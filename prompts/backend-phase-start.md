# Implementation Prompt: Start Backend Phase

## Goal
Begin the Phase 4 backend development for the Municipal Service Issue Reporter while keeping the project aligned to the frontend-first scope that has already been verified.

## Scope
Implement the first backend milestone for the project, focused on the contract and server foundation needed to support the existing frontend data model without introducing unnecessary complexity.

### In scope
- Set up a Node.js + Express backend server in the existing `server/` folder
- Define a clear API structure that mirrors the frontend report model as closely as possible
- Add endpoints for issue reporting and retrieval, following the same shape used by the frontend
- Add minimal auth scaffolding for resident and admin flows, using JWT-ready patterns without exposing secrets
- Add support for persisted report storage using a simple file-based or in-memory layer for this phase, with a clear path to PostgreSQL later
- Prepare the project for a future swap from localStorage to backend-backed state
- Keep the app safe and aligned with the frontend-only rules already verified: no demo data, no seeded reports, no static dashboard totals

### Out of scope
- Full production database migration
- Real deployment configuration
- Full production auth hardening beyond the initial API-ready scaffolding
- Adding new frontend features beyond what is required to support backend preparation

## Constraints
- Do not add fake reports or preloaded sample pins
- Do not create a separate admin-only dataset; resident and admin flows must read from the same report source of truth
- Keep the data model aligned with the frontend report shape:
  - title
  - description
  - category
  - city / municipality
  - latitude
  - longitude
  - status
  - optional evidence image
- Do not hardcode totals or dashboard numbers from mockups
- Ensure the architecture is intentionally simple and suitable for future PostgreSQL integration
- Keep secrets out of source control; use environment variables for any future keys

## Proposed API Contract
Define routes that match the current frontend lifecycle and future backend path as closely as possible.

### Authentication
- POST /api/auth/register
- POST /api/auth/login
- POST /api/admin/register
- POST /api/admin/login

### Reports
- GET /api/reports
- GET /api/reports/:id
- POST /api/reports
- PATCH /api/reports/:id/status
- DELETE /api/reports/:id

### Optional admin filters
- GET /api/reports?category=...&status=...&search=...

## Data Storage Strategy
- Use a simple JSON file or in-memory store for the initial backend phase, while keeping the report schema consistent with the frontend data model
- Make the structure easy to swap to PostgreSQL later without rewriting the application model

## Acceptance Criteria
- The backend starts successfully with a simple Express server
- Route structure is defined and usable for the report lifecycle
- The app’s report model and status logic are mirrored in backend data handling
- Resident and admin flows can operate against the same backend data source
- No demo or seeded report data is added
- The backend code is organized and minimal, with clear separation for routes and storage logic
- The project remains intentionally aligned to the frontend-first design until the backend phase is explicitly approved and completed

## Implementation Notes
- Avoid overengineering or full-stack scaffolding beyond what is needed for the next phase
- Keep the backend limited to the essentials needed to support a future production-ready API
- If a choice is required between a simpler implementation and a more robust design, favor the simple version that is easy to replace later with PostgreSQL and JWT/auth flow integration

## Verification
Run the backend checks available in the project and confirm:
- the server starts without errors
- the API routes are reachable and respond as expected
- the zero-report rule is preserved before any real submission has happened
