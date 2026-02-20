from datetime import datetime
from typing import Any

from pydantic import BaseModel


class ProfileOut(BaseModel):
    username: str
    display_name: str | None = None
    dietary_preferences: dict[str, Any] | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ProfileUpdate(BaseModel):
    display_name: str | None = None
    dietary_preferences: dict[str, Any] | None = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str
