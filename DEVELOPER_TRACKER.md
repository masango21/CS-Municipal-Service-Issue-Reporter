# Developer Tracker

## Project Status Summary

- Project: Municipal Service Issue Reporter
- Current Phase: Phase 3 — Frontend Development (complete)
- Status: Frontend flows and isolated API integration verified; deployment not verified
- Backend Phase: Server code exists in the repository but is outside the current frontend-only scope
- Zero-report rule: Verified and maintained
- Staff account provisioning: Two invite keys configured in ignored `server/.env` and verified in an isolated test

## Phase Tracker

- [x] Phase 1 — Proposed Solution & Requirements
- [x] Phase 2 — UI/UX Screen Design
- [x] Phase 3 — Frontend Development
- [ ] Phase 4 — Backend Development (future phase; outside current scope)
- [ ] Phase 5 — Testing, QA, and Refinement (broader release QA remains future work)
- [ ] Phase 6 — Deployment and Production Readiness (not deployed or verified)

## Frontend Completion Tracker

### Core app foundation
- [x] Next.js app structure set up
- [x] Routing foundation created
- [x] Shared context/state pattern implemented
- [x] localStorage persistence configured
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

- Client build: `cd client && npm run build` — compiled successfully on the current snapshot
- Backend tests: 7 passed, 0 failed in an isolated temporary copy using file-store mode
- Browser smoke test: resident registration, map pin/category selection, report submission, staff registration/login, triage update, and resident-visible update passed against a disposable API
- Privacy check: resident view displayed the public update and omitted the internal staff note
- Data safety: isolated tests left the real local store at 0 reports and preserved its existing account
- Targeted client lint: 0 errors; two existing image optimization warnings
- Full client lint still reports an existing `LanguageContext.tsx` set-state-in-effect error
- Live API report list: 0 reports after implementation and tests
- Deployment: not performed or verified

## Notes

- Existing server code supports PostgreSQL/file-store persistence; this does not change the current frontend-only phase boundary.
- `JWT_SECRET` and two staff invite keys are configured in the ignored local `server/.env`; values are intentionally not recorded in tracked documentation.
- Both configured invite keys were accepted by the isolated API test, and an unconfigured key was rejected.
- The app must continue to start in a zero-report state until a real resident submission occurs.

## Next Up

- [x] Define backend API contract for Phase 4
- [x] Implement authentication and persistence layer
- [x] Add database-backed report storage
- [x] Connect frontend to backend services
- [x] Frontend build and isolated resident/staff workflow checks
- [x] Configure and verify both staff invite keys
- [ ] Backend phase and deployment work (outside current scope; requires a later phase decision)
