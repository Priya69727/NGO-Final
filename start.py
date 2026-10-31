#!/usr/bin/env python3
"""One-command launcher:  python start.py   (Windows: py start.py)

Starts PostgreSQL (Docker, if available), prepares the backend + database, seeds demo
accounts/data, installs frontend packages, then runs API (:8000) and UI (:5174).
"""
import os, shutil, subprocess, sys, time, webbrowser
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
BACK, FRONT, DB = ROOT / "backend", ROOT / "frontend", ROOT / "database"
WIN = os.name == "nt"
VENV = BACK / ".venv"
PY = VENV / ("Scripts/python.exe" if WIN else "bin/python")
NPM = "npm.cmd" if WIN else "npm"
UI_URL = "http://localhost:5174"

CREDS = [
    ("Admin", "admin@hopefoundation.org", "Admin@Hope2026"),
    ("Project Manager", "manager@hopefoundation.org", "Manager@Hope2026"),
    ("Staff", "staff@hopefoundation.org", "Staff@Hope2026"),
    ("Volunteer", "volunteer@hopefoundation.org", "Volunteer@Hope2026"),
    ("Board", "board@hopefoundation.org", "Board@Hope2026"),
]


def step(msg): print(f"\n==> {msg}", flush=True)
def die(msg): print(f"\nERROR: {msg}", file=sys.stderr); sys.exit(1)
def run(cmd, cwd=None, **kw): return subprocess.run([str(c) for c in cmd], cwd=cwd, check=True, **kw)


def read_env():
    env = {}
    f = BACK / ".env"
    if f.exists():
        for line in f.read_text(encoding="utf-8").splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                k, v = line.split("=", 1); env[k.strip()] = v.strip()
    return env


def main():
    if sys.version_info < (3, 11): die("Python 3.11+ is required.")
    if not shutil.which(NPM): die("Node.js 20+ (with npm) is required: https://nodejs.org")

    env = {**read_env(), **{k: v for k, v in os.environ.items() if k in ("DATABASE_URL", "JWT_SECRET")}}
    db_url = env.get("DATABASE_URL", "")
    if not db_url: die("DATABASE_URL is not set (backend/.env).")
    host = urlparse(db_url.replace("+psycopg", "")).hostname

    # 1. Database
    if shutil.which("docker") and host in ("localhost", "127.0.0.1") and "ngo_app:change-me" in db_url:
        step("Starting PostgreSQL (Docker)")
        run(["docker", "compose", "up", "-d", "--wait", "db"], cwd=ROOT)
    else:
        step("Using existing PostgreSQL from DATABASE_URL")

    # 2. Backend env
    step("Preparing backend (virtualenv + dependencies)")
    if not PY.exists(): run([sys.executable, "-m", "venv", VENV])
    stamp = VENV / ".deps-installed"
    if not stamp.exists() or stamp.stat().st_mtime < (BACK / "pyproject.toml").stat().st_mtime:
        run([PY, "-m", "pip", "install", "-q", "--disable-pip-version-check", "-e", BACK])
        stamp.touch()

    child_env = {**os.environ, **env}
    # 3. Wait for DB, create schema if needed, migrate, seed
    step("Initialising database")
    init = f'''
import time, sys, pathlib, psycopg
url = {db_url!r}.replace("postgresql+psycopg", "postgresql")
for i in range(60):
    try:
        conn = psycopg.connect(url, autocommit=True); break
    except Exception as e:
        err = e; time.sleep(1)
else:
    sys.exit("Cannot connect to PostgreSQL: %s" % err)
with conn:
    if conn.execute("select to_regclass('public.users')").fetchone()[0] is None:
        d = pathlib.Path({str(DB)!r})
        for f in ("schema.sql", "seed.sql"):
            conn.execute((d / f).read_text(encoding="utf-8")); print("applied", f)
'''
    run([PY, "-c", init], env=child_env)
    run([PY, "-m", "alembic", "upgrade", "head"], cwd=BACK, env=child_env)
    run([PY, "scripts/seed_users.py"], cwd=BACK, env=child_env)
    run([PY, "scripts/seed_demo.py"], cwd=BACK, env=child_env)

    # 4. Frontend
    if not (FRONT / "node_modules").exists():
        step("Installing frontend packages (first run only)")
        run([NPM, "install", "--no-audit", "--no-fund"], cwd=FRONT)

    # 5. Run both servers
    step("Starting servers")
    api = subprocess.Popen([str(PY), "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"], cwd=BACK, env=child_env)
    ui = subprocess.Popen([NPM, "exec", "--", "vite", "--host", "127.0.0.1"], cwd=FRONT)
    print("\n" + "=" * 62 + f"\n  Hope Foundation NGO is running:  {UI_URL}\n  API docs: http://127.0.0.1:8000/docs\n" + "-" * 62)
    for role, email, pw in CREDS: print(f"  {role:<16} {email:<30} {pw}")
    print("=" * 62 + "\n  Press Ctrl+C to stop.\n", flush=True)
    time.sleep(4)
    try: webbrowser.open(UI_URL)
    except Exception: pass
    try:
        while api.poll() is None and ui.poll() is None: time.sleep(1)
    except KeyboardInterrupt:
        pass
    finally:
        for p in (api, ui):
            if p.poll() is None: p.terminate()
        for p in (api, ui):
            try: p.wait(5)
            except Exception: p.kill()
    print("Stopped.")


if __name__ == "__main__":
    main()
