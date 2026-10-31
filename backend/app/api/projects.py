from app.api.records import build_resource_router

router = build_resource_router(
    (
        "projects",
        "team-members",
        "partners",
        "milestones",
        "tasks",
        "department-checklists",
        "documents",
        "budget-items",
        "expenses",
        "funding-sources",
        "impact-indicators",
        "impact-measurements",
        "resources",
        "risks",
        "activity",
    ),
    "projects",
)


# ── Project workspace (plan, checklists, documents, risks, impact log, activity) ──
import json as _json
from fastapi import Body, Request

from app.api.common import ApiError, execute, parse_uuid, record_audit, require_role
from app.dependencies import CurrentUser, DbSession

_WORKSPACE_KEYS = ("plan", "workspace", "meta")
_MAX_WORKSPACE_BYTES = 2_000_000


@router.put("/projects/{project_id}/workspace")
def save_workspace(project_id: str, user: CurrentUser, db: DbSession, body: dict = Body(...)):
    """Merge plan / workspace / meta into projects.plan_data. Admin, Project Manager and Staff may save."""
    require_role(user, {"Admin", "Project Manager", "Staff"})
    pid = parse_uuid(project_id, "Project")
    patch = {k: body[k] for k in _WORKSPACE_KEYS if k in body and isinstance(body[k], dict)}
    if not patch:
        raise ApiError(422, "Nothing to save.")
    payload = _json.dumps(patch, default=str)
    if len(payload) > _MAX_WORKSPACE_BYTES:
        raise ApiError(413, "Project data is too large.")
    result = execute(
        db,
        "UPDATE projects SET plan_data = COALESCE(plan_data, '{}'::jsonb) || CAST(:p AS jsonb), updated_at = now() "
        "WHERE id = CAST(:id AS uuid)",
        p=payload, id=pid,
    )
    if result.rowcount == 0:
        raise ApiError(404, "Project not found.")
    db.commit()
    return {"ok": True}
