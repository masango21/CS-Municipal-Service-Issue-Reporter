# Implementation Prompt: Secure Municipality-Scoped Staff Workflow

## Goal
Incrementally extend the existing Municipal Service Issue Reporter into a secure municipality-routed reporting and operations workflow. Preserve working UI and behavior where compatible. Do not rebuild the application, create a second report/auth system, invent geographic data, add demo records, deploy, or connect to/migrate the existing production database.

## Repository Findings
Use these verified implementation facts as the starting point and re-check them before editing:

- The client is Next.js/React/TypeScript with shared `AuthContext` and `ReportsContext`; the API is Express in `server/index.js`.
- Resident and admin/staff authentication already use separate endpoints and an HttpOnly `msr_session` cookie. Password hashes use Node `crypto.scrypt`; staff registration currently uses invite keys from `ADMIN_REGISTRATION_KEYS`.
- The only current roles are `resident` and `admin`. The latter has global access to staff report endpoints; a distinct super-admin role and staff-to-municipality authorization do not exist.
- PostgreSQL uses `resident_users`, `staff_users`, `issue_categories`, and `issues`. Reports currently store municipality as free text, have coordinates and resident ownership, and have no municipality foreign key. A JSON file store is also supported locally and in tests.
- The existing report API supports public listing/detail, resident-owned listing/creation, staff listing/detail, triage, status updates, notes, and public updates. Keep its shared report source of truth and public/private field separation.
- `LocationPicker`/`MapView` capture a map point, but currently supply placeholder city/municipality/address values. The report form preselects Pretoria/Tshwane and allows manual editing. No municipality boundary dataset or geocoding configuration has been identified.
- Existing staff UI is `/admin/dashboard` and `/admin/reports/:id`; residents use `/report`, `/dashboard`, and `/issues`. Preserve existing visual language and routes where practical, protecting routes with backend enforcement, not only client redirects.

## Required Workflow

### Resident
- Preserve resident registration/login/logout, resident-owned report history, public report status viewing, category, description, and optional photo behavior.
- On map pin placement or movement, resolve a real address and South African municipality from the coordinates. Show loading, success, and unresolved states. Address and municipality are read-only; remove misleading Pretoria/Tshwane defaults.
- Do not accept a municipality name or municipality ID as authority from the browser. The server must resolve/validate the coordinate against the configured authoritative source and persist the matched municipality relationship. Reject report creation when a valid municipality cannot be determined.
- Keep latitude/longitude, category, and location required. A report exists only after a resident submits it.

### Staff
- Retain the existing staff login and invitation flow where appropriate, but do not let self-registration choose a role, municipality, or administrative privilege.
- After login, return only municipalities assigned to the authenticated staff account. Selecting one requires a second access-code verification before report-management access is granted.
- Restrict every staff read and mutation on the server to the selected municipality, current staff assignment, and a valid, unexpired municipality verification. This includes list, detail by arbitrary report ID, status, triage, notes, public updates, and any existing delete/reset operations. Never rely on UI filtering.
- Provide a lock/exit action. Keep verification state out of localStorage; expire it and invalidate it when the access code is reset, staff assignment is removed, or the user logs out.
- Scope staff counts, report totals, filters, lists, and map pins to the verified municipality. Preserve existing status values and workflow; do not silently rename or discard supported statuses.

### Super Admin
- Add a genuinely separate super-admin capability for municipality and staff administration: view municipalities/reports and data-derived statistics, assign/remove staff, configure municipalities, and generate/reset access codes.
- Do not add public super-admin registration or promote an account from request-body role data. Define a secure, documented bootstrap/first-super-admin mechanism that is not seeded into runtime data and never commits secrets. Only super admins may use administrative endpoints; ordinary staff and residents receive 403.
- Display a newly generated access code only once to the authenticated super admin who requested it. Never return/log/store the plaintext code or expose its hash. Rate-limit verification and management operations.

## Data and Geographic Source Requirements
- Add a new forward-only SQL migration. Extend `issues` additively with `municipality_id` referencing a real `municipalities` table; preserve existing reports and nullable/legacy municipality text safely. Add municipality province, code, type, boundary/source metadata as justified. Add a `staff_municipalities` relationship table with appropriate foreign keys/unique constraints and timestamps. Add only necessary access-code hash/version fields and any bounded verification/session or audit tables needed by the chosen secure design.
- Keep local JSON and isolated tests aligned with the new municipality and assignment behavior. Continue to start with exactly zero reports and zero map pins. Do not seed municipalities unless they are real, sourced reference data and the source is documented; never seed fake boundaries/accounts/reports.
- Do not hard-code Pretoria/Tshwane or another coordinate-to-municipality mapping. Do not fabricate GeoJSON or claim that reverse geocoding alone proves jurisdiction.
- Before implementation relies on location resolution, identify an authoritative South African municipality boundary dataset or configured geospatial provider and its license, update cadence, coverage, and deployment configuration. Identify a reverse-geocoding provider for street addresses and document its usage limits/privacy implications. Do not depend on public Nominatim from browser clicks as an unconfigured production service.
- If authoritative boundary data/provider or required secrets are absent, do not fake successful detection. Implement a clear provider boundary/configuration contract where useful, block report submission for unresolved coordinates, and document exactly what external data/service/environment variables are still needed. Never connect to or migrate the existing Neon database. Validate migrations only on an isolated disposable PostgreSQL database/branch after separate approval.

## Authorization and API
- Reuse the existing cookie authentication and Express conventions. Verify identity/role from a validated server session and current persisted account state. Do not trust `role`, `staff_id`, `municipality_id`, report ownership, or assigned staff identifiers from the request body.
- Use explicit authorization helpers for super admin, authenticated resident, assigned staff, and verified municipality access. Resolve report membership on the server before returning or mutating it. Return consistent 401/403/404 responses without leaking another municipality's report existence.
- Keep public report payloads free of resident identity, private staff notes, assignment data, access hashes, audit data, and other staff-only fields.
- Define API contracts consistent with existing routes before wiring UI. Add only routes needed for municipality listing/resolution, staff municipality listing/access verification/lock, scoped staff report operations, super-admin municipality/staff management, and code generation/reset. Validate all input server-side and keep error responses user-safe.
- Use a memory-hard password hashing approach already supported by project dependencies/current stack for access codes (prefer existing scrypt helpers or a reviewed compatible implementation); use timing-safe comparison. Do not log secrets. Keep code verification bounded and invalidate existing grants on reset/assignment removal.
- Ensure a resident cannot call staff/admin endpoints; staff cannot use another municipality's valid code without assignment; staff cannot read/change an unauthorized report by changing its URL/ID; only super admins can manage users, municipalities, and codes.
- Add an audit trail for access-code changes, assignment changes, and report status/triage actions if it fits the existing persistence model without exposing it to residents.

## UI Requirements
- Reuse the current resident form, map, authentication components, report cards/detail views, and staff dashboard. Make incremental, accessible changes and preserve responsive behavior.
- Resident location view: map pin, automatic address and municipality status, explicit unresolved-location explanation, and disabled submit until resolution succeeds.
- Staff view: assigned municipality selection, access-code prompt, useful invalid/expired/not-authorized messages, verified workspace, scoped dashboard/map/report detail, status controls, private-note behavior, and an obvious lock/exit control.
- Super-admin views: municipality overview and controls to add/edit configuration, assign/remove staff, view statistics/reports, and generate/reset access codes with one-time code display. Do not present fabricated totals or example municipality records.
- Protect dashboard page loads and all data actions; frontend redirects are a usability layer only.

## Testing and Acceptance
Use the existing Node test suite and conventions; add isolated tests for JSON-store behavior and database-level tests only when a disposable local/test database is available. Do not run any migration against the configured/existing production database.

Verify at minimum:

1. A fresh isolated store starts with 0 reports and 0 report pins; existing user-created reports are preserved by additive migrations.
2. Existing resident registration/login/session/logout and owner-only report history continue to work; resident status views omit internal staff data.
3. A real configured location provider resolves address and municipality from selected coordinates; moving the pin recomputes both. Unknown/out-of-coverage coordinates block submission with a clear message.
4. The server ignores/rejects client-supplied municipality authority and stores the server-resolved municipality foreign key.
5. Staff see only assigned municipalities. Correct code plus assignment grants time-limited municipality access; wrong code, expired grant, no assignment, reset code, removed assignment, and logout deny access.
6. Resident requests to staff endpoints fail. Staff cannot access any other municipality's report through list, detail URL, status update, triage, note, or other mutation. A valid code for an unassigned municipality does not grant access.
7. Super-admin-only actions reject resident/staff callers; super admins can assign/remove staff and generate/reset a code. Plaintext codes are displayed only once and never appear in persisted store, database queries/responses, logs, or unrelated API responses.
8. Staff statuses and scoped dashboard/map totals reflect actual stored reports. Existing report APIs and public/private serialization remain compatible.
9. Run `npm test` in `server/`, `npm run lint` and `npm run build` in `client/`, and report exact results. Fix only regressions caused by this task; disclose unavailable provider/database tests rather than claiming success.

## Safety and Delivery Constraints
- No demo or seeded reports, map pins, fake municipality boundaries, fake staff, or hardcoded statistics.
- No production deployment, production database access, production migration, destructive global data reset, or secret rotation without separate explicit user approval.
- Do not print or commit `.env` values. Update `.env.example`/deployment docs with variable names and safe descriptions only.
- Keep changes small, typed, tested, and consistent with existing code. Read the relevant installed Next.js documentation under `client/node_modules/next/dist/docs/` before editing Next.js code.
- At completion, report authentication changes, authoritative location resolution approach and dependencies, schema/migration changes, staff/super-admin authorization, access-code storage/session invalidation, report handling, security tests, failed/unavailable tests, required environment variables, and exact remaining external data/provider work. Never claim an untested feature works.
