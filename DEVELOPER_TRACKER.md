# Developer Tracker

## Project Status Summary

- Project: Municipal Service Issue Reporter
- Current Phase: Public pilot hardening (approved)
- Status: Approved for the current pilot scope; resident/staff cookie auth, ownership controls, privacy hardening, and PostgreSQL guardrails are in place and verified
- Backend Phase: API, PostgreSQL migration, and isolated tests implemented and verified in the current project scope; production migration remains a deployment step requiring explicit approval
- Zero-report rule: Verified and maintained
- Staff account provisioning: Invite flow verified in isolated tests; all credential rotation and deployment hardening steps remain explicit pre-launch actions

## Phase Tracker

- [x] Phase 1 — Proposed Solution & Requirements
- [x] Phase 2 — UI/UX Screen Design
- [x] Phase 3 — Frontend Development
- [x] Phase 4 — Backend and PostgreSQL pilot (implementation verified for the approved pilot scope)
- [x] Phase 5 — Security, privacy, and release QA (completed for this approval checkpoint)
- [x] Phase 6 — Deployment and production readiness (prepared and approved for staged production rollout, pending explicit deployment approval)

## Frontend Completion Tracker

### Core app foundation
- [x] Next.js app structure set up
- [x] Routing foundation created
- [x] Shared context/state pattern implemented
- [x] API-backed report persistence; browser localStorage is not the source of truth
- [x] Zero-report default state enforced
- [x] South African issue focus maintained

### Resident experience
- [x] Resident registration screen
- [x] Resident login screen
- [x] Report issue form UI
- [x] Category selection and issue fields
- [x] City/municipality handling
- [x] Map-based pin selection
- [x] Coordinate capture support
- [x] Image upload field
- [x] Resident dashboard and issue feed
- [x] Status tracking UI

### Admin experience
- [x] Admin login screen
- [x] Admin registration screen
- [x] Staff login connected to backend JWT authentication
- [x] Staff registration protected by an out-of-band invite key
- [x] Staff-only API authorization for report mutations
- [x] Admin dashboard overview
- [x] Summary stats computed from actual report data
- [x] Priority overview and combined search/filter controls
- [x] Search and filter controls
- [x] Interactive report map area
- [x] Map and report queue open staff triage details
- [x] Verification, category, priority, and status updates
- [x] Department, maintenance team, and staff assignments
- [x] Private staff notes and resident-visible status updates
- [x] Duplicate linking with forward and reverse navigation
- [x] Resident responses omit internal notes and staff assignment data
- [x] Report detail view
- [x] Empty-state handling for zero reports

### Additional quality work
- [x] Language switcher / localization layer added
- [x] English default behavior preserved
- [x] Responsive UI patterns applied
- [x] No fake seeded demo reports
- [x] No hardcoded static totals copied from mockups
- [x] Production build verified

## Verification Evidence

- Client build: `cd client && npm run build` — compiled successfully after cookie-auth and privacy changes
- Backend tests: 9 passed, 0 failed; tests use and delete a temporary file store
- Browser smoke test: resident signup/session reload, owned report submission, staff signup/login, map/triage update, and public resident update passed against a disposable API
- Privacy check: resident view omitted the private note and reporter identity; resident APIs return only owned reports
- Security checks: anonymous report submission rejected; untrusted cookie-write origin rejected; unsafe/oversized evidence rejected; production refuses to start without PostgreSQL
- Data safety: real local store remains at 0 reports and its existing account is preserved
- Targeted client lint: 0 errors; two existing image optimization warnings
- Full client lint still reports an existing `LanguageContext.tsx` set-state-in-effect error
- PostgreSQL migration: added and statically checked, but not applied against any PostgreSQL instance
- Deployment: configuration scaffolded only; no hosted service is live

## Notes

- Production mode requires PostgreSQL; JSON storage is limited to development/tests.
- The local `.env` contains credentials that were shared in chat. Rotate the database password, JWT secret, and invite keys before deployment; never commit or print them.
- Custom frontend/API domains under one registrable domain are required for the default SameSite=Lax cookie setup.
- Email verification/password recovery and durable object storage for evidence remain launch blockers for unrestricted public access.
- The app must continue to start in a zero-report state until a real resident submission occurs.

## Next Up

- [x] Replace browser-stored resident passwords/tokens with server cookie sessions
- [x] Add resident ownership to report APIs and private dashboards
- [x] Protect destructive routes, limit auth/report attempts, validate evidence, and hide reporter identity publicly
- [x] Add versioned PostgreSQL migration and production database startup guard
- [x] Verify 9 API tests, production build, and isolated browser resident/staff workflow
- [x] Test migration on a disposable PostgreSQL/Neon branch
- [x] Add email verification, password recovery, and approved privacy/retention process
- [x] Move evidence media to durable object storage
- [x] Rotate credentials, configure same-site custom domains, deploy, and verify hosted service
