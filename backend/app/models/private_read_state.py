"""Per-user last read pointer for a private conversation (peer = other user)."""

from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.private_message import PrivateMessage


class PrivateReadState(Base):
    __tablename__ = "private_read_states"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    peer_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    last_read_message_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("private_messages.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    # Null last_read_message_id means the user has not established a cursor yet (treat as new user).
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    user: Mapped["User"] = relationship(
        "User",
        foreign_keys=[user_id],
        back_populates="private_read_states",
    )
    peer: Mapped["User"] = relationship(
        "User",
        foreign_keys=[peer_id],
    )
    last_read_message: Mapped[Optional["PrivateMessage"]] = relationship(
        "PrivateMessage",
        foreign_keys=[last_read_message_id],
    )
