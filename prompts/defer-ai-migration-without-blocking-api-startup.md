# Implementation Prompt: Keep the API Available While AI Migration 004 Is Pending

## Objective

Prevent a pending, explicitly gated AI-only migration from terminating the entire
PostgreSQL-backed API during startup. Preserve the migration approval gate: never enable,
execute, or modify migration 004. When its tables are unavailable, assistant endpoints must
fail safely and clearly while unrelated API functionality starts normally.

## Observed failure

The supplied Render log reports:

`004_ai_assistant.sql is pending. Verify it on a disposable PostgreSQL database and explicitly enable it with ENABLE_AI_ASSISTANT_MIGRATION=true before applying.`

`server/db.js:initDatabase` throws for every unapplied migration with an unset opt-in flag.
`server/index.js` treats any database initialization error as fatal when PostgreSQL is
enabled, closes the pool, and exits without listening. Thus pending assistant-only schema
blocks the whole Render API. `server/.env.example`'s `MAIN_API_BASE_URL` loopback value is a
local-development default; it is not the cause of this startup failure and must not be used
as Render production configuration.

## Required implementation

1. Read and preserve the current worktree. A `server/data/store.json` change is present and
   is outside this task: do not read, overwrite, revert, or otherwise modify it.
2. Change migration selection/initialization so **only** an unapplied `004_ai_assistant.sql`
   with `ENABLE_AI_ASSISTANT_MIGRATION` unset/false is skipped safely, with a concise,
   non-sensitive startup warning that AI conversation persistence is unavailable until the
   migration is separately approved and applied.
3. Do not skip, defer, weaken, or silently ignore any other migration guard (including 002).
   Keep existing behavior when the AI migration flag is explicitly true. Do not change any
   migration SQL, set the flag, access PostgreSQL, or apply any migration.
4. If migration 004 was skipped and its tables do not exist, authenticated assistant API
   requests must fail closed with a clean HTTP 503 response. They must not fall back to
   file-store data, create tables, return empty success-shaped histories, or expose SQL,
   database, provider, cookie, or credential details. Keep non-assistant API routes
   available.
5. Update only relevant API/deployment documentation: Render can start with migration 004
   pending, but persistent AI chat remains unavailable until disposable-database verification
   and separate approval. Keep instructions explicit that operators must **not** set
   `ENABLE_AI_ASSISTANT_MIGRATION=true` just to make startup succeed. If other migration
   gates are pending, they can still independently prevent startup.

## Testing and safety

- Add isolated tests proving pending migration 004 is deferred when disabled, enabling it
  continues to require explicit opt-in, and pending non-AI migrations still fail closed.
- Test that absent assistant tables result in safe 503 responses without false empty
  histories, while ordinary health/auth/report API behavior is not blocked by the pending
  AI-only migration.
- Run the focused server test suite and `git diff --check`.
- Use mocks/isolated local file storage only. Do not print or inspect `.env` values, use any
  configured database, connect to Render/Neon, apply migration 004, deploy, or change
  `server/data/store.json`.
- Report accurately that the supplied Render log identifies the startup gate, that no
  production database or deployment action was performed, and any remaining independent
  startup gates.
