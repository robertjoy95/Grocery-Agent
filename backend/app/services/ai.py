import base64
import json
import uuid
from typing import Any, AsyncGenerator

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

RECIPE_EXTRACTION_PROMPT = """Extract recipes from this conversation transcript.

Return JSON only in this shape:
{
  "recipes": [
    {
      "name": "string",
      "description": "string or null",
      "ingredients": [{"name": "string", "quantity": "string", "unit": "string"}],
      "prep_time_minutes": "integer or null",
      "instructions": "string or null",
      "source": "string or null",
      "favourite": "boolean",
      "category": "string or null"
    }
  ]
}

Rules:
- Include only actual recipes present in the conversation.
- Do not invent missing details. Use null or empty strings where needed.
- Ensure each recipe has at least a non-empty name and one ingredient.
- The "ingredients" field must always be an array.
"""

RECIPE_IMAGE_EXTRACTION_PROMPT = """Extract recipe text from this photo and return structured JSON.

Return JSON only in this shape:
{
  "recipes": [
    {
      "name": "string",
      "description": "string or null",
      "ingredients": [{"name": "string", "quantity": "string", "unit": "string"}],
      "prep_time_minutes": "integer or null",
      "instructions": "string or null",
      "source": "string or null",
      "favourite": "boolean",
      "category": "string or null"
    }
  ]
}

Rules:
- Parse only recipes visible/readable in the image.
- Do not invent missing details. Use null or empty strings where needed.
- Ensure each recipe has at least a non-empty name and one ingredient.
- If the image has no usable recipe content, return {"recipes": []}.
- The "ingredients" field must always be an array.
"""

INGREDIENT_IMAGE_EXTRACTION_PROMPT = """Extract pantry ingredients from this photo and return structured JSON.

Return JSON only in this shape:
{
  "ingredients": [
    {
      "name": "string",
      "quantity": "string or empty string",
      "unit": "string or empty string",
      "category": "string or null"
    }
  ]
}

Rules:
- Parse only ingredient items visible/readable in the image (labels, lists, grocery receipts, pantry shelves).
- Do not invent missing details. Use empty strings for unknown quantity/unit and null for unknown category.
- Skip entries with empty names.
- Normalize obvious OCR noise where possible (for example, fix common misspellings if confidence is high).
- If the image has no usable ingredient content, return {"ingredients": []}.
"""


def build_tools(db: AsyncSession, user_id: uuid.UUID):
    @tool
    async def save_recipe(
        name: str,
        description: str,
        ingredients: str,
        prep_time_minutes: int,
        instructions: str,
        source: str = "AI generated",
        favourite: bool = False,
        category: str = "",
    ) -> str:
        """Save a recipe to the user's collection.

        Args:
            name: Recipe name
            description: Short description of the dish
            ingredients: JSON string of ingredient list, each item has name, quantity, unit
            prep_time_minutes: Estimated prep/cook time in minutes
            instructions: Step-by-step cooking instructions
            source: Where the recipe came from
            favourite: Whether recipe should be starred as favorite
            category: Recipe category like dinner, breakfast, dessert
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
            favourite=favourite,
            category=category or None,
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


async def extract_recipes_from_transcript(
    transcript: str,
    user_categories: list[str] | None = None,
) -> list[dict[str, Any]]:
    """Parse recipe objects from a chat transcript using the LLM."""
    llm = ChatOpenAI(
        model="gpt-4o",
        api_key=settings.openai_api_key,
        temperature=0,
        streaming=False,
    )
    categories = sorted(
        {
            category.strip()
            for category in (user_categories or [])
            if isinstance(category, str) and category.strip()
        }
    )
    category_block = (
        "User categories:\n"
        + "\n".join(f"- {category}" for category in categories)
        + "\nUse one of these categories when it fits. If none fit, return null for category."
        if categories
        else "User categories:\n- (none)\nIf no category is clear, return null for category."
    )
    prompt = (
        f"{RECIPE_EXTRACTION_PROMPT}\n\n"
        f"{category_block}\n\n"
        f"Conversation transcript:\n{transcript}"
    )
    response = await llm.ainvoke([SystemMessage(content=prompt)])
    content = (response.content or "").strip()

    # Models sometimes wrap JSON in code fences; strip those safely.
    if content.startswith("```"):
        lines = content.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        content = "\n".join(lines).strip()
        if content.lower().startswith("json"):
            content = content[4:].strip()

    data = json.loads(content)
    recipes = data.get("recipes", [])
    if not isinstance(recipes, list):
        return []
    return recipes


async def extract_recipes_from_photo(
    image_bytes: bytes,
    image_mime_type: str,
    user_categories: list[str] | None = None,
) -> list[dict[str, Any]]:
    """Parse recipe objects from a recipe photo using the multimodal model."""
    llm = ChatOpenAI(
        model="gpt-4o",
        api_key=settings.openai_api_key,
        temperature=0,
        streaming=False,
    )
    categories = sorted(
        {
            category.strip()
            for category in (user_categories or [])
            if isinstance(category, str) and category.strip()
        }
    )
    category_block = (
        "User categories:\n"
        + "\n".join(f"- {category}" for category in categories)
        + "\nUse one of these categories when it fits. If none fit, return null for category."
        if categories
        else "User categories:\n- (none)\nIf no category is clear, return null for category."
    )
    image_base64 = base64.b64encode(image_bytes).decode("utf-8")
    prompt = f"{RECIPE_IMAGE_EXTRACTION_PROMPT}\n\n{category_block}"
    response = await llm.ainvoke(
        [
            HumanMessage(
                content=[
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:{image_mime_type};base64,{image_base64}"},
                    },
                ]
            )
        ]
    )
    content = (response.content or "").strip()
    if content.startswith("```"):
        lines = content.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        content = "\n".join(lines).strip()
        if content.lower().startswith("json"):
            content = content[4:].strip()

    data = json.loads(content)
    recipes = data.get("recipes", [])
    if not isinstance(recipes, list):
        return []
    return recipes


async def extract_ingredients_from_photo(
    image_bytes: bytes,
    image_mime_type: str,
    user_categories: list[str] | None = None,
) -> list[dict[str, Any]]:
    """Parse pantry ingredient objects from a photo using the multimodal model."""
    llm = ChatOpenAI(
        model="gpt-4o",
        api_key=settings.openai_api_key,
        temperature=0,
        streaming=False,
    )
    categories = sorted(
        {
            category.strip()
            for category in (user_categories or [])
            if isinstance(category, str) and category.strip()
        }
    )
    category_block = (
        "User categories:\n"
        + "\n".join(f"- {category}" for category in categories)
        + "\nUse one of these categories when it fits. If none fit, return null for category."
        if categories
        else "User categories:\n- (none)\nIf no category is clear, return null for category."
    )
    image_base64 = base64.b64encode(image_bytes).decode("utf-8")
    prompt = f"{INGREDIENT_IMAGE_EXTRACTION_PROMPT}\n\n{category_block}"
    response = await llm.ainvoke(
        [
            HumanMessage(
                content=[
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:{image_mime_type};base64,{image_base64}"},
                    },
                ]
            )
        ]
    )
    content = (response.content or "").strip()
    if content.startswith("```"):
        lines = content.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        content = "\n".join(lines).strip()
        if content.lower().startswith("json"):
            content = content[4:].strip()

    data = json.loads(content)
    ingredients = data.get("ingredients", [])
    if not isinstance(ingredients, list):
        return []
    return ingredients
