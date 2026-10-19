# Implementation Prompt: Repair Report Submission and Location Workflow

## Objective

Fix and verify the existing resident report flow in this repository without replacing its
architecture or weakening its security. Preserve the existing visual design and unrelated
worktree changes.

## Existing architecture

- The client is Next.js 16 App Router with React and TypeScript under `client/`.
- Browser `/api/*` calls use Next.js rewrites configured by the server-only `API_BASE_URL`
  setting to reach the Express API under `server/`.
- The API uses HttpOnly JWT session cookies, a server-side exact-origin allowlist from
  `CLIENT_ORIGIN`, PostgreSQL in production, and an isolated JSON file store for development
  and tests.
- The map uses React Leaflet/Leaflet and OpenStreetMap tiles. Search currently calls
  Nominatim directly; the API uses the configured Nominatim-compatible reverse-geocoder and
  the Municipal Demarcation Board ArcGIS feature service for point-in-polygon lookups.
- Report creation currently sends JSON to `/api/reports`; evidence is a base64 data URI
  stored in `issues.evidence_image` or the local JSON store. No separate object-storage
  provider or upload credentials are configured. Do not substitute a new provider.

## Findings to address

1. `server/index.js` rejects cookie-authenticated writes unless `Origin` exactly matches a
   configured `CLIENT_ORIGIN`. The Next.js rewrite keeps the browser's frontend origin, so a
   deployed Vercel origin omitted from the running API's environment is rejected with
   `A valid same-origin request is required`. Keep exact allowlisting and deny missing or
   untrusted origins for cookie-authenticated writes. Test accepted, untrusted, and missing
   origins. Do not add wildcard or suffix-based trust. The existing worktree already contains
   a Render Blueprint/documentation update for the reported Vercel preview; preserve those
   edits and explain that they only take effect after the deployed service is synchronized
   and restarted/redeployed.
2. `LocationPicker` keeps a separate internal marker state initialized only once from its
   `value`, so clearing the parent selection can leave a stale marker. Map click/search and
   geolocation callbacks also attach placeholder city, address, or municipality values before
   the authoritative server lookup. Make selected coordinates controlled by the report form,
   update the marker immediately, and never present placeholders as real geocoding or
   municipality results.
3. The report form relies mostly on server validation, hides the server's safe error behind a
   generic submission message, does not lock repeated submissions synchronously, and uses
   `FileReader` without explicit read-error handling. Add accessible client validation and
   field limits matching server rules; preserve report details on failed uploads/submissions;
   show safe API errors; make loading/disabled and repeated-click behavior dependable.
4. Server evidence checks validate a data-URI prefix and encoded-text length but do not verify
   decoded byte size or that the bytes match the claimed PNG/JPEG/WebP type. The JSON parser's
   5 MB limit can also fail before route validation. Enforce the existing 3 MB limit and
   supported formats on both sides, safely return an appropriate client error for oversized
   JSON, and do not expose provider/database details. Keep the existing data-URI persistence
   approach unless code inspection establishes an existing configured storage provider.
5. The report route validates core fields and resolves authoritative coordinates, but its
   broad database error handling responds with HTTP 500 and logs the raw database error.
   Return a safe service-unavailable response for storage outages and log only safe,
   non-sensitive error context. Preserve coordinates, priority, category, municipality,
   address, image, status, and authenticated resident ownership through both persistence
   paths.
6. Current tests cover unauthenticated submission, location failures, and basic image
   rejections, but do not exercise the cookie-origin guard or byte-accurate valid/invalid
   evidence payloads. Add focused server tests for trusted/untrusted/missing origins, payload
   validation, location resolution, and storage/network failure behavior. Keep the tests
   isolated from any configured or production database.

## Implementation constraints

- Inspect each affected file and the relevant installed Next.js documentation before changing
  Next.js-facing code.
- Preserve authentication, CSRF/origin protection, exact-origin configuration, rate limits,
  resident ownership, municipal boundary checks, and public-response privacy.
- Do not read or print ignored `.env` files, invent credentials, call production services,
  deploy, commit, or connect to/migrate an existing database.
- Do not add demo reports/pins or fabricate address/municipality results.
- Avoid schema migrations or production-database changes unless absolutely required; obtain
  separate explicit approval before any live database operation.
- Preserve all existing user changes, including the current edits to `DEPLOYMENT.md` and
  `render.yaml` and the pre-existing deployment troubleshooting prompts.
- Update only directly related documentation and tests.

## Verification

Use the existing npm package-manager setup. Run the server unit/integration tests, client
lint, TypeScript check, and production build. Add automated coverage for server-verifiable
cases; clearly distinguish manual browser checks from automated test results. Verify that
the test store starts with zero reports, trusted cookie-authenticated writes pass, untrusted
and missing origins fail, invalid or oversized evidence is rejected, valid evidence is
accepted, and failed persistence does not return a success response. Do not claim any live
provider, deployment, or production-database check that was not performed.
