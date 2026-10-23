# Municipal Service API

## Start

Install dependencies and start the API from this directory:

```powershell
npm ci
Copy-Item .env.example .env
npm start
```

The default API address is `http://localhost:4000`.

## Configuration

Set these values in ignored `.env` for local development or in the hosting provider's secret manager:

- `JWT_SECRET`: high-entropy signing secret. Rotate before public launch.
- `ADMIN_REGISTRATION_KEYS`: comma-separated staff invite keys. Rotate before public launch.
- `DATABASE_URL`: PostgreSQL connection string. Required in production; optional only for local file-store development.
- `DATABASE_SSL`: defaults to certificate-verified TLS. Set `false` only for a trusted local PostgreSQL instance.
- `CLIENT_ORIGIN`: one or more exact frontend origins, comma-separated and including the scheme (for example `https://reports.example.gov.za,https://preview.example.gov.za`). Do not include paths or credentials. Production requires at least one HTTPS origin; cookie-authenticated writes reject missing and untrusted `Origin` headers.
- `SESSION_COOKIE_SAME_SITE`: defaults to `lax`; use frontend/API custom domains under the same registrable domain.
- `SUPER_ADMIN_BOOTSTRAP_TOKEN`: one-time high-entropy secret for first super-admin setup. Remove it from the server environment after bootstrap.
- `OLLAMA_BASE_URL`: Ollama API base URL. Local development defaults to `http://127.0.0.1:11434`; production defaults to `https://ollama.com` and can override it with another HTTPS-compatible service.
- `OLLAMA_MODEL`: model identifier used by the assistant. Local development defaults to `llama3.2:3b`; production must explicitly set a model identifier available to the configured Ollama Cloud account.
- `OLLAMA_API_KEY`: required in production for Ollama Cloud; sent only as a server-side Bearer credential. Configure it in Render's protected environment settings, never in Vercel or a `NEXT_PUBLIC_*` variable.
- `MAIN_API_BASE_URL`: server-only origin used by the assistant routes to verify resident sessions and fetch owner-scoped reports from this API. Local development defaults to `http://127.0.0.1:4000`; production must explicitly configure the API's HTTPS origin.
- `MDB_MUNICIPALITY_FEATURE_LAYER_URL`: optional override for the authoritative Municipal Demarcation Board polygon layer. The current public item is titled MDB Local Municipalities 2021 but its linked FeatureServer describes a 2018 layer; verify the current demarcation release before a public pilot.
- `REVERSE_GEOCODER_URL`: optional server-side reverse-geocoding endpoint; defaults to OpenStreetMap Nominatim. Configure an alternative endpoint for sustained/public service.
- `GEOCODING_USER_AGENT` and `GEOCODING_CONTACT`: identifying User-Agent and operational contact for the selected geocoder.
- `ENABLE_MUNICIPALITY_SCOPING_MIGRATION`: set to `true` only after migration 002 has been verified on a disposable PostgreSQL database and production changes separately approved. The API refuses database-backed startup while migration 002 is pending and this flag is unset.
- `ENABLE_SUPPORT_CHAT_MIGRATION`: legacy opt-in for migration 003 only. The retired resident-to-staff chat is no longer available; an un-applied legacy migration is skipped unless this flag is explicitly enabled.
- `ENABLE_AI_ASSISTANT_MIGRATION`: keep `false` until migration 004 has been verified on a disposable PostgreSQL database and production changes separately approved. If it is pending while disabled, the API starts normally but authenticated assistant routes return HTTP 503; do not enable it just to make the API start.

Never commit environment files. Production refuses to start without PostgreSQL. Versioned migrations under `sql/migrations/` are applied transactionally at startup. Migration 002 still requires explicit opt-in after disposable-database validation; pending migration 004 alone is deferred with assistant persistence unavailable until it is separately approved and enabled. Resident and staff passwords are stored as salted scrypt hashes. Browser sessions use HttpOnly cookies; authentication endpoints are rate-limited.

Residents must sign in to submit reports. `/api/my/reports` returns only the signed-in resident's reports. Public responses omit reporter identity and staff-only notes/assignment fields. Destructive operations require staff authorization, and cookie-authenticated writes require an allowed `Origin`.

The resident AI Assistant uses `/api/assistant/conversations` and `/api/assistant/conversations/:id/messages` on the same API as the rest of the application. Conversations are private to the authenticated resident and stored in separate AI-assistant tables (migration 004) or the isolated local assistant file store. Resident sessions and report ownership are checked against the configured main API by forwarding only the existing HttpOnly session cookie to `/api/auth/session` and `/api/my/reports`. The assistant sends bounded conversation context to Ollama's `/api/chat` endpoint and includes only a minimal verified report summary. Legacy support-chat tables and records are not reused or sent to Ollama. Provider failures are returned safely; there are no canned fallback responses. The model URL, bearer credential, and model name are server-only settings.

### Local AI Assistant (Windows)

Install Ollama from [ollama.com/download/windows](https://ollama.com/download/windows), then start the Ollama application. In PowerShell, download and confirm the small instruction-tuned model:

```powershell
ollama pull llama3.2:3b
ollama list
Invoke-RestMethod http://127.0.0.1:11434/api/tags
```

`.env.example` files are templates and are not automatically loaded by dotenv. Copy `server/.env.example` to the ignored `server/.env`; its Ollama URL and `llama3.2:3b` model are local-development defaults. Production does not fall back to that model: it requires an explicit `OLLAMA_MODEL` and `OLLAMA_API_KEY`.

For the normal local setup, use the main API on port 4000 and the client on port 3000. Configure `USE_FILE_STORE=true`, a development-only `JWT_SECRET`, and `ADMIN_REGISTRATION_KEYS` in the ignored `server/.env`. Set `API_BASE_URL=http://localhost:4000` in `client/.env.local` or use the example file. Start both services from the repository root:

```powershell
npm run dev
```

The chat widget sends requests through the same-origin Next.js `/api/assistant/*` proxy as other API requests. No port-4001 assistant service is required. Sign in as a resident at `http://localhost:3000`, open AI Assistant, and ask a municipal-help question. Confirm model availability with `ollama list` or `/api/tags`. If the model is not installed, run `ollama pull llama3.2:3b`. If Ollama is unreachable, start the Ollama application and confirm `/api/tags` responds. The UI shows a safe error and Retry action when the service is unavailable. Do not expose model URLs or provider credentials as `NEXT_PUBLIC_*` variables.

### Ollama Cloud in production

The production API calls the documented `https://ollama.com/api/chat` endpoint over HTTPS
with `Authorization: Bearer <OLLAMA_API_KEY>`, `stream: false`, and reads the answer from
`message.content`. Ollama Cloud does not require a local Ollama installation. Configure
these values on the Render API service:

- `OLLAMA_BASE_URL`: normally `https://ollama.com`; the backend appends `/api/chat`.
- `OLLAMA_MODEL`: the exact model `name` available to your Ollama Cloud account. Check the
  [Cloud model catalog](https://ollama.com/search?c=cloud) or the documented model-list API
  at <https://ollama.com/api/tags>. The documentation's example model does not guarantee
  account availability. Production has no fallback to the local `llama3.2:3b` tag.
- `OLLAMA_API_KEY`: create a key at <https://ollama.com/settings/keys> and enter it only in
  Render's protected environment settings. Never put it in Vercel, browser code, source
  control, or a `NEXT_PUBLIC_*` variable.

The Render Blueprint runs the Express API only; it does not install Ollama or choose a model
for your Cloud account. `.env.example` is a local template and does not configure Render.
For an existing Render service, set these values in its environment and redeploy only when
you choose to do so. PostgreSQL-backed assistant history still requires separately approved
verification and application of migration 004; this task does not enable or apply it.

### Isolated local assistant API validation

When the configured `DATABASE_URL` has not been confirmed as non-production and disposable, do not restart an existing API process or connect to that database. To test the API source against a fresh temporary file store instead, use an unused port and set every relevant value for the isolated process:

```powershell
$env:NODE_ENV = "development"
$env:USE_FILE_STORE = "true"
$env:DATA_STORE_PATH = Join-Path $env:TEMP ("msr-ai-test-" + [guid]::NewGuid().ToString("N") + "\store.json")
$env:PORT = "4002"
$env:JWT_SECRET = "local-isolated-test-secret-change-me"
$env:CLIENT_ORIGIN = "http://localhost:3001"
$env:OLLAMA_BASE_URL = "http://127.0.0.1:11434"
$env:OLLAMA_MODEL = "llama3.2:3b"
$env:OLLAMA_API_KEY = ""
$env:MAIN_API_BASE_URL = "http://127.0.0.1:4002"
$env:ENABLE_AI_ASSISTANT_MIGRATION = "false"
$env:ENABLE_MUNICIPALITY_SCOPING_MIGRATION = "false"
$env:ENABLE_SUPPORT_CHAT_MIGRATION = "false"
npm --prefix server start
```

This server uses only its temporary file store and does not replace or restart the existing API. Verify its health and unauthenticated assistant rejection:

```powershell
Invoke-RestMethod http://localhost:4002/api/health
Invoke-WebRequest http://localhost:4002/api/assistant/conversations -UseBasicParsing
```

The health request should succeed; the unauthenticated conversation request should return HTTP 401. This does not test production data or apply migrations. To test the UI against this isolated service, start Next.js in a separate terminal on an unused port with `$env:API_BASE_URL = "http://127.0.0.1:4002"` and `npm --prefix client run dev -- --port 3001`; do not configure a production API URL in local testing.

Report municipality IDs are resolved server-side with a point-in-polygon query against the MDB feature layer; browser-supplied municipality values are not trusted. Street address lookup is server-side and cached; address lookup failure does not change boundary determination, while boundary lookup failure blocks submission. Attribute the boundary source to the Municipal Demarcation Board. MDB allows value-added use with acknowledgement, but prohibits resale/commercial appropriation and passing modified data off as MDB data; confirm terms for your intended deployment. The public Nominatim service has a strict usage policy (including a maximum of one request per second per application, identifying User-Agent, attribution, caching, and no personal/confidential data); use an approved provider or self-hosted service for public-pilot traffic.

The first super-admin is created once through `/admin/bootstrap`, gated by `SUPER_ADMIN_BOOTSTRAP_TOKEN`; remove that variable after successful bootstrap. Existing file-store staff remain unassigned until a super admin assigns them. Legacy reports keep their old municipality text and remain inaccessible to municipality-scoped staff until their municipality relationship has been reviewed and backfilled from authoritative coordinates. Do not auto-assign from the old free-text value.

Evidence accepts JPEG, PNG, or WebP files up to 3 MB. The current implementation stores encoded evidence in PostgreSQL; move it to durable object storage before broad public use.

## Tests

```powershell
npm test
```

Tests use an automatically created temporary file store and remove it after the suite. They do not reset or modify `server/data/store.json`. No sample reports or pins are part of normal startup.