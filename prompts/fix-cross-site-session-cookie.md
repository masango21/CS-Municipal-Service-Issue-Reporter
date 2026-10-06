# Fix Cross-Site Production Sessions

## Goal
Make resident, staff, and super-admin API requests remain authenticated when the frontend is hosted on Vercel and the API is hosted on Render.

## Evidence
- The screenshots show signed-in identities in the client, while protected API calls return `Authentication is required`.
- The client sends API requests with `credentials: "include"` and receives user identity in application state after login.
- Production session cookies are `Secure` and `HttpOnly`, but `SESSION_COOKIE_SAME_SITE` defaults to `lax`.
- Vercel and Render default hostnames are cross-site. `SameSite=Lax` does not send the session cookie with those cross-site fetch requests.
- The API already limits credentialed CORS to configured `CLIENT_ORIGIN` values and rejects cookie-authenticated unsafe requests from unapproved origins.

## Scope
- Configure the Render blueprint to use `SESSION_COOKIE_SAME_SITE=none` for the current cross-site Vercel/Render hosting arrangement.
- Keep production cookies `Secure` and `HttpOnly`; do not weaken CORS or the existing origin check for unsafe requests.
- Update deployment instructions to explain that `SameSite=None` enables cross-site requests only when browser privacy settings allow third-party cookies, and that same-site custom domains are the more robust deployment option.
- Do not deploy, change hosted provider settings, inspect or print secrets, or modify any database or report data.

## Acceptance Criteria
- The Render blueprint sets `SESSION_COOKIE_SAME_SITE=none` for cross-site hosting.
- Production login responses continue to set the session cookie with `Secure` and `HttpOnly`, and clear-cookie settings match.
- Credentialed requests from configured Vercel origins continue to pass the existing exact-origin CORS and CSRF checks.
- Deployment docs explain the browser restriction and same-site custom-domain alternative.
- No authentication roles, authorization rules, report data, or deployment secrets are changed.

## Verification
- Run `npm test --prefix server`.
- Inspect the cookie configuration and Render blueprint to confirm `SameSite=None` is paired with production `Secure` and the cookie remains `HttpOnly`.
- After a separately approved deployment, log in as a temporary resident and staff account, refresh their dashboards, and confirm session-backed API calls succeed. Verify logout clears the cookie.
