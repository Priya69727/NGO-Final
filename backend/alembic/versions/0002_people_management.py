"""Create and complete People Management data tables.

Revision ID: 0002_people_management
Revises: 0001_user_sessions
"""
from alembic import op

revision = "0002_people_management"
down_revision = "0001_user_sessions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    statements = """
        ALTER TABLE departments
            ADD COLUMN IF NOT EXISTS code text,
            ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';

        ALTER TABLE staff_profiles
            ALTER COLUMN user_id DROP NOT NULL,
            ADD COLUMN IF NOT EXISTS full_name text NOT NULL DEFAULT '',
            ADD COLUMN IF NOT EXISTS email text,
            ADD COLUMN IF NOT EXISTS phone text,
            ADD COLUMN IF NOT EXISTS gender text,
            ADD COLUMN IF NOT EXISTS date_of_birth date,
            ADD COLUMN IF NOT EXISTS address text NOT NULL DEFAULT '',
            ADD COLUMN IF NOT EXISTS emergency_contact text NOT NULL DEFAULT '',
            ADD COLUMN IF NOT EXISTS qualifications jsonb NOT NULL DEFAULT '[]'::jsonb;

        UPDATE staff_profiles AS staff
        SET full_name = COALESCE(NULLIF(staff.full_name, ''), users.full_name),
            email = COALESCE(NULLIF(staff.email, ''), users.email),
            phone = COALESCE(NULLIF(staff.phone, ''), users.phone)
        FROM users
        WHERE staff.user_id = users.id;

        CREATE TABLE IF NOT EXISTS hr_requirements (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            title text NOT NULL,
            department_id text REFERENCES departments(id) ON DELETE SET NULL,
            urgency text NOT NULL DEFAULT 'Medium'
                CHECK (urgency IN ('Low', 'Medium', 'High', 'Critical')),
            openings integer NOT NULL DEFAULT 1 CHECK (openings > 0),
            status text NOT NULL DEFAULT 'Draft'
                CHECK (status IN ('Draft', 'Pending Approval', 'Approved', 'In Progress', 'Open', 'Shortlisting', 'On Hold', 'Fulfilled', 'Filled', 'Rejected', 'Cancelled')),
            description text NOT NULL DEFAULT '',
            required_skills text NOT NULL DEFAULT '',
            opened_on date NOT NULL DEFAULT CURRENT_DATE,
            closes_on date,
            experience_years numeric(4, 1) NOT NULL DEFAULT 0 CHECK (experience_years >= 0),
            qualification text NOT NULL DEFAULT '',
            designation text NOT NULL DEFAULT '',
            assigned_hr_id uuid REFERENCES users(id) ON DELETE SET NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
            CHECK (closes_on IS NULL OR closes_on >= opened_on)
        );

        CREATE TABLE IF NOT EXISTS hr_applicants (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            requirement_id uuid REFERENCES hr_requirements(id) ON DELETE SET NULL,
            full_name text NOT NULL,
            email text NOT NULL,
            phone text NOT NULL DEFAULT '',
            qualification text NOT NULL DEFAULT '',
            experience_years numeric(4, 1) NOT NULL DEFAULT 0 CHECK (experience_years >= 0),
            skills text[] NOT NULL DEFAULT '{}',
            resume_url text,
            status text NOT NULL DEFAULT 'Applied'
                CHECK (status IN ('Applied', 'Under Review', 'Shortlisted', 'Interview Scheduled', 'Selected', 'Rejected', 'Hired')),
            interview_date timestamptz,
            interview_notes text NOT NULL DEFAULT '',
            rating numeric(3, 1) CHECK (rating IS NULL OR rating BETWEEN 0 AND 5),
            notes text NOT NULL DEFAULT '',
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS hr_applicants_requirement_idx ON hr_applicants(requirement_id);
        CREATE INDEX IF NOT EXISTS hr_applicants_status_idx ON hr_applicants(status);

        CREATE TABLE IF NOT EXISTS staff_leave_applications (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            staff_id uuid NOT NULL REFERENCES staff_profiles(id) ON DELETE RESTRICT,
            leave_type text NOT NULL,
            starts_on date NOT NULL,
            ends_on date NOT NULL,
            reason text NOT NULL,
            status text NOT NULL DEFAULT 'Pending'
                CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Cancelled')),
            reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
            reviewed_at timestamptz,
            decision_notes text NOT NULL DEFAULT '',
            days_count numeric(4, 1) NOT NULL DEFAULT 1 CHECK (days_count > 0),
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
            CHECK (ends_on >= starts_on)
        );

        CREATE TABLE IF NOT EXISTS staff_performance_reviews (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            staff_id uuid NOT NULL REFERENCES staff_profiles(id) ON DELETE RESTRICT,
            reviewer_id uuid REFERENCES users(id) ON DELETE SET NULL,
            reviewed_on date NOT NULL DEFAULT CURRENT_DATE,
            rating numeric(3, 1) NOT NULL CHECK (rating BETWEEN 0 AND 5),
            scores jsonb NOT NULL DEFAULT '{}'::jsonb,
            feedback text NOT NULL DEFAULT '',
            review_period text NOT NULL DEFAULT 'Annual',
            strengths text NOT NULL DEFAULT '',
            improvement_areas text NOT NULL DEFAULT '',
            created_at timestamptz NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS staff_payroll (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            staff_id uuid NOT NULL REFERENCES staff_profiles(id) ON DELETE RESTRICT,
            payroll_period text NOT NULL,
            basic_salary numeric(14, 2) NOT NULL DEFAULT 0 CHECK (basic_salary >= 0),
            allowances numeric(14, 2) NOT NULL DEFAULT 0 CHECK (allowances >= 0),
            deductions numeric(14, 2) NOT NULL DEFAULT 0 CHECK (deductions >= 0),
            net_salary numeric(14, 2) NOT NULL DEFAULT 0 CHECK (net_salary >= 0),
            payment_status text NOT NULL DEFAULT 'Pending'
                CHECK (payment_status IN ('Pending', 'Processing', 'Paid', 'On Hold')),
            payment_date date,
            payment_method text NOT NULL DEFAULT 'Bank Transfer',
            transaction_reference text,
            notes text NOT NULL DEFAULT '',
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
            UNIQUE (staff_id, payroll_period)
        );
        CREATE INDEX IF NOT EXISTS staff_payroll_staff_period_idx ON staff_payroll(staff_id, payroll_period);

        ALTER TABLE staff_attendance DROP CONSTRAINT IF EXISTS staff_attendance_status_check;
        ALTER TABLE staff_attendance
            ADD CONSTRAINT staff_attendance_status_check
            CHECK (status IN ('Present', 'Absent', 'Half Day', 'Late', 'Leave', 'Holiday'));

        ALTER TABLE intern_applications
            ADD COLUMN IF NOT EXISTS college text NOT NULL DEFAULT '',
            ADD COLUMN IF NOT EXISTS degree text NOT NULL DEFAULT '',
            ADD COLUMN IF NOT EXISTS graduation_year integer,
            ADD COLUMN IF NOT EXISTS cgpa numeric(4, 2) CHECK (cgpa IS NULL OR cgpa BETWEEN 0 AND 10),
            ADD COLUMN IF NOT EXISTS skills text[] NOT NULL DEFAULT '{}',
            ADD COLUMN IF NOT EXISTS resume_url text,
            ADD COLUMN IF NOT EXISTS preferred_department_id text REFERENCES departments(id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS duration_weeks integer NOT NULL DEFAULT 8 CHECK (duration_weeks > 0),
            ADD COLUMN IF NOT EXISTS reviewer_remarks text NOT NULL DEFAULT '';
        ALTER TABLE intern_applications DROP CONSTRAINT IF EXISTS intern_applications_status_check;
        ALTER TABLE intern_applications
            ADD CONSTRAINT intern_applications_status_check
            CHECK (status IN ('New', 'Applied', 'Under Review', 'Shortlisted', 'Selected', 'Accepted', 'Rejected', 'Withdrawn', 'Completed'));
        CREATE INDEX IF NOT EXISTS intern_applications_email_idx ON intern_applications(lower(email));

        CREATE TABLE IF NOT EXISTS intern_application_history (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            application_id uuid NOT NULL REFERENCES intern_applications(id) ON DELETE RESTRICT,
            event text NOT NULL,
            occurred_at timestamptz NOT NULL DEFAULT now(),
            created_at timestamptz NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS intern_profiles (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            application_id uuid NOT NULL UNIQUE REFERENCES intern_applications(id) ON DELETE RESTRICT,
            intern_code text NOT NULL UNIQUE,
            mentor_staff_id uuid REFERENCES staff_profiles(id) ON DELETE SET NULL,
            starts_on date,
            ends_on date,
            status text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Completed', 'On Hold')),
            project_name text NOT NULL DEFAULT '',
            progress smallint NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
            attendance_percent numeric(5, 2) NOT NULL DEFAULT 0 CHECK (attendance_percent BETWEEN 0 AND 100),
            final_feedback text NOT NULL DEFAULT '',
            certificate_status text NOT NULL DEFAULT 'Pending'
                CHECK (certificate_status IN ('Pending', 'Generated', 'Issued', 'Not Eligible')),
            full_name text NOT NULL DEFAULT '',
            email text NOT NULL DEFAULT '',
            phone text NOT NULL DEFAULT '',
            college text NOT NULL DEFAULT '',
            department_id text REFERENCES departments(id) ON DELETE SET NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
            CHECK (ends_on IS NULL OR starts_on IS NULL OR ends_on >= starts_on)
        );

        CREATE TABLE IF NOT EXISTS intern_tasks (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            intern_id uuid NOT NULL REFERENCES intern_profiles(id) ON DELETE RESTRICT,
            title text NOT NULL,
            project_name text NOT NULL DEFAULT '',
            status text NOT NULL DEFAULT 'Not Started'
                CHECK (status IN ('Not Started', 'To Do', 'In Progress', 'Under Review', 'Completed', 'Done', 'On Hold')),
            due_date date,
            priority text NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Critical')),
            description text NOT NULL DEFAULT '',
            progress smallint NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
            mentor_feedback text NOT NULL DEFAULT '',
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS intern_tasks_intern_idx ON intern_tasks(intern_id);

        CREATE TABLE IF NOT EXISTS intern_attendance (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            intern_id uuid NOT NULL REFERENCES intern_profiles(id) ON DELETE RESTRICT,
            attendance_date date NOT NULL,
            status text NOT NULL CHECK (status IN ('Present', 'Late', 'Absent')),
            note text NOT NULL DEFAULT '',
            created_at timestamptz NOT NULL DEFAULT now(),
            UNIQUE (intern_id, attendance_date)
        );

        CREATE TABLE IF NOT EXISTS intern_feedback (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            intern_id uuid NOT NULL REFERENCES intern_profiles(id) ON DELETE RESTRICT,
            feedback_date date NOT NULL DEFAULT CURRENT_DATE,
            rating numeric(3, 1) CHECK (rating IS NULL OR rating BETWEEN 0 AND 5),
            scores jsonb NOT NULL DEFAULT '{}'::jsonb,
            feedback text NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS intern_certificates (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            intern_id uuid NOT NULL UNIQUE REFERENCES intern_profiles(id) ON DELETE RESTRICT,
            certificate_number text NOT NULL UNIQUE,
            issued_on date NOT NULL DEFAULT CURRENT_DATE,
            file_url text,
            final_evaluation text NOT NULL DEFAULT '',
            created_at timestamptz NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS volunteer_applications (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            full_name text NOT NULL,
            email text NOT NULL,
            phone text NOT NULL DEFAULT '',
            skills text[] NOT NULL DEFAULT '{}',
            motivation text NOT NULL DEFAULT '',
            status text NOT NULL DEFAULT 'Applied'
                CHECK (status IN ('New', 'Applied', 'Under Review', 'Approved', 'Rejected')),
            applied_on date NOT NULL DEFAULT CURRENT_DATE,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS volunteer_applications_email_idx ON volunteer_applications(lower(email));

        ALTER TABLE volunteer_profiles
            ADD COLUMN IF NOT EXISTS city text NOT NULL DEFAULT '',
            ADD COLUMN IF NOT EXISTS age integer CHECK (age IS NULL OR age BETWEEN 0 AND 130),
            ADD COLUMN IF NOT EXISTS application_id uuid REFERENCES volunteer_applications(id) ON DELETE SET NULL;
        ALTER TABLE volunteer_profiles DROP CONSTRAINT IF EXISTS volunteer_profiles_status_check;
        ALTER TABLE volunteer_profiles
            ADD CONSTRAINT volunteer_profiles_status_check
            CHECK (status IN ('Applicant', 'Applied', 'Under Review', 'Approved', 'Active', 'Inactive', 'Rejected'));
        ALTER TABLE volunteer_assignments
            ALTER COLUMN project_id DROP NOT NULL,
            ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES events(id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS assignment_kind text NOT NULL DEFAULT 'Project'
                CHECK (assignment_kind IN ('Project', 'Event', 'Activity')),
            ADD COLUMN IF NOT EXISTS target_label text NOT NULL DEFAULT '',
            ADD COLUMN IF NOT EXISTS responsibilities text NOT NULL DEFAULT '';

        CREATE TABLE IF NOT EXISTS volunteer_attendance (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            volunteer_id uuid NOT NULL REFERENCES volunteer_profiles(id) ON DELETE RESTRICT,
            assignment_id uuid REFERENCES volunteer_assignments(id) ON DELETE SET NULL,
            attendance_date date NOT NULL,
            status text NOT NULL CHECK (status IN ('Present', 'Absent', 'Late')),
            hours numeric(6, 2) NOT NULL DEFAULT 0 CHECK (hours >= 0),
            assignment_kind text NOT NULL DEFAULT 'Event' CHECK (assignment_kind IN ('Project', 'Event', 'Activity')),
            target_label text NOT NULL DEFAULT '',
            notes text NOT NULL DEFAULT '',
            created_at timestamptz NOT NULL DEFAULT now(),
            UNIQUE (volunteer_id, assignment_id, attendance_date)
        );

        CREATE TABLE IF NOT EXISTS volunteer_feedback (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            volunteer_id uuid NOT NULL REFERENCES volunteer_profiles(id) ON DELETE RESTRICT,
            reviewer_id uuid REFERENCES users(id) ON DELETE SET NULL,
            reviewed_on date NOT NULL DEFAULT CURRENT_DATE,
            rating numeric(3, 1) CHECK (rating IS NULL OR rating BETWEEN 0 AND 5),
            scores jsonb NOT NULL DEFAULT '{}'::jsonb,
            feedback text NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now()
        );

        CREATE UNIQUE INDEX IF NOT EXISTS volunteer_attendance_unassigned_day_idx
            ON volunteer_attendance(volunteer_id, attendance_date) WHERE assignment_id IS NULL;

        CREATE TABLE IF NOT EXISTS volunteer_recognitions (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            volunteer_id uuid NOT NULL REFERENCES volunteer_profiles(id) ON DELETE RESTRICT,
            title text NOT NULL,
            recognition_type text NOT NULL CHECK (recognition_type IN ('Certificate', 'Award', 'Recognition')),
            issued_on date NOT NULL DEFAULT CURRENT_DATE,
            created_at timestamptz NOT NULL DEFAULT now()
        );

        """
    for statement in statements.split(";"):
        if statement.strip():
            op.execute(statement)

    for table_name in (
        "hr_requirements",
        "hr_applicants",
        "staff_leave_applications",
        "staff_payroll",
        "intern_profiles",
        "intern_tasks",
        "volunteer_applications",
    ):
        op.execute(f"DROP TRIGGER IF EXISTS set_updated_at ON {table_name}")
        op.execute(
            f"CREATE TRIGGER set_updated_at BEFORE UPDATE ON {table_name} "
            "FOR EACH ROW EXECUTE FUNCTION set_updated_at()"
        )


def downgrade() -> None:
    for table_name in (
        "volunteer_recognitions",
        "volunteer_feedback",
        "volunteer_attendance",
        "volunteer_applications",
        "intern_certificates",
        "intern_feedback",
        "intern_attendance",
        "intern_tasks",
        "intern_profiles",
        "intern_application_history",
        "staff_payroll",
        "staff_performance_reviews",
        "staff_leave_applications",
        "hr_applicants",
        "hr_requirements",
    ):
        op.execute(f"DROP TABLE IF EXISTS {table_name}")
