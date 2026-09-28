# Municipal Service API

## Start

Install dependencies and start the API from this directory:

```powershell
npm install
npm start
```

The default API address is `http://localhost:4000`.

## Required configuration

Copy `.env.example` to `.env` and set:

- `JWT_SECRET`: a high-entropy secret used to sign staff access tokens.
- `ADMIN_REGISTRATION_KEYS`: comma-separated out-of-band invite keys required to create staff accounts; the legacy singular `ADMIN_REGISTRATION_KEY` remains supported.
- `DATABASE_URL`: optional PostgreSQL connection string; without it, the JSON file store is used.

Never commit environment files. Staff invite keys may be placed in the ignored `server/.env.staff-invites` file as `ADMIN_REGISTRATION_KEYS=key-one,key-two`; the server loads it at startup. Registration returns `503` until at least one key is configured. Provide invite keys only to authorized municipal staff. Passwords created through the API are stored as salted scrypt hashes; legacy plaintext records are upgraded after a successful login.

Staff report mutations require `Authorization: Bearer <staff-token>`. Staff notes are returned only from authenticated `/api/admin/reports/:id`; public report responses intentionally omit notes.

## Tests

```powershell
npm test
```

Tests use the file-store mode and reset their reports, accounts, and staff records after each test. No sample reports or pins are part of normal startup.