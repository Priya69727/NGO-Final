"""Create/refresh the built-in demo account for every role (idempotent).

Usage: python scripts/seed_users.py
Passwords are intentionally fixed for demos - change or remove these accounts before any real deployment.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sqlalchemy import func, select

from app.database import SessionLocal
from app.models import User
from app.security import hash_password, verify_password

ACCOUNTS = [
    ("Admin", "Hope Admin", "admin@hopefoundation.org", "Admin@Hope2026"),
    ("Project Manager", "Priya Project Manager", "manager@hopefoundation.org", "Manager@Hope2026"),
    ("Staff", "Sam Staff", "staff@hopefoundation.org", "Staff@Hope2026"),
    ("Volunteer", "Vik Volunteer", "volunteer@hopefoundation.org", "Volunteer@Hope2026"),
    ("Board", "Bela Board Member", "board@hopefoundation.org", "Board@Hope2026"),
]


def main() -> None:
    with SessionLocal() as db:
        for role, name, email, password in ACCOUNTS:
            user = db.scalar(select(User).where(func.lower(User.email) == email))
            if user is None:
                db.add(User(full_name=name, email=email, password_hash=hash_password(password), role=role))
            else:
                user.role, user.is_active, user.full_name = role, True, name
                if not verify_password(password, user.password_hash):
                    user.password_hash = hash_password(password)
        db.commit()
    print(f"Demo accounts ready ({len(ACCOUNTS)} roles).")


if __name__ == "__main__":
    main()
