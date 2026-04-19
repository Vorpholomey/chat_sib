"""Temporary password fields for forgot-password recovery.

Revision ID: 007_password_recovery
Revises: 006_message_caption
Create Date: 2026-04-18

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "007_password_recovery"
down_revision: Union[str, None] = "006_message_caption"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("temporary_password_hash", sa.String(length=256), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column(
            "is_using_temporary_password",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.add_column(
        "users",
        sa.Column("temporary_password_expires_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "temporary_password_expires_at")
    op.drop_column("users", "is_using_temporary_password")
    op.drop_column("users", "temporary_password_hash")
