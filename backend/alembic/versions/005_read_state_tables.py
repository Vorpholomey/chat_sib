"""Global and private per-user last read message pointers.

Revision ID: 005_read_state_tables
Revises: 004_multiple_global_pins
Create Date: 2026-04-08

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "005_read_state_tables"
down_revision: Union[str, None] = "004_multiple_global_pins"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "global_read_states",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("last_read_message_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["last_read_message_id"], ["global_messages.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("user_id"),
    )
    op.create_index(
        "ix_global_read_states_last_read_message_id",
        "global_read_states",
        ["last_read_message_id"],
        unique=False,
    )

    op.create_table(
        "private_read_states",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("peer_id", sa.Integer(), nullable=False),
        sa.Column("last_read_message_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["peer_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["last_read_message_id"], ["private_messages.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("user_id", "peer_id"),
    )
    op.create_index(
        "ix_private_read_states_last_read_message_id",
        "private_read_states",
        ["last_read_message_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_private_read_states_last_read_message_id", table_name="private_read_states")
    op.drop_table("private_read_states")
    op.drop_index("ix_global_read_states_last_read_message_id", table_name="global_read_states")
    op.drop_table("global_read_states")
