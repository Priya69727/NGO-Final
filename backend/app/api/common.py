"""Shared helpers for the proposal / planning / event routers (raw SQL, camelCase JSON)."""
import json
import re
from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation
from uuid import UUID

from fastapi import HTTPException, Request
from sqlalchemy import text
from sqlalchemy.orm import Session

READ_ROLES = {"Admin", "Project Manager", "Staff"}


class ApiError(HTTPException):
    def __init__(self, status: int, detail: str):
        super().__init__(status_code=status, detail=detail)


_camel_boundary = re.compile(r"(?<!^)(?=[A-Z])")


def camel_case(value: str) -> str:
    first, *rest = value.split("_")
    return first + "".join(part.capitalize() for part in rest)


def _camelize(row) -> dict:
    return {camel_case(k): v for k, v in dict(row).items()}


def fetch_all(db: Session, sql: str, **params) -> list[dict]:
    return [_camelize(r) for r in db.execute(text(sql), params).mappings().all()]


def fetch_one(db: Session, sql: str, **params) -> dict | None:
    row = db.execute(text(sql), params).mappings().first()
    return _camelize(row) if row else None


def execute(db: Session, sql: str, **params):
    return db.execute(text(sql), params)


def record_audit(db: Session, user, action: str, entity_type: str, entity_id: str, changes: dict) -> None:
    execute(
        db,
        "INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, changes) "
        "VALUES (CAST(:actor AS uuid), :action, :etype, :eid, CAST(:changes AS jsonb))",
        actor=str(user.id), action=action, etype=entity_type, eid=entity_id, changes=json.dumps(changes, default=str),
    )


def require_role(user, allowed: set[str]) -> None:
    if user.role not in allowed:
        raise ApiError(403, "You do not have permission to perform this action.")


def parse_uuid(value, label="id") -> str:
    try:
        return str(UUID(str(value)))
    except (ValueError, TypeError):
        raise ApiError(404, f"{label} not found.")


def clean_text(data: dict, key: str, label: str, *, required=False, max_len=500) -> str | None:
    if key not in data:
        if required:
            raise ApiError(422, f"{label} is required.")
        return None
    value = data[key]
    if value is None:
        value = ""
    if not isinstance(value, str):
        raise ApiError(422, f"{label} must be text.")
    value = value.strip()
    if required and not value:
        raise ApiError(422, f"{label} is required.")
    if len(value) > max_len:
        raise ApiError(422, f"{label} must be at most {max_len} characters.")
    return value


def clean_money(data: dict, key: str, label: str, *, required=False) -> Decimal | None:
    if key not in data or data[key] in (None, ""):
        if required:
            raise ApiError(422, f"{label} is required.")
        return None
    try:
        value = Decimal(str(data[key]))
    except (InvalidOperation, ValueError):
        raise ApiError(422, f"{label} must be a number.")
    if not value.is_finite() or value < 0 or value >= Decimal("1e12"):
        raise ApiError(422, f"{label} must be a non-negative amount.")
    return value


def clean_date(data: dict, key: str, label: str, *, required=False) -> date | None:
    if key not in data or data[key] in (None, ""):
        if required:
            raise ApiError(422, f"{label} is required.")
        return None
    try:
        return date.fromisoformat(str(data[key])[:10])
    except ValueError:
        raise ApiError(422, f"{label} must be a valid date (YYYY-MM-DD).")


def clean_datetime(data, key: str, label: str, *, required=False) -> datetime | None:
    if key not in data or data[key] in (None, ""):
        if required:
            raise ApiError(422, f"{label} is required.")
        return None
    try:
        value = datetime.fromisoformat(str(data[key]).replace("Z", "+00:00"))
    except ValueError:
        raise ApiError(422, f"{label} must be a valid date and time.")
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value


def paging(request: Request) -> tuple[int, int]:
    try:
        limit = int(request.query_params.get("limit", 50))
        offset = int(request.query_params.get("offset", 0))
    except ValueError:
        raise ApiError(422, "limit and offset must be integers.")
    if not 1 <= limit <= 200 or offset < 0:
        raise ApiError(422, "limit must be 1-200 and offset >= 0.")
    return limit, offset


async def json_body(request: Request) -> dict:
    try:
        data = await request.json()
    except Exception:
        data = None
    if not isinstance(data, dict):
        raise ApiError(422, "A JSON object is required.")
    return data
