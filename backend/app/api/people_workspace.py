import re
import uuid
from datetime import date, datetime, timezone
from typing import Any

import phonenumbers
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from sqlalchemy import String, Table, case, cast, func, insert, literal, or_, select, update
from sqlalchemy.exc import IntegrityError

from app.api.records import (
    READ_ROLES,
    _convert_value,
    _metadata,
    _record_audit,
    _require_role,
    _serialize,
    _table,
    _tables,
    _tables_lock,
)
from app.dependencies import CurrentUser, DbSession
from app.schemas import to_camel

router = APIRouter(prefix="/api", tags=["people management"])
HR_ROLES = {"Admin", "Project Manager", "Staff"}
TASK_STATUSES = {"Not Started", "In Progress", "On Hold", "Completed"}
TASK_PRIORITIES = {"Low", "Medium", "High", "Critical"}
OPPORTUNITY_TYPES = {"Job", "Internship", "Volunteer"}
OPPORTUNITY_STATUSES = {"Draft", "Published", "Closed"}


def _named_table(db, name: str) -> Table:
    with _tables_lock:
        if name not in _tables:
            _tables[name] = Table(name, _metadata, autoload_with=db.connection())
        return _tables[name]


def _uuid(value: Any, label: str) -> uuid.UUID:
    try:
        return uuid.UUID(str(value))
    except (ValueError, TypeError, AttributeError) as error:
        raise HTTPException(status_code=422, detail=f"{label} must be a valid identifier.") from error


def _column_id(column, value):
    if isinstance(value, uuid.UUID):
        try:
            if column.type.python_type is str:
                return str(value)
        except NotImplementedError:
            pass
    return _convert_value(column, value)


def _required_text(value: Any, label: str, max_length: int = 5000) -> str:
    if not isinstance(value, str) or not value.strip():
        raise HTTPException(status_code=422, detail=f"{label} is required.")
    normalized = value.strip()
    if len(normalized) > max_length:
        raise HTTPException(status_code=422, detail=f"{label} must be {max_length} characters or fewer.")
    return normalized


def _iso_date(value: Any, label: str, *, optional: bool = False) -> date | None:
    if value in (None, "") and optional:
        return None
    try:
        if isinstance(value, date):
            return value
        return date.fromisoformat(str(value))
    except (ValueError, TypeError) as error:
        raise HTTPException(status_code=422, detail=f"{label} must be a valid ISO date.") from error


def _as_date(value: Any) -> date | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        return None


def _is_past_date(value: Any) -> bool:
    parsed = _as_date(value)
    return parsed is not None and parsed < date.today()


def _phone_e164(value: Any) -> str:
    if not isinstance(value, str):
        raise HTTPException(status_code=422, detail="Enter a valid international phone number.")
    raw = value.strip()
    if not raw or re.search(r"[A-Za-z]", raw) or re.search(r"[^0-9+().\-\s]", raw):
        raise HTTPException(status_code=422, detail="Enter a valid international phone number.")
    try:
        parsed = phonenumbers.parse(raw, None if raw.startswith("+") else "IN")
    except phonenumbers.NumberParseException as error:
        raise HTTPException(status_code=422, detail="Enter a valid international phone number.") from error
    if not phonenumbers.is_valid_number(parsed):
        raise HTTPException(status_code=422, detail="Enter a valid phone number for the selected country.")
    if parsed.country_code == 91 and len(str(parsed.national_number)) != 10:
        raise HTTPException(status_code=422, detail="Indian phone numbers must contain exactly 10 digits.")
    return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)


def _role_member(db, assignee_type: str, assignee_id: uuid.UUID):
    resources = {
        "Employee": ("staff", "staff_id"),
        "Intern": ("intern-profiles", "intern_id"),
        "Volunteer": ("volunteers", "volunteer_id"),
    }
    if assignee_type not in resources:
        raise HTTPException(status_code=422, detail="Select an employee, intern, or volunteer.")
    resource, column_name = resources[assignee_type]
    table = _table(db, resource)
    person_id = _column_id(table.c.id, assignee_id)
    row = db.execute(select(table).where(table.c.id == person_id)).mappings().first()
    if row is None:
        raise HTTPException(status_code=422, detail="The selected assignee does not exist.")
    if row.get("status") not in {"Active", "On Leave"}:
        raise HTTPException(status_code=422, detail="The selected person is not active.")
    return column_name, row


def _task_join(db):
    task = _named_table(db, "people_tasks")
    staff = _named_table(db, "staff_profiles")
    intern = _named_table(db, "intern_profiles")
    volunteer = _named_table(db, "volunteer_profiles")
    assigned_by = _named_table(db, "users").alias("task_assigned_by")
    department = _named_table(db, "departments")
    project = _named_table(db, "projects")
    query = (
        select(
            task,
            func.coalesce(staff.c.full_name, intern.c.full_name, volunteer.c.full_name).label("assignee_name"),
            func.coalesce(staff.c.email, intern.c.email, volunteer.c.email).label("assignee_email"),
            assigned_by.c.full_name.label("assigned_by_name"),
            department.c.name.label("department_name"),
            project.c.name.label("project_name"),
            case(
                ((task.c.status != "Completed") & (task.c.due_date < date.today()), "Overdue"),
                else_=task.c.status,
            ).label("effective_status"),
        )
        .select_from(
            task.outerjoin(staff, task.c.staff_id == staff.c.id)
            .outerjoin(intern, task.c.intern_id == intern.c.id)
            .outerjoin(volunteer, task.c.volunteer_id == volunteer.c.id)
            .outerjoin(
                assigned_by,
                func.replace(cast(task.c.assigned_by, String), "-", "")
                == func.replace(cast(assigned_by.c.id, String), "-", ""),
            )
            .outerjoin(department, task.c.department_id == department.c.id)
            .outerjoin(project, task.c.project_id == project.c.id)
        )
    )
    return task, query


def _assigned_task_filter(db, task, user):
    user_id = _uuid(user.id, "User")
    assignments = (
        ("staff_profiles", "staff_id"),
        ("intern_profiles", "intern_id"),
        ("volunteer_profiles", "volunteer_id"),
    )
    conditions = []
    for table_name, task_column in assignments:
        profile = _named_table(db, table_name)
        conditions.append(
            task.c[task_column].in_(
            select(profile.c.id).where(
                profile.c.user_id == _column_id(profile.c.user_id, user_id)
            )
            )
        )
    return or_(*conditions)


def _task_dict(row) -> dict[str, Any]:
    result = _serialize(row)
    result["status"] = result.pop("effectiveStatus", result.get("status"))
    result["assigneeName"] = result.pop("assigneeName", None)
    result["assigneeEmail"] = result.pop("assigneeEmail", None)
    result["assignedByName"] = result.pop("assignedByName", None)
    result["departmentName"] = result.pop("departmentName", None)
    result["projectName"] = result.pop("projectName", None)
    return result


def _task_values(db, payload: dict[str, Any], *, existing=None) -> dict[str, Any]:
    allowed = {
        "title", "description", "assigneeType", "assigneeId", "startDate", "dueDate",
        "priority", "status", "departmentId", "projectId",
    }
    unknown = set(payload) - allowed
    if unknown:
        raise HTTPException(status_code=422, detail=f"Unknown field(s): {', '.join(sorted(unknown))}.")
    current = {}
    if existing is not None:
        row = dict(existing)
        if row.get("staff_id"):
            current.update(assigneeType="Employee", assigneeId=row["staff_id"])
        elif row.get("intern_id"):
            current.update(assigneeType="Intern", assigneeId=row["intern_id"])
        else:
            current.update(assigneeType="Volunteer", assigneeId=row["volunteer_id"])
        current.update(
            title=row["title"], description=row["description"], startDate=row["starts_on"],
            dueDate=row["due_date"], priority=row["priority"], status=row["status"],
            departmentId=row.get("department_id"), projectId=row.get("project_id"),
        )
    merged = {**current, **payload}
    required = ("title", "description", "assigneeType", "assigneeId", "startDate", "dueDate", "priority", "status")
    missing = [field for field in required if field not in merged or merged[field] in (None, "")]
    if missing:
        labels = ", ".join(field[0].upper() + field[1:] for field in missing)
        raise HTTPException(status_code=422, detail=f"Required task fields are missing: {labels}.")
    title = _required_text(merged["title"], "Task title", 160)
    description = _required_text(merged["description"], "Task description", 5000)
    starts_on = _iso_date(merged["startDate"], "Start date")
    due_date = _iso_date(merged["dueDate"], "Due date")
    if starts_on is None or due_date is None:
        raise HTTPException(status_code=422, detail="Task start and due dates are required.")
    if starts_on > due_date:
        raise HTTPException(status_code=422, detail="Due date cannot be earlier than the start date.")
    if merged["priority"] not in TASK_PRIORITIES:
        raise HTTPException(status_code=422, detail="Select a valid task priority.")
    if merged["status"] not in TASK_STATUSES:
        raise HTTPException(status_code=422, detail="Select a valid task status.")
    assignee_id = _uuid(merged["assigneeId"], "Assignee")
    assignee_column, _ = _role_member(db, merged["assigneeType"], assignee_id)
    target_resource = {"Employee": "staff", "Intern": "intern-profiles", "Volunteer": "volunteers"}[merged["assigneeType"]]
    target_id = _column_id(_table(db, target_resource).c.id, assignee_id)
    department_id = _required_text(merged["departmentId"], "Department", 80) if merged.get("departmentId") else None
    project_id = _column_id(_named_table(db, "projects").c.id, _uuid(merged["projectId"], "Project")) if merged.get("projectId") else None
    return {
        "title": title,
        "description": description,
        "starts_on": starts_on,
        "due_date": due_date,
        "priority": merged["priority"],
        "status": merged["status"],
        "staff_id": target_id if assignee_column == "staff_id" else None,
        "intern_id": target_id if assignee_column == "intern_id" else None,
        "volunteer_id": target_id if assignee_column == "volunteer_id" else None,
        "department_id": department_id,
        "project_id": project_id,
    }


def _is_assignee(db, task, user) -> bool:
    staff = _named_table(db, "staff_profiles")
    intern = _named_table(db, "intern_profiles")
    volunteer = _named_table(db, "volunteer_profiles")
    user_id = _uuid(user.id, "User")
    return any((
        task["staff_id"] is not None and db.scalar(select(staff.c.id).where(staff.c.id == task["staff_id"], staff.c.user_id == _column_id(staff.c.user_id, user_id))) is not None,
        task["intern_id"] is not None and db.scalar(select(intern.c.id).where(intern.c.id == task["intern_id"], intern.c.user_id == _column_id(intern.c.user_id, user_id))) is not None,
        task["volunteer_id"] is not None and db.scalar(select(volunteer.c.id).where(volunteer.c.id == task["volunteer_id"], volunteer.c.user_id == _column_id(volunteer.c.user_id, user_id))) is not None,
    ))


def _record_task_history(db, task_id, actor_id, old, new) -> None:
    history = _named_table(db, "people_task_history")
    for field in sorted(set(old) | set(new)):
        before, after = old.get(field), new.get(field)
        if before == after:
            continue
        db.execute(insert(history).values(
            task_id=_column_id(history.c.task_id, task_id),
            actor_id=_column_id(history.c.actor_id, actor_id) if actor_id is not None else None,
            field_name=field,
            old_value=before.isoformat() if hasattr(before, "isoformat") else (str(before) if before is not None else None),
            new_value=after.isoformat() if hasattr(after, "isoformat") else (str(after) if after is not None else None),
        ))


@router.get("/people/tasks")
def list_people_tasks(
    user: CurrentUser,
    db: DbSession,
    assignee_id: str | None = Query(default=None, alias="assigneeId"),
    assignee_type: str | None = Query(default=None, alias="assigneeType"),
    department_id: str | None = Query(default=None, alias="departmentId"),
    priority: str | None = None,
    status: str | None = None,
    due_from: date | None = Query(default=None, alias="dueFrom"),
    due_to: date | None = Query(default=None, alias="dueTo"),
    search: str | None = Query(default=None, max_length=200),
):
    is_hr = user.role in HR_ROLES
    if not is_hr and user.role != "Volunteer":
        raise HTTPException(status_code=403, detail="You do not have permission to view these tasks.")
    task, query = _task_join(db)
    if not is_hr:
        query = query.where(_assigned_task_filter(db, task, user))
    if assignee_id:
        parsed_id = _uuid(assignee_id, "Assignee")
        if assignee_type == "Employee":
            query = query.where(task.c.staff_id == _column_id(task.c.staff_id, parsed_id))
        elif assignee_type == "Intern":
            query = query.where(task.c.intern_id == _column_id(task.c.intern_id, parsed_id))
        elif assignee_type == "Volunteer":
            query = query.where(task.c.volunteer_id == _column_id(task.c.volunteer_id, parsed_id))
        else:
            query = query.where(or_(
                task.c.staff_id == _column_id(task.c.staff_id, parsed_id),
                task.c.intern_id == _column_id(task.c.intern_id, parsed_id),
                task.c.volunteer_id == _column_id(task.c.volunteer_id, parsed_id),
            ))
    if department_id:
        query = query.where(task.c.department_id == department_id)
    if priority:
        if priority not in TASK_PRIORITIES:
            raise HTTPException(status_code=422, detail="Select a valid task priority.")
        query = query.where(task.c.priority == priority)
    if status:
        if status == "Overdue":
            query = query.where(task.c.status != "Completed", task.c.due_date < date.today())
        elif status in TASK_STATUSES:
            query = query.where(task.c.status == status)
        else:
            raise HTTPException(status_code=422, detail="Select a valid task status.")
    if due_from:
        query = query.where(task.c.due_date >= due_from)
    if due_to:
        query = query.where(task.c.due_date <= due_to)
    if search:
        query = query.where(or_(task.c.title.ilike(f"%{search}%"), task.c.description.ilike(f"%{search}%")))
    rows = db.execute(query.order_by(task.c.due_date, task.c.created_at.desc())).mappings().all()
    return {"items": [_task_dict(row) for row in rows], "total": len(rows)}


@router.post("/people/tasks", status_code=201)
def create_people_task(payload: dict[str, Any], user: CurrentUser, db: DbSession):
    _require_role(user, HR_ROLES)
    values = _task_values(db, payload)
    task = _named_table(db, "people_tasks")
    try:
        created = db.execute(insert(task).values(
            id=_column_id(task.c.id, uuid.uuid4()),
            **values,
            assigned_by=_column_id(task.c.assigned_by, user.id),
        ).returning(*task.columns)).mappings().one()
        _record_task_history(db, created["id"], user.id, {}, values)
        _record_audit(db, user, "create", "people-tasks", str(created["id"]), {"fields": sorted(values)})
        db.commit()
        row = db.execute(_task_join(db)[1].where(task.c.id == created["id"])).mappings().one()
        return _task_dict(row)
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="The task conflicts with existing data or a database constraint.") from error


@router.patch("/people/tasks/{task_id}")
def update_people_task(task_id: str, payload: dict[str, Any], user: CurrentUser, db: DbSession):
    task, _ = _task_join(db)
    task_key = _column_id(task.c.id, _uuid(task_id, "Task"))
    existing = db.execute(select(task).where(task.c.id == task_key)).mappings().first()
    if existing is None:
        raise HTTPException(status_code=404, detail="Task not found.")
    is_hr = user.role in HR_ROLES
    if not is_hr and not _is_assignee(db, existing, user):
        raise HTTPException(status_code=403, detail="You may only update tasks assigned to you.")
    if not is_hr and set(payload) != {"status"}:
        raise HTTPException(status_code=403, detail="Assigned users may only update task status.")
    values = _task_values(db, payload, existing=existing)
    try:
        db.execute(update(task).where(task.c.id == task_key).values(**values))
        _record_task_history(db, task_key, user.id, dict(existing), values)
        _record_audit(db, user, "update", "people-tasks", task_id, {"fields": sorted(values)})
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="The task update conflicts with existing data.") from error
    row = db.execute(_task_join(db)[1].where(task.c.id == task_key)).mappings().one()
    return _task_dict(row)


@router.get("/people/tasks/{task_id}/history")
def get_people_task_history(task_id: str, user: CurrentUser, db: DbSession):
    _require_role(user, HR_ROLES)
    task = _named_table(db, "people_tasks")
    task_key = _column_id(task.c.id, _uuid(task_id, "Task"))
    if db.scalar(select(task.c.id).where(task.c.id == task_key)) is None:
        raise HTTPException(status_code=404, detail="Task not found.")
    history = _named_table(db, "people_task_history")
    users = _named_table(db, "users")
    rows = db.execute(
        select(history, users.c.full_name.label("actor_name"))
        .select_from(
            history.outerjoin(
                users,
                func.replace(cast(history.c.actor_id, String), "-", "")
                == func.replace(cast(users.c.id, String), "-", ""),
            )
        )
        .where(history.c.task_id == task_key)
        .order_by(history.c.created_at.desc())
    ).mappings().all()
    return {"items": [_serialize(row) for row in rows]}


def _opportunity_values(payload: dict[str, Any], *, existing=None) -> dict[str, Any]:
    allowed = {"opportunityType", "title", "description", "requirements", "departmentId", "location", "employmentType", "closesOn", "status"}
    unknown = set(payload) - allowed
    if unknown:
        raise HTTPException(status_code=422, detail=f"Unknown field(s): {', '.join(sorted(unknown))}.")
    current = {}
    if existing is not None:
        row = dict(existing)
        current = {
            "opportunityType": row["opportunity_type"], "title": row["title"], "description": row["description"],
            "requirements": row["requirements"], "departmentId": row.get("department_id"), "location": row["location"],
            "employmentType": row["employment_type"], "closesOn": row.get("closes_on"), "status": row["status"],
        }
    merged = {**current, **payload}
    for field in ("opportunityType", "title", "description", "status"):
        if merged.get(field) in (None, ""):
            raise HTTPException(status_code=422, detail=f"{field[0].upper() + field[1:]} is required.")
    if merged["opportunityType"] not in OPPORTUNITY_TYPES:
        raise HTTPException(status_code=422, detail="Select a valid opportunity type.")
    if merged["status"] not in OPPORTUNITY_STATUSES:
        raise HTTPException(status_code=422, detail="Select a valid opportunity status.")
    title = _required_text(merged["title"], "Title", 160)
    description = _required_text(merged["description"], "Description", 10000)
    requirements = str(merged.get("requirements") or "").strip()
    closes_on = _iso_date(merged.get("closesOn"), "Application deadline", optional=True)
    if merged["status"] == "Published":
        if closes_on is not None and closes_on < date.today():
            raise HTTPException(status_code=422, detail="A published opportunity must have a future application deadline.")
    department_id = _required_text(merged["departmentId"], "Department", 80) if merged.get("departmentId") else None
    return {
        "opportunity_type": merged["opportunityType"],
        "title": title,
        "description": description,
        "requirements": requirements,
        "department_id": department_id,
        "location": str(merged.get("location") or "").strip(),
        "employment_type": str(merged.get("employmentType") or "").strip(),
        "closes_on": closes_on,
        "status": merged["status"],
    }


def _slug_for(title: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:90] or "opportunity"
    return f"{base}-{uuid.uuid4().hex[:8]}"


@router.get("/people/opportunities")
def list_people_opportunities(user: CurrentUser, db: DbSession):
    _require_role(user, HR_ROLES)
    table = _named_table(db, "people_opportunities")
    rows = db.execute(select(table).order_by(table.c.created_at.desc())).mappings().all()
    items = []
    for row in rows:
        item = _serialize(row)
        if item["status"] == "Published" and _is_past_date(item["closesOn"]):
            item["status"] = "Expired"
        items.append(item)
    return {"items": items, "total": len(items)}


@router.post("/people/opportunities", status_code=201)
def create_people_opportunity(payload: dict[str, Any], user: CurrentUser, db: DbSession):
    _require_role(user, HR_ROLES)
    values = _opportunity_values(payload)
    table = _named_table(db, "people_opportunities")
    values["slug"] = _slug_for(values["title"])
    values["created_by"] = _column_id(table.c.created_by, user.id)
    if values["status"] == "Published":
        values["published_at"] = datetime.now(timezone.utc)
    try:
        row = db.execute(insert(table).values(
            id=_column_id(table.c.id, uuid.uuid4()),
            **values,
        ).returning(*table.columns)).mappings().one()
        _record_audit(db, user, "create", "people-opportunities", str(row["id"]), {"fields": sorted(values)})
        db.commit()
        return _serialize(row)
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="The opportunity conflicts with existing data.") from error


@router.patch("/people/opportunities/{opportunity_id}")
def update_people_opportunity(opportunity_id: str, payload: dict[str, Any], user: CurrentUser, db: DbSession):
    _require_role(user, HR_ROLES)
    table = _named_table(db, "people_opportunities")
    key = _column_id(table.c.id, _uuid(opportunity_id, "Opportunity"))
    existing = db.execute(select(table).where(table.c.id == key)).mappings().first()
    if existing is None:
        raise HTTPException(status_code=404, detail="Opportunity not found.")
    values = _opportunity_values(payload, existing=existing)
    if values["status"] == "Published" and existing["status"] != "Published":
        values["published_at"] = datetime.now(timezone.utc)
    try:
        row = db.execute(update(table).where(table.c.id == key).values(**values).returning(*table.columns)).mappings().one()
        _record_audit(db, user, "update", "people-opportunities", str(key), {"fields": sorted(values)})
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="The opportunity update conflicts with existing data.") from error
    return _serialize(row)


class PublicApplication(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    phone: str
    message: str = Field(default="", max_length=5000)
    college: str = Field(default="", max_length=200)
    degree: str = Field(default="", max_length=200)
    skills: list[str] = Field(default_factory=list, max_length=30)
    experience_years: float = Field(default=0, ge=0, le=80)

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="forbid")

    @field_validator("full_name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        cleaned = value.strip()
        if len(cleaned) < 2:
            raise ValueError("Enter your full name.")
        return cleaned

    @field_validator("phone")
    @classmethod
    def normalize_phone(cls, value: str) -> str:
        return _phone_e164(value)

    @field_validator("message", "college", "degree")
    @classmethod
    def trim_text(cls, value: str) -> str:
        return value.strip()


def _public_opportunity(db, slug: str):
    table = _named_table(db, "people_opportunities")
    row = db.execute(select(table).where(table.c.slug == slug)).mappings().first()
    if row is None or row["status"] == "Draft":
        raise HTTPException(status_code=404, detail="This opportunity is not available.")
    if row["status"] == "Closed" or _is_past_date(row["closes_on"]):
        raise HTTPException(status_code=410, detail="This opportunity is no longer accepting applications.")
    return table, row


@router.get("/public/opportunities/{slug}")
def get_public_opportunity(slug: str, db: DbSession):
    _, row = _public_opportunity(db, slug)
    return {
        "slug": row["slug"],
        "opportunityType": row["opportunity_type"],
        "title": row["title"],
        "description": row["description"],
        "requirements": row["requirements"],
        "location": row["location"],
        "employmentType": row["employment_type"],
        "closesOn": row["closes_on"],
    }


@router.post("/public/opportunities/{slug}/applications", status_code=201)
def apply_to_public_opportunity(slug: str, payload: PublicApplication, db: DbSession):
    opportunity_table, opportunity = _public_opportunity(db, slug)
    app_values = payload.model_dump(by_alias=False)
    common = {
        "full_name": app_values["full_name"],
        "email": str(app_values["email"]).lower(),
        "phone": app_values["phone"],
        "opportunity_id": opportunity["id"],
    }
    try:
        if opportunity["opportunity_type"] == "Job":
            table = _table(db, "hr-applicants")
            values = {
                **common,
                "requirement_id": None,
                "qualification": app_values["degree"],
                "experience_years": app_values["experience_years"],
                "skills": app_values["skills"],
                "status": "Applied",
                "notes": app_values["message"],
            }
        elif opportunity["opportunity_type"] == "Internship":
            table = _table(db, "intern-applications")
            values = {
                **common,
                "area_of_interest": opportunity["title"],
                "college": app_values["college"],
                "degree": app_values["degree"],
                "skills": app_values["skills"],
                "notes": app_values["message"],
                "status": "Applied",
            }
        else:
            table = _table(db, "volunteer-applications")
            values = {
                **common,
                "skills": app_values["skills"],
                "motivation": app_values["message"],
                "status": "Applied",
            }
        values["opportunity_id"] = _convert_value(table.c.opportunity_id, opportunity["id"])
        inserted = db.execute(insert(table).values(**values).returning(table.c.id)).scalar_one()
        db.commit()
        return {"message": "Application received.", "applicationId": str(inserted)}
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="An application with this email already exists or the opportunity is no longer available.") from error


def _event_in_range(item: dict[str, Any], start: date | None, end: date | None) -> bool:
    begins = item.get("startDate")
    finishes = item.get("dueDate") or begins
    begins_date = _as_date(begins)
    finishes_date = _as_date(finishes)
    if start and finishes_date and finishes_date < start:
        return False
    if end and begins_date and begins_date > end:
        return False
    return True


@router.get("/people/calendar")
def get_people_calendar(
    user: CurrentUser,
    db: DbSession,
    date_from: date | None = Query(default=None, alias="dateFrom"),
    date_to: date | None = Query(default=None, alias="dateTo"),
    person_id: str | None = Query(default=None, alias="personId"),
    person_type: str | None = Query(default=None, alias="personType"),
    department_id: str | None = Query(default=None, alias="departmentId"),
    status: str | None = None,
    event_type: str | None = Query(default=None, alias="eventType"),
):
    _require_role(user, READ_ROLES)
    if date_from and date_to and date_from > date_to:
        raise HTTPException(status_code=422, detail="The end of the date range cannot precede its start.")
    events: list[dict[str, Any]] = []
    task, task_query = _task_join(db)
    task_rows = db.execute(task_query).mappings().all()
    for row in task_rows:
        item = _task_dict(row)
        item.update(
            id=f"task:{item['id']}", eventType="Task", personId=item.get("staffId") or item.get("internId") or item.get("volunteerId"),
            personType="Employee" if item.get("staffId") else "Intern" if item.get("internId") else "Volunteer",
            assignedPerson=item.get("assigneeName"), assignedBy=item.get("assignedByName"),
            startDate=item.get("startsOn"), dueDate=item.get("dueDate"), relatedProject=item.get("projectName"),
            description=item.get("description", ""), link=f"/people-management/tasks?task={item['id']}",
        )
        events.append(item)

    legacy_tasks = _table(db, "intern-tasks")
    interns = _named_table(db, "intern_profiles")
    mentors = _named_table(db, "staff_profiles")
    legacy_rows = db.execute(
        select(
            legacy_tasks,
            interns.c.full_name.label("intern_name"),
            interns.c.department_id.label("department_id"),
            mentors.c.full_name.label("mentor_name"),
        )
        .select_from(
            legacy_tasks.join(interns, legacy_tasks.c.intern_id == interns.c.id)
            .outerjoin(mentors, interns.c.mentor_staff_id == mentors.c.id)
        )
    ).mappings().all()
    for row in legacy_rows:
        starts_on = row["created_at"].date() if isinstance(row["created_at"], datetime) else (row["created_at"] or row["due_date"])
        status_value = row["status"]
        if status_value not in {"Completed", "Done"} and row["due_date"] and row["due_date"] < date.today():
            status_value = "Overdue"
        events.append({
            "id": f"intern-task:{row['id']}", "eventType": "Task", "title": row["title"],
            "assignedPerson": row["intern_name"], "assignedBy": row["mentor_name"], "personId": str(row["intern_id"]),
            "personType": "Intern", "departmentId": row["department_id"], "startDate": starts_on,
            "dueDate": row["due_date"], "status": status_value, "priority": row["priority"],
            "description": row["description"], "relatedProject": row["project_name"],
            "link": "/people-management/interns",
        })

    attendance_sources = (
        ("staff-attendance", "staff_id", "staff_profiles", "Employee"),
        ("intern-attendance", "intern_id", "intern_profiles", "Intern"),
        ("volunteer-attendance", "volunteer_id", "volunteer_profiles", "Volunteer"),
    )
    for resource, person_column, person_table_name, role in attendance_sources:
        records = _table(db, resource)
        people = _named_table(db, person_table_name)
        department_column = people.c.department_id if "department_id" in people.c else literal(None)
        for row in db.execute(
            select(records, people.c.full_name.label("person_name"), department_column.label("department_id"))
            .select_from(records.join(people, records.c[person_column] == people.c.id))
        ).mappings().all():
            item = {
                "id": f"attendance:{role}:{row['id']}", "eventType": "Attendance",
                "title": f"{role} attendance · {row['status']}", "assignedPerson": row["person_name"],
                "personId": str(row[person_column]), "personType": role, "departmentId": row["department_id"],
                "startDate": row["attendance_date"], "dueDate": row["attendance_date"], "status": row["status"],
                "priority": None, "description": row.get("notes") or row.get("note") or "",
                "link": f"/people-management/attendance?personType={role}&personId={row[person_column]}&date={row['attendance_date']}",
            }
            events.append(item)

    opportunity = _named_table(db, "people_opportunities")
    for row in db.execute(select(opportunity).where(opportunity.c.status == "Published", opportunity.c.closes_on.is_not(None))).mappings().all():
        events.append({
            "id": f"opportunity:{row['id']}", "eventType": "Deadline", "title": f"Applications close · {row['title']}",
            "assignedPerson": None, "personId": None, "personType": None, "departmentId": row["department_id"],
            "startDate": row["closes_on"], "dueDate": row["closes_on"],
            "status": "Overdue" if _is_past_date(row["closes_on"]) else "Upcoming", "priority": None,
            "description": row["description"], "link": f"/opportunities/{row['slug']}",
        })

    requirements = _table(db, "hr-requirements")
    for row in db.execute(select(requirements).where(requirements.c.closes_on.is_not(None))).mappings().all():
        events.append({
            "id": f"requirement:{row['id']}", "eventType": "Deadline", "title": f"Hiring deadline · {row['title']}",
            "assignedPerson": None, "personId": None, "personType": None, "departmentId": row["department_id"],
            "startDate": row["closes_on"], "dueDate": row["closes_on"],
            "status": "Overdue" if _is_past_date(row["closes_on"]) else "Upcoming", "priority": row["urgency"],
            "description": row["description"], "link": "/people-management/hr",
        })

    applicants = _table(db, "hr-applicants")
    for row in db.execute(select(applicants).where(applicants.c.interview_date.is_not(None))).mappings().all():
        events.append({
            "id": f"interview:{row['id']}", "eventType": "Interview", "title": f"Interview · {row['full_name']}",
            "assignedPerson": row["full_name"], "personId": None, "personType": "Applicant", "departmentId": None,
            "startDate": row["interview_date"], "dueDate": row["interview_date"], "status": row["status"],
            "priority": None, "description": row["interview_notes"], "link": "/people-management/hr",
        })

    calendar_events = _named_table(db, "events")
    for row in db.execute(select(calendar_events)).mappings().all():
        events.append({
            "id": f"event:{row['id']}", "eventType": row["event_type"], "title": row["title"],
            "assignedPerson": row["organizer"], "personId": None, "personType": None, "departmentId": None,
            "startDate": row["starts_at"], "dueDate": row["ends_at"] or row["starts_at"], "status": row["status"],
            "priority": None, "description": row["description"], "relatedProject": str(row["project_id"]) if row["project_id"] else None,
            "link": "/events",
        })

    parsed_person = _uuid(person_id, "Person") if person_id else None
    filtered = []
    for item in events:
        if not _event_in_range(item, date_from, date_to):
            continue
        if parsed_person and str(item.get("personId")) != str(parsed_person):
            continue
        if person_type and item.get("personType") != person_type:
            continue
        if department_id and str(item.get("departmentId")) != department_id:
            continue
        if status and item.get("status") != status:
            continue
        if event_type and item.get("eventType") != event_type:
            continue
        filtered.append(item)
    filtered.sort(key=lambda item: str(item.get("startDate") or ""))
    return {"items": filtered, "total": len(filtered)}
