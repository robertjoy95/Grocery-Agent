import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.ingredient import HouseholdIngredient
from app.models.user import User
from app.schemas.ingredient import IngredientCreate, IngredientUpdate, IngredientOut
from app.services.auth import get_current_user

router = APIRouter(prefix="/ingredients", tags=["ingredients"])


@router.get("", response_model=list[IngredientOut])
async def list_ingredients(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(HouseholdIngredient)
        .where(HouseholdIngredient.user_id == user.id)
        .order_by(HouseholdIngredient.name)
    )
    return result.scalars().all()


@router.post("", response_model=IngredientOut, status_code=status.HTTP_201_CREATED)
async def create_ingredient(
    body: IngredientCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = HouseholdIngredient(
        user_id=user.id,
        name=body.name,
        quantity=body.quantity,
        unit=body.unit,
        category=body.category,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


@router.put("/{item_id}", response_model=IngredientOut)
async def update_ingredient(
    item_id: uuid.UUID,
    body: IngredientUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(HouseholdIngredient).where(
            HouseholdIngredient.id == item_id,
            HouseholdIngredient.user_id == user.id,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")

    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(item, key, value)

    await db.commit()
    await db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_ingredient(
    item_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(HouseholdIngredient).where(
            HouseholdIngredient.id == item_id,
            HouseholdIngredient.user_id == user.id,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    await db.delete(item)
    await db.commit()
