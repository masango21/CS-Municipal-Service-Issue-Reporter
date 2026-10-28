# Implementation Prompt: Remove the AI Assistant

## Goal

Remove the resident-facing AI assistant and its exclusively related client UI, API behavior, inference integration, configuration, and documentation while preserving all unrelated municipal reporting functionality and existing data.

## Existing implementation

- The assistant is mounted globally from `client/app/layout.tsx` and has a report-detail entry point in `client/app/issues/[id]/page.tsx`.
- `client/components/AIAssistant.tsx` calls `/api/assistant/*`.
- `server/index.js` registers assistant routes, local file-store conversation functions, assistant-only session forwarding helpers, and an assistant rate limiter.
- `server/ai-assistant.js` implements the Ollama provider.
- `server/db.js` exposes assistant conversation queries and conditionally applies `004_ai_assistant.sql`.
- Render, `.env.example`, README and deployment documentation contain assistant/Ollama/assistant migration configuration.
- Historical assistant conversations exist in `server/data/store.json`; do not read, edit, remove, or expose them.
- SQL migration `server/sql/migrations/004_ai_assistant.sql` creates assistant-specific tables. Preserve it and all existing database objects/data; do not connect to a database, apply/revert migrations, or drop tables.

## Requirements

1. Remove the global assistant widget and its report-detail entry point. Remove the assistant client component.
2. Remove `/api/assistant/*` routes, provider implementation, assistant-only middleware/helpers/rate limiter, and database query helpers. Preserve unrelated authentication and reporting code.
3. Remove the assistant-only Next.js rewrite while retaining the general `/api/*` rewrite.
4. Remove assistant-only Render variables, Ollama and assistant migration variables from `server/.env.example`, and assistant setup/configuration documentation. Remove obsolete assistant-specific implementation prompt files if they describe only this retired feature.
5. Remove `MAIN_API_BASE_URL` only if a full repository search confirms it served only the assistant integration.
6. Preserve legacy assistant conversation data in the JSON file store: removing its readers must not cause unrelated report/account writes to discard unrecognized legacy store fields. Do not edit the existing store file.
7. Preserve `004_ai_assistant.sql`, existing database tables/rows, and support-chat migration 003. Ensure migration 004 is permanently excluded from automatic migration selection, regardless of an environment flag; do not leave a switch that can re-enable it. Document that its existing schema/data are retained for separately approved retirement.
8. Keep the existing retired `/api/chat/*` behavior and other unrelated routes intact, but remove any stale message directing users to the AI assistant.
9. Do not modify real `.env` files, production services, deployment state, reports, authentication, maps, staff/admin logic, or the backend process on port 4000.
10. Remove assistant-only tests and add targeted tests that prove assistant endpoints are absent, migration 004 is never selected, and legacy store fields survive unrelated store updates.

## Validation

- Run client lint and production build. Use only a temporary `API_BASE_URL` process environment override if required; do not read or edit `.env`.
- Run server tests and `git diff --check`.
- Search source, deployment configuration, and current documentation for assistant UI/routes, Ollama/OpenAI integrations, and assistant-only settings. Any retained migration filename or archival database-data note must be intentional.
- Verify public registration/login, report browsing/details, maps and unrelated staff/admin route behavior with focused existing tests. Do not claim production browser checks if the backend is unavailable.

## Acceptance criteria

- No assistant UI or callable assistant API remains.
- Ollama/OpenAI integration and assistant-only deployment configuration are removed.
- Existing report/auth/map/admin behavior and data remain unchanged.
- Migration 004 and its existing conversation records are preserved and never automatically applied or deleted.
- Lint, build, server tests, and diff checks pass.
