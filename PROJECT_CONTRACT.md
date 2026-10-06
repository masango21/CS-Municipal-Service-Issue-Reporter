# Municipal Service Issue Reporter — Project Contract

## 1. Project Overview

Project Name: Municipal Service Issue Reporter

Business problem:
Residents often identify infrastructure and municipal service problems such as potholes, burst pipes, blocked drains, illegal dumping, broken streetlights, and traffic signal faults, but there is often no simple, transparent digital channel to report them. Municipal teams also lack a single place to view, triage, and monitor these issues efficiently.

This project aims to solve that gap by creating a digital reporting and monitoring platform for residents and municipal staff in South Africa.

## 2. Project Goal

To build a responsive web application that allows:
- Residents to report municipal service issues with accurate map-based positioning
- Municipal staff to track, search, filter, and review those reports
- The system to start from a true zero-report state and grow as real submissions are made
- A secure API and database-backed foundation for a controlled public pilot

## 3. Core Problem Statement

Municipal service problems are often reported through fragmented channels, informal complaints, or delayed manual processes. This leads to:
- slow response times
- poor visibility of issues across an area
- difficult tracking and prioritisation
- a lack of data for municipal planning and maintenance

The application should provide a simple digital process for reporting issues and a clear operational view for the municipality.

## 4. Target Users

### Resident Users
Residents should be able to:
- register and log in
- report service issues
- choose issue category
- describe the problem
- provide location details
- pin exact issue location on a map
- upload evidence images
- view submitted reports and statuses
- log out

### Administrators / Municipal Staff
Municipal administrators should be able to:
- log in to an admin area
- view all reports
- see locations on a map
- search and filter issues
- inspect report details
- monitor status and priority
- review issue volume and trends
- log out

## 5. Functional Scope

### Resident experience
- Resident registration
- Resident login
- Report issue form
- Category-based issue selection
- Description and title entry
- City / municipality input
- Interactive South African map with issue pinning
- Coordinate capture from selected map point
- Image upload support
- Report submission
- Resident dashboard
- Issue feed
- Report status tracking

### Admin experience
- Admin login
- Admin registration
- Admin dashboard
- Summary statistics
- Search and filtering
- Issue list
- Interactive report map
- Report detail view
- Status monitoring

## 6. Non-Functional Requirements

- Responsive UI for desktop, tablet, and mobile
- Clear accessibility structure and labels
- South Africa-focused map and location data
- Reusable frontend components
- API-backed resident/staff identity and report persistence
- Private report history scoped to the authenticated resident
- Production deployment remains gated on security, privacy, database migration, and hosting verification
- No fake report data, no fake pins, no copied video data

## 7. Technical Constraints and Architecture Requirements

### Current public-pilot phase
- Next.js
- React
- TypeScript
- Tailwind CSS
- Node.js
- Express
- PostgreSQL
- Neon
- HttpOnly cookie sessions and server-side password hashes
- Render
- Vercel

### Production boundary
JSON file storage is limited to local development and isolated tests. Production requires PostgreSQL. Deployment and migrations against the existing Neon database require rotated credentials, a verified backup, a disposable-branch migration test, and explicit approval.

## 8. Core Data Principles

The application starts in this state:
- 0 reports
- 0 map pins

A report is generated only when a real resident submits it from the frontend. There must be:
- no preloaded demonstration reports
- no fake map pins
- no copied sample data from design videos
- no static dashboard totals copied from mockups

Reports must contain geographic coordinates to support map-based issue tracking.

## 9. Required Project Rules

1. Start with zero reports and zero map pins.
2. Use South African cities and municipalities only.
3. Every report must have a real latitude and longitude.
4. Every report pin must be tied to an issue category.
5. Admin and resident flows must use the same report source of truth.
6. All dashboard statistics must be calculated from actual report data.
7. The frontend must support future backend integration.
8. No secret keys or sensitive credentials may be committed to source code.
9. Do not flood the app with demo content.
10. All work must be testable and verifiable.

## 10. Project Phases

### Phase 1 — Proposed Solution & Requirements
Status: Completed

Purpose:
- define the problem, solution, target users, project objectives, and boundaries

Deliverable:
- Proposed solution and requirements foundation

### Phase 2 — UI/UX Screen Design
Status: Completed

Purpose:
- create the main resident and admin interface designs and visual flow

Deliverable:
- Initial UI screens / design reference

### Phase 3 — Frontend Development
Status: Completed (verified 2026-09-29)

Purpose:
- implement the approved interface as a responsive web application
- prepare reusable frontend components
- validate the resident-to-admin issue reporting workflow

Deliverable:
- Functional frontend

### Phase 4 — Backend Development
Status: In progress; implementation and isolated tests are complete, but a real PostgreSQL migration is not yet verified.

Purpose:
- implement the API, database structure, authentication, and persistence layer

### Phase 5 — Testing, QA, and Refinement
Status: In progress; hosted database, email recovery/verification, and object storage remain unverified or incomplete.

Purpose:
- validate all workflows, responsiveness, security preparation, and project readiness

### Phase 6 — Deployment and Production Readiness
Status: Not deployed. Render/Vercel configuration is scaffolded; public launch requires separate approval and completed launch gates.

Purpose:
- deploy frontend and backend, prepare environment variables, and final production configuration

## 11. Project Sprints

### Sprint 1 — Frontend setup and architecture
Objective:
- confirm project structure
- establish design foundation and base app shell
- prepare shared state for future report workflows

Included work:
- Next.js project review
- app shell and routing foundation
- design system and base layout
- shared report data model
- zero-report default state

Deliverable:
- App foundation ready for feature development

### Sprint 2 — Resident and admin authentication screens
Objective:
- create resident and municipal admin authentication flows

Included work:
- resident register screen
- resident login screen
- admin register screen
- admin login screen
- navigation and layout structure

Deliverable:
- Functional authentication interface screens

### Sprint 3 — Core reporting and map foundation
Objective:
- allow residents to describe and submit municipal issues with exact map pinning

Included work:
- report form fields
- issue categories
- location data model
- South African map foundation
- interactive pin selection
- coordinate storage
- report validation

Deliverable:
- Working report creation flow

### Sprint 4 — Report persistence and issue flow
Objective:
- connect report submission to frontend state and local storage

Included work:
- issue state management
- localStorage persistence
- created report availability across app
- empty states
- issue feed

Deliverable:
- Real report data persists across the frontend experience

### Sprint 5 — Details, dashboards, and report browsing
Objective:
- make issue history visible to residents and admin users

Included work:
- issue details page
- resident dashboard
- issue feed enhancements
- admin dashboard summary cards
- report list and status display

Deliverable:
- Resident and admin reporting interfaces

### Sprint 6 — Admin map and filtering
Objective:
- show all reports on the admin map and allow operational filtering

Included work:
- admin map display of all pins
- category-based markers
- search and filter controls
- map-driven issue visibility
- same-source-of-truth data model

Deliverable:
- Full admin monitoring dashboard

### Sprint 7 — Responsive and accessibility improvements
Objective:
- ensure the app works well across devices and is accessible for real-world use

Included work:
- mobile adaptation
- keyboard-friendly controls
- focus states
- responsive layout refinement
- accessibility checks

Deliverable:
- Usable responsive app

### Sprint 8 — Final frontend review and backend handoff
Objective:
- prepare the frontend for backend integration

Included work:
- code cleanup
- architecture review
- data model readiness
- API replacement planning
- deployment preparation for future backend phase

Deliverable:
- Backend-ready frontend contract

## 12. Project Timeline Summary

### Current timeline
- Phase 1: Completed
- Phase 2: Completed
- Phase 3: Completed
- Phase 4: In progress
- Phase 5: In progress
- Phase 6: Not deployed

### Scope note
The approved scope now includes public-pilot hardening. No live service or production database migration is claimed as complete.

### Suggested next milestone schedule
- Sprint 1: foundation complete
- Sprint 2: auth screens complete
- Sprint 3: report creation and map pinning complete
- Sprint 4: report persistence complete
- Sprint 5: dashboards and issues complete
- Sprint 6: admin map and filters complete
- Sprint 7: responsive design complete
- Sprint 8: backend handoff complete

## 13. Success Criteria

The project is successful when:
- residents can submit issues with a map pin
- resident accounts and reports persist through the server/database
- residents can see only their own private report history
- admin users can view live report data and map locations
- reports are generated from real user actions only
- there are no hardcoded fake reports or demo pins
- database/authentication failures never masquerade as successful local-only persistence
- deployment, privacy, retention, and account recovery requirements are verified before public launch

## 14. Acceptance Statement

This document serves as the project contract for the Municipal Service Issue Reporter. It defines the problem, solution scope, project phases, sprint plan, and required technical boundaries. All future development must align with this contract.

## 15. Project Status Snapshot

Current status:
- Problem defined
- Solution framed
- Frontend design foundation established
- Resident and admin frontend workflows implemented and verified
- Server-side resident/staff auth and owner-scoped report API implemented
- Zero-report starting condition preserved
- Production database migration not verified; production deployment not performed

## 16. Planned Commit Milestones

Examples of meaningful development checkpoints:
- feat: setup municipal reporter frontend
- feat: add resident authentication screens
- feat: add admin authentication screens
- feat: add application navigation
- feat: build report issue form
- feat: add south african map integration
- feat: add report location pinning
- feat: add dynamic report state
- feat: build issue feed
- feat: build issue details
- feat: build resident dashboard
- feat: build admin dashboard map
- feat: add category based map markers
- feat: improve responsive design

## 17. Final Note

This project is a municipal service reporting application being hardened for a controlled public pilot. Resident/staff cookie authentication and database-backed report ownership are implemented and tested with isolated data. The production PostgreSQL migration, email recovery/verification, durable evidence storage, privacy process, credential rotation, and hosted deployment remain launch gates.
