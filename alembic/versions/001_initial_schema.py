"""Initial schema: users, global_messages, private_messages.

Revision ID: 001
Revises:
Create Date: 2025-03-15

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create enum if not exists (idempotent for partial runs)
    op.execute(
        "DO $$ BEGIN CREATE TYPE messagetype AS ENUM ('text', 'image', 'gif'); "
        "EXCEPTION WHEN duplicate_object THEN null; END $$;"
    )

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("username", sa.String(64), nullable=False),
        sa.Column("email", sa.String(256), nullable=False),
        sa.Column("hashed_password", sa.String(256), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_users_username", "users", ["username"], unique=True)

    # Use raw SQL for tables with enum to avoid SQLAlchemy emitting CREATE TYPE again
    op.execute("""
        CREATE TABLE global_messages (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            content TEXT NOT NULL,
            message_type messagetype NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
        )
    """)
    op.create_index("ix_global_messages_user_id", "global_messages", ["user_id"], unique=False)

    op.execute("""
        CREATE TABLE private_messages (
            id SERIAL PRIMARY KEY,
            sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            content TEXT NOT NULL,
            message_type messagetype NOT NULL,
            is_read BOOLEAN NOT NULL DEFAULT false,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
        )
    """)
    op.create_index("ix_private_messages_sender_id", "private_messages", ["sender_id"], unique=False)
    op.create_index("ix_private_messages_recipient_id", "private_messages", ["recipient_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_private_messages_recipient_id", table_name="private_messages")
    op.drop_index("ix_private_messages_sender_id", table_name="private_messages")
    op.drop_table("private_messages")
    op.drop_index("ix_global_messages_user_id", table_name="global_messages")
    op.drop_table("global_messages")
    op.drop_index("ix_users_username", table_name="users")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
    sa.Enum("text", "image", "gif", name="messagetype").drop(op.get_bind(), checkfirst=True)
