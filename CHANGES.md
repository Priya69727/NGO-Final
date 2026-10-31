# What changed in this build

**Project Management is now fully live and part of the end-to-end flow**
Proposal -> Review/Approval -> Detailed Planning -> Activate Project -> Project workspace -> Reports/Dashboard.

- `frontend/src/services/projectApi.ts` rewritten: the in-memory mock (which reset on every reload and ignored the
  proposal's planning data) is replaced by the real API.
  - Projects, tasks, expenses, team members, budget items and impact indicators use their own tables, so
    Reports and Dashboard show the same data as the Projects module.
  - Plan, department checklists, documents, risks, impact log and activity feed are saved per project
    (`projects.plan_data`) through the new endpoint below.
  - Activation builds the project from the proposal's real planning data (name, location, SDGs, duration, team lead,
    volunteers, budget lines, department owners). Budget always ties to the approved estimate.
  - A proposal can only be activated once; the cache is cleared on login/logout.
- `backend/app/api/projects.py`: new `PUT /api/projects/{id}/workspace` (Admin / Project Manager / Staff).
- `backend/app/main.py`: in development, `localhost` and `127.0.0.1` origins are both accepted (login used to fail
  with 403 when the UI was opened on 127.0.0.1). Production still allows only `APP_ORIGIN`.
- `backend/tests/test_flow_postgres.py`: new workspace test.

Run the full test suite incl. Postgres flow tests:
`TEST_DATABASE_URL=postgresql+psycopg://ngo_app:change-me@localhost:5432/ngo_management pytest`
