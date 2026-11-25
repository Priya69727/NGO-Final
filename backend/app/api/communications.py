
"""Persistent communication center for Hope Foundation."""
from datetime import date
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr, Field, ConfigDict
from sqlalchemy import text

from app.api.records import build_resource_router
from app.dependencies import CurrentUser, DbSession

# Register specific routes before generic CRUD routes to avoid route conflicts.
router = APIRouter(tags=["communications"])

STAFF_ROLES = {"Admin", "Project Manager", "Staff"}
MESSAGE_ROLES = {"Admin", "Project Manager", "Staff", "Volunteer", "Board", "Member"}

RELATED_TABLES = {
    "Donor": ("donors", "donor_id"),
    "Beneficiary": ("beneficiaries", "beneficiary_id"),
    "Project": ("projects", "project_id"),
}


def _staff(user) -> None:
    if user.role not in STAFF_ROLES:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Staff access is required for this action."
        )


def _message_access(user) -> None:
    if user.role not in MESSAGE_ROLES:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Your account cannot access internal messages."
        )


class MessageCreate(BaseModel):
    recipient_email: EmailStr = Field(alias="recipientEmail")
    subject: str = Field(min_length=1, max_length=160)
    body: str = Field(min_length=1, max_length=5000)
    parent_id: UUID | None = Field(default=None, alias="parentId")
    model_config = ConfigDict(populate_by_name=True)


class AnnouncementCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    body: str = Field(min_length=1, max_length=5000)
    audience: Literal["All", "Staff", "Volunteers"] = "All"
    priority: Literal["Normal", "High"] = "Normal"


class ExternalMessageCreate(BaseModel):
    related_type: Literal["Donor", "Beneficiary", "Project"] = Field(alias="relatedType")
    related_id: UUID = Field(alias="relatedId")
    recipient_name: str | None = Field(default=None, max_length=160, alias="recipientName")
    recipient_email: EmailStr | None = Field(default=None, alias="recipientEmail")
    recipient_phone: str | None = Field(default=None, max_length=40, alias="recipientPhone")
    subject: str = Field(min_length=1, max_length=250)
    body: str = Field(min_length=1, max_length=5000)
    channel: Literal["Email", "WhatsApp", "SMS", "Phone", "In Person", "Other"] = "Email"
    status: Literal["Draft", "Logged"] = "Draft"
    model_config = ConfigDict(populate_by_name=True)


class FollowupCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    description: str = Field(default="", max_length=2000)
    related_type: Literal["Donor", "Beneficiary", "Project"] = Field(alias="relatedType")
    related_id: UUID = Field(alias="relatedId")
    assigned_to: UUID | None = Field(default=None, alias="assignedTo")
    due_date: date = Field(alias="dueDate")
    model_config = ConfigDict(populate_by_name=True)


class FollowupUpdate(BaseModel):
    status: Literal["Pending", "Completed", "Cancelled"]


class DonorLogCreate(BaseModel):
    donor_id: UUID = Field(alias="donorId")
    subject: str = Field(min_length=1, max_length=250)
    body: str = Field(min_length=1, max_length=5000)
    channel: Literal["Email", "Phone", "SMS", "WhatsApp", "In Person", "Other"] = "Email"
    model_config = ConfigDict(populate_by_name=True)


# ---------------------------------------------------------
# INTERNAL MESSAGES
# ---------------------------------------------------------

@router.get("/api/communications/users")
def list_message_users(user: CurrentUser, db: DbSession):
    _message_access(user)

    rows = db.execute(text("""
        SELECT id, full_name, email, role
        FROM users
        WHERE is_active = true AND id <> :user_id
        ORDER BY full_name ASC
        LIMIT 500
    """), {"user_id": user.id}).mappings().all()

    return {
        "items": [
            {
                "id": str(x["id"]),
                "fullName": x["full_name"],
                "email": x["email"],
                "role": x["role"],
            }
            for x in rows
        ]
    }


@router.get("/api/communications/messages")
def list_messages(
    user: CurrentUser,
    db: DbSession,
    folder: Literal["inbox", "sent"] = "inbox"
):
    _message_access(user)

    owner_column = "recipient_id" if folder == "inbox" else "sender_id"

    rows = db.execute(text(f"""
        SELECT
            m.id, m.parent_id, m.subject, m.body, m.created_at, m.read_at,
            s.id AS sender_id, s.full_name AS sender_name, s.email AS sender_email,
            r.id AS recipient_id, r.full_name AS recipient_name, r.email AS recipient_email
        FROM communication_messages m
        JOIN users s ON s.id = m.sender_id
        JOIN users r ON r.id = m.recipient_id
        WHERE m.{owner_column} = :user_id
        ORDER BY m.created_at DESC
        LIMIT 200
    """), {"user_id": user.id}).mappings().all()

    return {
        "items": [
            {
                "id": str(x["id"]),
                "parentId": str(x["parent_id"]) if x["parent_id"] else None,
                "subject": x["subject"],
                "body": x["body"],
                "createdAt": x["created_at"].isoformat(),
                "read": x["read_at"] is not None,
                "readAt": x["read_at"].isoformat() if x["read_at"] else None,
                "senderId": str(x["sender_id"]),
                "senderName": x["sender_name"],
                "senderEmail": x["sender_email"],
                "recipientId": str(x["recipient_id"]),
                "recipientName": x["recipient_name"],
                "recipientEmail": x["recipient_email"],
            }
            for x in rows
        ]
    }


@router.post("/api/communications/messages", status_code=status.HTTP_201_CREATED)
def create_message(body: MessageCreate, user: CurrentUser, db: DbSession):
    _message_access(user)

    recipient = db.execute(text("""
        SELECT id
        FROM users
        WHERE lower(email) = lower(:email)
          AND is_active = true
    """), {"email": str(body.recipient_email)}).mappings().first()

    if not recipient:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "No active user account was found for that email address."
        )

    if recipient["id"] == user.id:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "You cannot send a message to yourself."
        )

    subject = body.subject.strip()

    if not subject or not body.body.strip():
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Subject and message body are required."
        )

    if body.parent_id:
        parent = db.execute(text("""
            SELECT id, subject, sender_id, recipient_id
            FROM communication_messages
            WHERE id = :id
        """), {"id": body.parent_id}).mappings().first()

        if not parent or user.id not in (
            parent["sender_id"],
            parent["recipient_id"]
        ):
            raise HTTPException(
                status.HTTP_404_NOT_FOUND,
                "The message thread was not found."
            )

        expected_recipient = (
            parent["recipient_id"]
            if parent["sender_id"] == user.id
            else parent["sender_id"]
        )

        if recipient["id"] != expected_recipient:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "A reply must be sent to the other participant in the thread."
            )

        parent_subject = parent["subject"].strip()
        subject = (
            parent_subject
            if parent_subject.lower().startswith("re:")
            else f"Re: {parent_subject}"
        )

    row = db.execute(text("""
        INSERT INTO communication_messages(
            sender_id, recipient_id, parent_id, subject, body
        )
        VALUES (
            :sender, :recipient, :parent, :subject, :body
        )
        RETURNING id, created_at
    """), {
        "sender": user.id,
        "recipient": recipient["id"],
        "parent": body.parent_id,
        "subject": subject,
        "body": body.body.strip(),
    }).mappings().one()

    db.commit()

    return {
        "id": str(row["id"]),
        "subject": subject,
        "createdAt": row["created_at"].isoformat(),
        "status": "Stored in inbox",
    }


@router.get("/api/communications/messages/{message_id}/thread")
def get_message_thread(
    message_id: UUID,
    user: CurrentUser,
    db: DbSession
):
    _message_access(user)

    selected = db.execute(text("""
        SELECT id, sender_id, recipient_id
        FROM communication_messages
        WHERE id = :id
    """), {"id": message_id}).mappings().first()

    if not selected or user.id not in (
        selected["sender_id"],
        selected["recipient_id"]
    ):
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "The message thread was not found."
        )

    rows = db.execute(text("""
        WITH RECURSIVE ancestors AS (
            SELECT id, parent_id
            FROM communication_messages
            WHERE id = :message_id

            UNION ALL

            SELECT parent.id, parent.parent_id
            FROM communication_messages parent
            JOIN ancestors child ON child.parent_id = parent.id
        ),
        root AS (
            SELECT id
            FROM ancestors
            WHERE parent_id IS NULL
            LIMIT 1
        ),
        thread AS (
            SELECT message.*
            FROM communication_messages message
            JOIN root ON message.id = root.id

            UNION ALL

            SELECT child.*
            FROM communication_messages child
            JOIN thread parent ON child.parent_id = parent.id
        )
        SELECT
            m.id, m.parent_id, m.subject, m.body, m.created_at, m.read_at,
            s.id AS sender_id, s.full_name AS sender_name, s.email AS sender_email,
            r.id AS recipient_id, r.full_name AS recipient_name, r.email AS recipient_email
        FROM thread m
        JOIN users s ON s.id = m.sender_id
        JOIN users r ON r.id = m.recipient_id
        ORDER BY m.created_at ASC
    """), {"message_id": message_id}).mappings().all()

    for item in rows:
        if item["recipient_id"] == user.id and item["read_at"] is None:
            db.execute(text("""
                UPDATE communication_messages
                SET read_at = now()
                WHERE id = :id
            """), {"id": item["id"]})

    db.commit()

    return {
        "items": [
            {
                "id": str(x["id"]),
                "parentId": str(x["parent_id"]) if x["parent_id"] else None,
                "subject": x["subject"],
                "body": x["body"],
                "createdAt": x["created_at"].isoformat(),
                "read": x["read_at"] is not None or x["recipient_id"] == user.id,
                "senderId": str(x["sender_id"]),
                "senderName": x["sender_name"],
                "senderEmail": x["sender_email"],
                "recipientId": str(x["recipient_id"]),
                "recipientName": x["recipient_name"],
                "recipientEmail": x["recipient_email"],
            }
            for x in rows
        ]
    }


@router.patch("/api/communications/messages/{message_id}/read")
def mark_message_read(
    message_id: UUID,
    user: CurrentUser,
    db: DbSession
):
    _message_access(user)

    result = db.execute(text("""
        UPDATE communication_messages
        SET read_at = COALESCE(read_at, now())
        WHERE id = :id
          AND recipient_id = :user_id
        RETURNING id
    """), {
        "id": message_id,
        "user_id": user.id,
    }).first()

    if not result:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "Inbox message not found."
        )

    db.commit()

    return {"id": str(message_id), "read": True}


# ---------------------------------------------------------
# ANNOUNCEMENTS
# ---------------------------------------------------------

@router.get("/api/communications/announcements")
def list_announcements(user: CurrentUser, db: DbSession):
    rows = db.execute(text("""
        SELECT id, title, body, audience, priority, published_at, created_by
        FROM communication_announcements
        WHERE audience = 'All'
           OR (
                audience = 'Staff'
                AND :role IN ('Admin', 'Project Manager', 'Staff')
           )
           OR (
                audience = 'Volunteers'
                AND :role IN ('Volunteer', 'Member')
           )
        ORDER BY published_at DESC
        LIMIT 200
    """), {"role": user.role}).mappings().all()

    return {
        "items": [
            {
                "id": str(x["id"]),
                "title": x["title"],
                "body": x["body"],
                "audience": x["audience"],
                "priority": x["priority"],
                "publishedAt": x["published_at"].isoformat(),
                "createdBy": str(x["created_by"]) if x["created_by"] else None,
            }
            for x in rows
        ]
    }


@router.post("/api/communications/announcements", status_code=status.HTTP_201_CREATED)
def create_announcement(
    body: AnnouncementCreate,
    user: CurrentUser,
    db: DbSession
):
    _staff(user)

    if not body.title.strip() or not body.body.strip():
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Title and announcement text are required."
        )

    row = db.execute(text("""
        INSERT INTO communication_announcements(
            title, body, audience, priority, created_by
        )
        VALUES (
            :title, :body, :audience, :priority, :user_id
        )
        RETURNING id, published_at
    """), {
        "title": body.title.strip(),
        "body": body.body.strip(),
        "audience": body.audience,
        "priority": body.priority,
        "user_id": user.id,
    }).mappings().one()

    db.commit()

    return {
        "id": str(row["id"]),
        "publishedAt": row["published_at"].isoformat(),
    }


# ---------------------------------------------------------
# EXTERNAL MESSAGE DRAFTS AND COMMUNICATION HISTORY
# ---------------------------------------------------------

def _validate_related(db, related_type: str, related_id: UUID) -> None:
    table, _column = RELATED_TABLES[related_type]

    exists = db.execute(
        text(f"SELECT id FROM {table} WHERE id = :id"),
        {"id": related_id}
    ).first()

    if not exists:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            f"{related_type} record not found."
        )


@router.get("/api/communications/external")
def list_external_messages(user: CurrentUser, db: DbSession):
    _staff(user)

    rows = db.execute(text("""
        SELECT
            c.id, c.subject, c.channel, c.body, c.status, c.created_at,
            c.recipient_name, c.recipient_email, c.recipient_phone,
            c.donor_id, d.display_name AS donor_name,
            c.beneficiary_id, b.full_name AS beneficiary_name,
            c.project_id, p.name AS project_name,
            u.full_name AS created_by_name
        FROM communications c
        LEFT JOIN donors d ON d.id = c.donor_id
        LEFT JOIN beneficiaries b ON b.id = c.beneficiary_id
        LEFT JOIN projects p ON p.id = c.project_id
        LEFT JOIN users u ON u.id = c.sent_by
        ORDER BY c.created_at DESC
        LIMIT 300
    """)).mappings().all()

    items = []

    for x in rows:
        if x["donor_id"]:
            related_type = "Donor"
            related_id = x["donor_id"]
            related_name = x["donor_name"]
        elif x["beneficiary_id"]:
            related_type = "Beneficiary"
            related_id = x["beneficiary_id"]
            related_name = x["beneficiary_name"]
        else:
            related_type = "Project"
            related_id = x["project_id"]
            related_name = x["project_name"]

        items.append({
            "id": str(x["id"]),
            "subject": x["subject"],
            "channel": x["channel"],
            "body": x["body"],
            "status": x["status"],
            "createdAt": x["created_at"].isoformat(),
            "recipientName": x["recipient_name"],
            "recipientEmail": x["recipient_email"],
            "recipientPhone": x["recipient_phone"],
            "relatedType": related_type,
            "relatedId": str(related_id),
            "relatedName": related_name or related_type,
            "createdByName": x["created_by_name"] or "Former user",
        })

    return {"items": items}


@router.post("/api/communications/external", status_code=status.HTTP_201_CREATED)
def create_external_message(
    body: ExternalMessageCreate,
    user: CurrentUser,
    db: DbSession
):
    _staff(user)
    _validate_related(db, body.related_type, body.related_id)

    _table, fk_column = RELATED_TABLES[body.related_type]

    if not body.subject.strip() or not body.body.strip():
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Subject and message body are required."
        )

    if body.channel == "Email" and not body.recipient_email:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Enter the recipient email address for an email draft."
        )

    if body.channel in {"SMS", "WhatsApp"} and not body.recipient_phone:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Enter the recipient phone number for this message."
        )

    row = db.execute(text(f"""
        INSERT INTO communications(
            subject, channel, body, {fk_column}, sent_by, status,
            recipient_name, recipient_email, recipient_phone
        )
        VALUES (
            :subject, :channel, :body, :related_id, :user_id, :record_status,
            :recipient_name, :recipient_email, :recipient_phone
        )
        RETURNING id, created_at
    """), {
        "subject": body.subject.strip(),
        "channel": body.channel,
        "body": body.body.strip(),
        "related_id": body.related_id,
        "user_id": user.id,
        "record_status": body.status,
        "recipient_name": body.recipient_name.strip() if body.recipient_name else None,
        "recipient_email": str(body.recipient_email) if body.recipient_email else None,
        "recipient_phone": body.recipient_phone.strip() if body.recipient_phone else None,
    }).mappings().one()

    db.commit()

    return {
        "id": str(row["id"]),
        "createdAt": row["created_at"].isoformat(),
        "status": body.status,
        "deliveryNote": "Saved in the database only. No email, SMS or WhatsApp message was sent.",
    }


# ---------------------------------------------------------
# FOLLOW-UP TRACKER
# ---------------------------------------------------------

@router.get("/api/communications/followups")
def list_followups(user: CurrentUser, db: DbSession):
    _staff(user)

    rows = db.execute(text("""
        SELECT
            f.id, f.title, f.description, f.due_date, f.status, f.created_at,
            f.related_type, f.donor_id, d.display_name AS donor_name,
            f.beneficiary_id, b.full_name AS beneficiary_name,
            f.project_id, p.name AS project_name,
            f.assigned_to, a.full_name AS assigned_to_name,
            c.full_name AS created_by_name,
            (
                f.status = 'Pending'
                AND f.due_date < CURRENT_DATE
            ) AS is_overdue
        FROM communication_followups f
        LEFT JOIN donors d ON d.id = f.donor_id
        LEFT JOIN beneficiaries b ON b.id = f.beneficiary_id
        LEFT JOIN projects p ON p.id = f.project_id
        LEFT JOIN users a ON a.id = f.assigned_to
        LEFT JOIN users c ON c.id = f.created_by
        ORDER BY
            CASE WHEN f.status = 'Pending' THEN 0 ELSE 1 END,
            f.due_date ASC,
            f.created_at DESC
        LIMIT 300
    """)).mappings().all()

    items = []

    for x in rows:
        if x["related_type"] == "Donor":
            related_id = x["donor_id"]
            related_name = x["donor_name"]
        elif x["related_type"] == "Beneficiary":
            related_id = x["beneficiary_id"]
            related_name = x["beneficiary_name"]
        else:
            related_id = x["project_id"]
            related_name = x["project_name"]

        items.append({
            "id": str(x["id"]),
            "title": x["title"],
            "description": x["description"],
            "dueDate": x["due_date"].isoformat(),
            "status": x["status"],
            "isOverdue": bool(x["is_overdue"]),
            "relatedType": x["related_type"],
            "relatedId": str(related_id),
            "relatedName": related_name or x["related_type"],
            "assignedTo": str(x["assigned_to"]),
            "assignedToName": x["assigned_to_name"] or "Former user",
            "createdByName": x["created_by_name"] or "Former user",
            "createdAt": x["created_at"].isoformat(),
        })

    return {"items": items}


@router.post("/api/communications/followups", status_code=status.HTTP_201_CREATED)
def create_followup(
    body: FollowupCreate,
    user: CurrentUser,
    db: DbSession
):
    _staff(user)
    _validate_related(db, body.related_type, body.related_id)

    assigned_to = body.assigned_to or user.id

    assignee = db.execute(text("""
        SELECT id
        FROM users
        WHERE id = :id
          AND is_active = true
          AND role IN ('Admin', 'Project Manager', 'Staff')
    """), {"id": assigned_to}).first()

    if not assignee:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "The selected staff member is not active."
        )

    if body.due_date < date.today():
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Due date cannot be in the past."
        )

    _table, fk_column = RELATED_TABLES[body.related_type]

    row = db.execute(text(f"""
        INSERT INTO communication_followups(
            title, description, related_type, {fk_column},
            assigned_to, due_date, created_by
        )
        VALUES (
            :title, :description, :related_type, :related_id,
            :assigned_to, :due_date, :created_by
        )
        RETURNING id, created_at
    """), {
        "title": body.title.strip(),
        "description": body.description.strip(),
        "related_type": body.related_type,
        "related_id": body.related_id,
        "assigned_to": assigned_to,
        "due_date": body.due_date,
        "created_by": user.id,
    }).mappings().one()

    db.commit()

    return {
        "id": str(row["id"]),
        "createdAt": row["created_at"].isoformat(),
        "status": "Pending",
    }


@router.patch("/api/communications/followups/{followup_id}")
def update_followup(
    followup_id: UUID,
    body: FollowupUpdate,
    user: CurrentUser,
    db: DbSession
):
    _staff(user)

    row = db.execute(text("""
        UPDATE communication_followups
        SET status = :status,
            completed_at = CASE
                WHEN :status = 'Completed'
                THEN COALESCE(completed_at, now())
                ELSE NULL
            END,
            updated_at = now()
        WHERE id = :id
        RETURNING id, status
    """), {
        "id": followup_id,
        "status": body.status,
    }).mappings().first()

    if not row:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "Follow-up not found."
        )

    db.commit()

    return {
        "id": str(row["id"]),
        "status": row["status"],
    }


# ---------------------------------------------------------
# BACKWARD COMPATIBILITY: DONOR COMMUNICATION LOGS
# ---------------------------------------------------------

@router.get("/api/communications/donor-logs")
def list_donor_logs(user: CurrentUser, db: DbSession):
    _staff(user)

    rows = db.execute(text("""
        SELECT
            c.id, c.donor_id, d.display_name AS donor_name,
            c.subject, c.body, c.channel, c.status, c.created_at
        FROM communications c
        JOIN donors d ON d.id = c.donor_id
        ORDER BY c.created_at DESC
        LIMIT 200
    """)).mappings().all()

    return {
        "items": [
            {
                "id": str(x["id"]),
                "donorId": str(x["donor_id"]),
                "donorName": x["donor_name"],
                "subject": x["subject"],
                "body": x["body"],
                "channel": x["channel"],
                "status": x["status"],
                "createdAt": x["created_at"].isoformat(),
            }
            for x in rows
        ]
    }


@router.post("/api/communications/donor-logs", status_code=status.HTTP_201_CREATED)
def create_donor_log(
    body: DonorLogCreate,
    user: CurrentUser,
    db: DbSession
):
    _staff(user)

    donor = db.execute(text("""
        SELECT id, display_name, email, phone
        FROM donors
        WHERE id = :id
    """), {"id": body.donor_id}).mappings().first()

    if not donor:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "Donor not found."
        )

    row = db.execute(text("""
        INSERT INTO communications(
            subject, channel, body, donor_id, sent_by, status,
            recipient_name, recipient_email, recipient_phone
        )
        VALUES (
            :subject, :channel, :body, :donor_id, :user_id, 'Logged',
            :name, :email, :phone
        )
        RETURNING id, created_at
    """), {
        "subject": body.subject.strip(),
        "channel": body.channel,
        "body": body.body.strip(),
        "donor_id": body.donor_id,
        "user_id": user.id,
        "name": donor["display_name"],
        "email": donor["email"],
        "phone": donor["phone"],
    }).mappings().one()

    db.commit()

    return {
        "id": str(row["id"]),
        "createdAt": row["created_at"].isoformat(),
        "status": "Logged",
    }


# Register generic communication CRUD after the specific routes.
router.include_router(
    build_resource_router(("communications",), "communications")
)
