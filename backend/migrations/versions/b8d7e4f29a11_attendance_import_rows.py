"""Persist attendance CSV results with unique per-user dates.

Revision ID: b8d7e4f29a11
Revises: a32f84c6d1e0
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "b8d7e4f29a11"
down_revision = "a32f84c6d1e0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "attendance_import_rows",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("status", sa.String(12), nullable=False),
        sa.Column("import_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("status IN ('Present','Absent','Late')", name="ck_attendance_import_status"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["import_id"], ["csv_imports.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "date", name="uq_attendance_import_user_date"),
    )


def downgrade() -> None:
    op.drop_table("attendance_import_rows")
