"""Message Pydantic schemas. All created_at in UTC."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.models.global_message import MessageType


class GlobalMessageCreate(BaseModel):
    text: str = Field(..., min_length=1, max_length=65535)
    content_type: MessageType = MessageType.text


class GlobalMessageResponse(BaseModel):
    id: int
    user_id: int
    username: str
    text: str
    content_type: MessageType
    created_at: datetime

    model_config = {"from_attributes": True}


class PrivateMessageCreate(BaseModel):
    text: str = Field(..., min_length=1, max_length=65535)
    content_type: MessageType = MessageType.text


class PrivateMessageResponse(BaseModel):
    id: int
    sender_id: int
    recipient_id: int
    content: str
    message_type: MessageType
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ConversationInterlocutor(BaseModel):
    id: int
    username: str


class ConversationItem(BaseModel):
    interlocutor: ConversationInterlocutor
    last_message: Optional[str] = None
    last_message_at: Optional[datetime] = None


class ConversationList(BaseModel):
    conversations: list[ConversationItem]
