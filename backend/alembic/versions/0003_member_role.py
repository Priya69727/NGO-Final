"""Add a least-privilege role for public registrations.

Revision ID: 0003_member_role
Revises: 0002_people_management
"""
from alembic import op

revision = "0003_member_role"
down_revision = "0002_people_management"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check")
    op.execute(
        """
        ALTER TABLE users
        ADD CONSTRAINT users_role_check
        CHECK (role IN ('Admin', 'Project Manager', 'Staff', 'Volunteer', 'Board', 'Member'))
        """
    )


def downgrade() -> None:
    op.execute("UPDATE users SET role = 'Volunteer' WHERE role = 'Member'")
    op.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check")
    op.execute(
        """
        ALTER TABLE users
        ADD CONSTRAINT users_role_check
        CHECK (role IN ('Admin', 'Project Manager', 'Staff', 'Volunteer', 'Board'))
        """
    )
