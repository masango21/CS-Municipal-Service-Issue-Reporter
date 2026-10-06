# Implementation Prompt: Protect Resident and Admin Dashboards

## Goal
Prevent logged-out users from seeing resident or municipal staff dashboard content, and keep each dashboard restricted to its own authenticated role.

## Current Behavior
- `client/app/dashboard/page.tsx` renders resident dashboard content without checking authentication.
- `client/app/admin/dashboard/page.tsx` renders staff dashboard content without checking authentication.
- `AuthContext` restores separate resident/admin sessions from localStorage in a client effect, so both users are initially `null` before restoration completes.

## Scope
- Add an explicit auth-hydration readiness signal to `AuthContext`.
- On `/dashboard`, render no dashboard data while auth is being restored; redirect unauthenticated users to `/login`; redirect authenticated staff to `/admin/dashboard`.
- On `/admin/dashboard`, render no staff dashboard data while auth is being restored; redirect unauthenticated users to `/admin/login`; redirect authenticated residents to `/dashboard`.
- Preserve the existing role-specific navbar and session behavior.
- Keep the current localStorage-based auth approach; do not add middleware, a backend, or new dependencies.
- Do not change public issue pages or the reports source of truth.

## Acceptance Criteria
- A fresh logged-out browser cannot see resident or admin dashboard contents, including summary counts, maps, and reports.
- Direct navigation to `/dashboard` while logged out redirects to `/login`.
- Direct navigation to `/admin/dashboard` while logged out redirects to `/admin/login`.
- A resident opening the admin dashboard is redirected to the resident dashboard, and staff opening the resident dashboard is redirected to the staff dashboard.
- A valid persisted session is restored before protected dashboard content renders; valid users do not get incorrectly redirected during hydration.
- Existing role-specific sign-in flows and dashboard functionality continue to work.
- `npm run build` succeeds from `client/`.

## Verification
Test direct URLs in a fresh logged-out browser, then test resident and admin sessions separately, including page refreshes on each dashboard. Confirm the dashboard content never flashes before redirects and run the client production build.