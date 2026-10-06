# Fix PostgreSQL Staff Assignment and Public Update Identity

## Goal

Fix two issues found during local end-to-end testing without changing deployment configuration or touching live production resources.

## Required changes

1. Make report triage resolve `assignedStaffId` from the configured persistence backend. PostgreSQL-backed requests must look up the staff member in `staff_users`, while file-store development/tests must continue using the file store. Preserve the existing 400 response for unknown staff IDs and persist both the ID and display name when found.
2. Ensure resident/public report responses do not expose internal staff identifiers embedded in `residentUpdates`. Keep the public update text, status, timestamp, and generic author display name. Keep author identity available only in authenticated staff views if those views currently need it. Do not expose staff notes, reporter identity, or resident ownership data in public responses.
3. Add focused tests for the public serialization contract and staff assignment behavior. Keep the existing file-store coverage; use a practical isolated test seam for PostgreSQL lookup behavior, without depending on a live or production database.

## Constraints

- Do not seed reports, alter schema, run migrations, connect to or modify a live database, or deploy.
- Keep changes limited to the server persistence/serialization paths and their tests.
- Preserve existing API routes and response shapes except removal of the internal update author ID from public payloads.
- Run `npm test` from `server/` and report results. Do not fix unrelated lint findings as part of this change.
