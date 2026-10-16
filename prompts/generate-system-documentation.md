# Generate Verified System Documentation

## Objective

After approval, create or update exactly one user-facing documentation file at the repository root: `SYSTEM_DOCUMENTATION.txt`. This prompt is not permission to create that final file until the user approves execution.

## Source of Truth

Base the documentation on the current checked-in/source files and inspect-time project state. Prefer executable code and configuration over planning notes where they conflict. Relevant sources include:

- Root `package.json`, `render.yaml`, `README.md`, `DEPLOYMENT.md`, `PROJECT_CONTRACT.md`, `DEVELOPER_TRACKER.md`, `AGENTS.md`
- `client/package.json`, `client/next.config.ts`, TypeScript/PostCSS/ESLint configuration, App Router pages, components, contexts, data, types, and client README
- `server/package.json`, `server/index.js`, `server/db.js`, `server/location.js`, `server/sql/schema.sql`, all SQL migrations, tests, and server README
- `server/data/store.json` only for privacy-preserving aggregate counts; never copy or expose account identities, hashes, or report contents

Do not read or reproduce actual `.env` values. Environment variable names may be documented from `.env.example` and source references. Do not invent a deployment, database state, API behavior, or security guarantee.

## Required Contents

Write plain text compatible with Windows Notepad. Include a clear title, a table of contents, consistent separators, numbered headings/subheadings, and all of these 27 sections:

1. System Overview
2. System Purpose and Objectives
3. Scope of the System
4. System Features and Functionalities
5. User Roles and Permissions
6. System Architecture
7. Technologies and Tools Used
8. Project Folder and File Structure
9. Detailed Module Descriptions
10. Frontend Implementation
11. Backend Implementation
12. Database Design and Structure
13. API Endpoints and Their Purposes
14. Authentication and Authorization
15. System Workflows and Data Flow
16. Input Validation and Error Handling
17. Security Features and Considerations
18. Installation and Setup Instructions
19. Environment Variables and Configuration
20. Database Setup and Migration Instructions
21. How to Run the System Locally
22. Testing Procedures
23. Deployment Instructions
24. Known Limitations and Potential Improvements
25. Troubleshooting Guide
26. Maintenance and Future Development
27. Conclusion

Cover actual routes, key files/functions, tables/relationships, data flow, setup commands, environment variable names, test commands, hosting scaffolding, implemented limitations, and improvements clearly labeled as recommendations. Explain what is unavailable or needs confirmation.

## Verified Project Facts and Caveats

- The client is Next.js 16 / React 19 / TypeScript with Tailwind CSS 4 and Leaflet/react-leaflet. Browser `/api/*` requests are proxied by `client/next.config.ts` to `NEXT_PUBLIC_API_BASE_URL` (default local API origin is `http://localhost:4000`).
- The server is Express 5 on Node.js with PostgreSQL (`pg`) and a JSON file fallback for local/test use. Root `npm run dev` concurrently starts API and client. Production startup refuses to run without PostgreSQL.
- Main API implementation is in `server/index.js`; persistence and migrations are in `server/db.js`. Startup applies ordered files in `server/sql/migrations/`; migration 002 is gated by `ENABLE_MUNICIPALITY_SCOPING_MIGRATION=true`. `server/sql/schema.sql` is not the complete current production schema; explain its legacy/base role and that runtime schema evolves through the versioned migrations.
- Authentication uses server-side scrypt password hashing and JWTs in HttpOnly cookies (one-hour token/cookie lifetime); accepted bearer tokens are also supported by the API. Residents own their submitted reports. Public endpoints omit reporter identity and internal staff fields. Staff operations require staff role, assignment, and current municipality verification. Super-admin duties include bootstrap, municipality, staff, and access administration; operational report triage is restricted to municipal staff.
- Report creation requires an authenticated resident, validates title/description/category/coordinates/priority/evidence, resolves municipality server-side using the Municipal Demarcation Board feature layer, and can reverse-geocode via Nominatim. The MDB data item/service year description is inconsistent in source comments/docs (2021 item vs 2018 service); state this requires verification. Map tiles and client-side search use OpenStreetMap/Nominatim.
- The report schema includes `issue_categories`, `issues`, `resident_users`, `staff_users`, `municipalities`, `staff_municipalities`, `audit_logs`, plus `schema_migrations`; issue operational metadata is JSONB and coordinates are numeric latitude/longitude, not PostGIS geometry. Describe actual foreign keys/indexes only after checking migrations.
- There are no default/sample reports or account seeds in the default store definition. However, at inspection on 2026-10-09, `server/data/store.json` contains 2 report records, 2 resident records, 3 staff records, and 213 municipality records. Report these aggregate counts as existing local persisted state; do not call the current local store a zero-report state and do not alter it. Explain that this is distinct from default initialization and must not be mistaken for demo seeding.
- Project docs disagree about completed milestones, migration/deployment validation, and launch readiness. The deployment guide says no service is deployed or verified against the real Neon database; source alone cannot prove external test/deployment activities. Clearly state that deployment is scaffolded but live deployment and production database migration are not verified by the source. Avoid claiming external milestones as facts.
- Evidence accepts JPEG, PNG, or WebP up to 3 MB and is currently stored encoded in the database/file store, not durable object storage. Email verification/recovery is not implemented. Public registration/operational privacy and data retention need appropriate real-world review before unrestricted launch.
- Do not print secret values. Document these configured names if verified in examples/source: `PORT`, `USE_FILE_STORE`, `JWT_SECRET`, `ADMIN_REGISTRATION_KEYS`, `DATABASE_URL`, `DATABASE_SSL`, `CLIENT_ORIGIN`, `SESSION_COOKIE_SAME_SITE`, `SUPER_ADMIN_BOOTSTRAP_TOKEN`, `MDB_MUNICIPALITY_FEATURE_LAYER_URL`, `REVERSE_GEOCODER_URL`, `GEOCODING_USER_AGENT`, `GEOCODING_CONTACT`, `ENABLE_MUNICIPALITY_SCOPING_MIGRATION`, `NEXT_PUBLIC_API_BASE_URL`.
- Current root scripts include `npm run dev`, `npm run build`, `npm run lint`, and server/client-specific scripts. Server tests run via `npm --prefix server test` (or from `server/`, `npm test`); client build/lint use the client package. Do not claim tests/builds pass unless run during the approved documentation task.
- Structure section should summarize repository-owned folders/files and omit dependency/build directories (`node_modules`, `.next`) and generated lock internals. Include all application routes grouped logically.

## Constraints

- Do not modify application source, configuration, database, local JSON store, credentials, existing documentation, or any file other than `SYSTEM_DOCUMENTATION.txt` after approval.
- If `SYSTEM_DOCUMENTATION.txt` exists by execution time, inspect and update it rather than creating a duplicate.
- Do not add secrets or copy unverified content from old documentation. Preserve distinctions between current implementation, current local persisted data, intended product behavior, and future recommendations.
- After writing, perform a focused content/format sanity check and report the final path, covered areas, checks run, and unresolved items.
