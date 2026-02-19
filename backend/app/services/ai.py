import json
import uuid
from typing import AsyncGenerator

from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langchain.agents import AgentExecutor, create_openai_tools_agent
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.recipe import Recipe
from app.models.ingredient import HouseholdIngredient

SYSTEM_PROMPT = """You are a friendly grocery and meal-planning assistant. You help users:
- Plan meals for the week before they go grocery shopping
- Create shopping lists based on their meal plans
- Suggest recipes using ingredients they already have at home
- When they're at the grocery store, suggest recipes and shopping list additions based on ingredients they see

You have access to tools that let you save recipes and manage the user's household pantry.
When a user asks you to save a recipe, use the save_recipe tool with all the structured fields.
When a user tells you about ingredients they have or bought, use the pantry tools to track them.

Be concise and practical. Format recipes clearly with ingredients, prep time, and step-by-step instructions.
When suggesting a meal plan, organize it by day and include a consolidated shopping list at the end."""


def build_tools(db: AsyncSession, user_id: uuid.UUID):
    @tool
    async def save_recipe(
        name: str,
        description: str,
        ingredients: str,
        prep_time_minutes: int,
        instructions: str,
        source: str = "AI generated",
    ) -> str:
        """Save a recipe to the user's collection.

        Args:
            name: Recipe name
            description: Short description of the dish
            ingredients: JSON string of ingredient list, each item has name, quantity, unit
            prep_time_minutes: Estimated prep/cook time in minutes
            instructions: Step-by-step cooking instructions
            source: Where the recipe came from
        """
        try:
            parsed = json.loads(ingredients)
        except json.JSONDecodeError:
            parsed = [{"name": ingredients, "quantity": "", "unit": ""}]

        recipe = Recipe(
            user_id=user_id,
            name=name,
            description=description,
            ingredients=parsed,
            prep_time_minutes=prep_time_minutes,
            instructions=instructions,
            source=source,
        )
        db.add(recipe)
        await db.commit()
        return f"Recipe '{name}' saved successfully."

    @tool
    async def add_pantry_item(name: str, quantity: str = "", unit: str = "", category: str = "") -> str:
        """Add an ingredient to the user's household pantry.

        Args:
            name: Ingredient name
            quantity: Amount (e.g. "2", "500")
            unit: Unit of measure (e.g. "lbs", "g", "cups")
            category: Category like produce, dairy, meat, etc.
        """
        item = HouseholdIngredient(
            user_id=user_id, name=name, quantity=quantity, unit=unit, category=category
        )
        db.add(item)
        await db.commit()
        return f"Added '{name}' to pantry."

    @tool
    async def remove_pantry_item(name: str) -> str:
        """Remove an ingredient from the user's household pantry.

        Args:
            name: Ingredient name to remove
        """
        result = await db.execute(
            select(HouseholdIngredient).where(
                HouseholdIngredient.user_id == user_id,
                HouseholdIngredient.name.ilike(f"%{name}%"),
            )
        )
        items = result.scalars().all()
        if not items:
            return f"No pantry item matching '{name}' found."
        for item in items:
            await db.delete(item)
        await db.commit()
        return f"Removed {len(items)} item(s) matching '{name}' from pantry."

    @tool
    async def get_pantry() -> str:
        """Get all ingredients currently in the user's household pantry."""
        result = await db.execute(
            select(HouseholdIngredient).where(HouseholdIngredient.user_id == user_id)
        )
        items = result.scalars().all()
        if not items:
            return "Pantry is empty."
        lines = [f"- {i.name}: {i.quantity} {i.unit} ({i.category})" for i in items]
        return "Current pantry:\n" + "\n".join(lines)

    return [save_recipe, add_pantry_item, remove_pantry_item, get_pantry]


def build_agent(db: AsyncSession, user_id: uuid.UUID):
    llm = ChatOpenAI(
        model="gpt-4o",
        api_key=settings.openai_api_key,
        temperature=0.7,
        streaming=True,
    )
    tools = build_tools(db, user_id)
    prompt = ChatPromptTemplate.from_messages([
        ("system", SYSTEM_PROMPT),
        MessagesPlaceholder(variable_name="chat_history"),
        ("human", "{input}"),
        MessagesPlaceholder(variable_name="agent_scratchpad"),
    ])
    agent = create_openai_tools_agent(llm, tools, prompt)
    return AgentExecutor(agent=agent, tools=tools, verbose=False)


def db_messages_to_langchain(messages) -> list:
    lc_messages = []
    for msg in messages:
        if msg.role == "user":
            lc_messages.append(HumanMessage(content=msg.content))
        elif msg.role == "assistant":
            lc_messages.append(AIMessage(content=msg.content))
    return lc_messages


async def stream_agent_response(
    db: AsyncSession,
    user_id: uuid.UUID,
    chat_history: list,
    user_input: str,
) -> AsyncGenerator[str, None]:
    """Stream the agent response token by token via SSE."""
    executor = build_agent(db, user_id)

    async for event in executor.astream_events(
        {"input": user_input, "chat_history": chat_history},
        version="v2",
    ):
        kind = event["event"]
        if kind == "on_chat_model_stream":
            chunk = event["data"]["chunk"]
            if hasattr(chunk, "content") and chunk.content:
                yield f"data: {json.dumps({'token': chunk.content})}\n\n"

    yield f"data: {json.dumps({'done': True})}\n\n"
