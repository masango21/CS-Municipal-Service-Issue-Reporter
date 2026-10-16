# Implementation Prompt: Interactive Municipal Report Density Map

## Goal

Extend the existing Municipal Service Issue Reporter map with South African province-level report density shading, province zoom and summaries, municipality-level report exploration, report filters, and report summaries. Integrate into the existing application; do not create a new project, replace the current Leaflet map, redesign unrelated pages, or remove current map/report functionality.

## Existing project context

- The frontend is Next.js, React, TypeScript, and React Leaflet. Leaflet and React Leaflet are already dependencies in `client/package.json`.
- The existing map is `client/components/MapView.tsx`; `client/components/ReportMap.tsx` adapts `Issue[]` and displays the map. The issues feed uses the full-size map, while dashboards and report detail pages use compact maps.
- Reports are represented by `Issue` in `client/types/issue.ts`. Fields include `title`, `category`, `priority`, `status`, `reportedAt`, and `location` with latitude, longitude, municipality, municipality ID, and province (some location fields may be absent).
- The reports context fetches from the same-origin `/api/reports` endpoint, with Next.js rewriting `/api/*` to the API origin configured in `client/next.config.ts` (defaults to `http://localhost:4000`).
- The backend already exposes `GET /api/reports`, `GET /api/my/reports`, `GET /api/admin/reports`, and `GET /api/admin/municipalities`. Preserve their existing public/resident/staff authorization and visibility rules. Reuse these endpoints as appropriate; do not fetch private staff data through public routes.
- Municipality resolution already records a province, municipality code, and Municipal Demarcation Board boundary-source metadata on resolved locations. This is a useful relationship when present but is not itself province polygon geometry.
- No South African province/municipality GeoJSON boundary dataset was found in the current client public assets. Research and verify the accuracy, attribution, and license of any boundary source before adding data. Do not invent or approximate boundary polygons.

## Scope and behavior

1. **Keep the existing map behavior.** Preserve issue markers/popups, selected-location support, map search/geolocation controls, and compact-map usage. Add the interactive density experience to the full-size issues map without imposing new controls on unrelated compact maps unless needed for consistent behavior.
2. **Province choropleth.** Load accurate South African province GeoJSON from a committed local asset, not an unreliable runtime URL. Count eligible, unique reports from the authorized report list using valid coordinates and reliable province association or point-in-polygon containment (GeoJSON order is longitude, latitude). Exclude invalid/out-of-country coordinates and points outside all polygons. Use a data-relative, comprehensible density scale; include a legend, non-crowding counts where practical, hover highlighting, and tooltips with province name, total, and unresolved counts.
3. **Province selection.** Clicking a province selects and highlights it, fits its real geometry bounds with suitable padding and maximum zoom, and shows a summary. Provide an accessible way to return to the South Africa overview and select another province without reloading.
4. **Municipalities.** Restrict municipality exploration to the selected province. Prefer verified municipal polygons only if an accurate, compatible, licensed dataset is available and fits the scope. Otherwise provide an explicitly labelled point-based hotspot/cluster visualization; do not represent point density as administrative boundaries. Municipality associations must use stable IDs/codes where available rather than municipality names alone. Avoid excessive markers and labels.
5. **Filters and summaries.** Add province, municipality (after province selection), category, priority, and status filters plus reset. Filters must consistently affect shading, counts, hotspots, and report lists. Clearly label filtered totals. Province/municipality summaries should include only fields supported by real records: total, unresolved, resolved, category and priority breakdowns, frequent categories, affected municipalities for a province, and matching reports with title, category, priority, status, and submission date. Selecting a report must open the existing detail view using existing navigation conventions.
6. **Visibility and data integrity.** Use the existing authorized report data already supplied by the application. Retain public and resident report visibility exactly as currently intended, and never expose staff-only or reporter identity data to an unauthorized user. Do not invent counts, seed reports, create fake pins, or use demo records. Missing optional fields are omitted or clearly treated as unavailable. Deduplicate by report ID.
7. **Reliability and accessibility.** Provide loading, empty, and actionable error states for the report/boundary experience. Keep controls keyboard accessible and labelled, layout responsive, and calculations stable (memoize derived summaries rather than recomputing on pointer movement). Cache/reuse boundary data and avoid unnecessary API requests when changing the selected area. Clean up Leaflet layers and event handlers correctly.
8. **Attribution.** Document the source, version/date, and license/attribution for every geographic dataset added. Do not add a runtime dependency or package unless it is genuinely needed; inspect existing dependencies first.

## Implementation approach

- First inspect the current map, report model/context, API response shapes, navigation to report details, and all map call sites. Confirm precisely which report list is provided in public, resident, and staff views.
- Reuse current `MapView`, `ReportMap`, `Issue`, and reports-context patterns. Keep new calculations and controls modular and typed. If the current public report payload lacks a needed non-sensitive field, make only the smallest consistent API change and preserve its existing authorization contract.
- Do not load all admin reports through an unprotected endpoint. Do not change unrelated endpoints, data sources, dashboards, or report workflows.
- Verify that a fresh instance still has zero reports and zero pins; the feature must not add seed/demo content.

## Acceptance checks

- South Africa overview uses real report records and local authoritative province geometry; province totals match independently computed counts.
- All provinces can be selected and fitted to bounds; selected province, summary, municipality options, and return-to-overview behavior work.
- Municipality hotspots are constrained to the selected province and visibly described according to whether they use polygons or point-based visualization.
- Category, priority, status, province, and municipality filters update every relevant total, map layer, and list consistently; reset clears them.
- Missing/invalid coordinates, missing optional metadata, empty data, boundary-load failure, and API failure do not crash the page or produce fabricated values.
- Report selection opens the established detail page/modal; existing markers and compact map workflows remain usable.
- Unauthorized users receive no restricted report or staff-only fields. A fresh empty app displays zero reports and zero pins.
- Run the smallest relevant frontend lint/build checks and backend tests if backend files change. Report only checks actually performed, plus remaining geographic-data limitations and exact manual verification steps.
