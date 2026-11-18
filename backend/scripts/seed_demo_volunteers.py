"""Idempotently add clearly labeled sample volunteers to a local development database.

Run from the NGO backend with its virtual environment after setting PYTHONPATH to that backend.
The generated accounts receive random, undisclosed passwords and are for profile demonstrations only.
"""
import secrets
from urllib.parse import urlparse

from sqlalchemy import func, select, text

from app.config import settings
from app.database import SessionLocal
from app.models import User
from app.security import hash_password


VOLUNTEERS = [
    {
        "name": "Demo Asha Menon",
        "email": "demo.asha@example.org",
        "city": "Kochi",
        "phone": "",
        "skills": ["Education", "Mentoring", "Community outreach"],
    },
    {
        "name": "Demo Ravi Sharma",
        "email": "demo.ravi@example.org",
        "city": "Mumbai",
        "phone": "",
        "skills": ["Coastal cleanup", "Logistics", "First aid"],
    },
    {
        "name": "Demo Meera Iyer",
        "email": "demo.meera@example.org",
        "city": "Chennai",
        "phone": "",
        "skills": ["Healthcare", "Community outreach", "Data entry"],
    },
    {
        "name": "Demo Omar Khan",
        "email": "demo.omar@example.org",
        "city": "Hyderabad",
        "phone": "",
        "skills": ["Fundraising", "Event planning", "Social media"],
    },
    {
        "name": "Demo Leela Das",
        "email": "demo.leela@example.org",
        "city": "Bengaluru",
        "phone": "",
        "skills": ["Animal welfare", "Photography", "Content writing"],
    },
]


def main() -> None:
    database = urlparse(settings.database_url)
    if settings.environment not in {"development", "test"} or database.hostname not in {"localhost", "127.0.0.1", "::1"}:
        raise SystemExit("Refusing to seed: this script only runs against a local development/test database.")

    created = 0
    with SessionLocal() as db:
        for item in VOLUNTEERS:
            email = item["email"].lower()
            user = db.scalar(select(User).where(func.lower(User.email) == email))
            if user is None:
                user = User(
                    full_name=item["name"],
                    email=email,
                    password_hash=hash_password(secrets.token_urlsafe(32)),
                    role="Volunteer",
                    is_active=True,
                )
                db.add(user)
                db.flush()
            elif user.role != "Volunteer":
                raise RuntimeError(f"Reserved demo email {email} already belongs to a non-volunteer account.")

            profile = db.execute(
                text(
                    """SELECT id, user_id FROM volunteer_profiles
                       WHERE user_id = :user_id OR lower(email) = :email
                       ORDER BY (user_id = :user_id) DESC NULLS LAST
                       LIMIT 1"""
                ),
                {"user_id": user.id, "email": email},
            ).mappings().first()
            if profile and profile["user_id"] not in (None, user.id):
                raise RuntimeError(f"Reserved demo email {email} is linked to a different account.")

            if profile:
                db.execute(
                    text(
                        """UPDATE volunteer_profiles
                           SET user_id = :user_id, full_name = :name, email = :email, phone = :phone,
                               city = :city, skills = :skills, about = :about, status = 'Active',
                               updated_at = now()
                           WHERE id = :profile_id"""
                    ),
                    {
                        "user_id": user.id,
                        "name": item["name"],
                        "email": email,
                        "phone": item["phone"],
                        "city": item["city"],
                        "skills": item["skills"],
                        "about": "Synthetic demonstration profile; not a real volunteer.",
                        "profile_id": profile["id"],
                    },
                )
            else:
                db.execute(
                    text(
                        """INSERT INTO volunteer_profiles
                               (user_id, full_name, email, phone, city, skills, about, status, joined_on)
                           VALUES
                               (:user_id, :name, :email, :phone, :city, :skills, :about, 'Active', CURRENT_DATE)"""
                    ),
                    {
                        "user_id": user.id,
                        "name": item["name"],
                        "email": email,
                        "phone": item["phone"],
                        "city": item["city"],
                        "skills": item["skills"],
                        "about": "Synthetic demonstration profile; not a real volunteer.",
                    },
                )
                created += 1
        db.commit()

    print(f"Demo volunteer profiles ready: {len(VOLUNTEERS)} ({created} newly created).")
    print("Profiles are labeled Demo and use reserved example.org email addresses.")


if __name__ == "__main__":
    main()
