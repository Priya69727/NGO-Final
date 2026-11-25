"""Add persistent internal messaging, announcements and broadcast campaigns.

Revision ID: 0009_communication_center
Revises: 0008_community_privacy
"""
from alembic import op

revision = "0009_communication_center"
down_revision = "0008_community_privacy"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE communication_messages (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            sender_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            recipient_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            parent_id uuid REFERENCES communication_messages(id) ON DELETE SET NULL,
            subject varchar(160) NOT NULL,
            body text NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 5000),
            read_at timestamptz,
            created_at timestamptz NOT NULL DEFAULT now(),
            CHECK (sender_id <> recipient_id)
        );
        CREATE INDEX communication_messages_inbox_idx ON communication_messages(recipient_id, created_at DESC);
        CREATE INDEX communication_messages_sent_idx ON communication_messages(sender_id, created_at DESC);

        CREATE TABLE communication_announcements (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            title varchar(160) NOT NULL,
            body text NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 5000),
            audience text NOT NULL CHECK (audience IN ('All', 'Staff', 'Volunteers', 'Interns', 'Donors')),
            priority text NOT NULL DEFAULT 'Normal' CHECK (priority IN ('Normal', 'High')),
            created_by uuid REFERENCES users(id) ON DELETE SET NULL,
            published_at timestamptz NOT NULL DEFAULT now(),
            created_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE INDEX communication_announcements_date_idx ON communication_announcements(published_at DESC);

        CREATE TABLE communication_broadcasts (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            title varchar(160) NOT NULL,
            body text NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 5000),
            audience text NOT NULL CHECK (audience IN ('All', 'Staff', 'Volunteers', 'Interns', 'Donors')),
            channel text NOT NULL CHECK (channel IN ('Email', 'WhatsApp', 'SMS', 'Email + WhatsApp')),
            status text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Scheduled', 'Cancelled')),
            scheduled_at timestamptz,
            created_by uuid REFERENCES users(id) ON DELETE SET NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE INDEX communication_broadcasts_date_idx ON communication_broadcasts(scheduled_at DESC NULLS LAST);
    """)


def downgrade() -> None:
    op.execute("""
        DROP TABLE IF EXISTS communication_broadcasts;
        DROP TABLE IF EXISTS communication_announcements;
        DROP TABLE IF EXISTS communication_messages;
    """)
