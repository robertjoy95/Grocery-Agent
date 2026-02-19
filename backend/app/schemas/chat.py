import uuid
from datetime import datetime

from pydantic import BaseModel


class ChatSendRequest(BaseModel):
    session_id: uuid.UUID | None = None
    message: str


class ChatMessageOut(BaseModel):
    id: uuid.UUID
    role: str
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatSessionOut(BaseModel):
    id: uuid.UUID
    title: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
