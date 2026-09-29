# Restore Server Environment Files

## Goal
Make the server's documented environment setup available again without restoring, exposing, or inventing real credentials.

## Changes
- Add `server/.env.example` with documented variable names and safe placeholder/blank values: `PORT`, `JWT_SECRET`, `ADMIN_REGISTRATION_KEYS`, `DATABASE_URL`, and `CLIENT_ORIGIN`.
- Add a local `server/.env` skeleton with the same variable names, clearly requiring the developer to replace secret placeholders before using staff auth.
- Update `server/.gitignore` to keep `.env` and `.env.*` ignored while explicitly allowing `.env.example` to be committed.
- Do not create actual secrets, database credentials, or staff invite keys.

## Verification
- Confirm the example template is visible/tracked while `.env` remains ignored.
- Confirm server setup documentation's copy instruction matches the files and variable names.
- Do not run the server with placeholder credentials or make requests that create accounts/reports.
