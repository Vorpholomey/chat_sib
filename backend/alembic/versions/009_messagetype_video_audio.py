"""Add video/audio to messagetype enum.

Revision ID: 009_messagetype_video_audio
Revises: 008_read_state_updated_at
Create Date: 2026-04-29
"""

from typing import Sequence, Union

from alembic import op

revision: str = "009_messagetype_video_audio"
down_revision: Union[str, None] = "008_read_state_updated_at"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "DO $$ BEGIN ALTER TYPE messagetype ADD VALUE 'video'; "
        "EXCEPTION WHEN duplicate_object THEN null; END $$;"
    )
    op.execute(
        "DO $$ BEGIN ALTER TYPE messagetype ADD VALUE 'audio'; "
        "EXCEPTION WHEN duplicate_object THEN null; END $$;"
    )


def downgrade() -> None:
    # PostgreSQL does not support removing enum values without type recreation.
    pass
