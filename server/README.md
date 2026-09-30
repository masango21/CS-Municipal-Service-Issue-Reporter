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
- `MDB_MUNICIPALITY_FEATURE_LAYER_URL`: optional override for the authoritative Municipal Demarcation Board polygon layer. The current public item is titled MDB Local Municipalities 2021 but its linked FeatureServer describes a 2018 layer; verify the current demarcation release before a public pilot.
- `REVERSE_GEOCODER_URL`: optional server-side reverse-geocoding endpoint; defaults to OpenStreetMap Nominatim. Configure an alternative endpoint for sustained/public service.
- `GEOCODING_USER_AGENT` and `GEOCODING_CONTACT`: identifying User-Agent and operational contact for the selected geocoder.
- `ENABLE_MUNICIPALITY_SCOPING_MIGRATION`: set to `true` only after migration 002 has been verified on a disposable PostgreSQL database and production changes separately approved. The API refuses database-backed startup while migration 002 is pending and this flag is unset.

Never commit environment files. Production refuses to start without PostgreSQL. Versioned migrations under `sql/migrations/` are applied transactionally at startup; municipality migration 002 requires explicit opt-in after disposable-branch validation and separate production approval. Resident and staff passwords are stored as salted scrypt hashes. Browser sessions use HttpOnly cookies; authentication endpoints are rate-limited.

Residents must sign in to submit reports. `/api/my/reports` returns only the signed-in resident's reports. Public responses omit reporter identity and staff-only notes/assignment fields. Destructive operations require staff authorization, and cookie-authenticated writes require an allowed `Origin`.

Report municipality IDs are resolved server-side with a point-in-polygon query against the MDB feature layer; browser-supplied municipality values are not trusted. Street address lookup is server-side and cached; address lookup failure does not change boundary determination, while boundary lookup failure blocks submission. Attribute the boundary source to the Municipal Demarcation Board. MDB allows value-added use with acknowledgement, but prohibits resale/commercial appropriation and passing modified data off as MDB data; confirm terms for your intended deployment. The public Nominatim service has a strict usage policy (including a maximum of one request per second per application, identifying User-Agent, attribution, caching, and no personal/confidential data); use an approved provider or self-hosted service for public-pilot traffic.

The first super-admin is created once through `/admin/bootstrap`, gated by `SUPER_ADMIN_BOOTSTRAP_TOKEN`; remove that variable after successful bootstrap. Existing file-store staff remain unassigned until a super admin assigns them. Legacy reports keep their old municipality text and remain inaccessible to municipality-scoped staff until their municipality relationship has been reviewed and backfilled from authoritative coordinates. Do not auto-assign from the old free-text value.

Evidence accepts JPEG, PNG, or WebP files up to 3 MB. The current implementation stores encoded evidence in PostgreSQL; move it to durable object storage before broad public use.

## Tests

```powershell
npm test
```

Tests use an automatically created temporary file store and remove it after the suite. They do not reset or modify `server/data/store.json`. No sample reports or pins are part of normal startup.