import logging
import os
import re
import uuid
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, File, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import func, select, Table, MetaData, insert, update, or_, and_, desc

from app.api.records import build_resource_router, _table, _serialize, _record_audit, _require_role, _convert_value, READ_ROLES
from app.dependencies import CurrentUser, DbSession

logger = logging.getLogger(__name__)


def _parse_iso_date(value: Any, label: str) -> date | None:
    if value in (None, ""):
        return None
    try:
        return date.fromisoformat(str(value))
    except ValueError as error:
        raise HTTPException(status_code=422, detail=f"{label} must be a valid ISO date.") from error


# Base resource router for all standard CRUD routes
router = build_resource_router(
    (
        "departments",
        "staff",
        "staff-attendance",
        "staff-leave-applications",
        "staff-performance-reviews",
        "staff-payroll",
        "hr-requirements",
        "hr-applicants",
        "intern-applications",
        "intern-application-history",
        "intern-profiles",
        "intern-tasks",
        "intern-attendance",
        "intern-feedback",
        "intern-certificates",
        "volunteers",
        "volunteer-applications",
        "volunteer-assignments",
        "volunteer-attendance",
        "volunteer-feedback",
        "volunteer-recognitions",
    ),
    "people management",
)

UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".docx", ".doc", ".webp"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
FILE_SIGNATURES = {
    ".pdf": lambda content: content.startswith(b"%PDF-"),
    ".png": lambda content: content.startswith(b"\x89PNG\r\n\x1a\n"),
    ".jpg": lambda content: content.startswith(b"\xff\xd8\xff"),
    ".jpeg": lambda content: content.startswith(b"\xff\xd8\xff"),
    ".webp": lambda content: len(content) >= 12 and content[:4] == b"RIFF" and content[8:12] == b"WEBP",
    ".docx": lambda content: content.startswith(b"PK\x03\x04"),
    ".doc": lambda content: content.startswith(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"),
}


# -------------------------------------------------------------------------
# Uploads Endpoints
# -------------------------------------------------------------------------
@router.post("/uploads", tags=["uploads"])
async def upload_file(
    user: CurrentUser,
    file: UploadFile = File(...),
):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type. Allowed types: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )

    content = await file.read(MAX_FILE_SIZE + 1)
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size exceeds maximum limit of 10MB.",
        )
    if not FILE_SIGNATURES[ext](content):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The file content does not match its file type.",
        )

    clean_stem = re.sub(r"[^a-zA-Z0-9_\-]", "_", Path(file.filename or "file").stem)[:40]
    unique_name = f"{clean_stem}_{uuid.uuid4().hex[:8]}{ext}"
    dest_path = UPLOAD_DIR / unique_name

    with open(dest_path, "wb") as f:
        f.write(content)

    return {
        "url": f"/api/uploads/{unique_name}",
        "filename": unique_name,
        "originalName": file.filename,
        "size": len(content),
    }


@router.get("/uploads/{filename}", tags=["uploads"])
async def get_uploaded_file(filename: str, user: CurrentUser):
    clean_name = Path(filename).name
    _require_role(user, READ_ROLES)
    file_path = UPLOAD_DIR / clean_name
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="Uploaded file not found.")
    return FileResponse(file_path)


# -------------------------------------------------------------------------
# HR Dashboard Statistics (Real Database Records)
# -------------------------------------------------------------------------
@router.get("/people/hr/dashboard", tags=["people management"])
def get_hr_dashboard(user: CurrentUser, db: DbSession):
    _require_role(user, READ_ROLES)
    staff_t = _table(db, "staff")
    req_t = _table(db, "hr-requirements")
    leaves_t = _table(db, "staff-leave-applications")
    att_t = _table(db, "staff-attendance")
    dept_t = _table(db, "departments")
    applicant_t = _table(db, "hr-applicants")

    total_employees = db.scalar(select(func.count()).select_from(staff_t)) or 0
    active_employees = db.scalar(select(func.count()).select_from(staff_t).where(staff_t.c.status == "Active")) or 0
    inactive_employees = total_employees - active_employees

    open_requirements = db.scalar(
        select(func.count()).select_from(req_t).where(
            req_t.c.status.in_(["Open", "In Progress", "Approved", "Draft", "Shortlisting"])
        )
    ) or 0

    pending_leaves = db.scalar(
        select(func.count()).select_from(leaves_t).where(leaves_t.c.status == "Pending")
    ) or 0

    total_applicants = db.scalar(select(func.count()).select_from(applicant_t)) or 0

    # Today's attendance
    today_date = date.today()
    att_rows = db.execute(
        select(att_t.c.status, func.count().label("cnt"))
        .where(att_t.c.attendance_date == today_date)
        .group_by(att_t.c.status)
    ).all()
    attendance_map = {row[0]: row[1] for row in att_rows}
    attendance_summary = {
        "present": attendance_map.get("Present", 0),
        "absent": attendance_map.get("Absent", 0),
        "late": attendance_map.get("Late", 0),
        "leave": attendance_map.get("Leave", 0) + attendance_map.get("Holiday", 0),
        "totalRecorded": sum(attendance_map.values()),
    }

    # Department distribution
    depts = db.execute(select(dept_t.c.id, dept_t.c.name)).all()
    dept_counts_rows = db.execute(
        select(staff_t.c.department_id, func.count().label("cnt"))
        .group_by(staff_t.c.department_id)
    ).all()
    count_map = {row[0]: row[1] for row in dept_counts_rows}

    dept_distribution = [
        {
            "departmentId": d[0],
            "name": d[1],
            "count": count_map.get(d[0], 0),
        }
        for d in depts
    ]

    return {
        "totalEmployees": total_employees,
        "activeEmployees": active_employees,
        "inactiveEmployees": inactive_employees,
        "openRequirements": open_requirements,
        "pendingLeaves": pending_leaves,
        "totalApplicants": total_applicants,
        "attendanceSummary": attendance_summary,
        "departmentDistribution": dept_distribution,
    }


# -------------------------------------------------------------------------
# Intern Dashboard Statistics (Real Database Records)
# -------------------------------------------------------------------------
@router.get("/people/intern/dashboard", tags=["people management"])
def get_intern_dashboard(user: CurrentUser, db: DbSession):
    _require_role(user, READ_ROLES)
    intern_t = _table(db, "intern-profiles")
    app_t = _table(db, "intern-applications")
    dept_t = _table(db, "departments")

    total_interns = db.scalar(select(func.count()).select_from(intern_t)) or 0
    active_interns = db.scalar(select(func.count()).select_from(intern_t).where(intern_t.c.status == "Active")) or 0
    completed_internships = db.scalar(select(func.count()).select_from(intern_t).where(intern_t.c.status == "Completed")) or 0

    total_apps = db.scalar(select(func.count()).select_from(app_t)) or 0
    new_apps = db.scalar(select(func.count()).select_from(app_t).where(app_t.c.status.in_(["New", "Applied"]))) or 0
    under_review = db.scalar(select(func.count()).select_from(app_t).where(app_t.c.status == "Under Review")) or 0
    shortlisted = db.scalar(select(func.count()).select_from(app_t).where(app_t.c.status == "Shortlisted")) or 0
    selected = db.scalar(select(func.count()).select_from(app_t).where(app_t.c.status.in_(["Selected", "Accepted"]))) or 0

    depts = db.execute(select(dept_t.c.id, dept_t.c.name)).all()
    intern_dept_rows = db.execute(
        select(intern_t.c.department_id, func.count().label("cnt"))
        .group_by(intern_t.c.department_id)
    ).all()
    count_map = {row[0]: row[1] for row in intern_dept_rows}

    dept_distribution = [
        {
            "departmentId": d[0],
            "name": d[1],
            "count": count_map.get(d[0], 0),
        }
        for d in depts
    ]

    return {
        "totalInterns": total_interns,
        "activeInterns": active_interns,
        "completedInternships": completed_internships,
        "totalApplications": total_apps,
        "newApplications": new_apps,
        "applicationsUnderReview": under_review,
        "shortlisted": shortlisted,
        "selected": selected,
        "departmentDistribution": dept_distribution,
    }


# -------------------------------------------------------------------------
# Volunteer Dashboard Statistics (Real Database Records)
# -------------------------------------------------------------------------
@router.get("/people/volunteer/dashboard", tags=["people management"])
def get_volunteer_dashboard(user: CurrentUser, db: DbSession):
    _require_role(user, READ_ROLES)
    vol_t = _table(db, "volunteers")
    app_t = _table(db, "volunteer-applications")
    assign_t = _table(db, "volunteer-assignments")
    att_t = _table(db, "volunteer-attendance")

    total_volunteers = db.scalar(select(func.count()).select_from(vol_t)) or 0
    active_volunteers = db.scalar(select(func.count()).select_from(vol_t).where(vol_t.c.status == "Active")) or 0

    total_apps = db.scalar(select(func.count()).select_from(app_t)) or 0
    new_apps = db.scalar(select(func.count()).select_from(app_t).where(app_t.c.status.in_(["New", "Applied"]))) or 0
    under_review = db.scalar(select(func.count()).select_from(app_t).where(app_t.c.status == "Under Review")) or 0
    approved_apps = db.scalar(select(func.count()).select_from(app_t).where(app_t.c.status == "Approved")) or 0

    active_assignments = db.scalar(select(func.count()).select_from(assign_t).where(assign_t.c.status == "Active")) or 0
    total_hours = db.scalar(select(func.coalesce(func.sum(att_t.c.hours), 0)).select_from(att_t)) or 0

    return {
        "totalVolunteers": total_volunteers,
        "activeVolunteers": active_volunteers,
        "totalApplications": total_apps,
        "newApplications": new_apps,
        "underReviewApplications": under_review,
        "approvedApplications": approved_apps,
        "activeAssignments": active_assignments,
        "totalHours": float(total_hours),
    }


# -------------------------------------------------------------------------
# Recruitment Workflow: Convert Applicant -> Employee
# -------------------------------------------------------------------------
@router.post("/people/recruitment/convert-applicant", tags=["people management"])
def convert_applicant_to_employee(payload: dict[str, Any], user: CurrentUser, db: DbSession):
    _require_role(user, {"Admin", "Staff"})
    applicant_id = payload.get("applicantId")
    if not applicant_id:
        raise HTTPException(status_code=422, detail="applicantId is required.")

    app_t = _table(db, "hr-applicants")
    staff_t = _table(db, "staff")
    req_t = _table(db, "hr-requirements")
    applicant_key = _convert_value(app_t.c.id, applicant_id)

    applicant = db.execute(select(app_t).where(app_t.c.id == applicant_key)).mappings().first()
    if not applicant:
        raise HTTPException(status_code=404, detail="Applicant not found.")
    if applicant["status"] not in {"Selected", "Hired"}:
        raise HTTPException(status_code=409, detail="Only selected applicants can be converted to employees.")
    if applicant["status"] == "Hired":
        raise HTTPException(status_code=409, detail="This applicant has already been converted.")

    # Generate employee code
    max_code = db.scalar(
        select(staff_t.c.employee_code)
        .where(staff_t.c.employee_code.like("EMP-%"))
        .order_by(desc(staff_t.c.employee_code))
        .limit(1)
    )
    next_num = 1
    if max_code and max_code.startswith("EMP-"):
        try:
            next_num = int(max_code.replace("EMP-", "")) + 1
        except ValueError:
            next_num = 1
    emp_code = f"EMP-{next_num:03d}"

    # Get requirement details if available
    job_title = payload.get("jobTitle") or "Staff Associate"
    department_id = payload.get("departmentId")
    if applicant["requirement_id"] and not department_id:
        req = db.execute(select(req_t).where(req_t.c.id == applicant["requirement_id"])).mappings().first()
        if req:
            department_id = req.get("department_id")
            if not payload.get("jobTitle"):
                job_title = req.get("title") or req.get("designation") or job_title

    salary = payload.get("salary")
    if salary is not None:
        try:
            if float(salary) < 0:
                raise ValueError
        except (TypeError, ValueError):
            raise HTTPException(status_code=422, detail="Salary must be a non-negative number.")
    hired_on = _parse_iso_date(payload.get("hiredOn") or date.today().isoformat(), "Joining date")

    staff_values = {
        "employee_code": emp_code,
        "full_name": applicant["full_name"],
        "email": applicant["email"],
        "phone": applicant["phone"],
        "job_title": job_title,
        "department_id": department_id,
        "salary": salary,
        "hired_on": hired_on,
        "status": "Active",
        "qualifications": [{"degree": applicant.get("qualification", ""), "skills": applicant.get("skills", [])}],
    }

    try:
        new_staff = db.execute(insert(staff_t).values(**staff_values).returning(*staff_t.columns)).mappings().one()
        db.execute(
            update(app_t)
            .where(app_t.c.id == applicant_key)
            .values(status="Hired", updated_at=datetime.now(timezone.utc))
        )
        _record_audit(db, user, "create", "staff", str(new_staff["id"]), {"source": "recruitment_conversion"})
        db.commit()
        return {
            "employee": _serialize(new_staff),
            "applicant": _serialize(applicant),
            "message": f"Successfully created employee record {emp_code}.",
        }
    except Exception as error:
        db.rollback()
        logger.exception("Failed to convert applicant to employee")
        raise HTTPException(status_code=409, detail=f"Failed to create employee record: {str(error)}")


# -------------------------------------------------------------------------
# Intern Workflow: Select Applicant -> Create Intern Profile
# -------------------------------------------------------------------------
@router.post("/people/intern/select-applicant", tags=["people management"])
def select_intern_applicant(payload: dict[str, Any], user: CurrentUser, db: DbSession):
    _require_role(user, {"Admin", "Project Manager", "Staff"})
    application_id = payload.get("applicationId")
    if not application_id:
        raise HTTPException(status_code=422, detail="applicationId is required.")

    app_t = _table(db, "intern-applications")
    intern_t = _table(db, "intern-profiles")
    hist_t = _table(db, "intern-application-history")
    application_key = _convert_value(app_t.c.id, application_id)

    app = db.execute(select(app_t).where(app_t.c.id == application_key)).mappings().first()
    if not app:
        raise HTTPException(status_code=404, detail="Intern application not found.")
    if app["status"] not in {"Shortlisted", "Selected"}:
        raise HTTPException(status_code=409, detail="Only shortlisted applicants can be selected as interns.")

    # Check if profile already exists
    existing = db.execute(select(intern_t).where(intern_t.c.application_id == application_key)).mappings().first()
    if existing:
        return {
            "intern": _serialize(existing),
            "application": _serialize(app),
            "message": "Intern profile already exists for this application.",
        }

    # Generate intern code
    max_code = db.scalar(
        select(intern_t.c.intern_code)
        .where(intern_t.c.intern_code.like("INT-%"))
        .order_by(desc(intern_t.c.intern_code))
        .limit(1)
    )
    next_num = 1
    if max_code and max_code.startswith("INT-"):
        try:
            next_num = int(max_code.replace("INT-", "")) + 1
        except ValueError:
            next_num = 1
    intern_code = f"INT-{next_num:03d}"

    starts_on = _parse_iso_date(payload.get("startsOn"), "Internship start date")
    ends_on = _parse_iso_date(payload.get("endsOn"), "Internship end date")
    if starts_on and ends_on and ends_on < starts_on:
        raise HTTPException(status_code=422, detail="Internship end date cannot be earlier than its start date.")
    mentor_id = payload.get("mentorStaffId")
    if mentor_id:
        staff_t = _table(db, "staff")
        mentor_key = _convert_value(staff_t.c.id, mentor_id)
        mentor = db.execute(select(staff_t.c.status).where(staff_t.c.id == mentor_key)).scalar_one_or_none()
        if mentor is None:
            raise HTTPException(status_code=404, detail="The selected mentor was not found.")
        if mentor != "Active":
            raise HTTPException(status_code=422, detail="An inactive employee cannot mentor an intern.")
        mentor_id = mentor_key

    intern_values = {
        "application_id": application_key,
        "intern_code": intern_code,
        "full_name": app["full_name"],
        "email": app["email"],
        "phone": app.get("phone") or "",
        "college": app.get("college", ""),
        "department_id": payload.get("departmentId") or app.get("preferred_department_id"),
        "mentor_staff_id": mentor_id,
        "project_name": payload.get("projectName") or "Onboarding",
        "starts_on": starts_on or date.today(),
        "ends_on": ends_on,
        "status": "Active",
        "progress": 0,
        "attendance_percent": 100,
        "certificate_status": "Pending",
    }

    try:
        new_intern = db.execute(insert(intern_t).values(**intern_values).returning(*intern_t.columns)).mappings().one()
        db.execute(
            update(app_t)
            .where(app_t.c.id == application_key)
            .values(status="Selected", updated_at=datetime.now(timezone.utc))
        )
        db.execute(
            insert(hist_t).values(
                application_id=application_key,
                event=f"Applicant selected and converted to intern profile {intern_code}",
            )
        )
        _record_audit(db, user, "create", "intern-profiles", str(new_intern["id"]), {"source": "application_selection"})
        db.commit()
        return {
            "intern": _serialize(new_intern),
            "application": _serialize(app),
            "message": f"Successfully created intern profile {intern_code}.",
        }
    except Exception as error:
        db.rollback()
        logger.exception("Failed to select intern applicant")
        raise HTTPException(status_code=409, detail=f"Failed to create intern profile: {str(error)}")


# -------------------------------------------------------------------------
# Volunteer Workflow: Approve Applicant -> Volunteer Profile
# -------------------------------------------------------------------------
@router.post("/people/volunteer/approve-applicant", tags=["people management"])
def approve_volunteer_applicant(payload: dict[str, Any], user: CurrentUser, db: DbSession):
    _require_role(user, {"Admin", "Project Manager", "Staff"})
    application_id = payload.get("applicationId")
    if not application_id:
        raise HTTPException(status_code=422, detail="applicationId is required.")

    app_t = _table(db, "volunteer-applications")
    vol_t = _table(db, "volunteers")
    application_key = _convert_value(app_t.c.id, application_id)

    app = db.execute(select(app_t).where(app_t.c.id == application_key)).mappings().first()
    if not app:
        raise HTTPException(status_code=404, detail="Volunteer application not found.")
    if app["status"] not in {"New", "Applied", "Under Review", "Approved"}:
        raise HTTPException(status_code=409, detail="This volunteer application cannot be approved in its current state.")

    existing = db.execute(
        select(vol_t).where(func.lower(vol_t.c.email) == app["email"].strip().lower())
    ).mappings().first()
    if existing:
        db.execute(
            update(vol_t)
            .where(vol_t.c.id == existing["id"])
            .values(status="Active", updated_at=datetime.now(timezone.utc))
        )
        db.execute(
            update(app_t)
            .where(app_t.c.id == application_key)
            .values(status="Approved", updated_at=datetime.now(timezone.utc))
        )
        db.commit()
        return {
            "volunteer": _serialize(existing),
            "application": _serialize(app),
            "message": "Activated existing volunteer profile.",
        }

    vol_values = {
        "full_name": app["full_name"],
        "email": app["email"],
        "phone": app.get("phone", ""),
        "skills": app.get("skills", []),
        "status": "Active",
        "joined_on": date.today(),
        "application_id": application_key,
    }

    try:
        new_vol = db.execute(insert(vol_t).values(**vol_values).returning(*vol_t.columns)).mappings().one()
        db.execute(
            update(app_t)
            .where(app_t.c.id == application_key)
            .values(status="Approved", updated_at=datetime.now(timezone.utc))
        )
        _record_audit(db, user, "create", "volunteers", str(new_vol["id"]), {"source": "application_approval"})
        db.commit()
        return {
            "volunteer": _serialize(new_vol),
            "application": _serialize(app),
            "message": "Successfully approved and created volunteer profile.",
        }
    except Exception as error:
        db.rollback()
        logger.exception("Failed to approve volunteer application")
        raise HTTPException(status_code=409, detail=f"Failed to create volunteer profile: {str(error)}")
