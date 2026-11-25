import csv
import io
import logging
import re
from datetime import date, datetime, timedelta
from typing import Any
from uuid import UUID

from fastapi import APIRouter, File, HTTPException, UploadFile
from sqlalchemy import and_, func, insert, or_, select
from sqlalchemy.exc import DataError, IntegrityError, StatementError

from app.api.records import (
    build_resource_router,
    _table,
    _require_role,
    _record_audit,
    WRITE_ROLES,
)
from app.dependencies import CurrentUser, DbSession

logger = logging.getLogger(__name__)

router = build_resource_router(
    ("beneficiaries", "beneficiary-enrollments", "beneficiary-services"),
    "beneficiaries",
)

MAX_IMPORT_SIZE = 10 * 1024 * 1024
MAX_IMPORT_ROWS = 5000

HEADER_ALIASES = {
    "project code": "project_code",
    "project_code": "project_code",
    "project id": "project_id",
    "project_id": "project_id",
    "name": "full_name",
    "full name": "full_name",
    "beneficiary name": "full_name",
    "fullname": "full_name",
    "reference code": "reference_code",
    "beneficiary code": "reference_code",
    "dob": "date_of_birth",
    "date of birth": "date_of_birth",
    "birth date": "date_of_birth",
    "mobile": "phone",
    "mobile number": "phone",
    "contact number": "phone",
    "phone number": "phone",
    "email address": "email",
    "consent": "consent_to_data_use",
    "consent to data use": "consent_to_data_use",
    "project id": "project_id",
    "project name": "project_name",
    "enrollment date": "enrolled_on",
    "enrolment date": "enrolled_on",
    "enrollment status": "enrollment_status",
    "enrolment status": "enrollment_status",
    "enrollment notes": "enrollment_notes",
    "service date": "service_date",
    "provided on": "service_date",
    "service notes": "service_notes",
}


def _clean(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _header(value: Any) -> str:
    text = str(value or "").strip().lower()
    text = re.sub(r"[_\-]+", " ", text)
    text = re.sub(r"\s+", " ", text)
    return HEADER_ALIASES.get(text, text.replace(" ", "_"))


def _parse_boolean(value: Any) -> bool:
    if isinstance(value, bool):
        return value

    text = str(value or "").strip().lower()

    if text in {"yes", "y", "true", "1"}:
        return True
    if text in {"no", "n", "false", "0"}:
        return False

    raise ValueError("Consent must be Yes or No.")


def _parse_date(value: Any, field_name: str) -> date | None:
    if value is None or str(value).strip() == "":
        return None

    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value

    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return date(1899, 12, 30) + timedelta(days=int(value))

    text = str(value).strip()

    for fmt in (
        "%Y-%m-%d",
        "%d-%m-%Y",
        "%d/%m/%Y",
        "%m/%d/%Y",
        "%d.%m.%Y",
    ):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            pass

    raise ValueError(
        f"{field_name} must be YYYY-MM-DD or DD-MM-YYYY."
    )


async def _read_upload(file: UploadFile) -> list[dict[str, Any]]:
    filename = (file.filename or "").lower()
    extension = "." + filename.rsplit(".", 1)[-1] if "." in filename else ""

    if extension not in {".csv", ".xlsx", ".xls"}:
        raise HTTPException(
            status_code=400,
            detail="Upload a CSV, XLSX, or XLS file.",
        )

    content = await file.read()

    if not content:
        raise HTTPException(status_code=400, detail="The file is empty.")

    if len(content) > MAX_IMPORT_SIZE:
        raise HTTPException(
            status_code=413,
            detail="Maximum upload size is 10 MB.",
        )

    try:
        if extension == ".csv":
            text = content.decode("utf-8-sig")
            reader = csv.DictReader(io.StringIO(text))

            if not reader.fieldnames:
                raise ValueError("Missing header row.")

            return [
                {
                    _header(key): value
                    for key, value in row.items()
                    if key is not None
                }
                for row in reader
            ]

        if extension == ".xlsx":
            from openpyxl import load_workbook

            workbook = load_workbook(
                io.BytesIO(content),
                read_only=True,
                data_only=True,
            )
            sheet = workbook.active
            iterator = sheet.iter_rows(values_only=True)
            headers = next(iterator, None)

            if not headers:
                raise ValueError("Missing header row.")

            names = [_header(value) for value in headers]
            rows = []

            for row in iterator:
                rows.append({
                    names[index]: value
                    for index, value in enumerate(row)
                    if index < len(names) and names[index]
                })

            workbook.close()
            return rows

        import xlrd

        workbook = xlrd.open_workbook(file_contents=content)
        sheet = workbook.sheet_by_index(0)

        if sheet.nrows < 1:
            raise ValueError("Missing header row.")

        names = [
            _header(sheet.cell_value(0, column))
            for column in range(sheet.ncols)
        ]

        rows = []
        for row_index in range(1, sheet.nrows):
            row = {}
            for column in range(sheet.ncols):
                value = sheet.cell_value(row_index, column)
                if sheet.cell_type(row_index, column) == xlrd.XL_CELL_DATE:
                    value = datetime(*xlrd.xldate_as_tuple(
                        value, workbook.datemode
                    ))
                row[names[column]] = value
            rows.append(row)

        return rows

    except HTTPException:
        raise
    except Exception as error:
        logger.exception("Could not read beneficiary import file")
        raise HTTPException(
            status_code=400,
            detail="Could not read the file. Check its format and header row.",
        ) from error


def _find_duplicate(db, table, data: dict[str, Any]) -> bool:
    conditions = []

    reference = data.get("reference_code")
    email = data.get("email")
    phone = data.get("phone")
    name = data.get("full_name")

    if reference:
        conditions.append(
            func.lower(table.c.reference_code) == reference.lower()
        )

    if email:
        conditions.append(
            func.lower(table.c.email) == email.lower()
        )

    if phone and name:
        conditions.append(
            and_(
                func.lower(table.c.full_name) == name.lower(),
                table.c.phone == phone,
            )
        )

    if not conditions:
        return False

    return db.scalar(
        select(table.c.id)
        .where(or_(*conditions))
        .limit(1)
    ) is not None



def _prepare_row(
    raw: dict[str, Any],
    row_number: int,
    db,
    beneficiary_table,
    project_table,
):
    errors: list[str] = []

    # Basic beneficiary information
    name = _clean(raw.get("full_name"))

    if not name:
        errors.append("Full name is required.")

    beneficiary = {
        "full_name": name,
        "reference_code": _clean(raw.get("reference_code")),
        "gender": _clean(raw.get("gender")),
        "phone": _clean(raw.get("phone")),
        "email": _clean(raw.get("email")),
        "address": _clean(raw.get("address")),
        "city": _clean(raw.get("city")),
        "district": _clean(raw.get("district")),
        "state": _clean(raw.get("state")),
        "status": _clean(raw.get("status")) or "Active",
        "consent_to_data_use": False,
    }

    # All project and service variables must be initialized here.
    project_code = _clean(raw.get("project_code"))
    project_id = _clean(raw.get("project_id"))
    project_name = _clean(raw.get("project_name"))
    category = _clean(raw.get("category"))
    service_name = _clean(raw.get("service_name"))

    enrollment = None
    service = None
    resolved_project_id = None

    # Date of birth
    try:
        beneficiary["date_of_birth"] = _parse_date(
            raw.get("date_of_birth"),
            "Date of birth",
        )

        if (
            beneficiary["date_of_birth"]
            and beneficiary["date_of_birth"] > date.today()
        ):
            errors.append("Date of birth cannot be in the future.")

    except ValueError as error:
        errors.append(str(error))

    # Consent
    try:
        consent = _clean(raw.get("consent_to_data_use"))

        if consent is not None:
            beneficiary["consent_to_data_use"] = _parse_boolean(consent)

    except ValueError as error:
        errors.append(str(error))

    # Email validation
    if beneficiary["email"]:
        beneficiary["email"] = beneficiary["email"].lower()

        if not re.fullmatch(
            r"[^\s@]+@[^\s@]+\.[^\s@]+",
            beneficiary["email"],
        ):
            errors.append("Email address is invalid.")

    # Beneficiary status
    if beneficiary["status"] not in {"Active", "Inactive"}:
        errors.append("Status must be Active or Inactive.")

    # Resolve project using Project Code first.
    if project_code:
        try:
            resolved_project_id = db.scalar(
                select(project_table.c.id)
                .where(
                    func.lower(project_table.c.project_code)
                    == project_code.strip().lower()
                )
                .limit(1)
            )

            if resolved_project_id is None:
                errors.append(
                    f"Project Code '{project_code}' was not found. "
                    "Please check the Projects module."
                )

        except Exception:
            logger.exception(
                "Project Code lookup failed for row %s",
                row_number,
            )
            errors.append(
                "Could not verify the supplied Project Code."
            )

    # Backward compatibility with older CSV files.
    elif project_id:
        try:
            project_uuid = UUID(project_id.strip())

            resolved_project_id = db.scalar(
                select(project_table.c.id)
                .where(project_table.c.id == project_uuid)
                .limit(1)
            )

            if resolved_project_id is None:
                errors.append("The supplied Project ID does not exist.")

        except (ValueError, TypeError, AttributeError):
            errors.append(
                "Project ID must be a valid UUID. "
                "Alternatively, use Project Code such as PRJ-2026-001."
            )

    elif project_name:
        errors.append(
            "Project Name cannot be used for assignment. "
            "Please provide the Project Code instead."
        )

    # Create project enrollment.
    if resolved_project_id is not None:
        enrollment_status = (
            _clean(raw.get("enrollment_status")) or "Active"
        )

        if enrollment_status not in {"Active", "Inactive"}:
            errors.append(
                "Enrollment status must be Active or Inactive."
            )
        else:
            try:
                enrollment_date = _parse_date(
                    raw.get("enrolled_on"),
                    "Enrollment date",
                )

                enrollment = {
                    "project_id": resolved_project_id,
                    "category": category or "General",
                    "enrolled_on": enrollment_date or date.today(),
                    "status": enrollment_status,
                    "notes": (
                        _clean(raw.get("enrollment_notes")) or ""
                    ),
                }

            except ValueError as error:
                errors.append(str(error))

    elif category or service_name:
        errors.append(
            "Project Code is required when importing category "
            "or service information."
        )

    # Optional beneficiary service record.
    if service_name:
        try:
            service_date = _parse_date(
                raw.get("service_date"),
                "Service date",
            )

            service = {
                "service_name": service_name,
                "provided_on": service_date or date.today(),
                "notes": _clean(raw.get("service_notes")) or "",
            }

        except ValueError as error:
            errors.append(str(error))

    if errors:
        return None, errors, False

    # Check existing beneficiaries for duplicates.
    duplicate = _find_duplicate(
        db,
        beneficiary_table,
        beneficiary,
    )

    return {
        "row_number": row_number,
        "beneficiary": beneficiary,
        "enrollment": enrollment,
        "service": service,
    }, [], duplicate


async def _validate_file(file: UploadFile, db):
    rows = await _read_upload(file)

    if not rows:
        raise HTTPException(
            status_code=400,
            detail="No beneficiary rows were found in the file.",
        )

    if len(rows) > MAX_IMPORT_ROWS:
        raise HTTPException(
            status_code=400,
            detail="A maximum of 5,000 rows can be imported at once.",
        )

    beneficiary_table = _table(db, "beneficiaries")
    project_table = _table(db, "projects")

    results = []
    seen = set()

    for row_number, raw in enumerate(rows, start=2):
        if not any(_clean(value) for value in raw.values()):
            continue

        prepared, errors, duplicate = _prepare_row(
            raw,
            row_number,
            db,
            beneficiary_table,
            project_table,
        )

        if prepared:
            data = prepared["beneficiary"]
            identity = (
                (data.get("reference_code") or "").lower(),
                (data.get("email") or "").lower(),
                (data.get("full_name") or "").lower(),
                data.get("phone") or "",
            )

            if identity in seen:
                duplicate = True
            seen.add(identity)

        results.append({
            "row": row_number,
            "name": (
                prepared["beneficiary"]["full_name"]
                if prepared else _clean(raw.get("full_name"))
            ),
            "data": prepared,
            "errors": errors,
            "duplicate": duplicate,
            "valid": bool(prepared) and not duplicate,
        })

    return results


@router.post("/beneficiaries/import/preview")
async def preview_beneficiary_import(
    user: CurrentUser,
    db: DbSession,
    file: UploadFile = File(...),
):
    _require_role(user, WRITE_ROLES["beneficiaries"])

    results = await _validate_file(file, db)

    return {
        "total": len(results),
        "valid": sum(1 for row in results if row["valid"]),
        "duplicates": sum(1 for row in results if row["duplicate"]),
        "invalid": sum(1 for row in results if row["errors"]),
        "rows": [
            {
                "row": row["row"],
                "name": row["name"],
                "valid": row["valid"],
                "duplicate": row["duplicate"],
                "errors": row["errors"],
            }
            for row in results
        ],
    }


@router.post("/beneficiaries/import")
async def import_beneficiaries(
    user: CurrentUser,
    db: DbSession,
    file: UploadFile = File(...),
):
    _require_role(user, WRITE_ROLES["beneficiaries"])

    results = await _validate_file(file, db)

    beneficiary_table = _table(db, "beneficiaries")
    enrollment_table = _table(db, "beneficiary-enrollments")
    service_table = _table(db, "beneficiary-services")

    imported = 0
    skipped = 0
    failed = []

    for item in results:
        if not item["valid"]:
            skipped += 1
            if item["errors"]:
                failed.append({
                    "row": item["row"],
                    "name": item["name"],
                    "errors": item["errors"],
                })
            continue

        data = item["data"]

        try:
            with db.begin_nested():
                beneficiary_result = db.execute(
                    insert(beneficiary_table)
                    .values(**data["beneficiary"])
                    .returning(*beneficiary_table.columns)
                ).mappings().one()

                beneficiary_id = beneficiary_result["id"]

                _record_audit(
                    db,
                    user,
                    "create",
                    "beneficiaries",
                    str(beneficiary_id),
                    {"source": "spreadsheet_import"},
                )

                enrollment_id = None

                if data["enrollment"]:
                    enrollment_id = db.execute(
                        insert(enrollment_table)
                        .values(
                            beneficiary_id=beneficiary_id,
                            **data["enrollment"],
                        )
                        .returning(enrollment_table.c.id)
                    ).scalar_one()

                    _record_audit(
                        db,
                        user,
                        "create",
                        "beneficiary-enrollments",
                        str(enrollment_id),
                        {"source": "spreadsheet_import"},
                    )

                if data["service"] and enrollment_id:
                    service_id = db.execute(
                        insert(service_table)
                        .values(
                            enrollment_id=enrollment_id,
                            **data["service"],
                        )
                        .returning(service_table.c.id)
                    ).scalar_one()

                    _record_audit(
                        db,
                        user,
                        "create",
                        "beneficiary-services",
                        str(service_id),
                        {"source": "spreadsheet_import"},
                    )

            imported += 1

        except (IntegrityError, DataError, StatementError, ValueError):
            logger.exception(
                "Beneficiary import failed at spreadsheet row %s",
                item["row"],
            )
            skipped += 1
            failed.append({
                "row": item["row"],
                "name": item["name"],
                "errors": [
                    "Could not save this row. Check its values and database constraints."
                ],
            })

    try:
        db.commit()
    except Exception as error:
        db.rollback()
        logger.exception("Beneficiary import commit failed")
        raise HTTPException(
            status_code=500,
            detail="Import could not be completed. The transaction was rolled back.",
        ) from error

    return {
        "message": "Beneficiary import completed.",
        "total": len(results),
        "imported": imported,
        "skipped": skipped,
        "failed": failed,
    }