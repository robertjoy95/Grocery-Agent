import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel


class IngredientItem(BaseModel):
    name: str
    quantity: str = ""
    unit: str = ""


class RecipeCreate(BaseModel):
    name: str
    description: str | None = None
    ingredients: list[IngredientItem]
    prep_time_minutes: int | None = None
    instructions: str | None = None
    source: str | None = None
    favourite: bool = False
    category: str | None = None


class RecipeConversationScanRequest(BaseModel):
    session_id: uuid.UUID


class RecipeConversationScanResponse(BaseModel):
    recipes: list[RecipeCreate]


class RecipeUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    ingredients: list[IngredientItem] | None = None
    prep_time_minutes: int | None = None
    instructions: str | None = None
    source: str | None = None
    favourite: bool | None = None
    category: str | None = None


class RecipeOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    ingredients: Any
    prep_time_minutes: int | None
    instructions: str | None
    source: str | None
    favourite: bool
    category: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
