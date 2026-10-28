# Implementation Prompt: Allow the Current Vercel Preview Origin

## Finding

The report page screenshot shows `A valid same-origin request is required` while opened at
the Vercel preview origin:

`https://cs-municipal-service-issue-rep-kduvpdqcv.vercel.app`

The API's global CSRF origin guard rejects cookie-authenticated write requests when the
browser `Origin` is not an exact member of `CLIENT_ORIGIN`. The committed Render Blueprint
currently lists only two earlier Vercel origins. This same guard applies to report and map
requests.

## Objective

Update the repository's Render Blueprint allowlist to include only the exact Vercel preview
origin shown above, preserving both existing origins. Clarify in deployment documentation
that this repository change does not update a running Render service automatically and that
ephemeral preview origins may need to be changed again or replaced with a stable approved
Vercel domain.

## Constraints

- Do not change the CSRF/origin-check implementation or replace the allowlist with a wildcard,
  suffix matcher, regular expression, or permissive origin.
- Do not inspect or edit `server/.env` or any other secret-bearing environment file.
- Do not access or modify Render/Vercel settings, deploy, publish, call production endpoints,
  access any database, enable or apply migration 004, or change report data.
- Preserve all unrelated worktree changes.

## Verification

- Confirm the Render Blueprint retains the two existing exact origins and adds only the
  screenshot's exact `https://` origin (no path or trailing slash).
- Run `git diff --check`.
- Explain that the user must separately synchronize the Render Blueprint / update
  `CLIENT_ORIGIN` and restart/redeploy the API after approval. Do not claim production is fixed.
