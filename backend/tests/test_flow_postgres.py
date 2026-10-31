"""End-to-end proposal -> planning -> event flow against a real PostgreSQL database.

Run with:  TEST_DATABASE_URL=postgresql+psycopg://user:pw@localhost/ngo_test pytest tests/test_flow_postgres.py
(the schema from database/schema.sql, or `alembic upgrade head`, must already be applied). Skipped otherwise.
"""
import os
import uuid
from itertools import count

import pytest

PG_URL = os.getenv("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not PG_URL, reason="TEST_DATABASE_URL (PostgreSQL) not set")

if PG_URL:
    os.environ["DATABASE_URL"] = PG_URL
    os.environ.setdefault("SESSION_COOKIE_SECURE", "false")
    from fastapi.testclient import TestClient
    from sqlalchemy import create_engine, text
    from sqlalchemy.orm import sessionmaker

    from app.database import get_db
    from app.main import app
    from app.models import User
    from app.security import hash_password

    _engine = create_engine(PG_URL, pool_pre_ping=True)
    _Session = sessionmaker(bind=_engine, autoflush=False, expire_on_commit=False)
    _hosts = count(10)
    PASSWORD = "Password12345!"

    def _override_db():
        with _Session() as session:
            yield session

    def make_user(role: str) -> str:
        email = f"{role.lower().replace(' ', '')}-{uuid.uuid4().hex[:8]}@test.org"
        with _Session() as s:
            s.add(User(full_name=f"Test {role}", email=email, password_hash=hash_password(PASSWORD), role=role))
            s.commit()
        return email

    @pytest.fixture(autouse=True, scope="module")
    def _wire():
        app.dependency_overrides[get_db] = _override_db
        yield
        with _Session() as s:
            s.execute(text("DELETE FROM events WHERE title LIKE 'TEST %'"))
            s.execute(text("DELETE FROM proposals WHERE title LIKE 'TEST %'"))
            s.execute(text("DELETE FROM users WHERE email LIKE '%@test.org'"))
            s.commit()
        app.dependency_overrides.pop(get_db, None)

    @pytest.fixture()
    def anon():
        return lambda: TestClient(app, client=(f"127.0.1.{next(_hosts) % 250}", 20000))

    @pytest.fixture()
    def login():
        def _login(role: str):
            client = TestClient(app, client=(f"127.0.2.{next(_hosts) % 250}", 20000))
            email = make_user(role)
            res = client.post("/api/auth/login", json={"email": email, "password": PASSWORD})
            assert res.status_code == 200, res.text
            return client

        return _login



NEW = {"title": "TEST Clean Water", "category": "Health", "estimatedBudget": 500000, "expectedBeneficiaries": "1,000 people",
       "startDate": "2027-01-01", "endDate": "2027-12-31", "summary": "Water filters", "geography": "Pune"}


def test_requires_login(anon):
    assert anon().get("/api/proposals").status_code == 401


def test_volunteer_cannot_read(login):
    assert login("Volunteer").get("/api/proposals").status_code == 403


def test_only_project_manager_creates_and_only_admin_reviews(login):
    assert login("Admin").post("/api/proposals", json=NEW).status_code == 403
    assert login("Staff").post("/api/proposals", json=NEW).status_code == 403
    pm = login("Project Manager")
    pid = pm.post("/api/proposals", json={**NEW, "title": "TEST Roles"}).json()["id"]
    assert login("Project Manager").post(f"/api/proposals/{pid}/transition", json={"status": "Under Review"}).status_code == 403
    assert pm.post(f"/api/proposals/{pid}/transition", json={"status": "Under Review"}).status_code == 403
    assert login("Admin").post(f"/api/proposals/{pid}/transition", json={"status": "Under Review"}).status_code == 200


def test_create_validation(login):
    c = login("Project Manager")
    assert c.post("/api/proposals", json={**NEW, "title": "x"}).status_code == 422
    assert c.post("/api/proposals", json={**NEW, "estimatedBudget": -5}).status_code == 422
    assert c.post("/api/proposals", json={**NEW, "endDate": "2026-01-01"}).status_code == 422


def test_full_lifecycle_and_planning(login):
    staff, admin = login("Project Manager"), login("Admin")
    res = staff.post("/api/proposals", json=NEW)
    assert res.status_code == 201, res.json()
    p = res.json()
    assert p["status"] == "Submitted" and p["proposalCode"].startswith("PP-")
    pid = p["id"]
    # project manager cannot review
    assert staff.post(f"/api/proposals/{pid}/transition", json={"status": "Under Review"}).status_code == 403
    # invalid jump
    assert admin.post(f"/api/proposals/{pid}/transition", json={"status": "Approved"}).status_code == 409
    assert admin.post(f"/api/proposals/{pid}/transition", json={"status": "Under Review"}).status_code == 200
    r = admin.post(f"/api/proposals/{pid}/transition", json={"status": "Financial Review"})
    assert r.json()["status"] == "Financial Review" and r.json()["reviewedByName"]
    # planning is blocked until approval
    assert staff.get(f"/api/proposals/{pid}/planning").status_code == 409
    assert admin.post(f"/api/proposals/{pid}/transition", json={"status": "Approved", "notes": "Good"}).status_code == 200
    # content can no longer be edited
    assert staff.patch(f"/api/proposals/{pid}", json={"title": "TEST Changed"}).status_code == 409
    plan = staff.get(f"/api/proposals/{pid}/planning").json()
    assert plan["planningStatus"] == "Not Started"
    assert plan["sections"]["overview"]["projectName"] == "TEST Clean Water"  # pre-filled
    assert len(plan["departments"]) == 9
    # incomplete plan cannot be finalised
    assert admin.post(f"/api/proposals/{pid}/planning/complete").status_code == 403  # admin does not plan
    assert staff.post(f"/api/proposals/{pid}/planning/complete").status_code == 422
    assert admin.put(f"/api/proposals/{pid}/planning", json={"sections": {}}).status_code == 403
    assert staff.put(f"/api/proposals/{pid}/planning", json={"sections": {"bogus": {}}}).status_code == 422
    assert staff.put(f"/api/proposals/{pid}/planning", json={"sections": {"overview": {"nope": "x"}}}).status_code == 422
    body = {"sections": {
        "beneficiary": {"primaryBeneficiaries": "Villagers", "estimatedCount": "1000", "selectionCriteria": "Need based"},
        "impact": {"directImpact": "Clean water", "longTermOutcomes": "Health"},
        "stages": {"phase1": "Survey", "milestones": "M1", "timeline": "12 months"},
        "hr": {"teamLead": "Asha", "staffAssigned": "4", "volunteersRequired": "12"},
        "operations": {"venueSite": "Villages", "logisticsPlan": "Trucks"},
        "budget": {"personnelCosts": "100000", "operationalCosts": "50000", "fundingSources": "CSR"},
    }, "departments": {"finance": {"responsible": "Ravi", "notes": "Track"}}}
    bad = {"sections": {"hr": {"volunteersRequired": "many"}}}
    assert staff.put(f"/api/proposals/{pid}/planning", json=bad).status_code == 422
    saved = staff.put(f"/api/proposals/{pid}/planning", json=body).json()
    assert saved["planningStatus"] == "In Progress"
    assert next(d for d in saved["departments"] if d["id"] == "finance")["responsible"] == "Ravi"
    done = staff.post(f"/api/proposals/{pid}/planning/complete")
    assert done.status_code == 200 and done.json()["planningStatus"] == "Complete"
    assert any(i["id"] == pid for i in staff.get("/api/planning/proposals").json()["items"])
    listed = staff.get("/api/proposals?status=Approved&search=TEST Clean").json()
    assert listed["total"] >= 1 and listed["items"][0]["planningCompletion"] == 100
    assert listed["items"][0]["volunteersRequired"] == 12


def test_reject_requires_reason_and_reopen(login):
    staff, admin = login("Project Manager"), login("Admin")
    pid = staff.post("/api/proposals", json={**NEW, "title": "TEST Reject Me", "submit": True}).json()["id"]
    admin.post(f"/api/proposals/{pid}/transition", json={"status": "Under Review"})
    assert admin.post(f"/api/proposals/{pid}/transition", json={"status": "Rejected"}).status_code == 422
    r = admin.post(f"/api/proposals/{pid}/transition", json={"status": "Rejected", "notes": "Over budget"}).json()
    assert r["status"] == "Rejected" and r["reviewNotes"] == "Over budget"
    assert staff.post(f"/api/proposals/{pid}/transition", json={"status": "Draft"}).json()["status"] == "Draft"
    assert staff.patch(f"/api/proposals/{pid}", json={"title": "TEST Reject Me v2"}).status_code == 200
    assert staff.delete(f"/api/proposals/{pid}").status_code == 204
    assert staff.get(f"/api/proposals/{pid}").status_code == 404


def test_draft_save_and_bad_id(login):
    c = login("Project Manager")
    d = c.post("/api/proposals", json={**NEW, "title": "TEST Draft", "submit": False}).json()
    assert d["status"] == "Draft"
    assert c.get("/api/proposals/not-a-uuid").status_code == 404
    c.delete(f"/api/proposals/{d['id']}")



EV = {"title": "TEST Health Camp", "eventType": "Outreach", "startsAt": "2027-03-01T10:00:00Z", "location": "Pune",
      "organizer": "Team A", "capacity": 2, "budget": 25000}


def test_event_crud_and_stats(login):
    c = login("Staff")
    assert c.post("/api/events", json={**EV, "capacity": 0}).status_code == 422
    assert c.post("/api/events", json={**EV, "eventType": "Party"}).status_code == 422
    assert c.post("/api/events", json={**EV, "endsAt": "2027-02-01T10:00:00Z"}).status_code == 422
    e = c.post("/api/events", json=EV).json()
    assert e["status"] == "Scheduled" and e["registered"] == 0 and e["budget"] == 25000
    assert c.get(f"/api/events?search=TEST Health").json()["total"] >= 1
    assert c.get("/api/events/stats").json()["total"] >= 1
    upd = c.patch(f"/api/events/{e['id']}", json={"location": "Mumbai"}).json()
    assert upd["location"] == "Mumbai"
    assert c.delete(f"/api/events/{e['id']}").status_code == 204
    assert c.get(f"/api/events/{e['id']}").status_code == 404


def test_registration_capacity_and_attendance(login):
    c = login("Admin")
    e = c.post("/api/events", json={**EV, "title": "TEST Capacity"}).json()
    eid = e["id"]
    people = []
    for _ in range(3):
        email = make_user("Staff")
        people.append(c.get(f"/api/events/people?type=user&search={email}").json()["items"][0]["id"])
    r1 = c.post(f"/api/events/{eid}/registrations", json={"personType": "user", "personId": people[0]})
    assert r1.status_code == 201 and r1.json()["name"]
    assert c.post(f"/api/events/{eid}/registrations", json={"personType": "user", "personId": people[0]}).status_code == 409
    assert c.post(f"/api/events/{eid}/registrations", json={"personType": "user", "personId": people[1]}).status_code == 201
    assert c.post(f"/api/events/{eid}/registrations", json={"personType": "user", "personId": people[2]}).status_code == 409  # full
    assert c.patch(f"/api/events/{eid}", json={"capacity": 1}).status_code == 409
    assert c.get(f"/api/events/{eid}").json()["registered"] == 2
    reg = r1.json()["id"]
    assert c.patch(f"/api/event-registrations/{reg}", json={"attendanceStatus": "Attended"}).json()["attendanceStatus"] == "Attended"
    assert c.delete(f"/api/events/{eid}").status_code == 409  # has registrations
    # cancelling the event cancels registrations and closes sign-up
    assert c.patch(f"/api/events/{eid}", json={"status": "Cancelled"}).json()["status"] == "Cancelled"
    assert c.post(f"/api/events/{eid}/registrations", json={"personType": "user", "personId": people[2]}).status_code == 409
    assert c.get(f"/api/events/{eid}").json()["registered"] == 1  # the attended one stays
    assert c.patch(f"/api/events/{eid}", json={"status": "Completed"}).status_code == 409


def test_volunteer_blocked_and_dashboard_ok(login):
    assert login("Volunteer").post("/api/events", json=EV).status_code == 403
    c = login("Admin")
    d = c.get("/api/dashboard")
    assert d.status_code == 200 and "metrics" in d.json()
    assert c.get("/api/dashboard/reminders").status_code == 200
    assert c.get("/api/reports/progress").status_code == 200
    assert c.get("/api/beneficiaries").status_code == 200
    assert c.post("/api/auth/logout").status_code == 204


PNG = (b"\x89PNG\r\n\x1a\n" + b"\x00" * 32)


def test_volunteer_views_events_without_budget_and_uploads_photos(login):
    staff, vol, vol2 = login("Staff"), login("Volunteer"), login("Volunteer")
    past = staff.post("/api/events", json={**EV, "title": "TEST Held", "startsAt": "2020-01-01T10:00:00Z"}).json()
    future = staff.post("/api/events", json={**EV, "title": "TEST Future"}).json()
    listed = vol.get("/api/events?search=TEST Held").json()["items"][0]
    assert listed["budget"] is None and listed["registered"] is None
    assert vol.get(f"/api/events/{past['id']}/registrations").status_code == 403
    assert vol.patch(f"/api/events/{past['id']}", json={"location": "X"}).status_code == 403
    assert vol.get("/api/events/stats").json()["totalBudget"] is None
    send = lambda c, eid, data, name="a.png": c.post(f"/api/events/{eid}/photos", files={"photo": (name, data, "image/png")}, data={"caption": "Day"})
    assert send(vol, future["id"], PNG).status_code == 409  # event not held yet
    assert send(vol, past["id"], b"not an image").status_code == 422
    ok = send(vol, past["id"], PNG)
    assert ok.status_code == 201 and ok.json()["canDelete"] is True
    pid = ok.json()["id"]
    assert vol2.get(f"/api/events/{past['id']}/photos").json()["total"] == 1
    assert vol2.get(f"/api/event-photos/{pid}/file").status_code == 200
    assert vol2.delete(f"/api/event-photos/{pid}").status_code == 403
    assert vol.delete(f"/api/event-photos/{pid}").status_code == 204


def test_project_workspace_save(login):
    admin, staff, volunteer = login("Admin"), login("Staff"), login("Volunteer")
    code = f"PRJ-T-{uuid.uuid4().hex[:6]}"
    created = admin.post("/api/projects", json={"projectCode": code, "name": "TEST Workspace", "sector": "Health", "status": "Upcoming"})
    assert created.status_code == 201, created.text
    pid = created.json()["id"]
    blob = {"plan": {"stages": []}, "workspace": {"risks": [{"id": "r1", "title": "Rain"}]}, "meta": {"managerName": "Asha"}}
    assert staff.put(f"/api/projects/{pid}/workspace", json=blob).status_code == 200
    assert volunteer.put(f"/api/projects/{pid}/workspace", json=blob).status_code == 403
    assert admin.put(f"/api/projects/{pid}/workspace", json={}).status_code == 422
    assert admin.put(f"/api/projects/{uuid.uuid4()}/workspace", json=blob).status_code == 404
    data = admin.get(f"/api/projects/{pid}").json()["planData"]
    assert data["workspace"]["risks"][0]["title"] == "Rain" and data["meta"]["managerName"] == "Asha"
    assert admin.delete(f"/api/projects/{pid}").status_code in (200, 204)
