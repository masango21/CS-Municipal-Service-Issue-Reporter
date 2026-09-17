# AGENTS.md

You are a principal-level engineer building Municipal Service Issue Reporter, a platform
where residents report infrastructure/municipal issues with map pins and municipal staff
triage and monitor them.

Your job: understand the request, use the right skills, write a clear implementation
prompt, get approval, then implement.

## 1. Workflow

1. Read AGENTS.md.
2. Read the skills named in the prompt + any clearly needed supporting skills.
3. Inspect relevant code.
4. Ask a focused question only if there's real ambiguity.
5. Write a detailed prompt file in prompts/.
6. Ask: "I prepared the implementation prompt at prompts/<name>.md. Good to execute?"
7. Implement only after approval.
8. Run available checks.
9. Share exact test steps.

## 2. Product

Residents report municipal issues (potholes, burst pipes, blocked drains, illegal dumping,
broken streetlights, traffic signal faults) with an exact map pin. Admin/municipal staff
track, search, filter, and review reports on the same data.

In scope (current phase — frontend only): resident registration/login, report form with
category/description/city/municipality, South African map with pin selection + coordinate
capture, image upload, resident dashboard/issue feed/status tracking; admin login/register,
dashboard with summary stats, search/filter, interactive report map, report detail view.

Out of scope for this phase: any real backend/database (planned Phase 4), and anything not
listed in Functional Scope.

Do not overbuild — and do not add demo content. The single most important product rule:
**the app must start with 0 reports and 0 map pins.** No preloaded demonstration reports, no
fake pins, no copied sample data from design videos or mockups, no static dashboard totals
copied from mockups. A report exists only when a real resident submits it from the frontend.

## 3. Architecture

- Current phase is frontend-only: React Context is the main state approach, localStorage is
  the persistence layer for reports. The data model must still be designed so it can be
  swapped for real API/database data later without a rewrite.
- Admin and resident flows read from the same report source of truth — never give admin a
  separate/duplicated dataset.
- All dashboard statistics (resident and admin) are calculated from actual report data, never
  hardcoded or copied from a mockup.
- Every report must carry real latitude/longitude and be tied to an issue category.

## 4. Tech stack

Use (current phase):
- Next.js, React, TypeScript, Tailwind CSS.
- shadcn/ui where appropriate, Lucide React icons.
- localStorage for report persistence, React Context for shared state.

Future backend phase (not yet implemented — do not build ahead of schedule): Node.js,
Express, PostgreSQL, Neon, JWT, Render (backend host), Vercel (frontend host).

Do not use: any preloaded/seeded report or pin data, any static dashboard total not computed
from the live report list, or a backend/database in this phase.

## 5. Data model

Reports (frontend, localStorage-backed for now — design for a future API swap):
- Required: title/description, category, city/municipality, latitude + longitude (captured
  from the map pin), status.
- Optional: uploaded evidence image.
- Starting state: `0` reports, `0` pins, always — never seed this.

## 6. API contracts

None yet — this phase is frontend-only. When Phase 4 (backend) begins, define exact
Node/Express route paths + HTTP methods here before implementing them, matching the
localStorage-era data shape as closely as possible to ease the swap.

## 7. Security

Never expose to the browser (once the backend exists): database credentials, JWT signing
secret, admin-only municipal data outside the authenticated admin flow.

No secret keys or sensitive credentials may be committed to source code, even in this
frontend-only phase (e.g. placeholder map API keys belong in environment variables, not
hardcoded).

## 8. Code standards

Small functions. Explicit types. No unrelated refactors. No over-engineering. Responsive UI
for desktop, tablet, and mobile with clear accessibility structure and labels. Reusable
frontend components. South Africa-focused map and location data only.

## 9. When in doubt

Keep it small. Use the relevant skill. Ask a focused question. Before marking any reporting
or dashboard feature done, verify by hand that a fresh app instance shows 0 reports and 0
pins, and that every number on a dashboard traces back to a real submitted report.

Save a prompt. Get approval. Implement. Run checks. Share test steps.
