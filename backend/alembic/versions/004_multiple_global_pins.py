"""Multiple global pinned messages (MRU order via pinned_at).

Revision ID: 004_multiple_global_pins
Revises: 003_message_reactions
Create Date: 2026-04-05

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "004_multiple_global_pins"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "global_pinned_messages",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("message_id", sa.Integer(), nullable=False),
        sa.Column(
            "pinned_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["message_id"], ["global_messages.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("message_id", name="uq_global_pinned_messages_message_id"),
    )
    op.create_index(
        "ix_global_pinned_messages_pinned_at",
        "global_pinned_messages",
        ["pinned_at"],
        unique=False,
    )

    op.execute(
        """
        INSERT INTO global_pinned_messages (message_id, pinned_at)
        SELECT pinned_message_id, NOW()
        FROM chat_settings
        WHERE pinned_message_id IS NOT NULL
        """
    )

    op.drop_constraint(
        "chat_settings_pinned_message_id_fkey",
        "chat_settings",
        type_="foreignkey",
    )
    op.drop_column("chat_settings", "pinned_message_id")


def downgrade() -> None:
    op.add_column(
        "chat_settings",
        sa.Column("pinned_message_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "chat_settings_pinned_message_id_fkey",
        "chat_settings",
        "global_messages",
        ["pinned_message_id"],
        ["global_messages.id"],
        ondelete="SET NULL",
    )
    op.execute(
        """
        UPDATE chat_settings
        SET pinned_message_id = (
            SELECT message_id FROM global_pinned_messages
            ORDER BY pinned_at DESC
            LIMIT 1
        )
        WHERE id = 1
        """
    )
    op.drop_index("ix_global_pinned_messages_pinned_at", table_name="global_pinned_messages")
    op.drop_table("global_pinned_messages")
