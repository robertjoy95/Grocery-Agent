import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.ingredient import HouseholdIngredient
from app.models.shopping_list import ShoppingList
from app.models.user import User
from app.schemas.shopping_list import (
    FinishAndAddResponse,
    ManualItemAddRequest,
    ShoppingListFinalizeRequest,
    ShoppingListFinalizeResponse,
    ShoppingListItem,
    ShoppingListItemUpdate,
    ShoppingListOut,
)
from app.services.auth import get_current_user
from app.services.shopping_list import finalize_shopping_items

router = APIRouter(prefix="/shopping-list", tags=["shopping-list"])


@router.get("", response_model=ShoppingListOut)
async def get_shopping_list(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    shopping_list = await _get_or_create_shopping_list(db, user.id)
    return _to_out(shopping_list)


@router.post("/items", response_model=ShoppingListOut)
async def add_shopping_list_item(
    body: ManualItemAddRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    shopping_list = await _get_or_create_shopping_list(db, user.id)
    item = ShoppingListItem(
        name=body.name.strip(),
        quantity=(body.quantity or "").strip() or None,
        unit=(body.unit or "").strip() or None,
        category=(body.category or "").strip() or None,
        checked=False,
    )
    shopping_list.items = [*shopping_list.items, item.model_dump(mode="json")]
    await db.commit()
    await db.refresh(shopping_list)
    return _to_out(shopping_list)


@router.patch("/items/{item_id}", response_model=ShoppingListOut)
async def update_shopping_list_item(
    item_id: uuid.UUID,
    body: ShoppingListItemUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    shopping_list = await _get_or_create_shopping_list(db, user.id)
    items = [ShoppingListItem.model_validate(item) for item in shopping_list.items]

    target = next((item for item in items if item.id == item_id), None)
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shopping list item not found")

    updates = body.model_dump(exclude_unset=True)
    for key, value in updates.items():
        if isinstance(value, str):
            value = value.strip() or None
        setattr(target, key, value)

    if not target.name or not target.name.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Item name cannot be empty")

    shopping_list.items = [item.model_dump(mode="json") for item in items]
    await db.commit()
    await db.refresh(shopping_list)
    return _to_out(shopping_list)


@router.delete("/items/{item_id}", response_model=ShoppingListOut)
async def remove_shopping_list_item(
    item_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    shopping_list = await _get_or_create_shopping_list(db, user.id)
    before = len(shopping_list.items)
    shopping_list.items = [
        item
        for item in shopping_list.items
        if str(item.get("id")) != str(item_id)
    ]
    if len(shopping_list.items) == before:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shopping list item not found")
    await db.commit()
    await db.refresh(shopping_list)
    return _to_out(shopping_list)


@router.post("/finalize", response_model=ShoppingListFinalizeResponse)
async def finalize_shopping_list(
    body: ShoppingListFinalizeRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    shopping_list = await _get_or_create_shopping_list(db, user.id)
    pantry_result = await db.execute(
        select(HouseholdIngredient).where(HouseholdIngredient.user_id == user.id)
    )
    pantry_items = pantry_result.scalars().all()

    finalized, excluded = finalize_shopping_items(
        existing_items=shopping_list.items,
        pantry_items=[{"name": item.name} for item in pantry_items],
        candidate_items=[item.model_dump(mode="json") for item in body.ingredients],
    )
    shopping_list.items = finalized
    await db.commit()

    return ShoppingListFinalizeResponse(
        shopping_list=[ShoppingListItem.model_validate(item) for item in finalized],
        excluded_as_in_pantry=excluded,
    )


@router.post("/finish", response_model=FinishAndAddResponse)
async def finish_and_add_to_pantry(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    shopping_list = await _get_or_create_shopping_list(db, user.id)
    items = [ShoppingListItem.model_validate(item) for item in shopping_list.items]
    checked_items = [item for item in items if item.checked]

    for item in checked_items:
        db.add(
            HouseholdIngredient(
                user_id=user.id,
                name=item.name,
                quantity=item.quantity,
                unit=item.unit,
                category=item.category,
            )
        )

    cleared_count = len(items)
    shopping_list.items = []
    await db.commit()

    return FinishAndAddResponse(
        added_to_pantry=len(checked_items),
        cleared_items=cleared_count,
        pantry_items=[item.name for item in checked_items],
    )


async def _get_or_create_shopping_list(db: AsyncSession, user_id: uuid.UUID) -> ShoppingList:
    result = await db.execute(select(ShoppingList).where(ShoppingList.user_id == user_id))
    shopping_list = result.scalar_one_or_none()
    if shopping_list:
        return shopping_list

    shopping_list = ShoppingList(user_id=user_id, items=[])
    db.add(shopping_list)
    await db.commit()
    await db.refresh(shopping_list)
    return shopping_list


def _to_out(shopping_list: ShoppingList) -> ShoppingListOut:
    return ShoppingListOut(
        id=shopping_list.id,
        items=[ShoppingListItem.model_validate(item) for item in shopping_list.items],
        created_at=shopping_list.created_at,
        updated_at=shopping_list.updated_at,
    )
