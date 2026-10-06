# Fix Localhost API CORS

## Goal
Make the local Next.js app at `http://localhost:3000` able to read reports and use the API at `http://localhost:4000` during development.

## Evidence
- The client requests the API at `http://localhost:4000` by default.
- `GET http://localhost:4000/api/reports` responds with HTTP 200 and an empty report list, as required for a fresh install.
- When the same request includes `Origin: http://localhost:3000`, the response omits `Access-Control-Allow-Origin` and `Access-Control-Allow-Credentials`.
- The Express CORS middleware uses `CLIENT_ORIGIN` as its allowlist when configured, replacing the localhost default. Therefore a local `.env` value that only lists a deployed client origin blocks the local browser request and produces `Failed to fetch`.

## Scope
- Adjust the Express CORS allowlist so localhost development origins are permitted in non-production, even when `CLIENT_ORIGIN` is configured for another environment.
- Include the local origins needed for the app (`http://localhost:3000` and `http://127.0.0.1:3000`) without allowing arbitrary origins.
- Keep production CORS restricted to the explicitly configured `CLIENT_ORIGIN` values; do not add wildcard origins or expose environment values.
- Add focused API tests for allowed local origins and rejection of an unapproved origin, reusing the existing Node test setup.
- Do not change report data, seed reports, alter authentication, or touch deployment configuration.

## Acceptance Criteria
- A request from `http://localhost:3000` to `/api/reports` receives the matching `Access-Control-Allow-Origin` header and `Access-Control-Allow-Credentials: true`.
- A request from `http://127.0.0.1:3000` is also supported in non-production.
- An arbitrary origin receives no permissive CORS response.
- Production continues to allow only configured client origins.
- The app still starts with zero reports and zero map pins.

## Verification
- Run `npm test` in `server/`.
- Restart `npm run dev` and confirm the homepage loads live report data without `Failed to fetch`.
- Confirm the homepage still displays zero reports and no pins on a fresh data store.
