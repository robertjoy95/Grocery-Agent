import uuid
from datetime import datetime

from pydantic import BaseModel


class IngredientCreate(BaseModel):
    name: str
    quantity: str | None = None
    unit: str | None = None
    category: str | None = None


class IngredientUpdate(BaseModel):
    name: str | None = None
    quantity: str | None = None
    unit: str | None = None
    category: str | None = None


class IngredientOut(BaseModel):
    id: uuid.UUID
    name: str
    quantity: str | None
    unit: str | None
    category: str | None
    added_at: datetime

    model_config = {"from_attributes": True}
