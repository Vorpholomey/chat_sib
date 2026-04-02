"""Role-based chat: user roles, public bans, replies, pin, audit log.

Revision ID: 002
Revises: 001
Create Date: 2025-03-25

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "DO $$ BEGIN CREATE TYPE userrole AS ENUM ('user', 'moderator', 'admin'); "
        "EXCEPTION WHEN duplicate_object THEN null; END $$;"
    )

    op.add_column(
        "users",
        sa.Column(
            "role",
            postgresql.ENUM("user", "moderator", "admin", name="userrole", create_type=False),
            server_default="user",
            nullable=False,
        ),
    )
    op.add_column("users", sa.Column("public_ban_until", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "users",
        sa.Column("public_ban_permanent", sa.Boolean(), server_default="false", nullable=False),
    )
    op.add_column("global_messages", sa.Column("reply_to_id", sa.Integer(), nullable=True))
    op.add_column("global_messages", sa.Column("edited_at", sa.DateTime(timezone=True), nullable=True))
    op.create_foreign_key(
        "fk_global_messages_reply_to_id",
        "global_messages",
        "global_messages",
        ["reply_to_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_global_messages_reply_to_id", "global_messages", ["reply_to_id"])

    op.add_column("private_messages", sa.Column("reply_to_id", sa.Integer(), nullable=True))
    op.add_column("private_messages", sa.Column("edited_at", sa.DateTime(timezone=True), nullable=True))
    op.create_foreign_key(
        "fk_private_messages_reply_to_id",
        "private_messages",
        "private_messages",
        ["reply_to_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_private_messages_reply_to_id", "private_messages", ["reply_to_id"])

    op.create_table(
        "chat_settings",
        sa.Column("id", sa.SmallInteger(), nullable=False),
        sa.Column("pinned_message_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["pinned_message_id"], ["global_messages.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint("id = 1", name="ck_chat_settings_singleton"),
    )
    op.execute("INSERT INTO chat_settings (id, pinned_message_id) VALUES (1, NULL)")

    op.create_table(
        "moderation_audit_log",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("actor_id", sa.Integer(), nullable=True),
        sa.Column("action", sa.String(64), nullable=False),
        sa.Column("target_type", sa.String(32), nullable=False),
        sa.Column("target_id", sa.Integer(), nullable=False),
        sa.Column("audit_metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["actor_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_moderation_audit_log_actor_id", "moderation_audit_log", ["actor_id"])
    op.create_index("ix_moderation_audit_log_action", "moderation_audit_log", ["action"])
    op.create_index("ix_moderation_audit_log_target_id", "moderation_audit_log", ["target_id"])


def downgrade() -> None:
    op.drop_index("ix_moderation_audit_log_target_id", table_name="moderation_audit_log")
    op.drop_index("ix_moderation_audit_log_action", table_name="moderation_audit_log")
    op.drop_index("ix_moderation_audit_log_actor_id", table_name="moderation_audit_log")
    op.drop_table("moderation_audit_log")

    op.drop_table("chat_settings")

    op.drop_index("ix_private_messages_reply_to_id", table_name="private_messages")
    op.drop_constraint("fk_private_messages_reply_to_id", "private_messages", type_="foreignkey")
    op.drop_column("private_messages", "edited_at")
    op.drop_column("private_messages", "reply_to_id")

    op.drop_index("ix_global_messages_reply_to_id", table_name="global_messages")
    op.drop_constraint("fk_global_messages_reply_to_id", "global_messages", type_="foreignkey")
    op.drop_column("global_messages", "edited_at")
    op.drop_column("global_messages", "reply_to_id")

    op.drop_column("users", "public_ban_permanent")
    op.drop_column("users", "public_ban_until")
    op.drop_column("users", "role")

    op.execute("DROP TYPE IF EXISTS userrole")
