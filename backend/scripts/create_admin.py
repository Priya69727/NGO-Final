"""Create or promote an Admin: python scripts/create_admin.py --email a@b.org --name "Full Name" --password '...'"""
import argparse, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sqlalchemy import func, select
from app.database import SessionLocal
from app.models import User
from app.security import hash_password

ap = argparse.ArgumentParser()
ap.add_argument("--email", required=True); ap.add_argument("--name", required=True); ap.add_argument("--password", required=True)
a = ap.parse_args()
if len(a.password) < 12:
    sys.exit("Password must be at least 12 characters.")
with SessionLocal() as db:
    email = a.email.strip().lower()
    u = db.scalar(select(User).where(func.lower(User.email) == email))
    if u:
        u.role, u.is_active = "Admin", True
    else:
        db.add(User(full_name=a.name, email=email, password_hash=hash_password(a.password), role="Admin"))
    db.commit()
print("Admin ready:", email)
