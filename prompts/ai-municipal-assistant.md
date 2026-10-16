# Implementation Prompt: AI Municipal Help Assistant

## Objective

Replace the current resident-to-staff live-support experience with a genuine,
server-backed AI assistant for the Municipal Service Issue Reporter. The AI is the
responder. Do not add or retain a resident-to-staff live-chat workflow in the UI or API.
Do not deploy the application or connect to/migrate an existing production database.

## Existing project context

- The repository uses a Next.js/React/TypeScript client and an Express API.
- Authentication is cookie-based and server-verified. Reports are persisted through the
  API using PostgreSQL in production and an isolated JSON file store in local development
  and tests.
- The shared root layout currently mounts `LiveSupportChat`. That widget uses Socket.IO
  and `/api/chat/conversations...` routes for resident/staff messages; a staff inbox is at
  `/admin/support`.
- Migration `003_support_chat.sql` defines staff-support conversations and messages. Its
  opt-in is documented and no production database migration is authorized.
- Existing sources of truth include `/api/categories`, `/api/my/reports`, report detail
  access checks, report statuses, and the reporting UI. Inspect these before writing any
  assistant guidance; do not invent functionality, statuses, priorities, or municipal
  policies.
- Preserve unrelated worktree changes, especially the current map work.

## Product and UI

1. Replace the floating support launcher/panel with one reusable floating assistant
   widget, mounted once from the shared layout. Label it clearly as an AI assistant and
   make it clear that answers are AI-generated, not replies from municipal staff.
2. Preserve the existing design system and responsive behavior. The panel must not block
   map controls, legends, report forms, navigation, or other page interactions. Opening or
   closing it must not reset page state.
3. Include a welcome message, source-accurate suggested questions, user/assistant message
   bubbles, typing/loading state, auto-scroll, empty/error/retry states, and a new
   conversation action. Enter sends; Shift+Enter inserts a newline.
4. Suggested questions must be sent as ordinary user messages and reflect real application
   capabilities. Provide clear navigation to the formal report submission workflow for
   users who want to report a new problem.
5. Remove the staff support inbox page and its navigation/entry points, and remove or
   retire staff-facing routes that send/reply to resident conversations. Do not silently
   leave an alternate human-chat surface available. Keep unrelated staff report triage and
   administrative features unchanged.

## AI provider and server behavior

1. Use the official OpenAI API from the Express server, using Node's built-in `fetch`
   unless the project already contains a suitable provider integration. Add only secret-free
   configuration examples such as `OPENAI_API_KEY` and `OPENAI_MODEL`; never expose
   provider credentials to the client or log secrets/private conversation contents.
2. Do not return canned responses when the provider is unavailable or unconfigured. Return
   a clear, non-sensitive API error the UI can render with a retry action. Handle provider
   timeout, non-success responses, malformed/empty output, and rate limits explicitly.
3. Keep provider calls server-side; apply server-side input length validation and rate
   limiting. Bound conversation history sent to the model. Treat user messages and report
   fields as untrusted data, not instructions. Enforce access in application code rather
   than relying on the model.
4. Create a municipal-help system instruction grounded in the actual application. It must
   identify itself as AI, explain supported reporting and account flows, use only real
   categories/statuses/rules, request clarification when useful, admit uncertainty, and
   never assert that a report was submitted, changed, or resolved without verified data.
   Do not have the model perform report mutations or administrative operations.

## Report assistance and privacy

- Authenticate requests using the existing server session. Persist conversations against
  the verified account ID and enforce ownership on every read/write.
- If a user asks about a specific report, require a report reference when needed and resolve
  it server-side only against reports the current resident is authorized to see. Pass the
  model only a minimal sanitized view of that authorized report (for example, reference,
  category, status, resident-visible description, municipality, and resident-visible
  updates). Never include reporter secrets, staff-only notes, assignments, another
  resident's report, or unrestricted admin data in the prompt.
- Keep report lookup deterministic and authorization-enforced by the backend; do not allow
  the model to choose arbitrary records or invoke privileged tools. If access or lookup
  fails, explain that no verified information is available.
- Provide authenticated conversation listing/history, message retrieval, and a
  new-conversation flow. Do not store unnecessary personal information.

## Persistence and migration

- Use a distinct AI-assistant conversation/message storage model and migration rather than
  mixing AI history with the existing staff-support tables. Leave migration 003 and any
  legacy support data intact; never send legacy staff-support conversation content to the
  AI provider.
- Provide equivalent isolated file-store behavior for local development and tests, following
  current storage patterns. Production must continue to require PostgreSQL.
- Gate the new schema migration with a dedicated opt-in setting, document disposable
  PostgreSQL verification, and do not enable or apply it to any configured deployment
  database.

## API and frontend contracts

- Define a small authenticated assistant API for listing/creating conversations, reading
  authorized history, and sending a message and receiving its actual AI response.
- Validate conversation IDs, body shape, text length, and report references on the server.
- Keep client state in React/context or component state; do not persist auth tokens,
  credentials, or report/conversation data in localStorage.
- Render assistant output as text or use a safe, established sanitizer if rich rendering is
  necessary. Never inject unsanitized model output as HTML.
- Remove the Socket.IO client dependency/use for the retired resident/staff support feature
  only if no other application feature depends on it; verify usage before changing packages.

## Tests and acceptance criteria

Add backend tests using a mocked provider fetch (no real API key/network call) for:

- authenticated message send and genuine provider response handling;
- unauthenticated rejection, conversation ownership/isolation, and history retrieval;
- authorized own-report context and rejection/omission of another resident's or
  staff-private report data;
- empty/invalid/oversized input, provider timeout/error/malformed output, and rate limits;
- new conversations and file-store/PostgreSQL helper behavior where applicable.

Run the relevant client lint/build and backend tests. Verify the shared widget appears only
once, works at desktop/mobile sizes, suggested questions send normally, and the existing
map/report/auth/navigation flows remain usable. Verify a fresh isolated instance still has
zero reports and zero map pins.

Document the chosen provider, required environment variables, new API routes, migration
gate/verification process, local run instructions, tests performed, and remaining need for
an operator-supplied AI API key. Do not print `.env` values, deploy, or run any migration
against a non-disposable database.
