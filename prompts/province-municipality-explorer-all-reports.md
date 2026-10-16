# Implementation Prompt: Province and Municipality Exploration Across All Report Maps

## Goal

Extend the existing report-map exploration so users can switch between a South Africa
overview, a selected province, and a selected municipality. Preserve density shading only
for the national overview, render reliable municipality boundaries when available, and
represent every report supplied to each map under its existing authorization scope.

Modify the current shared map components and data flows; do not recreate the application or
add sample reports.

## Current implementation findings

- `client/components/MapView.tsx` is the shared React Leaflet renderer. It renders report
  markers, clusters, optional province polygons, and the map legend. Cluster popups retain
  each grouped report as a selectable item.
- `client/components/ReportMap.tsx` routes full-size report maps through
  `ReportDensityExplorer`; compact views with more than one report also use the explorer,
  while one-report detail maps remain single-location maps.
- `client/components/ReportDensityExplorer.tsx` loads the local nine-province GeoJSON,
  assigns reports to provinces, applies category/priority/status filters, selects province
  and municipality associations, and computes the province density legend. Province
  polygons remain rendered after province selection, and there is no municipality polygon
  layer or municipality selection by geometry.
- `client/lib/reportDensity.ts` ignores reports with invalid coordinates while locating map
  reports. As a result, current summary/list counts cannot represent valid and unplottable
  reports separately. Municipality association uses report municipality IDs when available
  and falls back to names otherwise.
- `client/public/geojson/south-africa-provinces.geojson` is the only local boundary
  geometry. Its attribution is in `client/public/geojson/ATTRIBUTION.md`.
- `server/location.js` identifies municipalities through the Municipal Demarcation Board
  ArcGIS feature service. Its municipality-directory query requests attributes only
  (`returnGeometry=false`); this code does not currently provide municipality polygons.
  No municipality polygon asset is bundled.
- `server/index.js` public `/api/reports`, resident `/api/my/reports`, and authorized staff
  `/api/admin/reports` handlers return report arrays without pagination metadata. The
  PostgreSQL `getReportsFromDb` query in `server/db.js` orders results but has no row limit.
  Staff queries remain municipality-scoped. Do not weaken or bypass these scopes.
- Dashboard report cards intentionally use `reports.slice(0, 3)` in
  `client/app/dashboard/page.tsx`; this is a card-list presentation limit, not a map/API
  report limit. Do not remove or confuse it with map rendering.
- Relevant report map surfaces include the public landing page, issue feed, resident
  dashboard, staff dashboard, resident/staff report details, and report-location picker.
  Detail maps and the location picker have distinct purposes and must retain them.
- The local public API at `http://localhost:4000/api/reports` returned HTTP 500 during
  inspection. Do not infer that its response was empty or modify data to make the endpoint
  succeed. Preserve explicit load-error states and diagnose the API failure only if needed
  to validate the authorized report-loading flow.

## Implementation requirements

### 1. Audit every map and preserve its role

- Inspect all current map call sites before editing.
- Use the shared explorer for maps intended to browse multiple reports, preserving public,
  resident-private, and municipality-authorized staff input sets.
- Keep one-report detail maps focused on their report, without irrelevant nationwide density
  layers.
- Keep `LocationPicker` focused on pin placement and preserve click selection, search,
  geolocation, and selected-marker behavior.
- Do not make public reports, another resident's private reports, or another municipality's
  staff reports visible to a map.

### 2. Make map view state explicit

Represent the geographic view clearly as national, province, or municipality (or an
equivalent minimal state design).

- National view: render the existing province polygons, density shading, density key,
  province tooltips, and all-country extent.
- Province view: completely remove/hide the national density fill layer and its density
  legend. Keep the selected province outline visible, fit its actual bounds, and show only
  that province's municipality polygons when trustworthy geometry is available.
- Municipality view: keep the selected municipality highlighted and its boundary visible,
  keep other municipalities in the selected province visible for context, and fit the
  selected municipality's bounds.
- Returning to province view restores all province reports and clears municipality
  selection. Returning to national view restores density shading, its key, and country
  extent.
- Ensure map layers and handlers are cleaned up or updated when selection changes. Avoid
  stale selections, duplicate event handlers, and duplicate report markers during rapid
  view changes.

### 3. Municipality polygon source and safe fallback

- First verify whether the existing Municipal Demarcation Board ArcGIS layer can supply
  complete municipality polygon geometry for South Africa, with stable municipality IDs,
  province association, sufficient record coverage, and documented reuse/license and
  attribution.
- Prefer a validated local, appropriately simplified GeoJSON asset when feasible; document
  its exact source, dataset vintage, license, and attribution. Otherwise use a bounded,
  cached existing source using established project patterns, validate the payload, and
  surface loading/failure states explicitly.
- Do not fabricate or approximate boundaries, use clusters as boundaries, or rely on
  municipality names alone where stable codes are available.
- If a reliable, licensable polygon source cannot be verified, retain the province-only
  detail view with a clearly labelled municipality-boundary-unavailable explanation. Keep
  existing ID-backed municipality associations and summaries usable, but do not present
  those associations as polygon selection.
- Do not add secrets, expose server credentials, connect to or migrate the production
  database, or seed/alter report records.

### 4. Show every eligible report without losing summary data

- Trace report data from each existing authorized API flow to map props. Confirm the route
  does not paginate before deciding whether any fetch changes are required.
- The current list routes return complete arrays and no pagination metadata; the database
  report query has no `LIMIT`. Do not add pagination or an arbitrary marker cap without new
  evidence of a real limit. Keep this contract aligned if any endpoint is changed.
- Preserve a complete set of reports for the selected map input. Categorize reports into
  those with valid South African coordinates and those that cannot be plotted; do not
  silently discard unplottable reports from relevant totals, lists, or issue breakdowns.
- In province view, filter the authorized report set by the reliable province assignment
  already stored on a report, falling back to point-in-polygon against the existing province
  geometry only when the assignment is absent. Keep the assignment and fallback behavior
  explicit and avoid including a report in multiple provinces.
- In municipality view, prefer stable municipality IDs. Only use a documented, scoped
  fallback when a legacy record has no stable ID; do not cross-match ambiguous names.
- Show every unique report with valid coordinates in the selected geographic scope and
  active filters. Reuse existing markers and cluster behavior. Cluster counts and selectable
  members must represent every report in the cluster; zooming must expose individual
  reports. Use stable report IDs and prevent duplicate representation across layers.
- Preserve report category, priority, status, and existing report-detail navigation.
- If the endpoint fails, show its error rather than an empty or success-shaped report list.

### 5. Keep view-specific keys and summaries truthful

- National view: density legend values must match actual province fill classification; retain
  province report-count tooltips.
- Province view: remove the national density legend and show only encodings actually in use:
  province/municipality outlines, selected municipality, category marker colors, and cluster
  counts as applicable. Do not imply that category or priority colors are density.
- Municipality view: key must describe the selected boundary, category markers, and cluster
  markers actually shown.
- Preserve accessible labels and responsive layout.
- National summary uses the authorized report set and filters.
- Province and municipality summaries distinguish associated total reports from reports
  with valid coordinates and reports that can be plotted. Keep unplottable reports in
  relevant counts/breakdowns where the backing data supports that distinction.
- Calculate totals, category/priority breakdowns, and status totals from actual reports in
  the current authorized view and filter state. Do not invent missing geographic metadata or
  statistics.
- Municipality counts and summaries must use report-to-municipality associations and stable
  identifiers where available. Do not label association summaries as polygon boundary
  coverage unless the geometry source supports it.

### 6. Performance, accessibility, and product constraints

- Cache boundary loading to avoid repeated downloads on each selection; allow failed requests
  to be retried and surface errors clearly.
- Do not refetch all reports on each province/municipality click. Filter the already-loaded
  authorized report set unless evidence requires fetching.
- Validate boundary payloads and coordinates; reject malformed geometry safely.
- Keep maps, legends, controls, and report lists usable on narrow screens.
- Do not add demo content, fake pins, duplicate reports, unrelated dependencies, or unrelated
  refactors. The application must still start with zero reports and zero pins on a fresh
  instance.

## Validation requirements

Run frontend lint and production build; run backend tests if server behavior changes. Use
available browser checks and the local app/API only. Do not print `.env` values or credentials.
Do not modify production data.

Verify, where the local services allow:

1. National overview shows province shading, its matching key, tooltips, and country extent.
2. Province selection removes the entire density fill layer and density key, shows the
   selected outline, and fits province bounds.
3. Municipality geometry is accurate and source-attributed, or the unavailable-geometry
   fallback is clearly shown without fabricated boundaries.
4. Every actual authorized report with valid coordinates is represented in province and
   municipality views; clusters retain all members and correct counts.
5. Reports with invalid coordinates remain visible in relevant counts/lists and are reported
   as unplottable.
6. Municipality selection uses stable IDs, filters markers and summaries correctly, and
   clearing the selection restores the full province view.
7. Keys and summary panels change with the geographic view and active filters.
8. Returning to national view restores the density layer, key, and national extent.
9. Public, resident, staff, detail, and location-picker map behavior and data scopes remain
   correct.
10. Empty, loading, malformed-boundary, and API-error states do not masquerade as zero
    reports or produce fake markers.
11. No duplicate markers/layers appear when selections or filters change.

Report actual validation results and any environment limitation without claiming checks that
were not executed.
