import uuid

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.ingredient import HouseholdIngredient
from app.models.user import User
from app.schemas.ingredient import (
    IngredientCreate,
    IngredientUpdate,
    IngredientOut,
    IngredientPhotoScanResponse,
)
from app.services.auth import get_current_user
from app.services.ai import extract_ingredients_from_photo, _build_user_context

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


@router.post("/scan-photo", response_model=IngredientPhotoScanResponse)
async def scan_photo_for_ingredients(
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
        select(HouseholdIngredient.category)
        .where(HouseholdIngredient.user_id == user.id, HouseholdIngredient.category.is_not(None))
        .distinct()
    )
    user_categories = [
        category.strip()
        for category in category_rows.scalars().all()
        if isinstance(category, str) and category.strip()
    ]

    user_context = _build_user_context(user.display_name, user.dietary_preferences)

    try:
        parsed = await extract_ingredients_from_photo(
            image_bytes=image_bytes,
            image_mime_type=content_type,
            user_categories=user_categories,
            user_context=user_context,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Ingredient extraction from image failed: {exc}",
        ) from exc

    ingredients: list[IngredientCreate] = []
    for candidate in parsed:
        try:
            ingredients.append(IngredientCreate.model_validate(candidate))
        except Exception:
            continue

    return IngredientPhotoScanResponse(ingredients=ingredients)


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
