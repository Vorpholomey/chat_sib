"""Message reactions (global and private).

Revision ID: 003
Revises: 002
Create Date: 2026-04-04

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "global_message_reactions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("message_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("reaction_kind", sa.String(length=32), nullable=False),
        sa.ForeignKeyConstraint(["message_id"], ["global_messages.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("message_id", "user_id", "reaction_kind", name="uq_global_message_reaction"),
    )
    op.create_index(
        op.f("ix_global_message_reactions_message_id"),
        "global_message_reactions",
        ["message_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_global_message_reactions_user_id"),
        "global_message_reactions",
        ["user_id"],
        unique=False,
    )

    op.create_table(
        "private_message_reactions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("message_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("reaction_kind", sa.String(length=32), nullable=False),
        sa.ForeignKeyConstraint(["message_id"], ["private_messages.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("message_id", "user_id", "reaction_kind", name="uq_private_message_reaction"),
    )
    op.create_index(
        op.f("ix_private_message_reactions_message_id"),
        "private_message_reactions",
        ["message_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_private_message_reactions_user_id"),
        "private_message_reactions",
        ["user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_private_message_reactions_user_id"), table_name="private_message_reactions")
    op.drop_index(op.f("ix_private_message_reactions_message_id"), table_name="private_message_reactions")
    op.drop_table("private_message_reactions")
    op.drop_index(op.f("ix_global_message_reactions_user_id"), table_name="global_message_reactions")
    op.drop_index(op.f("ix_global_message_reactions_message_id"), table_name="global_message_reactions")
    op.drop_table("global_message_reactions")
