# Implementation Prompt: Let Super Admin Set Staff Access Codes

## Goal
Allow an authenticated super admin to choose, save, and replace a municipality staff access code from the existing municipality administration page. Preserve the current generated/reset flow, municipality assignment checks, session invalidation, JSON file-store support, PostgreSQL support, and the rule that plaintext codes are shown only to the requesting super admin and never persisted or logged.

## Current Findings
- `client/app/admin/municipalities/page.tsx` currently exposes only `Generate / reset access code` and displays the returned one-time code.
- `client/lib/municipalities.ts` has `generateMunicipalityAccessCode` but no custom-code API helper.
- `server/index.js` owns the super-admin municipality route and hashes generated access codes with the existing scrypt helper before saving.
- Municipality records already contain `accessCodeHash` and `accessCodeVersion`; resetting a code invalidates existing verified staff sessions.
- JSON storage and PostgreSQL are both supported. Do not connect to or migrate the existing production database.

## Required Changes
1. Add a super-admin-only API operation, preferably alongside the existing generate/reset endpoint, accepting a custom access code. Validate it server-side with a bounded length and clear strength requirements; reject blank, oversized, or obviously invalid values without revealing stored hashes.
2. Hash custom codes with the existing scrypt helper and persist only the hash. Increment the existing access-code version so previously verified staff sessions are revoked. Keep authorization and municipality existence checks consistent with the current endpoint.
3. Keep the generated-code endpoint behavior intact, including one-time plaintext response behavior. Do not return custom codes from GET/list endpoints or store them in audit logs.
4. Add a client API helper and an accessible input/control in the selected municipality panel. Make the save action explicit, clear the input after a successful save, show the returned success/error state, and avoid displaying the saved plaintext code after the request completes. Preserve the existing generated-code display and copy action.
5. Add focused tests for: super admin can save a custom code; the file store contains only a hash; the custom code verifies for an assigned staff member; the prior verified session is revoked after replacement; staff/residents cannot save codes; invalid input is rejected; and generated-code behavior remains intact. Add PostgreSQL query coverage only if it matches existing test conventions and does not require a real database.
6. Update relevant safe documentation or environment examples only if needed. Never print or commit secrets, alter demo data, deploy, or run migrations against production.

## Acceptance Checks
- `npm test` from `server/` passes.
- `npm run lint` and `npm run build` from `client/` pass.
- A fresh local store still starts with zero reports and zero pins.
- Plaintext custom codes do not appear in persisted JSON, database fields, API list responses, or logs.
- Only a super admin can save or replace a municipality code; assigned staff can verify the saved code; old verification is denied after replacement.

Keep the implementation small, use existing route/auth/storage patterns, and do not refactor unrelated workflows.
