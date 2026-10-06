# Complete Project Verification

## Goal
Close the remaining completion gaps without overwriting existing local data, using production credentials, or expanding product scope.

## Current evidence
- The tracker lists live staff login/triage browser verification as the only unchecked item.
- The project contract still describes the frontend-only phase, while the tracker describes backend and later phases as complete.
- The local server file store has zero reports and one existing account; tests must not run against or reset that store.
- The server's declared `dotenv` dependency is not currently installed.

## Work
- Install server dependencies from the existing lockfile without editing dependency manifests.
- Run the API test suite against an isolated disposable copy/store; preserve the real local store and `.env` exactly.
- Run the client production build and focused lint for any touched files.
- Verify the zero-report/zero-pin state and resident/admin entry paths.
- If staff flow verification is safe, use a disposable file store and temporary account/report fixtures; do not connect to Neon, create production records, or keep test records.
- Reconcile the tracker and project contract with the controlling `AGENTS.md` scope. Do not claim deployment or production readiness without evidence.
- Do not modify, print, commit, or transmit any `.env` values.

## Verification and closeout
- Confirm backend tests pass in isolation and the client builds.
- Confirm the real file store is unchanged and still has zero reports.
- Record any live checks that remain blocked, with exact reason and next step.
