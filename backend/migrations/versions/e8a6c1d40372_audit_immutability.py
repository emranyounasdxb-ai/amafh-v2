"""Reject updates and deletes of persisted audit records.

Revision ID: e8a6c1d40372
Revises: d7f8a4e260b3
"""

from alembic import op

revision = "e8a6c1d40372"
down_revision = "d7f8a4e260b3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE FUNCTION prevent_audit_change() RETURNS trigger AS $$
        BEGIN
            RAISE EXCEPTION 'Audit records are immutable';
        END;
        $$ LANGUAGE plpgsql
    """)
    op.execute("""
        CREATE TRIGGER audit_logs_immutable
        BEFORE UPDATE OR DELETE ON audit_logs
        FOR EACH ROW EXECUTE FUNCTION prevent_audit_change()
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER audit_logs_immutable ON audit_logs")
    op.execute("DROP FUNCTION prevent_audit_change()")
