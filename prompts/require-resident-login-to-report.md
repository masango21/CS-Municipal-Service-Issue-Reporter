# Implementation Prompt: Require Resident Login to Report

## Goal
Require a signed-in resident before the report form is rendered or a report can be submitted.

## Current Behavior
- `client/app/report/page.tsx` renders the report form for every visitor and creates reports through `ReportsContext`.
- `AuthContext` already provides separate resident/admin users and `isAuthReady` for localStorage session hydration.
- Resident login currently sends every successful login to `/dashboard`.

## Scope
- Gate `/report` until auth restoration completes; do not render the form while access is unresolved.
- Allow only authenticated residents to access the form.
- Redirect logged-out visitors to `/login?next=/report` and redirect authenticated staff to `/admin/dashboard`.
- After resident login from this report redirect, return to `/report`; keep `/dashboard` as the normal destination for other resident logins.
- Validate the return destination as the fixed internal path `/report`; do not allow arbitrary redirect URLs.
- Keep report data, persistence, and the shared resident/admin report source of truth unchanged.
- Do not add backend services, middleware, or dependencies.

## Acceptance Criteria
- A fresh logged-out visitor opening `/report` never sees the form or can submit a report.
- The visitor is sent to resident login, then returns to `/report` after successful resident authentication.
- An authenticated resident can still submit an issue normally.
- An authenticated staff user opening `/report` is routed to `/admin/dashboard` and cannot submit a resident report.
- Valid persisted resident sessions are restored before the form appears; no false login redirect occurs during hydration.
- The client production build succeeds with `npm run build`.

## Verification
Test direct `/report` navigation with no session, a resident session, and a staff session. Confirm no report is added while logged out, then complete a resident login and submit a real report. Run the client production build.