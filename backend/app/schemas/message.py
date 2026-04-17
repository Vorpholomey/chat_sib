"""Message Pydantic schemas. All created_at in UTC."""

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field

# Keys: thumbs_up | thumbs_down | heart | fire | joy → list of user ids
ReactionMap = dict[str, list[int]]

from app.models.global_message import MessageType


class GlobalMessageCreate(BaseModel):
    text: str = Field(..., min_length=1, max_length=65535)
    content_type: MessageType = MessageType.text
    reply_to_id: Optional[int] = None
    caption: Optional[str] = None


class GlobalMessageResponse(BaseModel):
    id: int
    user_id: int
    username: str
    text: str
    content_type: MessageType
    caption: Optional[str] = None
    created_at: datetime
    edited_at: Optional[datetime] = None
    reply_to_id: Optional[int] = None
    reply_to: Optional[dict[str, Any]] = None
    reactions: Optional[ReactionMap] = None

    model_config = {"from_attributes": True}


class GlobalMessageUpdate(BaseModel):
    text: str = Field(..., min_length=1, max_length=65535)
    content_type: MessageType = MessageType.text
    caption: Optional[str] = None


class PrivateMessageCreate(BaseModel):
    recipient_id: int = Field(..., ge=1)
    text: str = Field(..., min_length=1, max_length=65535)
    content_type: MessageType = MessageType.text
    reply_to_id: Optional[int] = None
    caption: Optional[str] = None


class PrivateMessageUpdate(BaseModel):
    text: str = Field(..., min_length=1, max_length=65535)
    content_type: MessageType = MessageType.text
    caption: Optional[str] = None


class PrivateMessageResponse(BaseModel):
    id: int
    sender_id: int
    recipient_id: int
    content: str
    message_type: MessageType
    caption: Optional[str] = None
    is_read: bool
    created_at: datetime
    edited_at: Optional[datetime] = None
    reply_to_id: Optional[int] = None
    reply_to: Optional[dict[str, Any]] = None
    reactions: Optional[ReactionMap] = None

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
