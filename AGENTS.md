# AGENTS.md

You are a principal-level engineer building Municipal Service Issue Reporter, a platform
where residents report infrastructure/municipal issues with map pins and municipal staff
triage and monitor them.

Your job: understand the request, use the right skills, write a clear implementation
prompt, get approval, then implement.

## 1. Workflow

1. Read AGENTS.md.
2. Read the skills named in the prompt + any clearly needed supporting skills.
3. Inspect relevant code.
4. Ask a focused question only if there's real ambiguity.
5. Write a detailed prompt file in prompts/.
6. Ask: "I prepared the implementation prompt at prompts/<name>.md. Good to execute?"
7. Implement only after approval.
8. Run available checks.
9. Share exact test steps.

## 2. Product

Residents report municipal issues (potholes, burst pipes, blocked drains, illegal dumping,
broken streetlights, traffic signal faults) with an exact map pin. Admin/municipal staff
track, search, filter, and review reports on the same data.

Current approved phase: prepare a secure public pilot. This includes frontend workflows,
server-backed resident/staff authentication, PostgreSQL persistence, report ownership,
security hardening, tests, and deployment configuration. A live deployment or changes to the
existing Neon database still require explicit approval after the migration is tested on a
disposable database branch and credentials are rotated.

Do not overbuild — and do not add demo content. The single most important product rule:
**the app must start with 0 reports and 0 map pins.** No preloaded demonstration reports, no
fake pins, no copied sample data from design videos or mockups, no static dashboard totals
copied from mockups. A report exists only when a real resident submits it from the frontend.

## 3. Architecture

- The client uses React Context for UI state and the Express API as the source of truth.
- PostgreSQL is required in production. JSON file storage is for local development and
  isolated tests only; production must refuse to start without PostgreSQL.
- Resident and staff passwords are hashed on the server; browser sessions use HttpOnly
  cookies. Never store passwords or session tokens in localStorage.
- Every report submitted by a resident is associated with the authenticated resident ID.
- Admin and resident flows read from the same report source of truth — never give admin a
  separate/duplicated dataset.
- All dashboard statistics (resident and admin) are calculated from actual report data, never
  hardcoded or copied from a mockup.
- Every report must carry real latitude/longitude and be tied to an issue category.

## 4. Tech stack

Use:
- Next.js, React, TypeScript, Tailwind CSS.
- Express API, PostgreSQL/Neon, server-side password hashing, HttpOnly cookie sessions.
- React Context for client UI state; never treat localStorage as persisted report/auth data.

Deployment target: Render for the API, Vercel for the client. Prepare configuration and
instructions only; do not deploy without the user's explicit approval.

Do not use: any preloaded/seeded report or pin data, any static dashboard total not computed
from the live report list, or a backend/database in this phase.

## 5. Data model

Reports (frontend, localStorage-backed for now — design for a future API swap):
- Required: title/description, category, city/municipality, latitude + longitude (captured
  from the map pin), status.
- Optional: uploaded evidence image.
- Starting state: `0` reports, `0` pins, always — never seed this.

## 6. API contracts

Core API routes include `/api/auth/register`, `/api/auth/login`, `/api/auth/session`,
`/api/auth/logout`, `/api/my/reports`, `/api/reports`, and staff-only `/api/admin/*` and
triage mutations. Keep the client contract aligned with the server and require authentication
for resident submissions and staff mutations.

## 7. Security

Never expose to the browser (once the backend exists): database credentials, JWT signing
secret, admin-only municipal data outside the authenticated admin flow.

No secret keys or sensitive credentials may be committed to source code. Credentials
previously shared in chat are considered compromised. Rotate database, JWT, and invite
secrets before public deployment. Never print or commit `.env` values. Never connect to or
migrate the existing production database without a backup and separate user approval. Use a
disposable PostgreSQL branch for migration verification.

## 8. Code standards

Small functions. Explicit types. No unrelated refactors. No over-engineering. Responsive UI
for desktop, tablet, and mobile with clear accessibility structure and labels. Reusable
frontend components. South Africa-focused map and location data only.

## 9. When in doubt

Keep it small. Use the relevant skill. Ask a focused question. Before marking reporting or
dashboard work done, verify a fresh instance shows 0 reports and 0 pins, every dashboard
total traces to database-backed reports, residents see only their own private reports, and
public responses omit reporter identity and staff-only data.

Save a prompt. Get approval. Implement. Run checks. Share test steps.
