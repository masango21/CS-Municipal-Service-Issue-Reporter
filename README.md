# Municipal Service Issue Reporter
Residents can report municipal service problems with map coordinates; staff review and triage reports from a shared data source.

## Public Pilot Status

Cookie-based resident/staff authentication, owner-scoped reports, PostgreSQL migrations, privacy controls, isolated API tests, and the client build are implemented. The app is **not live or ready for unrestricted public registration**. Database migration verification, credential rotation, email recovery/verification, durable evidence storage, privacy review, and hosting setup remain launch gates. See [DEPLOYMENT.md](DEPLOYMENT.md).

The app starts with 0 reports and 0 map pins. No sample reports, residents, or staff are seeded.
Authenticated residents can use the floating AI Assistant for application guidance and help understanding their own reports. The assistant calls its AI provider only from the server; it is not a resident-to-staff chat and cannot submit or change reports.

## Stack

- Next.js, React, TypeScript, Tailwind CSS
- Express API with PostgreSQL/Neon in production
- HttpOnly cookie sessions and server-side password hashing
- Server-side Ollama integration and owner-scoped AI conversation history
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

Then run `npm start` from `server/`. The assistant uses local Ollama; it does not require an OpenAI API key. Install Ollama and pull `llama3.2:3b` (or the configured model). The assistant routes use this same API service; a separate port-4001 assistant server is not needed. See [server/README.md](server/README.md#local-ai-assistant-windows) for setup and isolated verification. If Ollama or the model is unavailable, the API reports a safe error instead of returning canned responses.

2. In `client/`:

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Set `API_BASE_URL=http://localhost:4000` in `client/.env.local` if needed. The client runs at `http://localhost:3000`; the API and assistant routes run together at `http://localhost:4000`.

## Checks

Run `npm test` in `server/` and `npm run build` in `client/`. API tests create and delete a temporary store; they do not modify `server/data/store.json`.

## Production Boundary

Production refuses to start without PostgreSQL. A pending AI-only migration 004 no longer blocks the rest of the API; assistant persistence remains unavailable until the migration is verified on a disposable Neon branch and separately approved. Other gated migrations can still prevent startup. Never enable migration 004 just to make the API start. Rotate all credentials previously shared in chat; never commit `.env` files. The frontend and API need HTTPS custom domains under the same registrable domain for the configured Lax session cookie to work reliably.
