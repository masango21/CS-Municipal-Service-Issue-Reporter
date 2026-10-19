# Implementation Prompt: Fix the Existing Ollama Model Configuration

## Objective

Fix the root cause of `The AI assistant model is not configured yet.` in the existing
resident AI chat. Reuse the existing widget and API. Configure the existing Ollama model
`llama3.2:3b` for predictable local and Render setup, keep inference server-side, and verify
real local inference without contacting production or applying migration 004.

## Findings

- `server/ai-assistant.js:getAssistantReply` reads `process.env.OLLAMA_MODEL` directly and
  throws the exact reported error when it is unset or empty. `OLLAMA_BASE_URL` is a separate
  setting: if it is missing in production, the provider returns an AI service configuration
  error rather than the model configuration error.
- `server/.env.example` documents `OLLAMA_MODEL=llama3.2:3b`, but dotenv does not load
  `.env.example`; Render must receive the variable through its service settings/Blueprint.
- The deployment log checks out commit `3e47d50039ff9ca812b3b6fa1247c326fc643e5d`. That
  committed `render.yaml` does not declare `OLLAMA_MODEL`, `OLLAMA_BASE_URL`, or
  `OLLAMA_API_KEY`, while the current uncommitted working-tree version adds these settings.
  The provider fix in the working tree has not been deployed by the commit in the supplied
  log.
- The local Ollama server at `http://127.0.0.1:11434` responds and has `llama3.2:3b`
  installed. Do not infer that a Render instance can reach that local service.
- The existing client sends authenticated requests to the existing `/api/assistant/*`
  endpoints through the Next.js API proxy. Do not add another chat UI or endpoint.
- The worktree contains pre-existing changes to `server/data/store.json` and an
  uncommitted change setting `ENABLE_AI_ASSISTANT_MIGRATION=true` in
  `server/.env.example`. Preserve both files exactly; do not read/modify the store file or
  alter migration settings as part of this model-configuration task.

## Implementation

1. Add a backend constant for the project's already selected `llama3.2:3b` model and use it
   when `OLLAMA_MODEL` is absent or blank. Continue honoring an explicit configured model.
   Do not add a hardcoded production inference URL or credentials. In production, require
   the existing explicit HTTPS `OLLAMA_BASE_URL` validation.
2. Add a safe test proving an omitted/blank model selects `llama3.2:3b` in the server-side
   request body, and retain a test that genuine missing service configuration and
   unavailable/missing model conditions return useful, non-sensitive errors.
3. Keep `OLLAMA_MODEL=llama3.2:3b`, `OLLAMA_BASE_URL`, and optional `OLLAMA_API_KEY`
   represented in the existing example/Render service configuration. Preserve the existing
   local Render-uncommitted changes without duplicating keys.
4. Update directly relevant documentation to say the `.env.example` is illustrative only,
   explain that Render must have the three settings in its API service environment, identify
   that the supplied deployed commit predates the Ollama Render variables, and provide exact
   local commands to pull/check the model. For production, use placeholder examples only:
   require the operator to supply a real reachable HTTPS inference service; do not invent
   one or claim local Ollama is production-accessible.
5. Do not read `.env`/`.env.local`, reveal secrets, change `server/data/store.json`, modify
   migration files or migration settings, connect to any production host/database, apply
   migration 004, deploy, or publish changes. The separate API-startup/migration-004 change
   is not part of this task.

## Verification

- Run `npm --prefix server test` and `git diff --check`.
- Confirm `/api/tags` from local Ollama shows `llama3.2:3b`, then use a fresh, isolated
  file-store API to submit an authenticated prompt and verify a real generated reply from
  that model. Keep the test store isolated and delete only the exact temporary directory
  created for the test.
- If feasible, verify the existing chat widget sends through the same-origin API proxy and
  displays the real model answer. Do not connect the browser to a pre-existing non-isolated
  app/server.
- Confirm the original missing-model condition no longer occurs when the model setting is
  omitted, missing Ollama configuration fails clearly, existing authorization tests pass,
  migration 004 is untouched, and all unrelated worktree changes remain unmodified.
- Production Ollama connectivity cannot be verified without the operator-provided production
  endpoint and credentials. Report it as outstanding; do not deploy.
