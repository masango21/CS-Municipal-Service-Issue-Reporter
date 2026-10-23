# Implementation Prompt: Configure Ollama Cloud for the Existing AI Assistant

## Objective

Update the existing resident AI assistant provider to use Ollama Cloud from the server,
without creating a second backend or changing the chat UI, authentication, API routing, or
database. Make the cloud API key and account-supported model configurable only through
server-side environment variables. Do not deploy, access or modify a production database, or
apply or enable migration 004 (`004_ai_assistant.sql`).

## Findings from repository inspection

- `server/ai-assistant.js` already calls `/api/chat`, requests non-streaming JSON, has a
  90-second timeout, and accepts `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, and `OLLAMA_API_KEY`.
  Local development defaults to `http://127.0.0.1:11434` and `llama3.2:3b`. In production,
  the base URL has no default and must be set to HTTPS; if missing, the provider raises
  `not_configured`. The model currently falls back to the local `llama3.2:3b` tag even in
  production, which does not establish that the model is available through Ollama Cloud.
- The reported text, “The AI assistant model is not configured yet.”, does not occur in the
  current source. The only matching provider message in this checkout says the assistant
  service is not configured. Do not claim the deployed message's exact cause is proven from
  this workspace or access Render to diagnose it.
- `render.yaml` declares `OLLAMA_BASE_URL` as an operator-supplied setting, but currently
  sets `OLLAMA_MODEL=llama3.2:3b`; this is not evidence the tag is available to the user's
  Ollama Cloud account. Existing Render settings are not inspectable here.
- `client/next.config.ts` routes `/api/assistant/*` and other `/api/*` requests to the same
  configured API origin. Keep these rewrites, the existing Vercel-to-Render arrangement,
  and origin/CORS validation unchanged.
- `server/index.js` owns the existing resident-authenticated assistant endpoints, rate
  limiting, ownership checks, and message validation. Assistant history in PostgreSQL
  depends on migration 004; do not edit, enable, verify against, or apply it.
- The assistant provider tests are in `server/test/ai-assistant.test.js`; API and
  authentication/origin coverage is in `server/test/api.test.js`.
- The tagged `server/.env` is private and must not be opened, printed, or modified. The
  tracked worktree already has a modification to `server/data/store.json`; preserve it
  exactly and do not inspect or use it in tests.
- The official documentation confirms direct Cloud chat at `https://ollama.com/api/chat`,
  `Authorization: Bearer <API key>`, `stream: false`, and the answer at `message.content`.
  The Cloud guide says to use the exact model name returned by its model list and gives
  `gemma4:31b` only as an example. This workspace has no access to the user's Cloud account,
  so do not select or claim an account-available model. Require the operator to configure
  the exact model name available to their account. Do not request or print an API key.

## Implementation scope

1. Reuse `server/ai-assistant.js`; keep the existing `/api/chat` request contract, bounded
   history/context, `stream: false`, response-size checks, safe text-only output, and
   timeout. Use Ollama Cloud's documented chat endpoint with
   `Authorization: Bearer <OLLAMA_API_KEY>`. Never send the key or provider URL to the
   frontend or log secrets, headers, request bodies, or resident information.
2. Keep the local Ollama defaults for non-production development. In production, require an
   explicit nonblank `OLLAMA_MODEL` and `OLLAMA_API_KEY`; never silently substitute
   `llama3.2:3b` or another model. Use `OLLAMA_BASE_URL` when configured and default it to
   `https://ollama.com`, which is compatible with the official Cloud `/api/chat` endpoint.
   Validate the URL as HTTPS without embedded credentials or loopback hosts in production.
3. Return distinct, safe provider errors for missing key/model/configuration, invalid
   credentials (401/403), unavailable model (404), rate limiting (429), upstream server
   errors, network failures, and timeouts. Do not expose raw provider error content. Preserve
   any existing safe errors for malformed, empty, or oversized responses.
4. Add/update mocked-fetch tests in `server/test/ai-assistant.test.js` for missing key,
   missing model, successful Cloud request and exact Bearer header/request body, 401/403,
   unavailable model, 429, upstream 5xx, network error, timeout, malformed/empty response,
   and absence of credentials from the request body or user-facing errors.
5. Preserve and run relevant `server/test/api.test.js` coverage for resident authentication,
   authorization/ownership, same-origin checks, and request limits. Add tests only if the
   existing suite does not establish these behaviors. Do not change `/api/reports`, port
   4000, API route rewrites, CORS allowlists, or frontend origins unless a failing focused
   test demonstrates a necessary defect; any such change must be minimal and justified.
6. Update `server/.env.example` with placeholder-only cloud configuration while retaining
   local development configuration where useful. Update `render.yaml` so production does not
   silently configure the local model as a Cloud model; require the operator to set the
   model identifier and key in Render. Document the variables and secure Render dashboard
   setup in `DEPLOYMENT.md` and `server/README.md`. State that the account owner must choose
   a model shown as available to their Ollama Cloud account, and that `.env.example` does
   not configure Render. Do not add any real secrets.
7. Leave `client/next.config.ts`, Vercel environment variables, resident/staff auth, same-
   origin/CORS requirements, report data access, schemas, migrations, and production
   settings unchanged. Explain that assistant persistence remains unavailable if migration
   004 is pending or disabled; do not work around that restriction.

## Verification

- Run `npm --prefix server test`, `npm run lint`, `npm run build`, and `git diff --check`
  when safe. Do not start, stop, or restart the already-running port-4000 API as part of
  validation.
- All provider tests must mock external calls; no real key or cloud request is required.
- Verify assistant endpoints still enforce resident authentication and same-origin rules,
  and the municipal reports routes/proxy remain unchanged.
- Do not apply migrations, access production services/databases, deploy, or claim a live
  Ollama Cloud response was tested.
- Inspect the final diff for unrelated changes and secrets. Preserve the pre-existing
  `server/data/store.json` modification.

## Final report

Report what the checked-out code establishes about the original error and what remains
unverifiable without Render access. List modified files, exact Render variables, whether
any Vercel setting is needed, test commands/results, remaining migration/account-model
blockers, and the operator's secure manual setup steps. Explicitly state that there was no
deployment, production database access, migration 004 application, or live Cloud test.
