# Implementation Prompt: Fix Report Submission Detail 404

## Goal
After a resident submits a valid report, ensure the app opens the detail page for that exact report instead of showing Next.js 404.

## Evidence and Likely Causes
- `client/app/report/page.tsx` calls `addReport()` and immediately navigates using the returned optimistic local report ID.
- `ReportsContext.addReport()` later replaces that temporary ID with the server's canonical ID, but the browser URL is not updated.
- `ReportsProvider` loads reports asynchronously on mount and can replace the current list after a new report was added, dropping that report from context.
- The API can be temporarily unavailable; local fallback behavior must still allow the newly submitted report's detail page to work.

## Scope
- Make report creation expose a stable result that the submit flow can navigate to only after the create attempt has settled.
- When the API succeeds, use the canonical server report and its ID for the detail route and shared state.
- When the API fails, preserve the optimistic/local report and route to its local ID without losing it during initial report hydration.
- Ensure asynchronous bootstrap cannot overwrite reports added or changed while the request was pending. Reconcile remote data with the latest local/context state rather than replacing newer local mutations.
- Ensure the detail route treats a not-yet-loaded report collection as loading, and only shows not-found after loading completed and the requested ID is confirmed absent.
- Preserve the zero-report startup rule; do not seed reports, alter the report schema, or change staff/resident authorization.
- Keep the implementation localized to the report context, report submission flow, and detail loading state as needed.

## Acceptance Criteria
- Submitting a resident report with API available navigates to its canonical persisted report ID and displays its details.
- Submitting with API unavailable retains the local report and displays its details using its local ID.
- A report created while the initial list request is pending remains in shared state after hydration completes.
- The detail page never shows a transient 404 for a report that is still being loaded or just submitted.
- A truly nonexistent report ID eventually displays the existing not-found experience.
- Fresh app startup still has 0 reports and 0 pins.
- Client production build succeeds.

## Verification
Test a real resident submission with the API responding successfully, then with the API unavailable/file-store fallback. Add a controlled delayed initial report-list response and verify a report submitted during that delay remains visible. Confirm the resulting URL ID matches the displayed report, verify a truly invalid ID still becomes not-found, and run `npm run build` from `client/`.