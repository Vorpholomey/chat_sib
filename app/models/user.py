"""User model."""

from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.global_message import GlobalMessage
    from app.models.private_message import PrivateMessage


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(256), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(256), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    global_messages: Mapped[list["GlobalMessage"]] = relationship(
        "GlobalMessage",
        back_populates="user",
        foreign_keys="GlobalMessage.user_id",
    )
    sent_private_messages: Mapped[list["PrivateMessage"]] = relationship(
        "PrivateMessage",
        back_populates="sender",
        foreign_keys="PrivateMessage.sender_id",
    )
    received_private_messages: Mapped[list["PrivateMessage"]] = relationship(
        "PrivateMessage",
        back_populates="recipient",
        foreign_keys="PrivateMessage.recipient_id",
    )

    def __repr__(self) -> str:
        return f"<User(id={self.id}, username={self.username})>"
