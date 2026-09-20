"""Preserve fractional expected stage hours.

Revision ID: a32f84c6d1e0
Revises: f1b30c0f3fe5
"""

from alembic import op
import sqlalchemy as sa

revision = "a32f84c6d1e0"
down_revision = "f1b30c0f3fe5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("product_stages", "expected_duration_hours", existing_type=sa.Integer(), type_=sa.Numeric(10, 2), existing_nullable=False)
    op.alter_column("cases", "stage_expected_duration_hours", existing_type=sa.Integer(), type_=sa.Numeric(10, 2), existing_nullable=True)
    op.alter_column("case_history", "expected_duration_hours", existing_type=sa.Integer(), type_=sa.Numeric(10, 2), existing_nullable=True)


def downgrade() -> None:
    op.alter_column("case_history", "expected_duration_hours", existing_type=sa.Numeric(10, 2), type_=sa.Integer(), existing_nullable=True)
    op.alter_column("cases", "stage_expected_duration_hours", existing_type=sa.Numeric(10, 2), type_=sa.Integer(), existing_nullable=True)
    op.alter_column("product_stages", "expected_duration_hours", existing_type=sa.Numeric(10, 2), type_=sa.Integer(), existing_nullable=False)
