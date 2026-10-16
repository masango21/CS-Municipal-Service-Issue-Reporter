# Implementation Prompt: Replace OpenAI with Local Ollama

## Objective

Replace the AI Municipal Assistant's OpenAI provider with Ollama's local chat API.
Preserve the current assistant UI and request/response contracts. Keep the assistant
isolated on port 4001 with its existing temporary file store. Do not modify or restart
the existing API on port 4000, connect to a production database, or apply migration 004.

## Inspected environment and implementation

- The provider implementation is `server/ai-assistant.js`; its API boundary and resident
  authorization are in `server/index.js`.
- The existing authenticated client is `client/components/AIAssistant.tsx`. It sends
  `{ content, reportReference? }` through the same-origin assistant API and expects the
  current `{ messages }` response.
- Provider tests are in `server/test/ai-assistant.test.js`; API authorization and
  conversation tests are in `server/test/api.test.js`.
- Ollama is installed on Windows (version 0.40.4) and its local API responds at
  `http://127.0.0.1:11434`.
- Hardware reports 15.9 GB total RAM, 6.8 GB free at inspection, and Intel UHD 630
  integrated graphics. The only installed model is `qwen3-coder:latest` (30.5B
  parameters, Q4_K_M, approximately 17.7 GB); do not use it for this machine.
- Ollama's official model page describes Llama 3.2 as instruction-tuned and lists 3B and
  1B variants. Use `llama3.2:3b` as the initial local model candidate, but verify its
  exact tag, download availability, and model presence before configuring the runtime.
- The server's real `.env` is ignored by Git and contains unrelated values. Do not
  overwrite it, print it, or remove existing entries. Ollama configuration is not
  currently set there. Use the existing process-scoped configuration for port 4001 and
  keep `DATA_STORE_PATH` pointed at its existing isolated temporary store.
- A prior worktree change in `server/ai-assistant.js` classifies OpenAI quota errors.
  Replace provider-specific code only as required, preserving unrelated changes.
- Migration 004 is disabled. Keep it disabled and keep database storage off for API 4001.

## Provider implementation

1. Replace OpenAI credentials and endpoint usage with Node's built-in `fetch` to
   `${OLLAMA_BASE_URL}/api/chat`, defaulting only when the setting is genuinely absent to
   `http://127.0.0.1:11434`. Configure model through `OLLAMA_MODEL` with a documented
   candidate `llama3.2:3b`. Do not require or reference `OPENAI_API_KEY` for assistant
   operation.
2. Send `{ model, messages, stream: false }`, preserving municipal system instructions,
   bounded conversation history, and minimal server-verified report context. Read the
   answer from `message.content`.
3. Keep timeouts bounded and safe error messages. Distinguish a missing/unreachable
   Ollama service, unavailable model/download-needed response, timeout, malformed/empty
   output, and generic local service failure using sanitized server diagnostic codes.
   Never log prompts, report contents, cookies, credentials, raw provider responses, or
   filesystem paths. Do not automatically retry indefinitely.
4. Keep client routes, authenticated request shape `{ content, reportReference? }`,
   `{ messages }` response, layout, controls, loading behavior, and error/retry UI intact.
   Never call Ollama directly from the browser.
5. Preserve existing resident authentication, conversation ownership, report ownership,
   input bounds, and rate limits. Do not add model tool execution or database access.

## Configuration and documentation

- Update `server/.env.example` and `server/README.md` to describe
  `OLLAMA_BASE_URL` and `OLLAMA_MODEL`, Windows installation using the official Ollama
  instructions, model pull/start commands, starting the isolated API on 4001 and frontend
  on 3000, health/model checks, and troubleshooting.
- Do not alter the real `server/.env` or add `NEXT_PUBLIC_` provider settings.
- Keep the documented separate API 4000 deployment configuration and all unrelated
  environment variables intact.

## Tests and verification

- Update provider tests for Ollama request URL/body/response and sanitized failures:
  missing configuration, service unavailable, model missing, timeout, malformed or empty
  response. Use mocks only in tests.
- Keep/run the existing authenticated conversation, ownership, report privacy, and rate
  limit API tests.
- Where Ollama is available, pull only the verified lightweight model if needed, verify
  the model with `/api/tags`, send a harmless direct local request, then exercise the
  actual assistant through the authenticated browser session on port 4001. Distinguish
  real inference from mocked tests; never claim success without a real response.
- Run backend tests, client lint and build, and `git diff --check`.
- Verify API 4000 remains healthy and unchanged, API 4001 still uses the isolated file
  store with zero reports, migration 004 remains disabled, and the API key is not present
  in browser resources or client bundles.
- Preserve all existing worktree changes. Do not commit, deploy, or connect to a database.

## Official Ollama references

- [Windows install](https://ollama.com/download/windows)
- [Llama 3.2 model](https://ollama.com/library/llama3.2:3b)
- [Chat API](https://docs.ollama.com/api/chat)
- [Local API introduction](https://docs.ollama.com/api/introduction)
