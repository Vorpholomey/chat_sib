"""User model."""

from __future__ import annotations

import enum
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, DateTime, Enum, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.global_message import GlobalMessage
    from app.models.private_message import PrivateMessage


class UserRole(str, enum.Enum):
    user = "user"
    moderator = "moderator"
    admin = "admin"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(256), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(256), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="userrole", native_enum=True),
        default=UserRole.user,
        nullable=False,
        server_default="user",
    )
    public_ban_until: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    public_ban_permanent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, server_default="false")
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
