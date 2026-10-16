# Bridge Assistant Authentication to the Main API

## Objective

Fix the resident AI Assistant's `Authentication is required` error without
restarting the database-backed port-4000 API or weakening its authentication.
For this interim fix, keep the frontend assistant rewrite and isolated assistant
service on port 4001. Port 4000 remains the source of truth for resident
sessions, accounts, reports, and report ownership.

This is an interim bridge, not the preferred final single-backend architecture.
Do not remove port 4001 or switch frontend routes as part of this work.

## Diagnosis

- The client requests `/api/assistant/*` with `credentials: "include"`.
- The Next.js rewrite sends those requests to port 4001.
- Port 4001 verifies a resident token, then looks the resident up in its
  temporary JSON store. A main-API resident is not present in that isolated
  store, causing `Authentication is required`.
- The port-4000 API currently returns 404 for assistant routes, and is
  database-backed. Do not restart it or connect to its database.
- The current source has authenticated assistant routes and a server-side
  Ollama integration. Ollama/model availability were verified separately.

## Required changes

1. In the isolated assistant API, add assistant-only authentication that
   forwards the incoming `msr_session` cookie to the main API's existing
   `/api/auth/session` endpoint. Require HTTP 200 and a verified resident user
   with an ID. Do not trust request body user IDs, browser localStorage, or
   decoded JWT claims from the assistant service alone.
2. Use a server-only configurable main API origin, defaulting to the existing
   local API origin only if consistent with repository config. Never expose it
   through `NEXT_PUBLIC_*`. Use a bounded timeout and fail safely: no cookie,
   invalid session, non-resident session -> HTTP 401; main API unavailable or
   malformed response -> safe HTTP 503. Do not log cookies, tokens, provider
   details, or conversation contents.
3. Apply this middleware only to the assistant conversation routes; do not
   weaken or alter the main API's authentication middleware.
4. Keep conversation ownership keyed by the verified resident ID returned by
   the main API. Preserve request validation, rate limits, response shapes, and
   bounded conversation history.
5. For `reportReference`, fetch only `/api/my/reports` from the main API with
   the same forwarded cookie; locate the reference only in the authenticated
   resident's report list. Send only the existing minimal verified report
   summary to Ollama. Fail closed if authorization or lookup cannot be
   verified. Never trust report data from the client or the isolated store.
6. Preserve current frontend routes and chat UI. Keep Ollama requests
   server-side and preserve the existing `{ content, reportReference? }`
   contract.
7. Add tests with a mocked main API verifier for no cookie, invalid/non-resident
   session, upstream timeout/failure, valid resident, cross-resident
   conversation denial, and report ownership. Mocks are tests only.
8. Update environment examples/docs with the new server-only main API origin
   setting if introduced; do not edit `server/.env` or print its values.

## Safety and verification

- Preserve all existing dirty working-tree files and report data.
- Do not restart or terminate port 4000, connect to its database, apply any
  migration, or switch the frontend to port 4000.
- Keep the isolated assistant file-store path unchanged when restarting or
  testing port 4001. Do not delete its data.
- Test current source in a newly isolated temporary store and alternate port
  first; configure its main API origin to a safe file-store test backend on a
  separate port, never the configured database service.
- Verify a genuine Ollama answer, unauthenticated rejection, session expiry,
  per-resident conversation privacy, owner-scoped report lookup, and safe
  upstream failure responses.
- Run `npm --prefix server test`, client lint, client build, and `git diff
  --check`.
- Leave the live port-4000/4001 services untouched unless port 4001 has been
  explicitly approved for controlled restart while preserving its current
  store. Clearly distinguish isolated test results from the browser's live
  database-backed session.

## Completion

Report the diagnosis, changes, test results, whether genuine Ollama inference
was verified, and the remaining limitation: port 4001 is still required until
a safe single-backend cutover is approved and verified.
