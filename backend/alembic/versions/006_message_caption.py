"""Optional HTML caption for image/gif messages.

Revision ID: 006_message_caption
Revises: 005_read_state_tables
Create Date: 2026-04-17

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "006_message_caption"
down_revision: Union[str, None] = "005_read_state_tables"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "global_messages",
        sa.Column("caption", sa.Text(), nullable=True),
    )
    op.add_column(
        "private_messages",
        sa.Column("caption", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("private_messages", "caption")
    op.drop_column("global_messages", "caption")
