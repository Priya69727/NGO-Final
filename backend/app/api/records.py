import logging
import re
from threading import RLock
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Request, Response, status
from sqlalchemy import MetaData, Table, and_, func, insert, or_, select, update, delete
from sqlalchemy.exc import DataError, IntegrityError, NoSuchTableError, StatementError
from sqlalchemy.sql.sqltypes import JSON, Date, DateTime, Numeric, String
import phonenumbers

from app.dependencies import CurrentUser, DbSession

logger = logging.getLogger(__name__)

# Public API names are deliberately explicit; clients cannot choose arbitrary tables.
RESOURCES = {
    "proposals": "proposals",
    "projects": "projects",
    "team-members": "project_team_members",
    "partners": "project_partners",
    "milestones": "project_milestones",
    "tasks": "project_tasks",
    "department-checklists": "project_department_checklists",
    "documents": "project_documents",
    "budget-items": "project_budget_items",
    "expenses": "project_expenses",
    "funding-sources": "project_funding_sources",
    "impact-indicators": "impact_indicators",
    "impact-measurements": "impact_measurements",
    "beneficiaries": "beneficiaries",
    "beneficiary-enrollments": "beneficiary_enrollments",
    "beneficiary-services": "beneficiary_services",
    "donors": "donors",
    "donor-occasions": "donor_occasions",
    "campaigns": "campaigns",
    "contributions": "contributions",
    "donor-interactions": "donor_interactions",
    "events": "events",
    "event-registrations": "event_registrations",
    "departments": "departments",
    "staff": "staff_profiles",
    "staff-attendance": "staff_attendance",
    "staff-leave-applications": "staff_leave_applications",
    "staff-performance-reviews": "staff_performance_reviews",
    "staff-payroll": "staff_payroll",
    "hr-requirements": "hr_requirements",
    "hr-applicants": "hr_applicants",
    "intern-applications": "intern_applications",
    "intern-application-history": "intern_application_history",
    "intern-profiles": "intern_profiles",
    "intern-tasks": "intern_tasks",
    "intern-attendance": "intern_attendance",
    "intern-feedback": "intern_feedback",
    "intern-certificates": "intern_certificates",
    "volunteers": "volunteer_profiles",
    "volunteer-applications": "volunteer_applications",
    "volunteer-assignments": "volunteer_assignments",
    "volunteer-attendance": "volunteer_attendance",
    "volunteer-feedback": "volunteer_feedback",
    "volunteer-recognitions": "volunteer_recognitions",
    "communications": "communications",
    "resources": "project_resources",
    "risks": "project_risks",
    "activity": "activity_logs",
}

READ_ROLES = {"Admin", "Project Manager", "Staff"}
WRITE_ROLES = {
    "proposals": {"Admin", "Project Manager", "Staff"},
    "projects": {"Admin", "Project Manager"},
    "team-members": {"Admin", "Project Manager"},
    "partners": {"Admin", "Project Manager"},
    "milestones": {"Admin", "Project Manager", "Staff"},
    "tasks": {"Admin", "Project Manager", "Staff"},
    "department-checklists": {"Admin", "Project Manager", "Staff"},
    "documents": {"Admin", "Project Manager", "Staff"},
    "budget-items": {"Admin", "Project Manager"},
    "expenses": {"Admin", "Project Manager", "Staff"},
    "funding-sources": {"Admin", "Project Manager"},
    "impact-indicators": {"Admin", "Project Manager", "Staff"},
    "impact-measurements": {"Admin", "Project Manager", "Staff"},
    "beneficiaries": {"Admin", "Project Manager", "Staff"},
    "beneficiary-enrollments": {"Admin", "Project Manager", "Staff"},
    "beneficiary-services": {"Admin", "Project Manager", "Staff"},
    "donors": {"Admin", "Staff"},
    "donor-occasions": {"Admin", "Staff"},
    "campaigns": {"Admin", "Staff"},
    "contributions": {"Admin", "Staff"},
    "donor-interactions": {"Admin", "Staff"},
    "events": {"Admin", "Project Manager", "Staff"},
    "event-registrations": {"Admin", "Project Manager", "Staff"},
    "departments": {"Admin"},
    "staff": {"Admin", "Project Manager", "Staff"},
    "staff-attendance": {"Admin", "Project Manager", "Staff"},
    "staff-leave-applications": {"Admin", "Project Manager", "Staff"},
    "staff-performance-reviews": {"Admin", "Project Manager", "Staff"},
    "staff-payroll": {"Admin", "Staff"},
    "hr-requirements": {"Admin", "Project Manager", "Staff"},
    "hr-applicants": {"Admin", "Project Manager", "Staff"},
    "intern-applications": {"Admin", "Project Manager", "Staff"},
    "intern-application-history": {"Admin", "Project Manager", "Staff"},
    "intern-profiles": {"Admin", "Project Manager", "Staff"},
    "intern-tasks": {"Admin", "Project Manager", "Staff"},
    "intern-attendance": {"Admin", "Project Manager", "Staff"},
    "intern-feedback": {"Admin", "Project Manager", "Staff"},
    "intern-certificates": {"Admin", "Staff"},
    "volunteers": {"Admin", "Project Manager", "Staff"},
    "volunteer-applications": {"Admin", "Project Manager", "Staff"},
    "volunteer-assignments": {"Admin", "Project Manager", "Staff"},
    "volunteer-attendance": {"Admin", "Project Manager", "Staff"},
    "volunteer-feedback": {"Admin", "Project Manager", "Staff"},
    "volunteer-recognitions": {"Admin", "Project Manager", "Staff"},
    "communications": {"Admin", "Staff"},
    "resources": {"Admin", "Project Manager", "Staff"},
    "risks": {"Admin", "Project Manager", "Staff"},
    "activity": set(),
}

_metadata = MetaData()
_tables: dict[str, Table] = {}
_tables_lock = RLock()
_camel_boundary = re.compile(r"(?<!^)(?=[A-Z])")


def _snake_case(value: str) -> str:
    return _camel_boundary.sub("_", value).lower()


def _camel_case(value: str) -> str:
    first, *rest = value.split("_")
    return first + "".join(part.capitalize() for part in rest)


def _table(db, resource: str) -> Table:
    name = RESOURCES.get(resource)
    if name is None:
        raise HTTPException(status_code=404, detail="Resource not found.")
    with _tables_lock:
        if name not in _tables:
            try:
                _tables[name] = Table(name, _metadata, autoload_with=db.connection())
            except NoSuchTableError as error:
                logger.exception("Required database table is missing: %s", name)
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail=f"Database schema is missing the required table: {name}.",
                ) from error
        return _tables[name]


def _require_role(user, allowed: set[str]) -> None:
    if user.role not in allowed:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to perform this action.")


def _convert_value(column, value: Any) -> Any:
    if value is None:
        return None
    try:
        python_type = column.type.python_type
        if python_type is UUID:
            return UUID(str(value))
        if isinstance(column.type, DateTime):
            return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        if isinstance(column.type, Date):
            return date.fromisoformat(str(value))
        if isinstance(column.type, Numeric):
            return Decimal(str(value))
        if isinstance(column.type, JSON):
            return value
        if python_type is bool:
            if not isinstance(value, bool):
                raise ValueError("Expected a boolean value.")
            return value
        if python_type is int:
            if isinstance(value, bool):
                raise ValueError("Expected an integer value.")
            return int(value)
        if python_type is float:
            return float(value)
        if python_type is str:
            if not isinstance(value, str):
                raise ValueError("Expected a string value.")
            return value
        if python_type is list and not isinstance(value, list):
            raise ValueError("Expected a list value.")
    except (ValueError, TypeError, InvalidOperation, OverflowError) as error:
        raise HTTPException(status_code=422, detail=f"Invalid value for '{column.name}'.") from error
    except NotImplementedError:
        pass
    return value


def _values(table: Table, payload: dict[str, Any], *, inserting: bool) -> dict[str, Any]:
    if not isinstance(payload, dict) or not payload:
        raise HTTPException(status_code=422, detail="A non-empty JSON object is required.")
    primary_keys = {column.name for column in table.primary_key.columns}
    values: dict[str, Any] = {}
    unknown = []
    for api_name, value in payload.items():
        column_name = _snake_case(api_name)
        if column_name not in table.c:
            unknown.append(api_name)
        elif column_name in primary_keys or column_name in {"created_at", "updated_at"}:
            raise HTTPException(status_code=422, detail=f"'{api_name}' cannot be changed.")
        else:
            values[column_name] = _convert_value(table.c[column_name], value)
    if unknown:
        raise HTTPException(status_code=422, detail=f"Unknown field(s): {', '.join(unknown)}.")
    if inserting:
        for column in table.columns:
            if column.name in primary_keys or column.name in values:
                continue
            if column.nullable or column.default is not None or column.server_default is not None or column.autoincrement:
                continue
            raise HTTPException(status_code=422, detail=f"'{_camel_case(column.name)}' is required.")
    return values


def _validate_people_values(db, resource: str, table: Table, values: dict[str, Any], record_id: str | None = None) -> None:
    effective_values = dict(values)
    if record_id is not None:
        key = next(iter(table.primary_key.columns))
        existing = db.execute(
            select(table).where(key == _convert_value(key, record_id))
        ).mappings().first()
        if existing:
            effective_values = {**dict(existing), **values}

    required_fields = {
        "staff": ("full_name", "employee_code", "job_title"),
        "hr-requirements": ("title", "description"),
        "hr-applicants": ("full_name", "email"),
        "intern-applications": ("full_name", "email", "area_of_interest"),
        "intern-profiles": ("application_id", "intern_code"),
        "intern-tasks": ("intern_id", "title", "description"),
        "volunteers": ("full_name",),
        "volunteer-applications": ("full_name", "email"),
        "volunteer-assignments": ("volunteer_id", "role_title"),
        "staff-attendance": ("staff_id", "attendance_date", "status"),
        "intern-attendance": ("intern_id", "attendance_date", "status"),
        "volunteer-attendance": ("volunteer_id", "attendance_date", "status"),
        "staff-leave-applications": ("staff_id", "leave_type", "starts_on", "ends_on", "reason"),
    }
    for field in required_fields.get(resource, ()):
        value = effective_values.get(field)
        if value is None or (isinstance(value, str) and not value.strip()):
            raise HTTPException(
                status_code=422,
                detail=f"{_camel_case(field)} is required and cannot contain only whitespace.",
            )
        if isinstance(value, str):
            effective_values[field] = value.strip()
            values[field] = value.strip()

    email = values.get("email")
    if email is not None:
        normalized_email = email.strip().lower()
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", normalized_email):
            raise HTTPException(status_code=422, detail="Enter a valid email address.")
        values["email"] = normalized_email

        if resource in {"staff", "intern-applications", "volunteers", "volunteer-applications"}:
            conditions = [func.lower(table.c.email) == normalized_email]
            if resource == "intern-applications":
                conditions.append(table.c.status.in_(["New", "Applied", "Under Review", "Shortlisted", "Selected", "Accepted"]))
            elif resource == "volunteer-applications":
                conditions.append(table.c.status.in_(["New", "Applied", "Under Review", "Approved"]))
            if record_id is not None:
                key = next(iter(table.primary_key.columns))
                conditions.append(key != _convert_value(key, record_id))
            if db.scalar(select(table.c.id).where(*conditions).limit(1)) is not None:
                raise HTTPException(status_code=409, detail="A record with this email address already exists.")

    phone = values.get("phone")
    if phone is not None and phone.strip():
        normalized_phone = phone.strip()
        if re.search(r"[A-Za-z]", normalized_phone) or re.search(r"[^0-9+().\-\s]", normalized_phone):
            raise HTTPException(status_code=422, detail="Enter a valid international phone number.")
        try:
            parsed_phone = phonenumbers.parse(normalized_phone, None if normalized_phone.startswith("+") else "IN")
        except phonenumbers.NumberParseException as error:
            raise HTTPException(status_code=422, detail="Enter a valid international phone number.") from error
        if not phonenumbers.is_valid_number(parsed_phone):
            raise HTTPException(status_code=422, detail="Enter a valid phone number for the selected country.")
        if parsed_phone.country_code == 91 and len(str(parsed_phone.national_number)) != 10:
            raise HTTPException(status_code=422, detail="Indian phone numbers must contain exactly 10 digits.")
        values["phone"] = phonenumbers.format_number(parsed_phone, phonenumbers.PhoneNumberFormat.E164)

    attendance_keys = {
        "staff-attendance": ("staff_id", "staffId"),
        "intern-attendance": ("intern_id", "internId"),
        "volunteer-attendance": ("volunteer_id", "volunteerId"),
    }
    if resource in attendance_keys:
        member_column, member_field = attendance_keys[resource]
        member_id = values.get(member_column)
        attendance_date = values.get("attendance_date")
        if attendance_date is not None and attendance_date > date.today():
            raise HTTPException(status_code=422, detail="Attendance cannot be recorded for a future date.")
        if member_id is not None and attendance_date is not None:
            conditions = [
                table.c[member_column] == member_id,
                table.c.attendance_date == attendance_date,
            ]
            if resource == "volunteer-attendance":
                assignment_id = values.get("assignment_id")
                conditions.append(
                    table.c.assignment_id == assignment_id if assignment_id is not None else table.c.assignment_id.is_(None)
                )
            if record_id is not None:
                key = next(iter(table.primary_key.columns))
                conditions.append(key != _convert_value(key, record_id))
            if db.scalar(select(table.c.id).where(*conditions).limit(1)) is not None:
                raise HTTPException(status_code=409, detail=f"Attendance for this {member_field} and date already exists.")

    if resource == "hr-requirements":
        opened_on = effective_values.get("opened_on")
        closes_on = effective_values.get("closes_on")
        if opened_on and closes_on and closes_on < opened_on:
            raise HTTPException(status_code=422, detail="Closing date cannot be earlier than the opening date.")
    if resource == "intern-profiles":
        starts_on = effective_values.get("starts_on")
        ends_on = effective_values.get("ends_on")
        if starts_on and ends_on and ends_on < starts_on:
            raise HTTPException(status_code=422, detail="Internship end date cannot be earlier than its start date.")
    if resource == "volunteer-assignments":
        starts_on = effective_values.get("starts_on")
        ends_on = effective_values.get("ends_on")
        if starts_on and ends_on and ends_on < starts_on:
            raise HTTPException(status_code=422, detail="Assignment end date cannot be earlier than its start date.")

    if resource == "staff-leave-applications":
        staff_id = effective_values.get("staff_id")
        starts_on = effective_values.get("starts_on")
        ends_on = effective_values.get("ends_on")
        status_value = effective_values.get("status", "Pending")
        if starts_on and ends_on and ends_on < starts_on:
            raise HTTPException(status_code=422, detail="Leave end date cannot be earlier than its start date.")
        if staff_id and starts_on and ends_on and status_value not in {"Rejected", "Cancelled"}:
            conditions = [
                table.c.staff_id == staff_id,
                table.c.status.in_(["Pending", "Approved"]),
                table.c.starts_on <= ends_on,
                table.c.ends_on >= starts_on,
            ]
            if record_id is not None:
                key = next(iter(table.primary_key.columns))
                conditions.append(key != _convert_value(key, record_id))
            if db.scalar(select(table.c.id).where(*conditions).limit(1)) is not None:
                raise HTTPException(status_code=409, detail="This leave request overlaps an existing pending or approved request.")


def _serialize(row) -> dict[str, Any]:
    return {_camel_case(key): value for key, value in dict(row).items()}


def _audit_table(db) -> Table:
    with _tables_lock:
        if "audit_logs" not in _tables:
            try:
                _tables["audit_logs"] = Table("audit_logs", _metadata, autoload_with=db.connection())
            except NoSuchTableError as error:
                logger.exception("Required audit_logs table is missing")
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Database audit logging is not configured.",
                ) from error
        return _tables["audit_logs"]


def _record_audit(db, user, action: str, resource: str, entity_id: str, changes: dict[str, Any]) -> None:
    audit = _audit_table(db)
    db.execute(
        insert(audit).values(
            actor_id=str(user.id),
            action=action,
            entity_type=resource,
            entity_id=entity_id,
            changes=changes,
        )
    )


def list_records(
    resource: str,
    request: Request,
    user: CurrentUser,
    db: DbSession,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    search: str | None = Query(default=None, max_length=200),
    sort: str | None = None,
    order: str = Query(default="asc", pattern="^(asc|desc)$"),
):
    if resource != "departments":
        _require_role(user, READ_ROLES)
    table = _table(db, resource)
    query = select(table)
    count_query = select(func.count()).select_from(table)
    conditions = []
    reserved = {"limit", "offset", "search", "sort", "order"}
    for key, value in request.query_params.multi_items():
        if key in reserved:
            continue
        column_name = _snake_case(key)
        if column_name not in table.c:
            raise HTTPException(status_code=422, detail=f"Unknown filter '{key}'.")
        conditions.append(table.c[column_name] == _convert_value(table.c[column_name], value))
    if search:
        search_columns = [
            column for column in table.columns
            if isinstance(column.type, String)
        ]
        if not search_columns:
            raise HTTPException(status_code=422, detail="Search is not supported for this resource.")
        terms = [column.ilike(f"%{search}%") for column in search_columns]
        conditions.append(or_(*terms))
    if conditions:
        condition = and_(*conditions)
        query = query.where(condition)
        count_query = count_query.where(condition)
    if sort:
        sort_name = _snake_case(sort)
        if sort_name not in table.c:
            raise HTTPException(status_code=422, detail=f"Unknown sort field '{sort}'.")
        ordering = table.c[sort_name].desc() if order == "desc" else table.c[sort_name].asc()
        query = query.order_by(ordering)
    elif table.primary_key.columns:
        query = query.order_by(*table.primary_key.columns)
    total = db.scalar(count_query) or 0
    rows = db.execute(query.limit(limit).offset(offset)).mappings().all()
    return {"items": [_serialize(row) for row in rows], "total": total, "limit": limit, "offset": offset}


def get_record(resource: str, record_id: str, user: CurrentUser, db: DbSession):
    if resource != "departments":
        _require_role(user, READ_ROLES)
    table = _table(db, resource)
    if len(table.primary_key.columns) != 1:
        raise HTTPException(status_code=501, detail="This resource does not support record lookup.")
    key = next(iter(table.primary_key.columns))
    value = _convert_value(key, record_id)
    row = db.execute(select(table).where(key == value)).mappings().first()
    if row is None:
        raise HTTPException(status_code=404, detail="Record not found.")
    return _serialize(row)


def create_record(resource: str, payload: dict[str, Any], user: CurrentUser, db: DbSession):
    _require_role(user, WRITE_ROLES.get(resource, set()))
    table = _table(db, resource)
    values = _values(table, payload, inserting=True)
    _validate_people_values(db, resource, table, values)
    try:
        result = db.execute(insert(table).values(**values).returning(*table.columns)).mappings().one()
        row = _serialize(result)
        key = str(row.get(_camel_case(next(iter(table.primary_key.columns)).name), ""))
        _record_audit(db, user, "create", resource, key, {"fields": sorted(values)})
        db.commit()
        return row
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="The record conflicts with existing data or a database constraint.") from error
    except (DataError, StatementError) as error:
        db.rollback()
        raise HTTPException(status_code=422, detail="One or more fields have an invalid value.") from error


def update_record(resource: str, record_id: str, payload: dict[str, Any], user: CurrentUser, db: DbSession):
    _require_role(user, WRITE_ROLES.get(resource, set()))
    table = _table(db, resource)
    if len(table.primary_key.columns) != 1:
        raise HTTPException(status_code=501, detail="This resource does not support record updates.")
    values = _values(table, payload, inserting=False)
    _validate_people_values(db, resource, table, values, record_id)
    key = next(iter(table.primary_key.columns))
    value = _convert_value(key, record_id)
    try:
        result = db.execute(
            update(table).where(key == value).values(**values).returning(*table.columns)
        ).mappings().first()
        if result is None:
            db.rollback()
            raise HTTPException(status_code=404, detail="Record not found.")
        row = _serialize(result)
        _record_audit(db, user, "update", resource, record_id, {"fields": sorted(values)})
        db.commit()
        return row
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="The update conflicts with existing data or a database constraint.") from error
    except (DataError, StatementError) as error:
        db.rollback()
        raise HTTPException(status_code=422, detail="One or more fields have an invalid value.") from error


def delete_record(resource: str, record_id: str, user: CurrentUser, db: DbSession):
    _require_role(user, WRITE_ROLES.get(resource, set()))
    table = _table(db, resource)
    if len(table.primary_key.columns) != 1:
        raise HTTPException(status_code=501, detail="This resource does not support record deletion.")
    key = next(iter(table.primary_key.columns))
    value = _convert_value(key, record_id)
    try:
        row = db.execute(delete(table).where(key == value).returning(*table.columns)).mappings().first()
        if row is None:
            raise HTTPException(status_code=404, detail="Record not found.")
        _record_audit(db, user, "delete", resource, record_id, {"fields": sorted(row.keys())})
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="This record is still referenced and cannot be deleted.") from error
    except (DataError, StatementError) as error:
        db.rollback()
        raise HTTPException(status_code=422, detail="The requested deletion could not be completed.") from error
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def build_resource_router(resources: tuple[str, ...], tag: str) -> APIRouter:
    """Register CRUD endpoints for one backend feature area."""
    router = APIRouter(prefix="/api", tags=[tag])

    for resource in resources:
        def make_list_endpoint(resource_name: str):
            def endpoint(
                request: Request,
                user: CurrentUser,
                db: DbSession,
                limit: int = Query(default=50, ge=1, le=200),
                offset: int = Query(default=0, ge=0),
                search: str | None = Query(default=None, max_length=200),
                sort: str | None = None,
                order: str = Query(default="asc", pattern="^(asc|desc)$"),
            ):
                return list_records(resource_name, request, user, db, limit, offset, search, sort, order)

            endpoint.__name__ = f"list_{resource_name.replace('-', '_')}"
            return endpoint

        def make_get_endpoint(resource_name: str):
            def endpoint(record_id: str, user: CurrentUser, db: DbSession):
                return get_record(resource_name, record_id, user, db)

            endpoint.__name__ = f"get_{resource_name.replace('-', '_')}"
            return endpoint

        def make_create_endpoint(resource_name: str):
            def endpoint(payload: dict[str, Any], user: CurrentUser, db: DbSession):
                return create_record(resource_name, payload, user, db)

            endpoint.__name__ = f"create_{resource_name.replace('-', '_')}"
            return endpoint

        def make_update_endpoint(resource_name: str):
            def endpoint(record_id: str, payload: dict[str, Any], user: CurrentUser, db: DbSession):
                return update_record(resource_name, record_id, payload, user, db)

            endpoint.__name__ = f"update_{resource_name.replace('-', '_')}"
            return endpoint

        def make_delete_endpoint(resource_name: str):
            def endpoint(record_id: str, user: CurrentUser, db: DbSession):
                return delete_record(resource_name, record_id, user, db)

            endpoint.__name__ = f"delete_{resource_name.replace('-', '_')}"
            return endpoint

        router.add_api_route(f"/{resource}", make_list_endpoint(resource), methods=["GET"])
        router.add_api_route(f"/{resource}/{{record_id}}", make_get_endpoint(resource), methods=["GET"])
        router.add_api_route(
            f"/{resource}",
            make_create_endpoint(resource),
            methods=["POST"],
            status_code=status.HTTP_201_CREATED,
        )
        router.add_api_route(f"/{resource}/{{record_id}}", make_update_endpoint(resource), methods=["PATCH"])
        router.add_api_route(
            f"/{resource}/{{record_id}}",
            make_delete_endpoint(resource),
            methods=["DELETE"],
            status_code=status.HTTP_204_NO_CONTENT,
        )
    return router
