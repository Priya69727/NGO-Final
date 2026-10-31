"""Insert sample proposals, events and projects (skipped per table if it already has rows)."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sqlalchemy import text
from app.database import SessionLocal

DB = Path(__file__).resolve().parents[2] / "database"
with SessionLocal() as db:
    for table, f in (("proposals", "sample_data.sql"), ("projects", "sample_projects.sql")):
        if db.scalar(text(f"SELECT count(*) FROM {table}")):
            print(f"{table} already has rows - skipped {f}")
        else:
            db.execute(text((DB / f).read_text(encoding="utf-8"))); db.commit(); print("applied", f)
