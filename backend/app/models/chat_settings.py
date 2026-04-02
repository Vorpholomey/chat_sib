"""Singleton row for global chat settings (e.g. pinned message)."""

from typing import TYPE_CHECKING, Optional

from sqlalchemy import ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.global_message import GlobalMessage


class ChatSettings(Base):
    __tablename__ = "chat_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    pinned_message_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("global_messages.id", ondelete="SET NULL"),
        nullable=True,
    )

    pinned_message: Mapped[Optional["GlobalMessage"]] = relationship("GlobalMessage")
