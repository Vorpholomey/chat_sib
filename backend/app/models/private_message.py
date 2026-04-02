"""Private message model."""

from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.global_message import MessageType

if TYPE_CHECKING:
    from app.models.user import User


class PrivateMessage(Base):
    __tablename__ = "private_messages"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    sender_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    recipient_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    message_type: Mapped[MessageType] = mapped_column(
        Enum(MessageType),
        default=MessageType.text,
        nullable=False,
    )
    reply_to_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("private_messages.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    edited_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    sender: Mapped["User"] = relationship("User", back_populates="sent_private_messages", foreign_keys=[sender_id])
    recipient: Mapped["User"] = relationship("User", back_populates="received_private_messages", foreign_keys=[recipient_id])
    reply_to: Mapped[Optional["PrivateMessage"]] = relationship(
        "PrivateMessage",
        remote_side=[id],
        foreign_keys=[reply_to_id],
        back_populates="replies",
    )
    replies: Mapped[list["PrivateMessage"]] = relationship(
        "PrivateMessage",
        back_populates="reply_to",
        foreign_keys=[reply_to_id],
    )

    def __repr__(self) -> str:
        return f"<PrivateMessage(id={self.id}, sender_id={self.sender_id}, recipient_id={self.recipient_id})>"
