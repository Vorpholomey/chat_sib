"""Add updated_at to read state tables with DB-side maintenance.

Revision ID: 008_read_state_updated_at
Revises: 007_password_recovery
Create Date: 2026-04-21

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "008_read_state_updated_at"
down_revision: Union[str, None] = "007_password_recovery"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "global_read_states",
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.add_column(
        "private_read_states",
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.execute(
        """
        CREATE OR REPLACE FUNCTION touch_read_states_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = now();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute(
        """
        CREATE TRIGGER trg_global_read_states_updated_at
        BEFORE UPDATE ON global_read_states
        FOR EACH ROW
        EXECUTE FUNCTION touch_read_states_updated_at();
        """
    )
    op.execute(
        """
        CREATE TRIGGER trg_private_read_states_updated_at
        BEFORE UPDATE ON private_read_states
        FOR EACH ROW
        EXECUTE FUNCTION touch_read_states_updated_at();
        """
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_private_read_states_updated_at ON private_read_states")
    op.execute("DROP TRIGGER IF EXISTS trg_global_read_states_updated_at ON global_read_states")
    op.execute("DROP FUNCTION IF EXISTS touch_read_states_updated_at()")
    op.drop_column("private_read_states", "updated_at")
    op.drop_column("global_read_states", "updated_at")
