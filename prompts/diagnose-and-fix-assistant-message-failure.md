# Implementation Prompt: Diagnose the Production Assistant Message Failure

## Symptom and Evidence

- On the signed-in Vercel dashboard, the existing AI assistant opens and shows saved
  conversation history. Sending a message displays
  `The AI assistant is temporarily unavailable. Please try again.`
- The deployed browser screenshot does not contain the failed request's HTTP status/body or
  the matching API log. The user did not provide those diagnostics.
- In the current server source, that exact message is emitted by the catch-all in
  `POST /api/assistant/conversations/:id/messages` for unexpected errors. The widget also
  uses it as a fallback when a failed response contains no `message`.
- Known provider/configuration errors and an explicitly pending AI schema have distinct
  messages. Because listing a conversation works, the symptom alone does not identify the
  cause of the failed message request.

## Objective

Investigate and fix any concrete failure reproducible in the local code, and make otherwise
unexpected server-side failures diagnosable from Render logs without logging user content,
report details, cookies, credentials, service URLs, or secrets. Preserve the current chat
widget, API contracts, authentication/ownership checks, and safe generic client response for
unknown failures.

## Scope

1. Inspect the complete assistant message handler and its conversation/report/history/provider/
   persistence helpers and existing tests. Do not assume Ollama is the failing component.
2. Add narrow, stage-specific diagnostics for unexpected errors within message handling
   (for example: conversation lookup, report context lookup, history load, provider, or turn
   persistence). Log only a fixed stage identifier, error class, and safe machine error code
   when available. Never log the exception message/stack or request/body data where it may
   contain user content, SQL parameters, credentials, or service URLs.
3. Preserve `AssistantProviderError` messages/codes and existing status behavior. Keep
   unknown errors generic in the HTTP response. Do not surface internal diagnostics to the
   browser.
4. Add targeted tests proving the stage is logged for unexpected provider/persistence
   failures, no exception details or message content are logged, no partial turn is written
   on provider failure, and existing assistant access controls and schema-unavailable
   behavior remain unchanged.
5. If isolated investigation identifies a specific underlying defect in this handler or a
   helper, fix it surgically and add a regression test. If no concrete defect can be
   reproduced locally, do not misrepresent diagnostics as having fixed the production
   incident; report that the matching Render log or failed request response is still needed.

## Safety Constraints

- Do not open the deployed site with the resident's session or access production endpoints,
  infrastructure, databases, logs, credentials, or secrets.
- Do not deploy, publish, run migrations, enable migration 004, or modify database schemas.
- Do not change the Ollama model, provider URL handling, or the widget's user experience
  without evidence that a specific change is needed.
- Preserve unrelated worktree changes, especially `server/data/store.json` and the existing
  migration-setting worktree change in `server/.env.example`.

## Verification

- Run the focused API tests and `npm --prefix server test`.
- Run `git diff --check`.
- Use test doubles only for injected failure cases; report them as mocked, not as production
  or Ollama integration tests.
- No production or database integration test is authorized.
