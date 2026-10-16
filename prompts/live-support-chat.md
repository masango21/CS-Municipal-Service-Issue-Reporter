# Implement Secure Live Support Chat

## Goal

Add a functional, persisted, real-time support chat to the existing Municipal Service Issue Reporter. Extend the current Next.js/React client and Express API; do not create a separate application, replace existing functionality, or add demo messages/conversations.

## Existing architecture and constraints

- The client is Next.js App Router with React Context providers mounted in `client/app/layout.tsx`.
- `AuthContext` exposes the authenticated resident/staff/super-admin and the current session is a server-issued HttpOnly `msr_session` cookie. Never put credentials or session tokens in browser storage.
- The Express API is in `server/index.js`; it verifies the cookie JWT against the current account on protected requests. Roles are resident, staff, and super_admin.
- PostgreSQL is the production source of truth. JSON file storage is used for local development and isolated tests. Preserve both existing storage modes and ensure production continues to refuse startup without PostgreSQL.
- `staff` is limited to a currently verified, active municipality and its reports; `super_admin` has global oversight. Keep report-linked support conversations within these existing authorization rules.
- There is no existing Socket.IO/WebSocket/SSE implementation. Implement actual real-time delivery using Socket.IO on the existing Express HTTP server, with the Socket.IO client in the existing Next.js frontend.
- The root layout is the single shared mount point. Show one chat widget only after auth initialization and only for authenticated residents and staff/super-admins; do not show it on public or sign-in/register pages to unauthenticated visitors.
- Never seed conversations, messages, reports, users, or pins.
- Do not connect to, migrate, or otherwise modify the existing production/Neon database or deploy the app. Add the migration and verify using isolated test storage or a disposable database only when explicitly approved.

## Resident experience

- Provide one fixed, accessible bottom-right “Live Support” launcher with unread badge and a responsive panel. Use existing Tailwind visual conventions. The panel must fit small screens and avoid obscuring essential map, report, navigation, and form controls.
- Residents can start a general support conversation, view/reopen their existing conversation(s), send text messages, and see persisted history, timestamps, sending/failure states, connection state, and unread counts.
- Show an empty state and communicate that support may take time; do not claim staff availability or online presence.
- Validate non-empty text and a server-enforced message length limit. Enter sends; Shift+Enter inserts a newline if using a textarea.
- Provide a report-linked entry point for a report owned by the signed-in resident. The server must verify ownership when creating/reading the linked conversation. Show the real report reference in chat and provide an authorized link to the existing report detail page. General conversations have no report link. Chat does not change report status or substitute for formal report updates.
- Preserve history in the server data store through refresh, logout, and login; never use localStorage as chat persistence.

## Staff experience and authorization

- Add an appropriate staff support/messages interface integrated with current staff navigation/dashboard. Staff can browse and reply to conversations they are authorized to handle, see unread indicators, resident identity from the authenticated backend record, report reference where authorized, and open/resolved status; support resolving and reopening conversations.
- General, unlinked support conversations are visible and replyable by any authenticated, active municipal staff member, as approved by the user. Staff may access those conversations without an active municipality selection. Super-admins can access all support conversations.
- A normal staff member may access a report-linked conversation only while their existing verified active municipality access grants access to that report. Revalidate access on every HTTP operation and Socket.IO room join/message delivery. Super-admins retain global access.
- Residents may only read, update read state, or send messages to their own conversations. Never expose another resident's messages or identity by changing an ID.
- Keep conversation/message authorization in the server; UI hiding is not authorization.

## Backend, persistence, and real-time behavior

- Follow the existing Express route/error/validation conventions and use the existing PostgreSQL pool and file-store test mode. Add the necessary DB helpers and an ordered SQL migration for conversations, messages, and per-user read state; use foreign keys to existing resident/staff/report records, appropriate constraints and indexes, and parameterized SQL.
- Suggested REST surface (adjust names to existing conventions if needed): authenticated conversation list/create, conversation message history, send-message, mark-read, and staff status update endpoints. Return only fields required by the authorized participant.
- Add a per-user/per-conversation read cursor or equivalent so unread counts are correct independently for each participant. Ensure sending a message cannot mark it read accidentally.
- Persist a validated message before broadcasting it. Deliver only to authorized conversation participants/authorized staff viewers. Prevent room-join IDOR; verify active account/session and conversation access on handshake and on every join. Recheck membership before emits where authorization can change.
- Authenticate Socket.IO using the existing HttpOnly session cookie (never a token in client storage or URL). Enforce the configured client-origin allowlist and credentialed CORS, reject invalid/inactive accounts, enforce role and municipality permissions, handle reconnects and avoid duplicate UI messages.
- Provide a clear disconnected state and delivery failure handling. The REST history/send/read endpoints remain authoritative; reconnecting must refresh authoritative state without duplicating persisted messages.
- Add a dedicated rate limiter for message sends and validate request shapes and text length. Use plain React text rendering; never inject user HTML.
- General support creation is resident-only. Only residents can create a conversation, optionally with a report ID. Validate report ownership server-side.
- Do not add staff assignment, online presence, push notifications, or unrelated chat features.

## Verification and safety

- Add backend tests for resident conversation isolation, resident report ownership, unauthorized/inactive users, staff municipality scope, super-admin access, status permissions, validation/rate-limiting where practical, persistence/read state, and Socket.IO authentication/room authorization.
- Add or update frontend tests if an existing frontend test harness exists; otherwise run lint/build and exercise the main flows in a local browser.
- Verify real-time delivery between two authenticated clients where feasible, history after refresh/relogin, unread state changes, general support handling, report-linked access, responsive layout, and exactly one widget across routes.
- Run backend tests, frontend lint/build, and `git diff --check`. Do not claim unexecuted checks passed.
- Do not run any database migration against configured or existing production credentials. Clearly document any remaining disposable-PostgreSQL verification and local setup requirements.
- Preserve all unrelated worktree changes and do not print or commit environment secrets.
