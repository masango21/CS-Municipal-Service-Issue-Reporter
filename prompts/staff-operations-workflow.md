# Implementation Prompt: Municipal Staff Operations Workflow

## Goal
Turn the existing staff dashboard into a usable municipal operations workspace for authenticating staff, triaging resident reports, assigning work, communicating status, and handling duplicates.

## Existing System
- Next.js client with local React Context and localStorage fallback, plus an Express API and PostgreSQL/file-store support.
- Reports are shared between resident and staff views and must remain a single source of truth.
- Current report statuses are `Reported`, `Under Review`, `Assigned`, `In Progress`, `Resolved`, and `Closed`. Treat `Reported` as the resident-facing equivalent of staff status `New` unless a deliberate compatible migration is needed.
- Current API supports report list/detail/create, status patch, and delete. Staff operational fields and staff-protected mutations are not implemented.
- Current authentication has resident/admin login endpoints and JWT creation, but the client uses localStorage accounts and the report routes do not enforce JWT roles. Passwords are stored as plaintext in the file-store implementation.

## Scope

### Staff authentication and access control
- Connect staff sign-in to the existing admin API/authentication flow and carry its authenticated identity into staff operations.
- Enforce admin role at the API for every staff mutation; client-side route guards alone are not authorization.
- Keep resident and staff sessions/areas isolated.
- Do not allow registration to grant elevated access implicitly; preserve the existing admin registration flow while ensuring only a valid staff session can mutate reports.
- Hash passwords in backend persistence and require a configured JWT secret outside tests/local test fixtures; never use the development fallback secret in production.

### Staff dashboard
- Show data-derived totals for total reports, new/reported, in progress, and resolved, plus priority counts/breakdown.
- Keep totals calculated from the same live report collection; no static totals or seeded reports.
- Provide search and combined status/category/priority/department filters with useful zero-result and zero-report states.
- Use `New` as the staff-facing label for the existing `Reported` status unless the model is safely migrated and all consumers/tests are updated.

### Report triage and detail
- Provide staff access to a report queue, report details, and opening a report from its map pin.
- Allow staff to verify/unverify a report, change category and priority, and update status across `New`, `Under Review`, `Assigned`, `In Progress`, `Resolved`, and `Closed`.
- Persist verification state, category, priority, status, and all assignments so refreshes and other views show the same data.
- Provide a staff-only detail/triage interface while retaining the resident-facing report detail/status experience.

### Department, team, and staff assignment
- Support assigning a department, maintenance team, and responsible staff member.
- Use explicit typed fields and persist assignments with the report. Responsible staff choices must come from actual staff accounts, not mock people.
- Do not seed sample departments, teams, or staff. Where no directory/management capability exists, allow staff to enter department/team names or manage them through a small real-data form; make the chosen approach explicit and keep it minimal.

### Communication and duplicate handling
- Allow authenticated staff to add timestamped staff notes tied to the staff account; do not expose internal notes to residents.
- Allow staff to post resident-visible status updates, with author and timestamp. Show these updates in resident report details/feed.
- Allow staff to mark a report as a duplicate of another existing report, link to the canonical report, and open either report from the relationship. Prevent self-links and invalid/nonexistent report IDs.
- Keep all notes, updates, and duplicate relationships persisted in the same report system.

### Map
- Continue to show real resident coordinates only, with no synthetic pins.
- Let staff open the corresponding report detail/triage view from each pin.

## Data and API Requirements
- Extend the existing report data model and PostgreSQL schema additively; preserve old records with safe defaults and keep file-store behavior aligned.
- Define and implement explicit API contracts for staff updates, assignments, notes, resident-visible updates, verification, and duplicate relationships before wiring UI controls.
- Require a valid admin JWT for every staff-only mutation and return clear 401/403/404/400 responses as appropriate.
- Validate status, priority, category, assignments, note/update text, and duplicate target server-side.
- Ensure staff notes are not returned in resident/public report payloads. Return resident-visible updates separately or as a clearly public field.
- Keep reports and dashboard totals backed by the shared report source; never create a parallel staff report list.
- Keep credentials and signing secrets out of source control.

## Out of Scope
- No seeded/demo reports, pins, staff members, departments, or teams.
- No unrelated redesign of resident reporting or map technology.
- No external notification service, email/SMS integration, analytics platform, or municipal ERP integration.
- No destructive global reset control in normal staff operations.

## Acceptance Criteria
- A fresh store/database starts with zero reports and zero pins; staff taxonomy/directory additions do not create reports.
- A resident or logged-out caller cannot perform staff mutations by calling the API directly.
- An authenticated staff user can search/filter reports, open a report from the list/map, verify it, edit category/priority, assign department/team/staff, and move it through all supported statuses.
- Staff notes remain private; resident-visible updates appear in the resident report experience.
- Duplicate reports are linked to a valid canonical report, cannot point to themselves, and can be followed from either report.
- Changes persist across reloads and are consistent across staff and resident views where intended.
- API tests cover unauthenticated/forbidden access, validation, persistence, role/status transitions, private notes, resident-visible updates, duplicate links, and empty-store behavior.
- Client production build and server tests pass.

## Verification
Use a clean test store/database and verify it begins empty. Exercise the workflows with a real resident-submitted report and a real staff login. Confirm API 401/403 behavior directly, verify staff notes are absent from resident payloads, verify public updates and status appear for residents, and run `npm test` in `server/` plus `npm run build` in `client/`.