import io
import pytest
from sqlalchemy import text

from app.api.records import _metadata, _tables
from app.models import User


def _install_people_test_tables(db_session_factory):
    _tables.clear()
    _metadata.clear()
    statements = [
        """CREATE TABLE IF NOT EXISTS departments (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )""",
        """CREATE TABLE IF NOT EXISTS staff_profiles (
            id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
            user_id TEXT,
            employee_code TEXT NOT NULL UNIQUE,
            job_title TEXT NOT NULL,
            department_id TEXT,
            employment_type TEXT NOT NULL DEFAULT 'Full-time',
            hired_on TEXT,
            manager_id TEXT,
            salary NUMERIC,
            status TEXT NOT NULL DEFAULT 'Active',
            full_name TEXT NOT NULL DEFAULT '',
            email TEXT,
            phone TEXT,
            gender TEXT,
            date_of_birth TEXT,
            address TEXT NOT NULL DEFAULT '',
            emergency_contact TEXT NOT NULL DEFAULT '',
            qualifications JSON NOT NULL DEFAULT '[]',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )""",
        """CREATE TABLE IF NOT EXISTS hr_requirements (
            id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
            title TEXT NOT NULL,
            department_id TEXT,
            urgency TEXT NOT NULL DEFAULT 'Medium',
            openings INTEGER NOT NULL DEFAULT 1,
            status TEXT NOT NULL DEFAULT 'Open',
            description TEXT NOT NULL DEFAULT '',
            required_skills TEXT NOT NULL DEFAULT '',
            opened_on TEXT DEFAULT CURRENT_TIMESTAMP,
            closes_on TEXT,
            experience_years NUMERIC DEFAULT 0,
            qualification TEXT DEFAULT '',
            designation TEXT DEFAULT '',
            assigned_hr_id TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )""",
        """CREATE TABLE IF NOT EXISTS hr_applicants (
            id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
            requirement_id TEXT,
            full_name TEXT NOT NULL,
            email TEXT NOT NULL,
            phone TEXT NOT NULL DEFAULT '',
            qualification TEXT NOT NULL DEFAULT '',
            experience_years NUMERIC NOT NULL DEFAULT 0,
            skills JSON NOT NULL DEFAULT '[]',
            resume_url TEXT,
            status TEXT NOT NULL DEFAULT 'Applied',
            interview_date TEXT,
            interview_notes TEXT NOT NULL DEFAULT '',
            rating NUMERIC,
            notes TEXT NOT NULL DEFAULT '',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )""",
        """CREATE TABLE IF NOT EXISTS staff_attendance (
            id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
            staff_id TEXT NOT NULL,
            attendance_date TEXT NOT NULL,
            check_in TEXT,
            check_out TEXT,
            status TEXT NOT NULL,
            notes TEXT NOT NULL DEFAULT '',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )""",
        """CREATE TABLE IF NOT EXISTS staff_leave_applications (
            id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
            staff_id TEXT NOT NULL,
            leave_type TEXT NOT NULL,
            starts_on TEXT NOT NULL,
            ends_on TEXT NOT NULL,
            reason TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'Pending',
            reviewed_by TEXT,
            reviewed_at TEXT,
            decision_notes TEXT NOT NULL DEFAULT '',
            days_count NUMERIC DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )""",
        """CREATE TABLE IF NOT EXISTS staff_performance_reviews (
            id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
            staff_id TEXT NOT NULL,
            reviewer_id TEXT,
            reviewed_on TEXT DEFAULT CURRENT_TIMESTAMP,
            rating NUMERIC NOT NULL,
            scores JSON NOT NULL DEFAULT '{}',
            feedback TEXT NOT NULL DEFAULT '',
            review_period TEXT DEFAULT 'Annual',
            strengths TEXT DEFAULT '',
            improvement_areas TEXT DEFAULT '',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )""",
        """CREATE TABLE IF NOT EXISTS staff_payroll (
            id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
            staff_id TEXT NOT NULL,
            payroll_period TEXT NOT NULL,
            basic_salary NUMERIC NOT NULL DEFAULT 0,
            allowances NUMERIC NOT NULL DEFAULT 0,
            deductions NUMERIC NOT NULL DEFAULT 0,
            net_salary NUMERIC NOT NULL DEFAULT 0,
            payment_status TEXT NOT NULL DEFAULT 'Pending',
            payment_date TEXT,
            payment_method TEXT NOT NULL DEFAULT 'Bank Transfer',
            transaction_reference TEXT,
            notes TEXT NOT NULL DEFAULT '',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )""",
        """CREATE TABLE IF NOT EXISTS intern_applications (
            id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
            full_name TEXT NOT NULL,
            email TEXT NOT NULL,
            phone TEXT,
            area_of_interest TEXT NOT NULL,
            applied_on TEXT DEFAULT CURRENT_TIMESTAMP,
            status TEXT NOT NULL DEFAULT 'Applied',
            assigned_project_id TEXT,
            notes TEXT NOT NULL DEFAULT '',
            college TEXT NOT NULL DEFAULT '',
            degree TEXT NOT NULL DEFAULT '',
            graduation_year INTEGER,
            cgpa NUMERIC,
            skills JSON NOT NULL DEFAULT '[]',
            resume_url TEXT,
            preferred_department_id TEXT,
            duration_weeks INTEGER DEFAULT 8,
            reviewer_remarks TEXT DEFAULT '',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )""",
        """CREATE TABLE IF NOT EXISTS intern_profiles (
            id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
            application_id TEXT NOT NULL,
            intern_code TEXT UNIQUE,
            mentor_staff_id TEXT,
            starts_on TEXT,
            ends_on TEXT,
            status TEXT NOT NULL DEFAULT 'Active',
            project_name TEXT NOT NULL DEFAULT '',
            progress INTEGER NOT NULL DEFAULT 0,
            attendance_percent NUMERIC NOT NULL DEFAULT 0,
            final_feedback TEXT NOT NULL DEFAULT '',
            certificate_status TEXT NOT NULL DEFAULT 'Pending',
            full_name TEXT DEFAULT '',
            email TEXT DEFAULT '',
            phone TEXT DEFAULT '',
            college TEXT DEFAULT '',
            department_id TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )""",
        """CREATE TABLE IF NOT EXISTS intern_application_history (
            id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
            application_id TEXT NOT NULL,
            event TEXT NOT NULL,
            occurred_at TEXT DEFAULT CURRENT_TIMESTAMP,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )""",
        """CREATE TABLE IF NOT EXISTS volunteer_applications (
            id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
            full_name TEXT NOT NULL,
            email TEXT NOT NULL,
            phone TEXT NOT NULL DEFAULT '',
            skills JSON NOT NULL DEFAULT '[]',
            motivation TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT 'New',
            applied_on TEXT DEFAULT CURRENT_TIMESTAMP,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )""",
        """CREATE TABLE IF NOT EXISTS volunteer_profiles (
            id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
            user_id TEXT,
            full_name TEXT NOT NULL,
            email TEXT,
            phone TEXT,
            skills JSON NOT NULL DEFAULT '[]',
            availability TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT 'Active',
            joined_on TEXT,
            city TEXT NOT NULL DEFAULT '',
            age INTEGER,
            application_id TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )""",
        """CREATE TABLE IF NOT EXISTS volunteer_assignments (
            id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
            volunteer_id TEXT NOT NULL,
            project_id TEXT,
            role_title TEXT NOT NULL,
            starts_on TEXT,
            ends_on TEXT,
            status TEXT NOT NULL DEFAULT 'Active',
            event_id TEXT,
            assignment_kind TEXT NOT NULL DEFAULT 'Project',
            target_label TEXT NOT NULL DEFAULT '',
            responsibilities TEXT NOT NULL DEFAULT '',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )""",
        """CREATE TABLE IF NOT EXISTS volunteer_attendance (
            id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
            volunteer_id TEXT NOT NULL,
            assignment_id TEXT,
            attendance_date TEXT NOT NULL,
            status TEXT NOT NULL,
            hours NUMERIC NOT NULL DEFAULT 0,
            notes TEXT NOT NULL DEFAULT '',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )""",
        """CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            actor_id TEXT,
            action TEXT NOT NULL,
            entity_type TEXT NOT NULL,
            entity_id TEXT NOT NULL,
            changes JSON NOT NULL DEFAULT '{}',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )""",
        """INSERT INTO departments (id, name) VALUES ('hr', 'Human Resources')""",
        """INSERT INTO departments (id, name) VALUES ('tech', 'Data & Technology')""",
    ]
    with db_session_factory() as db:
        for stmt in statements:
            db.execute(text(stmt))
        db.commit()


def _login_admin(client, db_session_factory):
    resp = client.post(
        "/api/auth/register",
        json={"fullName": "Admin Staff", "email": "admin@ngo.org", "password": "secure-admin-password"},
    )
    assert resp.status_code == 201
    with db_session_factory() as db:
        user = db.query(User).filter_by(email="admin@ngo.org").one()
        user.role = "Admin"
        db.commit()


def test_file_upload_and_download(client, db_session_factory):
    _install_people_test_tables(db_session_factory)
    _login_admin(client, db_session_factory)

    file_content = b"%PDF-1.4 test resume content"
    response = client.post(
        "/api/uploads",
        files={"file": ("resume.pdf", io.BytesIO(file_content), "application/pdf")},
    )
    assert response.status_code == 200
    data = response.json()
    assert "url" in data
    assert data["filename"].endswith(".pdf")

    # Download file back
    dl_response = client.get(data["url"])
    assert dl_response.status_code == 200
    assert dl_response.content == file_content


def test_hr_recruitment_and_employee_conversion(client, db_session_factory):
    _install_people_test_tables(db_session_factory)
    _login_admin(client, db_session_factory)

    # 1. Create HR Requirement
    req_resp = client.post(
        "/api/hr-requirements",
        json={
            "title": "Community Project Lead",
            "departmentId": "hr",
            "urgency": "High",
            "openings": 2,
            "status": "Open",
            "description": "Lead grassroots outreach",
            "requiredSkills": "Outreach, Team management",
            "experienceYears": 2.5,
            "qualification": "Master's in Social Work",
        },
    )
    assert req_resp.status_code == 201
    req_data = req_resp.json()
    req_id = req_data["id"]

    # 2. Add an Applicant linked to the requirement
    app_resp = client.post(
        "/api/hr-applicants",
        json={
            "requirementId": req_id,
            "fullName": "Aarav Sharma",
            "email": "aarav.sharma@example.org",
            "phone": "+91 9876543210",
            "qualification": "MSW",
            "experienceYears": 3,
            "status": "Selected",
        },
    )
    assert app_resp.status_code == 201
    app_data = app_resp.json()
    applicant_id = app_data["id"]

    # 3. Convert applicant to employee without re-entering info
    conv_resp = client.post(
        "/api/people/recruitment/convert-applicant",
        json={"applicantId": applicant_id, "salary": 45000},
    )
    assert conv_resp.status_code == 200
    conv_data = conv_resp.json()
    assert conv_data["employee"]["fullName"] == "Aarav Sharma"
    assert conv_data["employee"]["employeeCode"] == "EMP-001"
    assert conv_data["employee"]["salary"] == 45000

    # 4. Check HR dashboard figures
    dash_resp = client.get("/api/people/hr/dashboard")
    assert dash_resp.status_code == 200
    dash_data = dash_resp.json()
    assert dash_data["totalEmployees"] == 1
    assert dash_data["activeEmployees"] == 1
    assert dash_data["openRequirements"] == 1


def test_intern_and_volunteer_workflows(client, db_session_factory):
    _install_people_test_tables(db_session_factory)
    _login_admin(client, db_session_factory)

    # 1. Intern application
    intern_app_resp = client.post(
        "/api/intern-applications",
        json={
            "fullName": "Meera Patel",
            "email": "meera@university.edu",
            "areaOfInterest": "Education Tech",
            "college": "Pune University",
            "degree": "B.Tech IT",
            "status": "Shortlisted",
        },
    )
    assert intern_app_resp.status_code == 201
    intern_app_id = intern_app_resp.json()["id"]
    duplicate_intern_app = client.post(
        "/api/intern-applications",
        json={
            "fullName": "Meera Patel",
            "email": "MEERA@UNIVERSITY.EDU",
            "areaOfInterest": "Education Tech",
        },
    )
    assert duplicate_intern_app.status_code == 409

    # 2. Convert to Intern Profile
    intern_conv_resp = client.post(
        "/api/people/intern/select-applicant",
        json={"applicationId": intern_app_id, "departmentId": "tech", "projectName": "Digital Literacy"},
    )
    assert intern_conv_resp.status_code == 200
    intern_data = intern_conv_resp.json()["intern"]
    assert intern_data["internCode"] == "INT-001"
    assert intern_data["fullName"] == "Meera Patel"
    assert intern_data["phone"] == ""

    # 3. Check Intern Dashboard
    intern_dash = client.get("/api/people/intern/dashboard")
    assert intern_dash.status_code == 200
    assert intern_dash.json()["totalInterns"] == 1
    assert intern_dash.json()["selected"] == 1

    # 4. Volunteer application & approval
    vol_app_resp = client.post(
        "/api/volunteer-applications",
        json={
            "fullName": "Rahul Verma",
            "email": "rahul.v@ngo-volunteer.org",
            "phone": "9988776655",
            "motivation": "Want to teach children on weekends",
        },
    )
    assert vol_app_resp.status_code == 201
    vol_app_id = vol_app_resp.json()["id"]
    duplicate_volunteer_app = client.post(
        "/api/volunteer-applications",
        json={
            "fullName": "Rahul Verma",
            "email": "RAHUL.V@NGO-VOLUNTEER.ORG",
        },
    )
    assert duplicate_volunteer_app.status_code == 409

    vol_conv_resp = client.post(
        "/api/people/volunteer/approve-applicant",
        json={"applicationId": vol_app_id},
    )
    assert vol_conv_resp.status_code == 200
    vol_data = vol_conv_resp.json()["volunteer"]
    assert vol_data["fullName"] == "Rahul Verma"
    assert vol_data["status"] == "Active"

    # 5. Check Volunteer Dashboard
    vol_dash = client.get("/api/people/volunteer/dashboard")
    assert vol_dash.status_code == 200
    assert vol_dash.json()["totalVolunteers"] == 1
    assert vol_dash.json()["approvedApplications"] == 1
