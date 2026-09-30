# Public Pilot Deployment

## Status

This repository contains deployment scaffolding, but no service is deployed or verified against the real Neon database. Do not describe the app as live until the launch gates below are completed.

## Required Before Launch

- Rotate the Neon database password, JWT signing secret, and staff invite keys. Their previous values were shared in chat and must be treated as compromised. Enter replacements directly in provider dashboards or local ignored environment files; never commit or send them in chat.
- Use separate development/staging and production Neon databases. Back up the production database and test the migration against a disposable Neon branch before allowing the API to apply it to production.
- Configure app and API custom domains under the same registrable domain, for example `reports.example.gov.za` and `api.example.gov.za`. The default Vercel and Render hostnames are cross-site; the default `SameSite=Lax` cookie will not reliably authenticate across them.
- Set an exact `CLIENT_ORIGIN` matching the frontend origin and `NEXT_PUBLIC_API_BASE_URL` matching the API origin. Both services must use HTTPS in production.
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
- `DATABASE_SSL=true` and `SESSION_COOKIE_SAME_SITE=lax` for HTTPS on same-site custom domains.

Production startup refuses to use JSON file storage. The API applies versioned SQL files under `server/sql/migrations/` at startup; migration 002 is explicitly gated after disposable-database validation and production approval. The API does not seed reports, residents, or staff accounts.

## Vercel Client

Import the repository into Vercel and set the project root directory to `client`. Add this non-secret environment variable for each deployment environment:

- `NEXT_PUBLIC_API_BASE_URL`: the HTTPS API origin, for example `https://api.example.gov.za`.

Assign the frontend custom domain under the same parent domain as the API. Do not use a wildcard CORS origin.

## Local Development

Copy `server/.env.example` to `server/.env` and `client/.env.example` to `client/.env.local`. Set a development-only database or omit `DATABASE_URL` to use the local JSON store. Never copy production credentials into a shared development environment. `DATABASE_SSL=false` is only for a trusted local PostgreSQL instance.

## Verification Gates

Before opening the pilot, verify the deployed health endpoint, cookie-based resident signup/login, owner-only report history, staff invitation/login/triage, unauthenticated destructive-route rejection, evidence upload constraints, database migrations, backups, and a fresh zero-report/zero-pin state. Use temporary test identities and delete their records before launch.
