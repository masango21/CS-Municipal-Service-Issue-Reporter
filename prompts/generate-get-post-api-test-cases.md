# Generate GET and POST API Test Case Documentation

## Objective

After approval, create or update exactly one repository-root file named `API_GET_POST_TEST_CASES.txt`. Do not create the final test-case document before the user approves execution.

## Source Inspection

Use current executable source as the primary reference:

- `server/index.js`: Express middleware, route definitions, validation, status codes, response shapes, role checks, and file-store branches
- `server/db.js`: PostgreSQL query methods, migrations, category initialization, and row conversion
- `server/location.js`: coordinate checks and MDB/Nominatim integrations
- `server/sql/schema.sql` and `server/sql/migrations/*.sql`: constraints and database relations
- `server/test/api.test.js` and `server/test/location.test.js`: existing regression coverage and fixtures
- `client/context/*.tsx`, `client/lib/municipalities.ts`, and page consumers: actual API request shapes and workflows
- `package.json` files and `.env.example` key names for execution/configuration context

Do not read or reproduce actual environment values, passwords, hashes, tokens, report contents, or account identities. Use placeholders such as `<VALID_RESIDENT_SESSION>` and `<TEST_BOOTSTRAP_VALUE>`, never real credentials. Avoid mutating the current local store or any database.

## Verified Route Inventory

The API currently defines 13 GET routes:

1. `GET /`
2. `GET /api/health`
3. `GET /api/auth/session`
4. `GET /api/staff/municipalities`
5. `GET /api/admin/municipalities`
6. `GET /api/admin/staff`
7. `GET /api/reports`
8. `GET /api/my/reports`
9. `GET /api/admin/reports`
10. `GET /api/staff/directory`
11. `GET /api/admin/reports/:id`
12. `GET /api/categories`
13. `GET /api/reports/:id`

The API currently defines 14 POST routes:

1. `POST /api/auth/logout`
2. `POST /api/location/resolve`
3. `POST /api/staff/municipalities/:id/verify-access`
4. `POST /api/staff/municipality/lock`
5. `POST /api/admin/bootstrap`
6. `POST /api/admin/staff/:staffId/municipalities/:municipalityId`
7. `POST /api/admin/municipalities/:id/access-code`
8. `POST /api/reports`
9. `POST /api/reports/:id/notes`
10. `POST /api/reports/:id/updates`
11. `POST /api/auth/register`
12. `POST /api/auth/login`
13. `POST /api/admin/register`
14. `POST /api/admin/login`

Reconfirm route counts against `server/index.js` at execution time. Do not include DELETE, PATCH, OPTIONS, or implicit HEAD routes as discovered GET/POST endpoints. Unsupported methods may be documented as cross-cutting checks, but distinguish framework fallback behavior from an explicit API contract.

## Required Document Content

Create a Windows Notepad-compatible plain-text file with a title, table of contents, numbered sections, consistent separators, and these sections:

1. Project and API Overview
2. Testing Scope and Objectives
3. Test Environment and Execution Instructions
4. GET Endpoint Inventory
5. POST Endpoint Inventory
6. Authentication and Authorization Model
7. Detailed GET Test Cases
8. Detailed POST Test Cases
9. Cross-Cutting Authentication, Validation, and Error-Handling Cases
10. Test Coverage Summary
11. Known Limitations and Items Requiring Confirmation

Document every discovered GET and POST endpoint. For every endpoint, include applicable success cases and failure/access-control cases. Include no-auth, invalid/expired auth tests where relevant; for public endpoints explicitly state that auth is not required and unauthorized roles are not applicable. Include valid and nonexistent IDs for path routes; distinguish invalid parameter shape from no matching record. Include filtering/search cases for `GET /api/reports` (`category`, `status`, `search`) and optional `municipalityId` for `GET /api/admin/reports`. Explicitly say there is no pagination/sorting in the implementation. Do not create imaginary parameters for endpoints that ignore query strings.

Each test case must use exactly these named fields, in this order, leaving ACTUAL RESULT empty and setting EXECUTION STATUS to `Not Executed`:

TEST CASE ID:
MODULE:
TEST CASE TITLE:
HTTP METHOD: GET or POST
ENDPOINT:
TEST CATEGORY:
PRIORITY:
TEST OBJECTIVE:
PRECONDITIONS:
AUTHENTICATION REQUIREMENTS:
REQUEST HEADERS:
PATH PARAMETERS:
QUERY PARAMETERS:
REQUEST BODY:
TEST STEPS:
EXPECTED HTTP STATUS CODE:
EXPECTED RESPONSE BODY:
EXPECTED DATABASE RESULT:
ACTUAL RESULT:
EXECUTION STATUS: Not Executed
REMARKS:

Use unique IDs such as `GET-HEALTH-001`, `GET-REPORT-001`, `POST-AUTH-001`, `POST-REPORT-001`, and `POST-STAFF-001`. Give all cases realistic JSON payloads based on route validation. Use clearly fake test identities/data (for example, `qa.resident@example.test`) and token placeholders only.

## Source-Derived Behavior to Preserve

- Express uses `express.json({ limit: '5mb' })`; CORS, Helmet, cookie parsing, an unsafe-cookie-request Origin check, and rate limiters are global or route middleware. Auth/bootstrap routes are limited to 10 requests/15 minutes; report creation 10/hour; location resolution 30/minute; access-code verification 8/15 minutes. Avoid relying on rate limits in normal case execution; label rate-limit tests as requiring isolated client/IP state.
- Auth cookie name is `msr_session`; tokens are one-hour JWTs. API accepts bearer tokens too. Never include a real token. Resident password length 12-128; names 2-120; email uses a basic `^\\S+@\\S+\\.\\S+$` server pattern. Staff registration checks configured invitation key before required account fields. Bootstrap checks configured token before fields and can succeed once only.
- `GET /api/auth/session` returns 200 `{ "user": null }` for absent/invalid/expired sessions; a missing/inactive account also clears the cookie. Database lookup failure is 503.
- `POST /api/auth/logout` requires no authenticated role and returns 200 `{ "message": "Signed out" }`; with a session cookie, an unapproved/missing Origin is rejected by the preceding unsafe-cookie request middleware.
- `GET /api/health` returns 200 `{status:"ok", reportsCount, timestamp}` and 503 `{status:"unavailable"}` on count lookup failure. `GET /` returns 200 with status/message/phase.
- `GET /api/reports` is public, supports case-insensitive `category`, `status`, and `search`, returns 200 `{reports:[...]}`, and has no pagination or sorting. Invalid filter values are not rejected; they ordinarily produce an empty list. Public report shaping omits resident identity and staff-only fields. `GET /api/reports/:id` returns 404 `{message:"Report not found"}` for no match or 200 `{report:...}`; public response is redacted.
- `GET /api/my/reports` requires resident role, returns only owner-scoped reports, and returns 401 without authentication / 403 for non-residents. It filters sensitive public fields.
- `GET /api/admin/reports` accepts staff/super-admin authentication, but operational staff require assigned, active, access-code-verified municipality scope; staff report results are scoped. Super-admin may pass optional `municipalityId`; unknown municipality identifiers are not validated and produce no matches where storage permits. Successful response is 200 `{reports:[...]}`. Unauthenticated is 401, resident is 403, invalid/missing staff scope is 403.
- `GET /api/staff/municipalities` requires staff/super-admin. Staff sees active assigned municipalities and possibly `verifiedMunicipalityId`; super-admin sees active directory records. Public municipality shaping omits access-code hashes/versions and boundary data. Resident is 403, anonymous is 401.
- `GET /api/admin/municipalities` and `/api/admin/staff` require super-admin. First refreshes official MDB list and persists/upserts municipalities, so successful GET has an external read and municipality upsert side effect; second returns staff and assigned municipality metadata without secrets. Staff/resident are forbidden; provider/database errors use route-specific 503.
- `GET /api/staff/directory` and `GET /api/admin/reports/:id` use `requireOperationalStaff`: municipal staff only (super-admin is explicitly rejected here). Both require verified municipality access. Staff directory returns active staff assigned to current municipality. Staff report detail returns 404 if nonexistent and 403 for cross-municipality access.
- `GET /api/categories` is public; success is 200 `{categories:[...]}`. Database errors are 500.
- `POST /api/location/resolve` requires resident role and JSON numeric latitude/longitude. Missing/wrong type is 400; unresolved/out-of-bound location is 422; service exception is 503; success 200 `{location:...}` and may upsert municipality. It calls external location services.
- `POST /api/staff/municipalities/:id/verify-access` requires operational staff (super-admin rejected), assignment, active municipality, configured scrypt access-code hash, and correct `accessCode`. Unassigned/unconfigured is 403; wrong/missing code is 401; success is 200 `{message, municipality}` and sets a scoped cookie/audit record; hash/version/boundary data are not exposed. It is rate limited.
- `POST /api/staff/municipality/lock` requires staff or super-admin token, strips municipality scope from the new cookie, and returns 200 `{message:"Municipality workspace locked."}`. A resident is 403.
- `POST /api/admin/bootstrap` is token-gated, does not require an existing session, creates first super-admin exactly once, validates name/email/password, hashes password, and returns 201 `{message,user}` plus HttpOnly cookie. Missing configuration is 503; wrong token 403; invalid fields 400; completed bootstrap or duplicate email 409; server failure 500.
- `POST /api/admin/register` is invite-key gated. Missing server invite configuration is 503; invalid key 403; then requires name/email/password; duplicate email 409; success 201 `{message,admin}` and cookie. Password is 12-128; name 2-120; email pattern above. `POST /api/admin/login` requires email/password, returns 400 if missing, 401 for invalid/inactive account, 200 `{message,admin}` and cookie on success.
- `POST /api/auth/register` requires name/email/password, optional phone, validates length/email, returns 400 for missing/invalid, 409 duplicate, 201 `{message,user}` and cookie on success. `POST /api/auth/login` requires email/password (400 missing, 401 invalid), returns 200 `{message,user}` and cookie on success. Database lookup errors return 503. Returned account objects do not contain password/hash/token.
- `POST /api/admin/staff/:staffId/municipalities/:municipalityId` requires super-admin; requires active staff role and active municipality. Invalid/missing/inactive references return 404; duplicate assignment is idempotent and still 200 `{message}`. Writes assignment and audit record. Anonymous 401, other roles 403.
- `POST /api/admin/municipalities/:id/access-code` requires super-admin, existing municipality (404), and trimmed code length 8-128 (400). Success 200 `{message}` only; stores scrypt hash, increments access-code version, invalidates existing scoped sessions, and audits; clear code must never be returned.
- `POST /api/reports` rate-limited and resident-only. Required title (non-empty <=160), description (non-empty <=5000), one of 11 categories, location object with numeric coordinates in bounds, optional one of Low/Medium/High/Critical priority, optional JPEG/PNG/WebP base64 data URL capped at 4,200,000 chars. Invalid payload 400; missing auth 401; unresolved boundary 422; inactive municipality 422; location provider failure 503; success 201 `{message,report}` with API-derived owner and location. Client-provided owner/name/status must not override authenticated identity/default initial status. No report should be created on validation or resolution failure.
- `POST /api/reports/:id/notes` is staff-only and scoped; note text 1-4000 chars. Empty/too long 400; nonexistent report 404; cross-municipality/invalid scope 403; success 201 `{note,report}`. Note is private and must not appear in public/resident responses.
- `POST /api/reports/:id/updates` is staff-only and scoped; requires text 1-4000 chars and one of six valid statuses. Invalid input 400; nonexistent report 404; cross-scope 403; success 201 `{update,report}`. Resident update is public to report viewers but omits update `authorId` from redacted public shape.
- Status and response behavior above follows explicit source branches. For malformed JSON, unsupported media types, unhandled parser errors, HEAD behavior, and default Express 404 responses, document them only as exploratory cases with expected result marked “requires execution/confirmation” unless a test or explicit middleware proves the exact response.
- POST endpoints without a request-body check (logout and municipality lock) accept an empty JSON body or no body; tests should verify behavior without inventing required fields.
- Database expectations must be reversible and isolated. For reads, name the fixture rows/filters/owner/scope and expected record counts/IDs using fake data. For writes, state exact intended insert/update/audit effect or “no database change expected.” Do not run these test cases while writing documentation.

## Constraints

- Do not modify application code, SQL, database records, JSON store, environment files, or existing unrelated documentation.
- If the requested output file exists at execution time, inspect/update it rather than creating another.
- Every test case must have all required fields; ACTUAL RESULT is empty and EXECUTION STATUS is `Not Executed`.
- Do not claim the tests were executed. Document expected results from source and clearly mark uncertain parser/framework behavior.
- At completion, verify all route counts and unique IDs, report the number of GET endpoints, POST endpoints, and documented test cases, mention checks run and unresolved behavior, and link the requested file.
