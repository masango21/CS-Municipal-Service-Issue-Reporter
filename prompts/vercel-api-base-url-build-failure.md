# Implementation Prompt: Clarify Vercel API_BASE_URL Build Configuration

## Finding

The Vercel build for commit `77e72e8` stops in `client/next.config.ts` before compiling
because production builds intentionally require a non-empty `API_BASE_URL`. The client
rewrites `/api/*` and `/api/assistant/*` to this backend origin. The check prevents a
successful production build whose API calls would target localhost or have no valid
destination.

`client/.env.example` contains only a local-development value. It does not configure the
Vercel project environment. The repository deployment guide already documents that Vercel
needs the variable; the failure most likely requires a Vercel project setting, not a code
fallback. The production backend URL was not available in the build log or inspected
configuration, so it must not be guessed.

## Objective

Make the deployment guidance more explicit for this exact build failure without weakening
the production validation or inventing an API URL. Do not change app behavior or try to
configure Vercel remotely.

## Changes

1. Add a concise troubleshooting note to `DEPLOYMENT.md` explaining:
   - The Vercel project Root Directory must be `client`.
   - `API_BASE_URL` must be added to the Vercel project's Environment Variables for every
     environment being deployed (Production, Preview, and/or Development as applicable).
   - Its value must be the operator's actual HTTPS origin for the deployed Express API
     (origin only; no `/api` suffix, path, credentials, or trailing route).
   - After saving, trigger a new deployment so the build receives the variable.
   - Do not use `localhost` in production and do not copy the local example value to Vercel.
2. Preserve the intentional production validation in `client/next.config.ts`; do not add a
   fake fallback, hardcode an API URL, add a `NEXT_PUBLIC_*` variable, or expose internal
   service configuration in browser code.
3. Do not read `.env` values, call Vercel APIs, change production settings, deploy, access
   production databases, or alter unrelated worktree changes.

## Verification

- Review the documentation diff and run `git diff --check`.
- Report that a successful deployment still requires the operator to enter the actual API
  origin in Vercel. Do not claim to have configured or deployed production.
