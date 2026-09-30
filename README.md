# Municipal Service Issue Reporter
Residents can report municipal service problems with map coordinates; staff review and triage reports from a shared data source.

## Public Pilot Status

Cookie-based resident/staff authentication, owner-scoped reports, PostgreSQL migrations, privacy controls, isolated API tests, and the client build are implemented. The app is **not live or ready for unrestricted public registration**. Database migration verification, credential rotation, email recovery/verification, durable evidence storage, privacy review, and hosting setup remain launch gates. See [DEPLOYMENT.md](DEPLOYMENT.md).

The app starts with 0 reports and 0 map pins. No sample reports, residents, or staff are seeded.

## Stack

- Next.js, React, TypeScript, Tailwind CSS
- Express API with PostgreSQL/Neon in production
- HttpOnly cookie sessions and server-side password hashing
- JSON file store only for local development and isolated tests
- Leaflet/OpenStreetMap for South Africa-focused report maps

## Local Development

Use two PowerShell terminals.

1. In `server/`:

```powershell
npm ci
Copy-Item .env.example .env
```

For isolated local development, set `USE_FILE_STORE=true` in ignored `server/.env`. Configure a local `JWT_SECRET` and `ADMIN_REGISTRATION_KEYS`. Generate development secrets locally instead of sharing them in chat:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Then run `npm start` from `server/`.

2. In `client/`:

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

The client runs at `http://localhost:3000`; the API runs at `http://localhost:4000`.

## Checks

Run `npm test` in `server/` and `npm run build` in `client/`. API tests create and delete a temporary store; they do not modify `server/data/store.json`.

## Production Boundary

Production refuses to start without PostgreSQL. Test migrations against a disposable Neon branch before applying them to any real database. Rotate all credentials previously shared in chat; never commit `.env` files. The frontend and API need HTTPS custom domains under the same registrable domain for the configured Lax session cookie to work reliably.
