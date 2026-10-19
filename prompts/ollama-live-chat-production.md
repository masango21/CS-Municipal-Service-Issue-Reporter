# Implementation Prompt: Prepare the Existing Ollama Assistant for Production

## Objective

Make the existing resident-facing AI assistant work through the project's deployed API
architecture and prepare its Ollama integration for production configuration. Reuse the
existing widget, Express routes, authentication, persistence, and model integration. Do not
create a second chat UI, duplicate API, or backend service. Do not deploy, access a production
database, or apply migration 004.

## Findings from repository inspection

- The shared Next.js layout already mounts `client/components/AIAssistant.tsx` once. It is
  resident-only and already provides a floating launcher, responsive panel, welcome message,
  suggested questions, timestamps, send/Enter behavior, loading state, error/retry, close,
  new conversation, and saved follow-up history.
- `server/index.js` already implements authenticated `/api/assistant/conversations` and
  `/api/assistant/conversations/:id/messages` routes. Requests are reauthenticated against
  the main API; only resident-owned conversations and reports are available. Inputs are
  bounded, responses are rate-limited, history is capped, and report context omits staff-only
  fields.
- `server/ai-assistant.js` already sends chat requests server-side to Ollama's `/api/chat`
  endpoint, uses `OLLAMA_MODEL=llama3.2:3b` in the example configuration, has a 90-second
  timeout, and returns safe provider errors. Keep this model and provider contract unless
  tests establish a concrete reason to change them.
- `client/next.config.ts` currently sends assistant traffic to a separate port-4001 origin
  (including a `NEXT_PUBLIC_ASSISTANT_API_BASE_URL` setting), while the main API is on port
  4000. The Render Blueprint defines one API service, and `server/README.md` documents a
  separate local assistant API. Consolidate normal application traffic through the existing
  main API; remove only the obsolete split-origin behavior and setup instructions.
- Local Ollama settings in `server/.env.example` are not a production model deployment.
  Render's existing Blueprint does not provision an Ollama service or model. Production
  therefore needs an independently hosted Ollama-compatible inference service reachable
  securely from the Render API. Do not point production to a developer machine, expose
  Ollama's port publicly, or expose provider configuration in client bundles.
- PostgreSQL-backed conversation history uses migration 004, which is gated by
  `ENABLE_AI_ASSISTANT_MIGRATION`. Do not edit, enable, verify against, or apply this
  migration. Clearly document that production database-backed assistant history remains
  blocked until a separately approved disposable-database verification and migration
  process is completed.

## Scope of implementation

1. Preserve the existing widget and API contracts. Make only directly needed UI/accessibility
   or responsive refinements discovered during verification; do not duplicate functionality.
2. Route `/api/assistant/*` through the same configured API origin as other application API
   requests in `client/next.config.ts`. Remove obsolete client-side assistant-origin config
   and port-4001 guidance. Do not hardcode a production localhost API or Ollama URL.
3. Keep Ollama calls server-side. Preserve the `OLLAMA_BASE_URL` and `OLLAMA_MODEL`
   configuration names and `llama3.2:3b` default for development. Ensure production
   startup/request behavior does not silently fall back to a localhost Ollama service when
   production configuration is missing. Fail safely with a non-sensitive error. If
   authentication is needed by the chosen compatible inference host, accept credentials only
   through a server-side secret variable and never forward them to the client or log them.
4. Keep the existing resident authorization, conversation ownership, report ownership,
   request-size/input validation, timeout, rate limiting, bounded context, and safe
   text-only model output. Do not add unrestricted database tools, URL-fetch tools, or
   administrative actions for the model.
5. Update directly related setup and deployment documentation with placeholder-only
   environment examples, model installation/availability, service startup, health checks,
   private-network/TLS and firewall requirements, troubleshooting, and the fact that Render's
   current API Blueprint does not run Ollama. Identify required operator-supplied model
   hosting/configuration. Do not claim production is fully operational until its inference
   endpoint and the separately gated schema requirement are satisfied.
6. Preserve every existing report, authentication, map, deployment, and migration behavior.
   Do not read `.env` values, modify database schemas, run migrations, access production
   services/databases, deploy, publish, or stop/restart unrelated running processes.

## Verification

- Run existing server tests and relevant client lint/build checks.
- Test the existing Ollama provider with mocked fetch for the configured model, timeout,
  unavailable/missing-model, malformed response, and safe error behavior. If an installed
  local Ollama model is available and can be reached without touching production, separately
  identify any real inference test as local (not production).
- Verify unauthenticated/staff access is rejected, resident conversation ownership and
  report ownership still hold, input limits and rate limiting remain effective, and the
  model is never sent staff-only or another resident's report information.
- Verify the frontend assistant proxy resolves to the same configured API origin as other
  `/api/*` traffic and no Ollama URL, model-service credential, or internal service address
  appears in browser-visible configuration or bundles.
- Run `git diff --check`; inspect the final diff for unrelated changes and secrets.
- Do not report unexecuted browser, real-model, or production checks as successful. State
  that migration 004 and production connectivity were not tested or applied.
