"""People tasks, public opportunities and cross-role calendar support.

Revision ID: 0006_people_workspace
Revises: 0005_volunteer_portal
"""
from alembic import op

revision = "0006_people_workspace"
down_revision = "0005_volunteer_portal"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE intern_profiles
            ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(id) ON DELETE SET NULL;

        ALTER TABLE intern_attendance DROP CONSTRAINT IF EXISTS intern_attendance_status_check;
        ALTER TABLE intern_attendance ADD CONSTRAINT intern_attendance_status_check
            CHECK (status IN ('Present', 'Absent', 'Half Day', 'Late', 'Leave', 'Holiday'));

        ALTER TABLE volunteer_attendance DROP CONSTRAINT IF EXISTS volunteer_attendance_status_check;
        ALTER TABLE volunteer_attendance ADD CONSTRAINT volunteer_attendance_status_check
            CHECK (status IN ('Present', 'Absent', 'Half Day', 'Late', 'Leave', 'Holiday'));

        CREATE TABLE IF NOT EXISTS people_opportunities (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            slug text NOT NULL UNIQUE,
            opportunity_type text NOT NULL CHECK (opportunity_type IN ('Job', 'Internship', 'Volunteer')),
            title text NOT NULL,
            description text NOT NULL,
            requirements text NOT NULL DEFAULT '',
            department_id text REFERENCES departments(id) ON DELETE SET NULL,
            location text NOT NULL DEFAULT '',
            employment_type text NOT NULL DEFAULT '',
            closes_on date,
            status text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Published', 'Closed')),
            created_by uuid REFERENCES users(id) ON DELETE SET NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
            published_at timestamptz
        );
        CREATE INDEX IF NOT EXISTS people_opportunities_status_deadline_idx
            ON people_opportunities(status, closes_on);

        ALTER TABLE hr_applicants
            ADD COLUMN IF NOT EXISTS opportunity_id uuid
                REFERENCES people_opportunities(id) ON DELETE SET NULL;
        ALTER TABLE intern_applications
            ADD COLUMN IF NOT EXISTS opportunity_id uuid
                REFERENCES people_opportunities(id) ON DELETE SET NULL;
        ALTER TABLE volunteer_applications
            ADD COLUMN IF NOT EXISTS opportunity_id uuid
                REFERENCES people_opportunities(id) ON DELETE SET NULL;

        CREATE TABLE IF NOT EXISTS people_tasks (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            title text NOT NULL,
            description text NOT NULL,
            assigned_by uuid REFERENCES users(id) ON DELETE SET NULL,
            staff_id uuid REFERENCES staff_profiles(id) ON DELETE RESTRICT,
            intern_id uuid REFERENCES intern_profiles(id) ON DELETE RESTRICT,
            volunteer_id uuid REFERENCES volunteer_profiles(id) ON DELETE RESTRICT,
            starts_on date NOT NULL,
            due_date date NOT NULL,
            priority text NOT NULL CHECK (priority IN ('Low', 'Medium', 'High', 'Critical')),
            status text NOT NULL DEFAULT 'Not Started'
                CHECK (status IN ('Not Started', 'In Progress', 'On Hold', 'Completed')),
            department_id text REFERENCES departments(id) ON DELETE SET NULL,
            project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
            CHECK (starts_on <= due_date),
            CHECK (num_nonnulls(staff_id, intern_id, volunteer_id) = 1)
        );
        CREATE INDEX IF NOT EXISTS people_tasks_due_idx ON people_tasks(due_date, status);
        CREATE INDEX IF NOT EXISTS people_tasks_staff_idx ON people_tasks(staff_id, starts_on);
        CREATE INDEX IF NOT EXISTS people_tasks_intern_idx ON people_tasks(intern_id, starts_on);
        CREATE INDEX IF NOT EXISTS people_tasks_volunteer_idx ON people_tasks(volunteer_id, starts_on);

        CREATE TABLE IF NOT EXISTS people_task_history (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            task_id uuid NOT NULL REFERENCES people_tasks(id) ON DELETE CASCADE,
            actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
            field_name text NOT NULL,
            old_value text,
            new_value text,
            created_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS people_task_history_task_idx
            ON people_task_history(task_id, created_at DESC);
        """
    )
    op.execute(
        """
        DROP TRIGGER IF EXISTS set_updated_at ON people_opportunities;
        CREATE TRIGGER set_updated_at BEFORE UPDATE ON people_opportunities
            FOR EACH ROW EXECUTE FUNCTION set_updated_at();
        DROP TRIGGER IF EXISTS set_updated_at ON people_tasks;
        CREATE TRIGGER set_updated_at BEFORE UPDATE ON people_tasks
            FOR EACH ROW EXECUTE FUNCTION set_updated_at();
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS people_task_history")
    op.execute("DROP TABLE IF EXISTS people_tasks")
    op.execute("ALTER TABLE volunteer_applications DROP COLUMN IF EXISTS opportunity_id")
    op.execute("ALTER TABLE intern_applications DROP COLUMN IF EXISTS opportunity_id")
    op.execute("ALTER TABLE hr_applicants DROP COLUMN IF EXISTS opportunity_id")
    op.execute("DROP TABLE IF EXISTS people_opportunities")
    op.execute("ALTER TABLE intern_profiles DROP COLUMN IF EXISTS user_id")
