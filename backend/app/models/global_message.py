"""Global chat message model."""

import enum
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class MessageType(str, enum.Enum):
    text = "text"
    image = "image"
    gif = "gif"


class GlobalMessage(Base):
    __tablename__ = "global_messages"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    message_type: Mapped[MessageType] = mapped_column(
        Enum(MessageType),
        default=MessageType.text,
        nullable=False,
    )
    reply_to_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("global_messages.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    edited_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    user: Mapped["User"] = relationship("User", back_populates="global_messages")
    reply_to: Mapped[Optional["GlobalMessage"]] = relationship(
        "GlobalMessage",
        remote_side=[id],
        foreign_keys=[reply_to_id],
        back_populates="replies",
    )
    replies: Mapped[list["GlobalMessage"]] = relationship(
        "GlobalMessage",
        back_populates="reply_to",
        foreign_keys=[reply_to_id],
    )

    def __repr__(self) -> str:
        return f"<GlobalMessage(id={self.id}, user_id={self.user_id})>"
