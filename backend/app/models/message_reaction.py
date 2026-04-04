"""Per-message emoji reactions (global and private), one row per (message, user, kind)."""

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class GlobalMessageReaction(Base):
    __tablename__ = "global_message_reactions"
    __table_args__ = (
        UniqueConstraint(
            "message_id",
            "user_id",
            "reaction_kind",
            name="uq_global_message_reaction",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    message_id: Mapped[int] = mapped_column(
        ForeignKey("global_messages.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    reaction_kind: Mapped[str] = mapped_column(String(32), nullable=False)


class PrivateMessageReaction(Base):
    __tablename__ = "private_message_reactions"
    __table_args__ = (
        UniqueConstraint(
            "message_id",
            "user_id",
            "reaction_kind",
            name="uq_private_message_reaction",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    message_id: Mapped[int] = mapped_column(
        ForeignKey("private_messages.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    reaction_kind: Mapped[str] = mapped_column(String(32), nullable=False)
