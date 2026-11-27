import io
from datetime import date, timedelta
from uuid import uuid4

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
            aadhaar_card_url TEXT,
            pan_card_url TEXT,
            resume_url TEXT,
            other_documents JSON NOT NULL DEFAULT '[]',
            bank_account_holder_name TEXT,
            bank_account_number TEXT,
            ifsc_code TEXT,
            bank_name TEXT,
            branch_details TEXT,
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
            opportunity_id TEXT,
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
            opportunity_id TEXT,
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
            user_id TEXT,
            full_name TEXT DEFAULT '',
            email TEXT DEFAULT '',
            phone TEXT DEFAULT '',
            college TEXT DEFAULT '',
            department_id TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )""",
        """CREATE TABLE IF NOT EXISTS intern_tasks (
            id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
            intern_id TEXT NOT NULL,
            title TEXT NOT NULL,
            project_name TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT 'Not Started',
            due_date TEXT,
            priority TEXT NOT NULL DEFAULT 'Medium',
            description TEXT NOT NULL DEFAULT '',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )""",
        """CREATE TABLE IF NOT EXISTS intern_attendance (
            id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
            intern_id TEXT NOT NULL,
            attendance_date TEXT NOT NULL,
            status TEXT NOT NULL,
            note TEXT NOT NULL DEFAULT '',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
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
            opportunity_id TEXT,
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
        """CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL
        )""",
        """CREATE TABLE IF NOT EXISTS events (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            project_id TEXT,
            starts_at TEXT NOT NULL,
            ends_at TEXT,
            event_type TEXT NOT NULL DEFAULT 'Meeting',
            organizer TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT 'Scheduled'
        )""",
        """CREATE TABLE IF NOT EXISTS people_opportunities (
            id TEXT PRIMARY KEY,
            slug TEXT NOT NULL UNIQUE,
            opportunity_type TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            requirements TEXT NOT NULL DEFAULT '',
            department_id TEXT,
            location TEXT NOT NULL DEFAULT '',
            employment_type TEXT NOT NULL DEFAULT '',
            closes_on TEXT,
            status TEXT NOT NULL DEFAULT 'Draft',
            created_by TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            published_at TEXT
        )""",
        """CREATE TABLE IF NOT EXISTS people_tasks (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            assigned_by TEXT,
            staff_id TEXT,
            intern_id TEXT,
            volunteer_id TEXT,
            starts_on TEXT NOT NULL,
            due_date TEXT NOT NULL,
            priority TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'Not Started',
            department_id TEXT,
            project_id TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )""",
        """CREATE TABLE IF NOT EXISTS people_task_history (
            id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
            task_id TEXT NOT NULL,
            actor_id TEXT,
            field_name TEXT NOT NULL,
            old_value TEXT,
            new_value TEXT,
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


def test_shared_people_tasks_calendar_and_public_opportunities(client, db_session_factory):
    _install_people_test_tables(db_session_factory)
    _login_admin(client, db_session_factory)
    employee = client.post(
        "/api/staff",
        json={
            "employeeCode": "EMP-KYC",
            "fullName": "KYC Employee",
            "jobTitle": "Coordinator",
            "aadhaarCardUrl": "/uploads/aadhaar.pdf",
            "panCardUrl": "/uploads/pan.pdf",
            "resumeUrl": "/uploads/resume.pdf",
            "otherDocuments": [{"name": "certificate.pdf", "url": "/uploads/certificate.pdf"}],
            "bankAccountHolderName": "KYC Employee",
            "bankAccountNumber": "001234567890",
            "ifscCode": "ABCD0123456",
            "bankName": "Hope Bank",
            "branchDetails": "Pune Main",
        },
    )
    assert employee.status_code == 201, employee.text
    assert employee.json()["aadhaarCardUrl"] == "/uploads/aadhaar.pdf"
    assert employee.json()["otherDocuments"] == [
        {"name": "certificate.pdf", "url": "/uploads/certificate.pdf"}
    ]
    assert employee.json()["bankAccountNumber"] == "001234567890"

    with db_session_factory() as db:
        admin = db.query(User).filter_by(email="admin@ngo.org").one()
        staff_id = str(uuid4())
        db.execute(
            text(
                """
                INSERT INTO staff_profiles (id, user_id, employee_code, job_title, department_id, status, full_name, email)
                VALUES (:id, :user_id, 'EMP-TEST', 'Coordinator', 'hr', 'Active', 'Staff Member', 'staff@example.org')
                """
            ),
            {"id": staff_id, "user_id": str(admin.id)},
        )
        db.commit()

    start = date.today().isoformat()
    due = (date.today() + timedelta(days=3)).isoformat()
    created = client.post(
        "/api/people/tasks",
        json={
            "title": "Prepare field report",
            "description": "Compile the monthly outreach results.",
            "assigneeType": "Employee",
            "assigneeId": staff_id,
            "startDate": start,
            "dueDate": due,
            "priority": "High",
            "status": "Not Started",
            "departmentId": "hr",
        },
    )
    assert created.status_code == 201, created.text
    task = created.json()
    assert task["assigneeName"] == "Staff Member"
    assert task["assignedByName"] == "Admin Staff"
    assert task["status"] == "Not Started"

    other_staff_id = str(uuid4())
    with db_session_factory() as db:
        db.execute(
            text(
                """
                INSERT INTO staff_profiles (id, employee_code, job_title, status, full_name, email)
                VALUES (:id, 'EMP-OTHER', 'Coordinator', 'Active', 'Other Staff', 'other@example.org')
                """
            ),
            {"id": other_staff_id},
        )
        db.commit()
    other_task_response = client.post(
        "/api/people/tasks",
        json={
            "title": "Other person's task",
            "description": "This task belongs to another staff member.",
            "assigneeType": "Employee",
            "assigneeId": other_staff_id,
            "startDate": start,
            "dueDate": due,
            "priority": "Low",
            "status": "Not Started",
        },
    )
    assert other_task_response.status_code == 201, other_task_response.text
    other_task = other_task_response.json()

    invalid_task = client.post(
        "/api/people/tasks",
        json={
            "title": "   ",
            "description": "A task",
            "assigneeType": "Employee",
            "assigneeId": staff_id,
            "startDate": due,
            "dueDate": start,
            "priority": "Low",
            "status": "Not Started",
        },
    )
    assert invalid_task.status_code == 422

    updated = client.patch(f"/api/people/tasks/{task['id']}", json={"status": "In Progress"})
    assert updated.status_code == 200
    with db_session_factory() as db:
        admin = db.query(User).filter_by(email="admin@ngo.org").one()
        admin.role = "Volunteer"
        db.commit()
    own_tasks = client.get("/api/people/tasks")
    assert own_tasks.status_code == 200
    assert [item["id"] for item in own_tasks.json()["items"]] == [task["id"]]
    participant_update = client.patch(f"/api/people/tasks/{task['id']}", json={"status": "Completed"})
    assert participant_update.status_code == 200
    forbidden_other_update = client.patch(f"/api/people/tasks/{other_task['id']}", json={"status": "Completed"})
    assert forbidden_other_update.status_code == 403
    forbidden_edit = client.patch(f"/api/people/tasks/{task['id']}", json={"title": "Changed by participant"})
    assert forbidden_edit.status_code == 403
    with db_session_factory() as db:
        admin = db.query(User).filter_by(email="admin@ngo.org").one()
        admin.role = "Admin"
        db.commit()
    history = client.get(f"/api/people/tasks/{task['id']}/history")
    assert history.status_code == 200
    assert any(item["fieldName"] == "status" for item in history.json()["items"])

    calendar = client.get(f"/api/people/calendar?dateFrom={start}&dateTo={due}")
    assert calendar.status_code == 200
    assert any(item["id"] == f"task:{task['id']}" for item in calendar.json()["items"])

    opportunity_response = client.post(
        "/api/people/opportunities",
        json={
            "opportunityType": "Volunteer",
            "title": "Weekend Reading Volunteer",
            "description": "Support reading sessions for local children.",
            "requirements": "Available on weekends.",
            "location": "Pune",
            "closesOn": due,
            "status": "Published",
        },
    )
    assert opportunity_response.status_code == 201, opportunity_response.text
    opportunity = opportunity_response.json()
    public = client.get(f"/api/public/opportunities/{opportunity['slug']}")
    assert public.status_code == 200
    assert public.json()["title"] == "Weekend Reading Volunteer"
    assert "createdBy" not in public.json()

    invalid_phone = client.post(
        f"/api/public/opportunities/{opportunity['slug']}/applications",
        json={"fullName": "Ravi Test", "email": "ravi@example.org", "phone": "+9198765"},
    )
    assert invalid_phone.status_code == 422

    application = client.post(
        f"/api/public/opportunities/{opportunity['slug']}/applications",
        json={
            "fullName": "Ravi Test",
            "email": "ravi@example.org",
            "phone": "+919876543210",
            "message": "I can help on weekends.",
        },
    )
    assert application.status_code == 201, application.text
    assert application.json()["applicationId"]
    with db_session_factory() as db:
        saved = db.execute(
            text("SELECT opportunity_id, phone FROM volunteer_applications WHERE email = 'ravi@example.org'")
        ).one()
        assert saved.phone == "+919876543210"
        assert saved.opportunity_id == opportunity["id"]

    closed = client.patch(f"/api/people/opportunities/{opportunity['id']}", json={"status": "Closed"})
    assert closed.status_code == 200
    assert client.get(f"/api/public/opportunities/{opportunity['slug']}").status_code == 410
