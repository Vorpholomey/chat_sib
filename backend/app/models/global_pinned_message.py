"""Room-level pinned global messages (many, ordered by pin time MRU)."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.global_message import GlobalMessage


class GlobalPinnedMessage(Base):
    __tablename__ = "global_pinned_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    message_id: Mapped[int] = mapped_column(
        ForeignKey("global_messages.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    pinned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    message: Mapped["GlobalMessage"] = relationship("GlobalMessage", foreign_keys=[message_id])
