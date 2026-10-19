# Public Pilot Deployment

## Status

This repository contains deployment scaffolding, but no service is deployed or verified against the real Neon database. Do not describe the app as live until the launch gates below are completed.

## Required Before Launch

- Rotate the Neon database password, JWT signing secret, and staff invite keys. Their previous values were shared in chat and must be treated as compromised. Enter replacements directly in provider dashboards or local ignored environment files; never commit or send them in chat.
- Use separate development/staging and production Neon databases. Back up the production database and test the migration against a disposable Neon branch before allowing the API to apply it to production.
- The client proxies browser `/api/*` requests through the Next.js origin to the API configured in the server-side `API_BASE_URL`. This keeps session cookies first-party in the browser and does not put the API origin in the browser bundle. For clients that call the API directly, Vercel and Render hostnames are cross-site; `SESSION_COOKIE_SAME_SITE=none` requires HTTPS and may still be blocked by browser third-party-cookie restrictions. Same-site custom domains are more reliable for direct calls.
- Set exact comma-separated `CLIENT_ORIGIN` values matching each deployed frontend origin, including the current Vercel preview when it is used, and set `API_BASE_URL` to the HTTPS API origin used by the rewrite. Both services must use HTTPS in production.
- Provide a verified municipal contact, privacy notice, retention/deletion policy, and incident-response contact. Resident email verification and password recovery are not implemented; add an approved identity/recovery process before unrestricted public registration.
- Evidence images are limited to 3 MB and stored in PostgreSQL. Choose and configure durable object storage before broad public use to avoid unbounded database growth.

## Render API

`render.yaml` defines the API service. Import the repository as a Render Blueprint and configure the secret variables in the Render dashboard:

- `DATABASE_URL`: production Neon connection string after rotating the database password.
- `JWT_SECRET`: newly generated high-entropy secret.
- `ADMIN_REGISTRATION_KEYS`: newly generated, comma-separated staff invitation keys.
- `SUPER_ADMIN_BOOTSTRAP_TOKEN`: temporary high-entropy token used once to create the first super-admin; remove immediately after bootstrap.
- `MAIN_API_BASE_URL`: the API's own HTTPS origin, for example `https://api.example.gov.za`. This server-only setting is used to verify resident sessions and fetch only the authenticated resident's reports.
- `OLLAMA_BASE_URL`: HTTPS base URL of the separately hosted Ollama-compatible inference service, for example `https://ollama.example.gov.za`. Restrict TLS-protected access to the API using a private network or provider access controls; do not expose Ollama's port publicly.
- `OLLAMA_MODEL`: the model tag installed by the inference-service operator; set it to the current project model, `llama3.2:3b`. The API uses this project model if the variable is absent or blank, but explicitly setting it in Render is recommended.
- `OLLAMA_API_KEY`: optional bearer credential if the selected service requires it. Configure it only in the Render API's server-side secret settings.
- `MDB_MUNICIPALITY_FEATURE_LAYER_URL`: optional MDB point-in-polygon layer override. Verify active municipal demarcation boundaries before public launch; current item metadata says “2021” while its service description says “2018”.
- `REVERSE_GEOCODER_URL`, `GEOCODING_USER_AGENT`, `GEOCODING_CONTACT`: server-side reverse-geocoder configuration and identifying contact. The public Nominatim endpoint is rate-limited to one request/second/application and subject to its usage policy; use a suitable provider or self-host for public traffic.
- `ENABLE_MUNICIPALITY_SCOPING_MIGRATION=true`: set only after migration 002 passes disposable-PostgreSQL verification and production change approval. Without it, startup refuses to apply the new migration.
- `ENABLE_AI_ASSISTANT_MIGRATION`: keep false until migration 004 passes disposable-PostgreSQL verification and separate production change approval. If 004 is pending while disabled, API startup continues with a warning and authenticated assistant routes return HTTP 503 until the schema is approved and applied. Do not set this flag to make the API start. A pending legacy migration 003 is skipped unless its own opt-in flag is enabled.
- `CLIENT_ORIGIN`: exact HTTPS frontend origin.
- `DATABASE_SSL=true`; use `SESSION_COOKIE_SAME_SITE=none` for cross-site Vercel/Render hostnames or `lax` for HTTPS on same-site custom domains.

Production startup refuses to use JSON file storage. The API applies versioned SQL files under `server/sql/migrations/` at startup. A pending migration 002 still blocks startup unless its separately verified gate is enabled. A pending migration 004 alone is deferred, with AI conversation routes unavailable (HTTP 503); it is never applied unless its dedicated flag is explicitly enabled after disposable-database validation and separate production approval. The API does not seed reports, residents, or staff accounts.

The existing Render Blueprint runs only the Node API; it does not install Ollama, host model weights, or provision inference capacity. A locally hosted Ollama instance is not reachable by the separately hosted Render API. Before production use, provision an always-available Ollama-compatible service with enough memory and compute for `llama3.2:3b`, install and verify the model there, restrict TLS-protected network access to the API or use provider authentication, and configure the server-only settings above. The API rejects missing, non-HTTPS, and loopback Ollama URLs in production and returns a safe error if the configured service or model is unavailable. Do not expose Ollama's port publicly or point production at a developer workstation.

The Render Blueprint in this repository declares `OLLAMA_MODEL=llama3.2:3b` and prompts for the inference URL and optional key. Existing Render services do not read `.env.example`, and changes to `render.yaml` do not affect a running service until its Blueprint configuration is synchronized and a new deployment is made. For an existing service, confirm these values in the Render API service's environment: `OLLAMA_MODEL=llama3.2:3b`, `OLLAMA_BASE_URL=<operator-provided HTTPS Ollama service URL>`, and `OLLAMA_API_KEY=<optional provider credential>`. Do not use a local `localhost` URL in Render. A missing `OLLAMA_MODEL` now selects the project's default model, but Ollama must still have that model installed; missing or inaccessible production service configuration remains an explicit error.

Assistant routes are part of the existing main API; the client proxies `/api/assistant/*` to the same configured API origin as other application requests. No second API service is required. PostgreSQL-backed conversation history depends on migration 004. Until it is verified on a disposable PostgreSQL branch and separately approved, leave `ENABLE_AI_ASSISTANT_MIGRATION` unset or false: the API can start, but chat requests return HTTP 503. This change does not verify, enable, or apply migration 004.

## Vercel Client

Import the repository into Vercel and set the project root directory to `client`. Add this server-side environment variable for each deployment environment; it is required for production builds and used by Next.js rewrites without exposing the API origin in browser bundles:

- `API_BASE_URL`: the HTTPS API origin, for example `https://api.example.gov.za`.

Assign the frontend custom domain under the same parent domain as the API. Do not use a wildcard CORS origin.

## Local Development

Copy `server/.env.example` to `server/.env` and `client/.env.example` to `client/.env.local`. Set a development-only database or omit `DATABASE_URL` to use the local JSON store. Never copy production credentials into a shared development environment. `DATABASE_SSL=false` is only for a trusted local PostgreSQL instance.

## Verification Gates

Before opening the pilot, verify the deployed health endpoint, cookie-based resident signup/login, owner-only report history, staff invitation/login/triage, unauthenticated destructive-route rejection, evidence upload constraints, database migrations, backups, and a fresh zero-report/zero-pin state. Use temporary test identities and delete their records before launch.
