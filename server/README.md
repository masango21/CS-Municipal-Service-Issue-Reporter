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
- `CLIENT_ORIGIN`: exact frontend origin, including scheme.
- `SESSION_COOKIE_SAME_SITE`: defaults to `lax`; use frontend/API custom domains under the same registrable domain.
- `SUPER_ADMIN_BOOTSTRAP_TOKEN`: one-time high-entropy secret for first super-admin setup. Remove it from the server environment after bootstrap.
- `OLLAMA_BASE_URL`: local Ollama API base URL; defaults to `http://127.0.0.1:11434`.
- `OLLAMA_MODEL`: installed local model tag used by the assistant, for example `llama3.2:3b`.
- `MAIN_API_BASE_URL`: server-only origin used by the isolated assistant API to verify resident sessions and fetch owner-scoped reports from the main API; defaults to `http://127.0.0.1:4000`.
- `MDB_MUNICIPALITY_FEATURE_LAYER_URL`: optional override for the authoritative Municipal Demarcation Board polygon layer. The current public item is titled MDB Local Municipalities 2021 but its linked FeatureServer describes a 2018 layer; verify the current demarcation release before a public pilot.
- `REVERSE_GEOCODER_URL`: optional server-side reverse-geocoding endpoint; defaults to OpenStreetMap Nominatim. Configure an alternative endpoint for sustained/public service.
- `GEOCODING_USER_AGENT` and `GEOCODING_CONTACT`: identifying User-Agent and operational contact for the selected geocoder.
- `ENABLE_MUNICIPALITY_SCOPING_MIGRATION`: set to `true` only after migration 002 has been verified on a disposable PostgreSQL database and production changes separately approved. The API refuses database-backed startup while migration 002 is pending and this flag is unset.
- `ENABLE_SUPPORT_CHAT_MIGRATION`: legacy opt-in for migration 003 only. The retired resident-to-staff chat is no longer available; an un-applied legacy migration is skipped unless this flag is explicitly enabled.
- `ENABLE_AI_ASSISTANT_MIGRATION`: set to `true` only after migration 004 has been verified on a disposable PostgreSQL database and production changes separately approved. The API refuses database-backed startup while migration 004 is pending and this flag is unset.

Never commit environment files. Production refuses to start without PostgreSQL. Versioned migrations under `sql/migrations/` are applied transactionally at startup; migrations 002 and 004 require explicit opt-in after disposable-branch validation and separate production approval. Resident and staff passwords are stored as salted scrypt hashes. Browser sessions use HttpOnly cookies; authentication endpoints are rate-limited.

Residents must sign in to submit reports. `/api/my/reports` returns only the signed-in resident's reports. Public responses omit reporter identity and staff-only notes/assignment fields. Destructive operations require staff authorization, and cookie-authenticated writes require an allowed `Origin`.

The resident AI Assistant uses `/api/assistant/conversations` and `/api/assistant/conversations/:id/messages`. Conversations are private to the authenticated resident and stored in separate AI-assistant tables (migration 004) or the isolated local assistant file store. For the isolated assistant API, resident sessions and report ownership are verified against the main API (`MAIN_API_BASE_URL`) by forwarding the existing HttpOnly session cookie to `/api/auth/session` and `/api/my/reports`. The main API remains authoritative; the assistant does not copy resident accounts or report records. The API sends bounded conversation context to local Ollama `/api/chat` and includes only a minimal verified report summary. Legacy support chat tables and records are not reused or sent to Ollama. Provider failures are returned to the client; there are no canned fallback responses.

### Local AI Assistant (Windows)

Install Ollama from [ollama.com/download/windows](https://ollama.com/download/windows), then start the Ollama application. In PowerShell, download and confirm the small instruction-tuned model:

```powershell
ollama pull llama3.2:3b
ollama list
Invoke-RestMethod http://127.0.0.1:11434/api/tags
```

For an isolated assistant API, open a PowerShell terminal at the repository root and set process-scoped values (these do not replace or edit `server/.env`):

```powershell
$env:USE_FILE_STORE = "true"
$env:PORT = "4001"
$env:DATA_STORE_PATH = Join-Path $env:TEMP "msr-ai-assistant\store.json"
$env:OLLAMA_BASE_URL = "http://127.0.0.1:11434"
$env:OLLAMA_MODEL = "llama3.2:3b"
$env:MAIN_API_BASE_URL = "http://127.0.0.1:4000"
$env:ENABLE_AI_ASSISTANT_MIGRATION = "false"
npm --prefix server start
```

The assistant service uses its isolated file store for conversations but verifies resident authentication against the existing main API. Keep `server/.env` and the main API's database configuration unchanged. The assistant requires no OpenAI key. Do not set the Ollama URL, model, or main API origin as a `NEXT_PUBLIC_*` variable. Verify the assistant API is healthy and starts with zero reports:

```powershell
Invoke-RestMethod http://localhost:4001/api/health
```

In a second terminal, point the client proxy at the assistant API and start Next.js:

```powershell
$env:NEXT_PUBLIC_API_BASE_URL = "http://localhost:4001"
npm --prefix client run dev -- --port 3000
```

Sign in as a resident at `http://localhost:3000`, open AI Assistant, and ask a municipal-help question. Confirm model availability with `ollama list` or `/api/tags`. If the assistant reports that the model is not installed, run `ollama pull llama3.2:3b`. If Ollama is unreachable, start the Ollama application and confirm `/api/tags` responds. If inference times out, allow more time for CPU inference or choose a suitable smaller model; no automatic retry loop is used. The UI shows a safe error and Retry action for failed requests.

### Safe integrated API validation without the configured database

When the configured `DATABASE_URL` has not been confirmed as non-production and disposable, do not restart the existing port-4000 API. The current server source can be tested safely on an unused port with file storage, without connecting to PostgreSQL or applying migrations. In a separate PowerShell terminal, use a fresh temporary store and keep the client pointed at the existing service:

```powershell
$env:USE_FILE_STORE = "true"
$env:DATA_STORE_PATH = Join-Path $env:TEMP ("msr-main-api-test-" + [guid]::NewGuid().ToString("N") + "\store.json")
$env:PORT = "4002"
$env:OLLAMA_BASE_URL = "http://127.0.0.1:11434"
$env:OLLAMA_MODEL = "llama3.2:3b"
$env:ENABLE_AI_ASSISTANT_MIGRATION = "false"
$env:ENABLE_MUNICIPALITY_SCOPING_MIGRATION = "false"
$env:ENABLE_SUPPORT_CHAT_MIGRATION = "false"
npm --prefix server start
```

The server should log `Database enabled: false` and the temporary store path. Verify `http://localhost:4002/api/health` and that unauthenticated access to `/api/assistant/conversations` returns HTTP 401. This validates the current assistant routes and Ollama integration against an isolated, initially empty store; it does not replace the reports/API on port 4000 and is not a reason to switch the frontend proxy. Only use port 4000 after its database target has been independently confirmed safe and a restart has been approved.

Report municipality IDs are resolved server-side with a point-in-polygon query against the MDB feature layer; browser-supplied municipality values are not trusted. Street address lookup is server-side and cached; address lookup failure does not change boundary determination, while boundary lookup failure blocks submission. Attribute the boundary source to the Municipal Demarcation Board. MDB allows value-added use with acknowledgement, but prohibits resale/commercial appropriation and passing modified data off as MDB data; confirm terms for your intended deployment. The public Nominatim service has a strict usage policy (including a maximum of one request per second per application, identifying User-Agent, attribution, caching, and no personal/confidential data); use an approved provider or self-hosted service for public-pilot traffic.

The first super-admin is created once through `/admin/bootstrap`, gated by `SUPER_ADMIN_BOOTSTRAP_TOKEN`; remove that variable after successful bootstrap. Existing file-store staff remain unassigned until a super admin assigns them. Legacy reports keep their old municipality text and remain inaccessible to municipality-scoped staff until their municipality relationship has been reviewed and backfilled from authoritative coordinates. Do not auto-assign from the old free-text value.

Evidence accepts JPEG, PNG, or WebP files up to 3 MB. The current implementation stores encoded evidence in PostgreSQL; move it to durable object storage before broad public use.

## Tests

```powershell
npm test
```

Tests use an automatically created temporary file store and remove it after the suite. They do not reset or modify `server/data/store.json`. No sample reports or pins are part of normal startup.