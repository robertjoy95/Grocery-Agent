import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status, UploadFile, File
from sqlalchemy import select, asc, desc, cast, String
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.chat import ChatSession
from app.models.recipe import Recipe
from app.models.user import User
from app.schemas.recipe import (
    RecipeCreate,
    RecipeUpdate,
    RecipeOut,
    RecipeConversationScanRequest,
    RecipeConversationScanResponse,
)
from app.services.auth import get_current_user
from app.services.ai import extract_recipes_from_transcript, extract_recipes_from_photo

router = APIRouter(prefix="/recipes", tags=["recipes"])

SORTABLE_FIELDS = {"name", "prep_time_minutes", "created_at", "source", "category", "favourite"}


@router.get("", response_model=list[RecipeOut])
async def list_recipes(
    sort_by: str = Query("created_at", description="Field to sort by"),
    order: Literal["asc", "desc"] = Query("desc"),
    ingredient: str | None = Query(None, description="Filter by ingredient name"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Recipe).where(Recipe.user_id == user.id)

    if ingredient:
        query = query.where(
            cast(Recipe.ingredients, String).ilike(f"%{ingredient}%")
        )

    if sort_by not in SORTABLE_FIELDS:
        sort_by = "created_at"

    col = getattr(Recipe, sort_by)
    query = query.order_by(desc(col) if order == "desc" else asc(col))

    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{recipe_id}", response_model=RecipeOut)
async def get_recipe(
    recipe_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Recipe).where(Recipe.id == recipe_id, Recipe.user_id == user.id)
    )
    recipe = result.scalar_one_or_none()
    if not recipe:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipe not found")
    return recipe


@router.post("", response_model=RecipeOut, status_code=status.HTTP_201_CREATED)
async def create_recipe(
    body: RecipeCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    recipe = Recipe(
        user_id=user.id,
        name=body.name,
        description=body.description,
        ingredients=[i.model_dump() for i in body.ingredients],
        prep_time_minutes=body.prep_time_minutes,
        instructions=body.instructions,
        source=body.source,
        favourite=body.favourite,
        category=body.category,
    )
    db.add(recipe)
    await db.commit()
    await db.refresh(recipe)
    return recipe


@router.post("/scan-conversation", response_model=RecipeConversationScanResponse)
async def scan_conversation_for_recipes(
    body: RecipeConversationScanRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ChatSession)
        .where(ChatSession.id == body.session_id, ChatSession.user_id == user.id)
        .options(selectinload(ChatSession.messages))
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    if not session.messages:
        return RecipeConversationScanResponse(recipes=[])

    transcript_lines = [
        f"{msg.role.upper()}: {msg.content.strip()}"
        for msg in session.messages
        if msg.content and msg.content.strip()
    ]
    transcript = "\n\n".join(transcript_lines)
    if not transcript:
        return RecipeConversationScanResponse(recipes=[])

    category_rows = await db.execute(
        select(Recipe.category)
        .where(Recipe.user_id == user.id, Recipe.category.is_not(None))
        .distinct()
    )
    user_categories = [
        category.strip()
        for category in category_rows.scalars().all()
        if isinstance(category, str) and category.strip()
    ]

    try:
        parsed = await extract_recipes_from_transcript(transcript, user_categories=user_categories)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Recipe extraction failed: {exc}",
        ) from exc

    recipes: list[RecipeCreate] = []
    for candidate in parsed:
        try:
            recipes.append(RecipeCreate.model_validate(candidate))
        except Exception:
            continue

    return RecipeConversationScanResponse(recipes=recipes)


@router.post("/scan-photo", response_model=RecipeConversationScanResponse)
async def scan_photo_for_recipes(
    photo: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    content_type = (photo.content_type or "").lower()
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file must be an image")

    image_bytes = await photo.read()
    if not image_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded image is empty")

    category_rows = await db.execute(
        select(Recipe.category)
        .where(Recipe.user_id == user.id, Recipe.category.is_not(None))
        .distinct()
    )
    user_categories = [
        category.strip()
        for category in category_rows.scalars().all()
        if isinstance(category, str) and category.strip()
    ]

    try:
        parsed = await extract_recipes_from_photo(
            image_bytes=image_bytes,
            image_mime_type=content_type,
            user_categories=user_categories,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Recipe extraction from image failed: {exc}",
        ) from exc

    recipes: list[RecipeCreate] = []
    for candidate in parsed:
        try:
            recipes.append(RecipeCreate.model_validate(candidate))
        except Exception:
            continue

    return RecipeConversationScanResponse(recipes=recipes)


@router.put("/{recipe_id}", response_model=RecipeOut)
async def update_recipe(
    recipe_id: uuid.UUID,
    body: RecipeUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Recipe).where(Recipe.id == recipe_id, Recipe.user_id == user.id)
    )
    recipe = result.scalar_one_or_none()
    if not recipe:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipe not found")

    update_data = body.model_dump(exclude_unset=True)
    if "ingredients" in update_data and update_data["ingredients"] is not None:
        update_data["ingredients"] = [i.model_dump() for i in body.ingredients]
    for key, value in update_data.items():
        setattr(recipe, key, value)

    await db.commit()
    await db.refresh(recipe)
    return recipe


@router.delete("/{recipe_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_recipe(
    recipe_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Recipe).where(Recipe.id == recipe_id, Recipe.user_id == user.id)
    )
    recipe = result.scalar_one_or_none()
    if not recipe:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipe not found")
    await db.delete(recipe)
    await db.commit()
