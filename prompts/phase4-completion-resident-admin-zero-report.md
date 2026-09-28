# Implementation Prompt: Complete Phase 4 — Resident Flow, Admin Flow, and Zero-Report Rule

## Goal
Finalize Phase 4 for the Municipal Service Issue Reporter by validating and fixing the resident flow, admin flow, and zero-report startup behavior, while keeping the architecture aligned with the frontend-first/React Context + localStorage model and the backend-ready API structure.

## Scope

### In scope
- Ensure resident registration/login works correctly in the app
- Ensure the resident report submission flow captures all required fields and creates a real issue record
- Validate resident dashboard stats and issue feed reflect actual submitted reports
- Ensure admin login/register works correctly and reads from the same report source of truth as resident flows
- Validate admin dashboard summaries, filtering, search, and report detail interactions
- Enforce the zero-report rule on fresh app launch and after reset
- Keep backend/server behavior aligned with the app’s data model and storage rules
- Finalize the backend foundation so it is ready for the project’s backend phase completion criteria

### Out of scope
- Full production backend deployment
- Large refactors unrelated to flow correctness or zero-report enforcement
- New feature work beyond the flows required for resident/admin operations and report lifecycle

## Constraints
- Do not add seeded demo reports, fake pins, or static dashboard totals copied from mockups
- Keep the app in a true zero-report state on first load unless a real resident submission happens
- Resident and admin flows must read from the same report source of truth
- Keep the data model aligned to the future API contract: issue title, description, category, city, municipality, latitude, longitude, status, and optional evidence image
- Preserve responsive, accessible UI behaviors for desktop/tablet/mobile
- Do not introduce backend/database complexity beyond the minimal backend foundation needed for this phase

## Required work
1. Audit the resident flow end to end
   - registration/login state and validation
   - report issue form behavior
   - map location selection and coordinate capture
   - issue creation and redirect to the issue detail page
   - resident dashboard stats and empty state behavior

2. Audit the admin flow end to end
   - admin registration/login
   - report list filtering/search logic
   - dashboard summary totals based on actual reports
   - map view and detail display
   - reset flow and empty-state handling

3. Enforce the zero-report rule
   - ensure fresh browser state has 0 reports and 0 pins
   - ensure reset clears all report state and does not leave hidden seeded data
   - ensure counts on both resident and admin dashboards are computed from current reports only

4. Complete backend phase alignment
   - maintain API route structure and storage behavior consistent with the report lifecycle
   - ensure server/file-store behavior supports the zero-report rule in test and local development
   - ensure category and report filter endpoints return meaningful data and behave consistently

## Acceptance criteria
- A fresh app instance shows 0 reports and 0 pins before any submission
- Resident report creation stores a real issue with category, description, city/municipality, latitude/longitude, status, and optional evidence image
- Resident dashboard totals and issue feed reflect the actual report list
- Admin dashboard totals, filters, search, and map reflect the same report list
- Admin and resident flows use the same underlying source of truth
- Backend route behaviors and test checks pass without seeded report data
- The project is ready to call Phase 4 complete from a functional and verification standpoint

## Verification
Run the available checks and confirm:
- server tests pass
- frontend build passes
- app starts cleanly with zero reports and zero pins
- one real resident submission updates both resident and admin dashboards correctly

## Notes
- Keep the implementation focused and minimal.
- Do not overbuild or add demo content.
- Prefer the simplest fix that preserves the architecture and ensures real data drives the app.
