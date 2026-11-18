"""Add profile visibility preferences for volunteer networking.

Revision ID: 0008_community_privacy
Revises: 0007_community
"""
from alembic import op

revision = "0008_community_privacy"
down_revision = "0007_community"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE volunteer_profiles
            ADD COLUMN IF NOT EXISTS community_visible boolean NOT NULL DEFAULT true
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE volunteer_profiles
            DROP COLUMN IF EXISTS community_visible
        """
    )
