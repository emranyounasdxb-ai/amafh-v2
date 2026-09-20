"""One commission calculation per Case.

Revision ID: c9e2f50b71a4
Revises: b8d7e4f29a11
"""

from alembic import op

revision = "c9e2f50b71a4"
down_revision = "b8d7e4f29a11"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_unique_constraint("uq_commission_case", "commission_records", ["case_id"])


def downgrade() -> None:
    op.drop_constraint("uq_commission_case", "commission_records", type_="unique")
