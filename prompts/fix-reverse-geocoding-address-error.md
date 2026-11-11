# Implementation Prompt: Fix Reverse-Geocoding Address Lookup Failure

## Goal

Diagnose and fix the report form's “Address could not be detected. The selected
coordinates and municipality are confirmed.” state. Preserve the authoritative map
coordinates and MDB municipality result; do not fabricate or guess a street address.

## Evidence and current behavior

- `client/app/report/page.tsx` shows the warning when location resolution succeeds but
  `selectedLocation.address` is empty.
- `server/location.js` resolves the MDB boundary and reverse geocoder independently.
  Reverse-geocoder errors and responses without `display_name` are converted into an
  empty address, so the client cannot distinguish an unavailable provider from a
  valid result without a street-level address.
- The default reverse geocoder is OpenStreetMap Nominatim. Its endpoint and identifying
  User-Agent/contact are configurable server-side. The public service has a strict
  usage policy and is not an unlimited production geocoder.
- The repository has unit coverage for successful geocoding, caching, and geocoder
  failure, but no coverage for malformed/empty responses or safe failure diagnostics.

## Requirements

1. Trace the address lookup from the map selection through `/api/location/resolve`,
   `server/location.js`, and the report form. Determine the actual failure class that
   can be established safely; do not claim a provider outage or rate limit without
   evidence.
2. Fix the reverse-geocoding request/response handling for the configured provider and
   make the failure state actionable. Distinguish provider/network failure from a
   successful response that simply lacks a usable address, without exposing internal
   endpoint details or secrets to residents.
3. Keep the existing provider configurable. Do not silently add or switch to another
   provider, require an API key, or send production requests during implementation.
   If a provider change or production configuration is required, stop and ask for
   separate approval rather than inventing credentials or configuration.
4. Preserve true latitude/longitude and authoritative municipality behavior. Never
   synthesize a street address from coordinates, never block a valid report solely
   because street-address lookup failed, and never hide a real failure with a
   success-shaped fallback.
5. Keep Nominatim usage policy in view: preserve caching and application-level request
   throttling, use a valid identifying User-Agent/contact configuration, and document
   the operational requirement without exposing contact details or changing deployed
   environment values.
6. Add focused tests for successful geocoding, no usable address in a successful
   response, provider HTTP/network/invalid-response failures, safe diagnostics, and
   retained confirmed coordinates/municipality. Keep tests isolated and mocked.
7. Preserve all unrelated report, authentication, map, database, and staff behavior.
   Do not inspect or edit real `.env` files, read or modify report data, connect to a
   production database, alter the API process on port 4000, or deploy.

## Validation

- Run the focused location and API tests, then the smallest relevant lint/type-check
  and production build checks available.
- Run `git diff --check`.
- Inspect the final diff and confirm no real environment files, deployment settings,
  database objects, report data, or unrelated API behavior changed.
- Report the diagnosed cause only to the extent supported by the tests or observed
  response. If the deployed provider configuration or availability is required to
  complete the fix, identify that as a separate operator action.

## Acceptance criteria

- The warning no longer masks an actionable distinction between lookup failure and a
  successful result without an address.
- Confirmed coordinates and municipality remain accurate and usable.
- No address is invented and no provider is silently changed.
- Focused mocked tests cover success and failure behavior; no production service or
  database is contacted or modified.
