# Fix AI Assistant Authentication Through the Main API

## Goal

Make the existing resident session work with the AI Assistant without weakening
authentication, changing report data, or connecting to an unverified database.
The intended final architecture uses the main API on port 4000 for the assistant
routes and calls Ollama server-side at `127.0.0.1:11434`. Port 4001 must not be
removed or bypassed until the main API and browser flow are verified.

## Diagnosis established from source and live checks

- `client/components/AIAssistant.tsx` requests same-origin `/api/assistant/*`
  with `credentials: "include"`.
- `client/next.config.ts` rewrites assistant routes to port 4001 and other API
  calls to port 4000.
- `server/index.js` already declares assistant routes guarded by `requireResident`.
- `requireRole('resident')` verifies the session token, then looks the resident
  up in that server's selected data source.
- The running port-4001 process uses an isolated temporary JSON file store. It
  cannot find an account that exists only in the main database, so the resident
  receives the generic `Authentication is required` error.
- The running port-4000 process serves the main application and five reports,
  but its current runtime returns 404 for `/api/assistant/conversations`. Its
  process predates the current source.
- Ollama is running and `llama3.2:3b` is installed.
- `server/db.js` runs database initialization at application startup. It creates
  the migration tracking table, checks/applies eligible migrations, and inserts
  default categories. `server/index.js` routes use assistant database tables
  when the database pool is enabled. Migration 004 is not enabled/applied.
- The configured database has not been established as disposable or
  non-production. Do not restart port 4000, connect to it, inspect private
  records, or run migrations.

## Required behavior

1. Preserve resident authentication, HttpOnly session cookies, assistant
   conversation ownership, message validation, rate limiting, and report-owner
   checks. Do not introduce a token bypass, trust client-supplied user IDs, or
   make resident endpoints public.
2. Reuse the existing assistant routes and `server/ai-assistant.js`; do not add
   a second Express server or duplicate the assistant routes.
3. Preserve `{ content, reportReference? }`, assistant response shapes,
   conversation history, and Ollama server-side-only use.
4. Keep all existing report data, queries, report API contracts, map/list/
   filter behavior, and unrelated worktree changes intact.
5. Keep `client/next.config.ts` routing `/api/assistant/*` to port 4001 until
   the current port-4000 process is confirmed to serve the assistant and the
   authenticated flow passes. Do not switch the frontend based only on source
   inspection, unit tests, or a port-4002 test.
6. Do not apply Migration 004 or any other migration to the configured database.
   Do not copy production data, report records, user credentials, or database
   credentials into a test environment.

## Safe implementation and verification procedure

1. Re-check Git status and preserve all existing changes.
2. If source changes are needed, make only changes required for the single API
   architecture. The current source may already contain the assistant routes;
   do not rewrite them just to match the goal.
3. Test the current source only in an isolated file-store instance on an unused
   port (such as 4002), with a newly created temporary store, `USE_FILE_STORE=true`,
   `DATABASE_URL` removed from that test process, and the already verified
   `OLLAMA_BASE_URL` / `OLLAMA_MODEL`. Do not use or overwrite
   `server/data/store.json` or the temporary store used by port 4001.
4. In that isolated instance, verify resident signup/login, authenticated
   assistant access, genuine Ollama inference, unauthenticated HTTP 401,
   cross-resident conversation denial, and rejection of a report reference not
   owned by the authenticated resident. Explain that the empty isolated store
   cannot validate existing report data.
5. Do not restart port 4000 or change frontend routing until the user provides
   an explicitly verified non-production/disposable backend configuration and
   approves using it. Even then, do not enable or apply Migration 004 without
   separate explicit approval.
6. If migration 004 remains unavailable, stop before switching traffic if the
   database-backed assistant conversation storage cannot operate without it.
   Do not replace persistent conversations with an unapproved in-memory or
   ephemeral production store.
7. Run server tests, client lint, client production build, and `git diff --check`.
   Recheck the main report API and frontend, and confirm the original 4000 and
   4001 services remain running if no safe cutover was approved.

## Completion/reporting

Report the diagnosis, files changed, tests actually run, whether the response
came from real Ollama, and which live flows remain unverified. Distinguish safe
source-level/file-store testing from the live database-backed port-4000 browser
flow. If safe database identity or migration authorization is unavailable,
leave the frontend on port 4001 and explain the exact prerequisite for cutover.
