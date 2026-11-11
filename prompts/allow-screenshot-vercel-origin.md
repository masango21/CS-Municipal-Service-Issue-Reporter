# Implementation Prompt: Allow the Report Page's Vercel Origin

## Finding

The screenshot shows the report form at
`https://cs-municipal-service-issue-reporter-p2rqt32e9.vercel.app`. Its location request
returns `A valid same-origin request is required`. The API checks the browser's exact
`Origin` against `CLIENT_ORIGIN`, and the committed Render Blueprint does not include this
host. The screenshot and repository configuration support an origin-allowlist mismatch;
do not infer that the running Render environment matches the committed Blueprint without
provider access.

## Objective

Add only the screenshot's exact HTTPS origin to the Render Blueprint `CLIENT_ORIGIN`
allowlist, preserve existing entries, and update deployment documentation to identify the
added origin and explain that syncing the Blueprint and restarting/redeploying the API are
separate operator steps.

## Constraints

- Keep exact-origin matching. Do not add a wildcard, Vercel suffix matcher, regex, or broad
  preview-host allowance.
- Do not change the CSRF/origin-check implementation, CORS behavior, auth, report handling,
  or map/location logic.
- Do not inspect or edit real `.env` files, print environment values, access provider
  dashboards, call production endpoints, access databases, alter report data, or deploy.
- Preserve unrelated worktree changes.
- Do not claim the running service is fixed by editing repository configuration alone.

## Verification

- Confirm the exact screenshot origin is added once and all existing exact origins remain.
- Confirm deployment documentation explains the need to sync the Blueprint and restart or
  redeploy the API, and notes that ephemeral preview origins change.
- Run `git diff --check` and inspect the focused diff.

## Acceptance Criteria

- The committed Blueprint trusts the screenshot's exact HTTPS origin and no other new
  origin.
- Existing origin restrictions and API security behavior remain unchanged.
- The operator is clearly told that the running Render service needs a separate approved
  configuration sync/restart before the report request can succeed.