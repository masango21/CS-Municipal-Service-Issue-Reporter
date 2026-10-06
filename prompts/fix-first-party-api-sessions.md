# Fix First-Party API Sessions

## Goal
Keep the required HttpOnly session-cookie authentication working in modern browsers by making browser API requests same-origin with the Next.js frontend, rather than relying on third-party cookies between Vercel and Render.

## Evidence
- The hosted screenshots show client-held signed-in identities while protected API requests return `Authentication is required`.
- All client API calls currently target `NEXT_PUBLIC_API_BASE_URL` directly and use `credentials: "include"`.
- Production uses Vercel and Render hostnames, which are cross-site; browser privacy settings can block the API's third-party session cookie even with `SameSite=None`.
- The installed Next.js version supports external rewrites as URL proxies.
- The API has exact-origin CORS and origin validation for unsafe cookie-authenticated requests; these controls must remain intact.

## Scope
- Configure a Next.js external rewrite for `/api/:path*` to the API origin configured by `NEXT_PUBLIC_API_BASE_URL`, with the existing local API origin as the development fallback.
- Update all browser API call sites to request relative `/api/...` paths so the browser only communicates with its own origin. Preserve `credentials: "include"` and all request behavior.
- Ensure the proxy target is a configured API origin, not user-controlled input, and preserve the incoming cookie and `Origin` headers required by server authentication and CSRF validation.
- Keep HttpOnly cookie sessions, role checks, exact API origin allowlists, and server-side password hashing. Do not move tokens into localStorage or remove cookie authentication.
- Update deployment documentation to describe the same-origin proxy and retain the direct cross-site cookie caveat for clients that bypass it.
- Do not deploy, change hosted provider settings, modify database contents, or expose environment values.

## Acceptance Criteria
- In local development, browser requests to `/api/auth/session` and `/api/reports` are served through the Next.js origin and reach the local API.
- In production builds, `/api/...` requests are proxied to the configured API origin without exposing the API origin in browser request URLs.
- A login response's HttpOnly cookie is stored for the frontend origin and sent back through the proxy on refresh and protected requests.
- The proxy preserves the original `Origin` on unsafe requests so the API's existing CSRF allowlist continues to work.
- No browser API call site continues to construct absolute requests to the API origin.
- The fresh-data rule remains intact: zero reports and zero pins until a resident submits one.

## Verification
- Run `npm run build --prefix client` and `npm test --prefix server`.
- Start `npm run dev`; verify `/api/auth/session` and `/api/reports` through `http://localhost:3000` return API responses.
- Verify a credentialed cookie login, page refresh, and protected resident/staff requests using the same-origin frontend URL.
- Confirm no new CORS wildcard, localStorage token, authorization bypass, database migration, or live deployment is introduced.
