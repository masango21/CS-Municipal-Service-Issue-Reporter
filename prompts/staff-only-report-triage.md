# Implementation Prompt: Staff-Only Report Operations

## Goal
Ensure municipal staff, not super admins, carry out report operations: triage and assignment, internal notes, and resident-facing status updates. Keep super-admin responsibilities focused on municipality and staff administration. Make this change incrementally without redesigning unrelated workflows.

## Verified Current Behavior
- The client has distinct `staff` and `super_admin` roles in `AuthContext`.
- `/admin/dashboard` redirects super admins to `/admin/municipalities`, but `/admin/reports/:id` accepts any `adminUser`, including super admins, and renders editable operational controls.
- In `server/index.js`, `requireStaff` permits both `staff` and `super_admin`; `requireAdmin` aliases it. `hasVerifiedMunicipalityAccess`, `requireActiveMunicipality`, and `findAuthorizedReport` all bypass municipality verification for super admins.
- Triage (`PATCH /api/reports/:id/triage`), staff notes (`POST /api/reports/:id/notes`), resident updates (`POST /api/reports/:id/updates`), and operational report reads are protected by the shared middleware, so super admins can currently perform them.
- Existing staff API tests verify staff operations and municipality boundaries. Preserve staff behavior and the shared report source of truth.

Re-check these facts before editing; files may have changed.

## Required Changes
- Limit report operations to authenticated `staff` accounts with current, verified access to the report's municipality. A super-admin session must not gain operational permission by bypassing municipality verification.
- Apply server-side authorization to operational report reads and mutations, including staff report detail, triage, notes, and resident updates. Keep unauthorized reports protected against ID guessing and preserve current 401/403/404 conventions.
- Keep super-admin municipality and staff administration routes functional. Do not remove super-admin access to unrelated municipality configuration or staff-management features. Preserve any intentionally read-only municipality overview only if it does not expose private operational data or enable mutations.
- On `/admin/reports/:id`, allow only a `staff` user to remain on the operational page. Redirect super admins to `/admin/municipalities`; retain current resident/logged-out redirects as appropriate. The UI guard supplements, but never replaces, server authorization.
- Keep staff municipality scoping and assignment validation intact. A staff member must still have assignment plus valid municipality verification before operating on a report.
- Do not change authentication/session storage, report schema, report ownership, or dashboard statistics unless necessary for this authorization change. Do not add demo reports, users, or pins.

## Tests and Acceptance
- Add focused API tests showing that a super-admin token is denied for operational detail reads and for each mutation: triage, staff note, resident update. Confirm no state changes occur after denied requests.
- Keep tests proving a valid municipality-verified staff member can perform the existing operations and staff outside the report's municipality cannot.
- Add or update client-level tests if the repository has an established route/component test setup; otherwise verify the role redirect behavior with the available client checks and report the gap.
- Confirm super-admin municipality/staff administration continues to work and has not accidentally been blocked by changing shared authorization helpers.
- Run `npm test` from `server/`, plus `npm run lint` and `npm run build` from `client/`. Report exact results and any unavailable checks.

## Constraints
- Follow the repository `AGENTS.md` workflow and applicable client instructions. Before editing Next.js code, read the relevant installed Next.js documentation under `client/node_modules/next/dist/docs/`.
- Make the smallest coherent authorization change. Keep the existing API contract for authorized staff and do not make unrelated cleanup.
- Do not deploy or connect to/change the production database. Do not print or commit `.env` values.
