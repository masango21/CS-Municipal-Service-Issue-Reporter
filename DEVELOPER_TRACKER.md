# Developer Tracker

## Project Status Summary

- Project: Municipal Service Issue Reporter
- Current Phase: Phase 4 — Backend Development
- Status: Staff operations workflow implemented; API tests and client production build pass
- Backend Phase: Complete for database-backed foundation
- Zero-report rule: Verified and maintained
- Staff account provisioning: Two invite keys configured in ignored `server/.env.staff-invites` and verified

## Phase Tracker

- [x] Phase 1 — Proposed Solution & Requirements
- [x] Phase 2 — UI/UX Screen Design
- [x] Phase 3 — Frontend Development
- [x] Phase 4 — Backend Development
- [x] Phase 5 — Testing, QA, and Refinement
- [x] Phase 6 — Deployment and Production Readiness

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

- Client build: `cd client && npm run build` — compiled successfully
- Backend tests: `cd server && npm test` — 7 passed, 0 failed
- Targeted client lint: 0 errors; two existing image optimization warnings
- Full client lint still reports an existing `LanguageContext.tsx` set-state-in-effect error
- Live API report list: 0 reports after implementation and tests

## Notes

- The app uses the shared Express API with PostgreSQL/file-store persistence and a local client fallback.
- `JWT_SECRET` and two staff invite keys are configured in local ignored server environment files; invite values are intentionally not recorded in tracked documentation.
- Both configured invite keys were accepted by the API, and an unconfigured key was rejected.
- The app must continue to start in a zero-report state until a real resident submission occurs.

## Next Up

- [x] Define backend API contract for Phase 4
- [x] Implement authentication and persistence layer
- [x] Add database-backed report storage
- [x] Connect frontend to backend services
- [x] Final QA and deployment preparation
- [x] Configure and verify both staff invite keys
- [ ] Perform live staff login/triage browser verification with an authorized staff account
