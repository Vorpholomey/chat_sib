"""Per-user last read pointer for the global chat."""

from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.global_message import GlobalMessage


class GlobalReadState(Base):
    __tablename__ = "global_read_states"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    last_read_message_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("global_messages.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    # Null last_read_message_id means the user has not established a cursor yet (treat as new user).
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    user: Mapped["User"] = relationship("User", back_populates="global_read_state")
    last_read_message: Mapped[Optional["GlobalMessage"]] = relationship(
        "GlobalMessage",
        foreign_keys=[last_read_message_id],
    )
