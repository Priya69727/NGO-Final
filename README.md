# NGO Management System

## Quick start (one command)

Requirements: **Python 3.11+**, **Node.js 20+**, and either **Docker** (recommended; PostgreSQL starts automatically) or a PostgreSQL server reachable at `DATABASE_URL` in `backend/.env`.

```sh
python start.py        # Windows: py start.py   (or double-click start.bat)
```

This starts PostgreSQL, creates the schema, runs migrations, seeds the demo accounts and sample data, installs dependencies on first run, then serves the API on :8000 and the app on **http://localhost:5174**. Press Ctrl+C to stop.

## Role-based demo accounts

| Role | Email | Password | Access |
|---|---|---|---|
| Admin | admin@hopefoundation.org | Admin@Hope2026 | Everything: proposal approvals, project activation, user roles |
| Project Manager | manager@hopefoundation.org | Manager@Hope2026 | Proposals, detailed planning, projects, events, people, reports |
| Staff | staff@hopefoundation.org | Staff@Hope2026 | Operations, donors, birthday module, communication, events, people |
| Volunteer | volunteer@hopefoundation.org | Volunteer@Hope2026 | "My Workspace": own tasks and upcoming events |
| Board | board@hopefoundation.org | Board@Hope2026 | "My Workspace": read-only events overview |

The login page has one-click buttons for these accounts. Access is enforced in two places: the API (`backend/app/api`, per-resource role checks) and the UI (`frontend/src/lib/access.ts` drives route guards and the sidebar). Self-registered users get the `Member` role and see an "access pending" page until an Admin assigns a role. **These fixed credentials are for demos only. Remove them (`backend/scripts/seed_users.py`) before a real deployment.**

NGO operations application with a React, TypeScript, and Vite frontend, a FastAPI backend, and PostgreSQL database scripts. The repository is organized into three application folders: `frontend/`, `backend/`, and `database/`.

## Requirements

- Node.js 22 (see `frontend/.mise.toml`)
- pnpm 10.34.3 (see `frontend/.mise.toml`)

## Development

```sh
cd frontend
pnpm install
pnpm dev       # Vite on http://localhost:5174 by default
pnpm build     # production build in dist/
pnpm preview   # preview the build on port 8443 by default
pnpm format    # format files with oxfmt
```

Set `PORT` to override the development or preview port. The dev server uses `5174` by default; preview uses `8443`.

## Sign-In

Authentication is backed by the FastAPI service and PostgreSQL. Follow [backend/README.md](backend/README.md) to configure the database and start the API, then run the Vite frontend with `npm run dev`. Open `/login` to sign in or `/register` to create a Volunteer account. Authenticated pages redirect to sign-in when the session is missing or expired.

## Modules

- Core operations: dashboard, projects, proposals, planning, events, beneficiaries, resources, occasions, engagement, outcomes, communications, reports, and administration.
- Birthday Project: `/birthday-project/dashboard`, `/profiles`, `/occasions`, `/engagement`, `/outcomes`, `/departments`, `/reports`, and `/action-workspace`.
- Donor Management: `/donor-management/admin/dashboard`, `/directory`, `/contributions`, `/campaigns`, `/communications`, `/followup`, and `/reports`.
- People Management: `/people-management`, `/people-management/hr`, `/people-management/interns`, and `/people-management/volunteers`. HR manages shared tasks and public Job/Internship/Volunteer opportunities; volunteers can see only their assigned tasks and update status at `/people-management/tasks`. `/people-management/calendar` and `/people-management/attendance` provide the shared schedule and attendance workspaces. Published opportunities are publicly viewable at `/opportunities/:slug` and applications are saved to the corresponding HR, intern, or volunteer application records. Apply migration `0006_people_workspace` with `alembic upgrade head` before using these features.

Project management routes include `/projects`, `/projects/create`, `/projects/planning`, `/projects/proposals`, `/projects/reports`, and `/projects/:id`.

## Project Map

- `frontend/src/App.tsx` registers routes; `frontend/src/components/Layout.tsx` defines the shared application shell and navigation.
- `frontend/src/pages/` contains the feature modules; `frontend/src/components/` contains shared UI.
- `frontend/src/services/` contains API clients and feature services; `frontend/src/data/` contains prototype seed data.
- `frontend/src/types/project.ts` defines project-domain types.
- `API_CONTRACT.md` documents the proposed project API and data model. It is a backend integration contract, not a live API.
- `frontend/.figma/make/` contains Figma Make development and deployment integration scripts.
- `backend/app/` contains the FastAPI app, feature routes, authentication, and database integration.
- `backend/alembic/` contains database migrations; `backend/tests/` contains backend tests.
- `database/schema.sql` and `database/seed.sql` define and seed the PostgreSQL schema.

## Data and Authentication

The FastAPI service connects to PostgreSQL, stores Argon2 password hashes and revocable JWT sessions, and provides authenticated CRUD endpoints for the persisted NGO data tables. Resource access is checked server-side and mutations are written to the audit log. The main dashboard, project reports, and event listing/creation/update call the API.

Most other React feature pages still use mock data or browser storage and are not yet connected to the backend. The application is therefore not production-ready until those service integrations and end-to-end workflows are completed and verified. See [backend/README.md](backend/README.md) for setup, endpoint conventions, and deployment requirements.

## PostgreSQL

`database/schema.sql` creates the core PostgreSQL schema, and `database/seed.sql` inserts the department lookup rows. Running `alembic upgrade head` from `backend/` also creates and extends the People Management tables before the API starts. For the Windows PostgreSQL, backend environment, migration, and local server commands, follow [backend/README.md](backend/README.md#local-setup). Keep database credentials and beneficiary/donor personal data on the server, never in browser code.


## Merged project flow

1. A **Project Manager** creates a proposal (`/projects/proposals`) and submits it.
2. An **Admin** reviews it (Under Review → Financial Review → Approved, or Rejected with a reason).
3. The Project Manager completes the Detailed Plan (`/projects/planning`) for the approved proposal.
4. An **Admin** activates it (`/projects/activate`); Project Managers then follow active projects.
5. Events (`/events`) support registrations, attendance and photos; People, Donor and Birthday modules share the same shell.

Setup extras: `cd backend && alembic upgrade head`, then `python scripts/create_admin.py --email ... --name ... --password ...` and optionally `python scripts/seed_demo.py`.
Postgres flow tests: `TEST_DATABASE_URL=postgresql+psycopg://... pytest tests/test_flow_postgres.py`.
