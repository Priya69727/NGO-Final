
"""Add recipient details, WhatsApp channel support and follow-ups.

Revision ID: 0010_communication_followups
Revises: 0009_communication_center
"""
from alembic import op

revision = "0010_communication_followups"
down_revision = "0009_communication_center"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE communications
            ADD COLUMN IF NOT EXISTS recipient_name text,
            ADD COLUMN IF NOT EXISTS recipient_email text,
            ADD COLUMN IF NOT EXISTS recipient_phone text;

        ALTER TABLE communications
            DROP CONSTRAINT IF EXISTS communications_channel_check;

        ALTER TABLE communications
            ADD CONSTRAINT communications_channel_check
            CHECK (
                channel IN (
                    'Email', 'Phone', 'SMS', 'WhatsApp', 'In Person', 'Other'
                )
            );

        CREATE TABLE IF NOT EXISTS communication_followups (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            title varchar(160) NOT NULL
                CHECK (length(trim(title)) BETWEEN 1 AND 160),
            description text NOT NULL DEFAULT '',
            related_type text NOT NULL
                CHECK (related_type IN ('Donor', 'Beneficiary', 'Project')),

            donor_id uuid REFERENCES donors(id) ON DELETE CASCADE,
            beneficiary_id uuid REFERENCES beneficiaries(id) ON DELETE CASCADE,
            project_id uuid REFERENCES projects(id) ON DELETE CASCADE,

            assigned_to uuid NOT NULL
                REFERENCES users(id) ON DELETE RESTRICT,
            created_by uuid
                REFERENCES users(id) ON DELETE SET NULL,

            due_date date NOT NULL,

            status text NOT NULL DEFAULT 'Pending'
                CHECK (status IN ('Pending', 'Completed', 'Cancelled')),

            completed_at timestamptz,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),

            CHECK (num_nonnulls(donor_id, beneficiary_id, project_id) = 1),

            CHECK (
                (related_type = 'Donor' AND donor_id IS NOT NULL)
                OR
                (related_type = 'Beneficiary' AND beneficiary_id IS NOT NULL)
                OR
                (related_type = 'Project' AND project_id IS NOT NULL)
            )
        );

        CREATE INDEX IF NOT EXISTS communication_followups_due_idx
            ON communication_followups(status, due_date);

        CREATE INDEX IF NOT EXISTS communication_followups_assignee_idx
            ON communication_followups(assigned_to, status, due_date);

        CREATE INDEX IF NOT EXISTS communications_related_created_idx
            ON communications(created_at DESC);
    """)


def downgrade() -> None:
    op.execute("""
        DROP TABLE IF EXISTS communication_followups;

        DROP INDEX IF EXISTS communications_related_created_idx;

        ALTER TABLE communications
            DROP COLUMN IF EXISTS recipient_name,
            DROP COLUMN IF EXISTS recipient_email,
            DROP COLUMN IF EXISTS recipient_phone;

        ALTER TABLE communications
            DROP CONSTRAINT IF EXISTS communications_channel_check;

        ALTER TABLE communications
            ADD CONSTRAINT communications_channel_check
            CHECK (
                channel IN ('Email', 'Phone', 'SMS', 'In Person', 'Other')
            );
    """)
