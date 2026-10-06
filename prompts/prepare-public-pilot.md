# Prepare Municipal Service Issue Reporter for a Public Pilot

## Goal
Move the current local prototype toward a safe, deployable pilot for real residents and municipal staff. Preserve the zero-report/zero-pin default. Do not claim a public launch until external hosting, privacy, and credential prerequisites are satisfied.

## Confirmed gaps
- Resident registration/login currently stores plaintext passwords and resident accounts in browser localStorage, although server resident auth endpoints already exist.
- Server resident auth and staff accounts use the JSON file store; the PostgreSQL schema currently covers issues/categories only.
- The client silently falls back to local report state when the API is unavailable, so residents may believe a report was saved when it is not shared.
- The report reset/delete-all path must be verified and restricted to authenticated staff; no anonymous caller may delete reports.
- No Render, Vercel, or container deployment configuration is present.
- The actual Neon database has not been verified in this work and must not be modified without a backup and explicit approval.

## Implementation scope
1. Replace resident localStorage account/password handling with the server auth API. Persist resident/admin accounts in PostgreSQL with normalized unique emails and salted password hashes. Do not store passwords in browser storage.
2. Use secure production sessions (HttpOnly, Secure, SameSite cookies with CSRF protection, or document and justify an equivalent secure design). Preserve role checks and prevent resident tokens from authorizing staff operations.
3. Add database migrations for resident/staff identity and report ownership. Require resident authentication to submit reports; associate each report with its authenticated owner. Keep any public issue feed limited to approved public fields, and return only a resident's own reports in their private dashboard.
4. Make PostgreSQL the required production store. Keep file-store mode for isolated tests/local development only. Production must fail clearly rather than silently switch to process-local or browser-local persistence.
5. Remove silent local fallback for production report reads/submission. Display an actionable service-unavailable state and never imply an unsynced report was saved.
6. Protect delete/reset operations behind staff authorization and remove any unauthenticated destructive API path. Add rate limits and baseline HTTP security headers, validation, request-size limits, and explicit production CORS configuration.
7. Keep evidence uploads safe with verified type/size limits and a documented durable production storage strategy. Do not put storage credentials in source control.
8. Add deployment configuration and exact setup instructions for the intended stack (Vercel client, Render API, Neon PostgreSQL). Use environment-variable names/placeholders only in tracked files.
9. Update `AGENTS.md`, `PROJECT_CONTRACT.md`, `DEVELOPER_TRACKER.md`, and setup docs only to the newly approved public-pilot scope and evidence actually completed.

## Safety constraints
- Do not seed reports, pins, residents, or staff accounts.
- Do not read, print, commit, or send `.env` values.
- The database URL, JWT signing secret, and invite keys were shared in chat: treat them as compromised and require rotation before a public deployment. Never reuse or print their old values.
- Do not connect to or migrate the current Neon database during implementation. First use an isolated disposable database/test store; production migration requires a backup and separate user approval.
- Do not create real resident/staff accounts or real reports for testing.
- Do not deploy or publish the service without user-approved hosting access, domain/URL, privacy/contact details, and rotated production secrets. Never request secrets through chat.

## Verification gates
- Client build and API tests pass; database tests use an isolated disposable database/store.
- Tests prove resident passwords are hashed, duplicate email registration is rejected, residents can only access their own private reports, staff-only routes reject residents/anonymous requests, and public responses omit private data.
- An anonymous request cannot delete/reset reports.
- API outage cannot create a false local-only success state.
- Fresh installation starts with zero reports and zero pins.
- Browser smoke tests cover resident registration/login/report submission and staff login/triage using temporary isolated data, then remove all test data.
- Deployment is considered prepared only after provider configuration is documented; it is not marked live until the approved external deployment is actually verified.
