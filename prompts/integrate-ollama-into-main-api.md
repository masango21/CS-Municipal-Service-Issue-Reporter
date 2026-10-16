# Integrate Ollama Assistant with the Main API

## Objective

Make the existing backend on port 4000 the only application API used by the
frontend for municipal routes and authenticated AI-assistant routes. The backend
must continue calling the installed local Ollama service server-side. Port 4001
must not be required for normal app use.

## Current findings

- `server/index.js` already declares the authenticated assistant conversation and
  message routes and delegates model generation to `server/ai-assistant.js`.
- At inspection time, the running API on port 4000 returned HTTP 404 for
  `/api/assistant/conversations`; the API on port 4001 returned HTTP 401 for the
  same unauthenticated request. The port-4000 listener is a Node `index.js`
  process, so verify its launch context and reload the existing main API from the
  repository's current source as part of the approved change.
- Port 4000 returned five reports through its existing API. The ignored
  `server/.env` indicates `USE_FILE_STORE=false` and a `DATABASE_URL` is
  configured; the actual value was not printed or independently tested.
  Preserve the current database configuration and report records.
- Ollama is responding on `127.0.0.1:11434`, and its installed model list
  includes `llama3.2:3b`.
- The example environment documents `OLLAMA_BASE_URL` and `OLLAMA_MODEL`. Do
  not print environment values; ensure the main server has these settings
  available without editing or exposing secrets.
- The client currently rewrites `/api/assistant/*` to port 4001 and other
  `/api/*` paths to port 4000.
- Migration 004 is unset in the local environment (therefore not enabled) and
  must remain unapplied. Do not restart the current backend or connect to its
  configured database until its owner confirms it is non-production and safe.

## Scope

1. Inspect current status and preserve every pre-existing working-tree change.
   Confirm the main server's startup context and existing data source without
   dumping secret or private data.
2. Do not restart the current main API until the configured database is
   confirmed non-production and safe for testing. After confirmation, load the
   current `server/index.js` on port 4000 without changing its configured report
   source. Do not create a second Express server or copy route logic.
3. Ensure server-side Ollama configuration is available to the main API using
   the already established `OLLAMA_BASE_URL` and `OLLAMA_MODEL` names. Retain
   safe failure behavior when Ollama is unavailable or misconfigured. Never
   expose provider settings as public frontend variables.
4. Update `client/next.config.ts` so assistant and all other API routes resolve
   to the main API on port 4000. Remove the assistant-specific port-4001 rewrite
   and any obsolete public assistant-origin setting.
5. Update only directly related setup documentation to describe the single API
   on port 4000, local Ollama on port 11434, and how to verify the authenticated
   assistant. Remove instructions that require port 4001 for normal use.
6. Do not stop or delete the currently running port-4001 process until the
   integrated port-4000 endpoint and frontend flow are verified. Afterward,
   leave unrelated processes alone; report whether 4001 remains active rather
   than terminating it without a clear safe basis.

## Security and data constraints

- Preserve resident authentication, per-resident conversation ownership,
  request validation, rate limiting, and the `reportReference` ownership check.
- Preserve report data, report API contracts, and the main API's current local
  data store. Do not seed or fabricate data.
- Do not add database migrations, enable Migration 004, or connect to a
  production database.
- Do not put Ollama configuration, credentials, cookies, or conversation content
  in browser-visible configuration, logs, or responses.
- Do not modify unrelated dirty files or revert any existing work.

## Verification

- Run `npm --prefix server test`, client lint, client production build, and
  `git diff --check`.
- Confirm port 4000 health and that it continues returning the same real reports.
- Confirm unauthenticated assistant requests to port 4000 return HTTP 401.
- With an authorized resident session, send a harmless assistant message through
  the frontend/API on port 4000 and verify a genuine response from the installed
  Ollama model (not a mock or canned reply).
- Confirm a different resident cannot access that conversation and an
  unauthorized `reportReference` is rejected.
- Confirm Ollama failure handling remains safe and does not crash the main API.
- Confirm the frontend sends no assistant traffic to port 4001 and that the
  existing map, report list, and filters still use port 4000.
- Confirm Migration 004 remains disabled/unapplied and port 4000's configured
  report source was preserved.
- Inspect the final diff for unrelated edits and secret exposure.
