"""Store employee KYC documents and bank details.

Revision ID: 0011_staff_kyc_bank_details
Revises: 0010_communication_followups
"""
from alembic import op

revision = "0011_staff_kyc_bank_details"
down_revision = "0010_communication_followups"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE staff_profiles
            ADD COLUMN IF NOT EXISTS aadhaar_card_url text,
            ADD COLUMN IF NOT EXISTS pan_card_url text,
            ADD COLUMN IF NOT EXISTS resume_url text,
            ADD COLUMN IF NOT EXISTS other_documents jsonb NOT NULL DEFAULT '[]'::jsonb,
            ADD COLUMN IF NOT EXISTS bank_account_holder_name text,
            ADD COLUMN IF NOT EXISTS bank_account_number text,
            ADD COLUMN IF NOT EXISTS ifsc_code text,
            ADD COLUMN IF NOT EXISTS bank_name text,
            ADD COLUMN IF NOT EXISTS branch_details text;
    """)


def downgrade() -> None:
    op.execute("""
        ALTER TABLE staff_profiles
            DROP COLUMN IF EXISTS aadhaar_card_url,
            DROP COLUMN IF EXISTS pan_card_url,
            DROP COLUMN IF EXISTS resume_url,
            DROP COLUMN IF EXISTS other_documents,
            DROP COLUMN IF EXISTS bank_account_holder_name,
            DROP COLUMN IF EXISTS bank_account_number,
            DROP COLUMN IF EXISTS ifsc_code,
            DROP COLUMN IF EXISTS bank_name,
            DROP COLUMN IF EXISTS branch_details;
    """)
