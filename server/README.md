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

Never commit environment files. Production refuses to start without PostgreSQL. Versioned migrations under `sql/migrations/` are applied transactionally at startup; validate them on a disposable PostgreSQL branch before any production migration. Resident and staff passwords are stored as salted scrypt hashes. Browser sessions use HttpOnly cookies; authentication endpoints are rate-limited.

Residents must sign in to submit reports. `/api/my/reports` returns only the signed-in resident's reports. Public responses omit reporter identity and staff-only notes/assignment fields. Destructive operations require staff authorization, and cookie-authenticated writes require an allowed `Origin`.

Evidence accepts JPEG, PNG, or WebP files up to 3 MB. The current implementation stores encoded evidence in PostgreSQL; move it to durable object storage before broad public use.

## Tests

```powershell
npm test
```

Tests use an automatically created temporary file store and remove it after the suite. They do not reset or modify `server/data/store.json`. No sample reports or pins are part of normal startup.