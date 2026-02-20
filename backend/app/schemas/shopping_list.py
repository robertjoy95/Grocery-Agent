import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class ShoppingListItem(BaseModel):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    name: str
    quantity: str | None = None
    unit: str | None = None
    category: str | None = None
    checked: bool = False


class ManualItemAddRequest(BaseModel):
    name: str
    quantity: str | None = None
    unit: str | None = None
    category: str | None = None


class ShoppingListItemUpdate(BaseModel):
    name: str | None = None
    quantity: str | None = None
    unit: str | None = None
    category: str | None = None
    checked: bool | None = None


class ShoppingListFinalizeRequest(BaseModel):
    ingredients: list[ShoppingListItem]


class ShoppingListOut(BaseModel):
    id: uuid.UUID
    items: list[ShoppingListItem]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ShoppingListFinalizeResponse(BaseModel):
    shopping_list: list[ShoppingListItem]
    excluded_as_in_pantry: list[str]


class FinishAndAddResponse(BaseModel):
    added_to_pantry: int
    cleared_items: int
    pantry_items: list[str]
