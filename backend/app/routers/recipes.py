import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, asc, desc, cast, String
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.recipe import Recipe
from app.models.user import User
from app.schemas.recipe import RecipeCreate, RecipeUpdate, RecipeOut
from app.services.auth import get_current_user

router = APIRouter(prefix="/recipes", tags=["recipes"])

SORTABLE_FIELDS = {"name", "prep_time_minutes", "created_at", "source"}


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
    )
    db.add(recipe)
    await db.commit()
    await db.refresh(recipe)
    return recipe


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
