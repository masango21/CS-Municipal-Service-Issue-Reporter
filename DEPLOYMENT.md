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
- `MDB_MUNICIPALITY_FEATURE_LAYER_URL`: optional MDB point-in-polygon layer override. Verify active municipal demarcation boundaries before public launch; current item metadata says “2021” while its service description says “2018”.
- `REVERSE_GEOCODER_URL`, `GEOCODING_USER_AGENT`, `GEOCODING_CONTACT`: server-side reverse-geocoder configuration and identifying contact. The public Nominatim endpoint is rate-limited to one request/second/application and subject to its usage policy; use a suitable provider or self-host for public traffic.
- `ENABLE_MUNICIPALITY_SCOPING_MIGRATION=true`: set only after migration 002 passes disposable-PostgreSQL verification and production change approval. Without it, startup refuses to apply the new migration.
- `CLIENT_ORIGIN`: exact HTTPS frontend origin.
- `DATABASE_SSL=true`; use `SESSION_COOKIE_SAME_SITE=none` for cross-site Vercel/Render hostnames or `lax` for HTTPS on same-site custom domains.

The Blueprint allowlist includes the current preview origin
`https://cs-municipal-service-issue-rep-kduvpdqcv.vercel.app` in addition to the two
existing Vercel origins. The API checks the browser's exact `Origin` on cookie-authenticated
writes across reports and maps. A new ephemeral Vercel preview hostname must be added as
an exact origin to the Render API's `CLIENT_ORIGIN` and allowed by its CORS configuration.
Updating `render.yaml` does not change an existing Render service until its Blueprint is
synchronized and the service is restarted/redeployed. Prefer a stable approved frontend
domain for ongoing use; do not allow arbitrary Vercel subdomains.

Production startup refuses to use JSON file storage. The API applies approved versioned SQL files under `server/sql/migrations/` at startup. A pending migration 002 still blocks startup unless its separately verified gate is enabled. Migration 004 is retained but excluded from automatic application; any existing assistant-related tables and records remain untouched pending a separately approved database cleanup. The API does not seed reports, residents, or staff accounts.


## Vercel Client

Import the repository into Vercel and set the project Root Directory to `client`. Add this server-side environment variable under **Project Settings → Environment Variables** for every environment that you deploy (Production, Preview, and Development as applicable). It is required during the production build and used by Next.js rewrites without exposing the API origin in browser bundles:

- `API_BASE_URL`: the actual HTTPS origin of the deployed Express API. Enter only the origin (scheme and hostname, with an optional port); do not append `/api` or another path, and do not include credentials. For example, use the placeholder form `https://<your-api-host>` and replace it with the API host assigned to your service.

After saving the variable, trigger a new deployment so the build receives it. If Vercel reports `API_BASE_URL must be configured for production builds`, this variable is missing from the environment used by that deployment. Do not remove the production check or set this variable to `localhost`; a successful build needs the real HTTPS API origin. The repository does not determine or configure that production host automatically.

Assign the frontend custom domain under the same parent domain as the API. Do not use a wildcard CORS origin.

## Local Development

Copy `server/.env.example` to `server/.env` and `client/.env.example` to `client/.env.local`. Set a development-only database or omit `DATABASE_URL` to use the local JSON store. Never copy production credentials into a shared development environment. `DATABASE_SSL=false` is only for a trusted local PostgreSQL instance.

## Verification Gates

Before opening the pilot, verify the deployed health endpoint, cookie-based resident signup/login, owner-only report history, staff invitation/login/triage, unauthenticated destructive-route rejection, evidence upload constraints, database migrations, backups, and a fresh zero-report/zero-pin state. Use temporary test identities and delete their records before launch.
