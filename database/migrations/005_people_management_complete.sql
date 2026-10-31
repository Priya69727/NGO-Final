-- Migration: Complete People Management Schema Enhancements
BEGIN;

-- 1. HR Requirements
ALTER TABLE hr_requirements
    ADD COLUMN IF NOT EXISTS experience_years numeric(4, 1) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS qualification text DEFAULT '',
    ADD COLUMN IF NOT EXISTS designation text DEFAULT '',
    ADD COLUMN IF NOT EXISTS assigned_hr_id uuid REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE hr_requirements DROP CONSTRAINT IF EXISTS hr_requirements_status_check;
ALTER TABLE hr_requirements
    ADD CONSTRAINT hr_requirements_status_check
    CHECK (status IN ('Draft', 'Pending Approval', 'Approved', 'In Progress', 'Open', 'Shortlisting', 'On Hold', 'Fulfilled', 'Filled', 'Rejected', 'Cancelled'));

ALTER TABLE hr_requirements DROP CONSTRAINT IF EXISTS hr_requirements_urgency_check;
ALTER TABLE hr_requirements
    ADD CONSTRAINT hr_requirements_urgency_check
    CHECK (urgency IN ('Low', 'Medium', 'High', 'Critical'));

-- 2. HR Recruitment Applicants
CREATE TABLE IF NOT EXISTS hr_applicants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    requirement_id uuid REFERENCES hr_requirements(id) ON DELETE SET NULL,
    full_name text NOT NULL,
    email text NOT NULL,
    phone text NOT NULL DEFAULT '',
    qualification text NOT NULL DEFAULT '',
    experience_years numeric(4, 1) NOT NULL DEFAULT 0,
    skills text[] NOT NULL DEFAULT '{}',
    resume_url text,
    status text NOT NULL DEFAULT 'Applied'
        CHECK (status IN ('Applied', 'Under Review', 'Shortlisted', 'Interview Scheduled', 'Selected', 'Rejected', 'Hired')),
    interview_date timestamptz,
    interview_notes text NOT NULL DEFAULT '',
    rating numeric(3, 1),
    notes text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hr_applicants_requirement_idx ON hr_applicants(requirement_id);
CREATE INDEX IF NOT EXISTS hr_applicants_status_idx ON hr_applicants(status);

-- 3. Staff Payroll & Financial Records
CREATE TABLE IF NOT EXISTS staff_payroll (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id uuid NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
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

-- 4. Staff Leave Applications
ALTER TABLE staff_leave_applications
    ADD COLUMN IF NOT EXISTS days_count numeric(4, 1) DEFAULT 1;

ALTER TABLE staff_leave_applications DROP CONSTRAINT IF EXISTS staff_leave_applications_status_check;
ALTER TABLE staff_leave_applications
    ADD CONSTRAINT staff_leave_applications_status_check
    CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Cancelled'));

-- 5. Staff Performance Reviews
ALTER TABLE staff_performance_reviews
    ADD COLUMN IF NOT EXISTS review_period text DEFAULT 'Annual',
    ADD COLUMN IF NOT EXISTS strengths text DEFAULT '',
    ADD COLUMN IF NOT EXISTS improvement_areas text DEFAULT '';

-- 6. Intern Applications
ALTER TABLE intern_applications
    ADD COLUMN IF NOT EXISTS preferred_department_id text REFERENCES departments(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS duration_weeks integer DEFAULT 8,
    ADD COLUMN IF NOT EXISTS reviewer_remarks text DEFAULT '';

ALTER TABLE intern_applications DROP CONSTRAINT IF EXISTS intern_applications_status_check;
ALTER TABLE intern_applications
    ADD CONSTRAINT intern_applications_status_check
    CHECK (status IN ('New', 'Applied', 'Under Review', 'Shortlisted', 'Selected', 'Accepted', 'Rejected', 'Withdrawn', 'Completed'));

-- 7. Intern Profiles
ALTER TABLE intern_profiles
    ADD COLUMN IF NOT EXISTS intern_code text UNIQUE,
    ADD COLUMN IF NOT EXISTS full_name text DEFAULT '',
    ADD COLUMN IF NOT EXISTS email text DEFAULT '',
    ADD COLUMN IF NOT EXISTS phone text DEFAULT '',
    ADD COLUMN IF NOT EXISTS college text DEFAULT '',
    ADD COLUMN IF NOT EXISTS department_id text REFERENCES departments(id) ON DELETE SET NULL;

ALTER TABLE intern_profiles DROP CONSTRAINT IF EXISTS intern_profiles_certificate_status_check;
ALTER TABLE intern_profiles
    ADD CONSTRAINT intern_profiles_certificate_status_check
    CHECK (certificate_status IN ('Pending', 'Generated', 'Issued', 'Not Eligible'));

-- 8. Intern Tasks
ALTER TABLE intern_tasks
    ADD COLUMN IF NOT EXISTS description text DEFAULT '',
    ADD COLUMN IF NOT EXISTS progress smallint DEFAULT 0,
    ADD COLUMN IF NOT EXISTS mentor_feedback text DEFAULT '';

ALTER TABLE intern_tasks DROP CONSTRAINT IF EXISTS intern_tasks_status_check;
ALTER TABLE intern_tasks
    ADD CONSTRAINT intern_tasks_status_check
    CHECK (status IN ('Not Started', 'To Do', 'In Progress', 'Under Review', 'Completed', 'Done', 'On Hold'));

-- 9. Intern Certificates
ALTER TABLE intern_certificates
    ADD COLUMN IF NOT EXISTS final_evaluation text DEFAULT '';

-- 10. Volunteer Applications & Profiles
ALTER TABLE volunteer_applications DROP CONSTRAINT IF EXISTS volunteer_applications_status_check;
ALTER TABLE volunteer_applications
    ADD CONSTRAINT volunteer_applications_status_check
    CHECK (status IN ('New', 'Applied', 'Under Review', 'Approved', 'Rejected'));

ALTER TABLE volunteer_profiles DROP CONSTRAINT IF EXISTS volunteer_profiles_status_check;
ALTER TABLE volunteer_profiles
    ADD CONSTRAINT volunteer_profiles_status_check
    CHECK (status IN ('Applicant', 'Applied', 'Under Review', 'Approved', 'Active', 'Inactive', 'Rejected'));

-- Triggers for updated_at
DO $$
DECLARE
    table_name text;
BEGIN
    FOREACH table_name IN ARRAY ARRAY['hr_applicants', 'staff_payroll']
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON %I', table_name);
        EXECUTE format(
            'CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
            table_name
        );
    END LOOP;
END;
$$;

COMMIT;
