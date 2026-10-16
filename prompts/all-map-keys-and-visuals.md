# Implementation Prompt: Consistent Visualizations and Map Keys Across All Maps

## Goal

Audit and enhance every existing Leaflet map in Municipal Service Issue Reporter with the visualization, interactions, report density indicators, and accessible map keys appropriate to that map's purpose. Keep all data from the existing report source and preserve existing map behavior, permissions, and navigation.

## Existing project findings

- `client/components/MapView.tsx` is the shared Leaflet/React Leaflet map. It renders report markers colored by category, selected-location markers for report creation, optional province GeoJSON, and lower-zoom grouped report points.
- `client/components/ReportMap.tsx` wraps report maps. Full-size maps use `ReportDensityExplorer`; compact maps use `MapView`.
- `client/components/ReportDensityExplorer.tsx` has province-level shading, filters, summaries, and a province density legend. Municipality polygons are not bundled; municipality counts are association-based, and point clusters are not jurisdiction boundaries.
- `client/components/LocationPicker.tsx` uses `MapView` to place a new report pin and already shows a category-color key below the map. Preserve its map-click, selected-location, search, and geolocation behavior.
- Map call sites:
  - `client/app/page.tsx`: public overview, compact report map.
  - `client/app/issues/page.tsx`: public map or authenticated resident's own reports, full-size.
  - `client/app/dashboard/page.tsx`: authenticated resident's private reports, compact.
  - `client/app/admin/dashboard/page.tsx`: staff's authorized municipality reports and active filters, full-size.
  - `client/app/issues/[id]/page.tsx`: single resident-visible issue, compact.
  - `client/app/admin/reports/[id]/page.tsx`: single staff-authorized issue, compact.
  - `client/app/report/page.tsx` through `LocationPicker`: new-report location picker, not a report-browsing map.
- Existing `Issue` fields include coordinates, category, priority, status, municipality, province, and submission time. Report visibility is currently determined by existing public, resident-owned, or municipality-scoped staff API calls. Preserve those scopes.
- The local province polygons are `client/public/geojson/south-africa-provinces.geojson`; attribution is documented in `client/public/geojson/ATTRIBUTION.md`. No municipality polygon dataset is present.
- Existing map marker colors encode category, while province fill colors encode report density. Do not conflate those meanings. Current supported priorities are Low, Medium, High, Critical; statuses are Reported, Under Review, Assigned, In Progress, Resolved, and Closed.

## Implementation requirements

1. **Audit and account for every map above.** Use shared components/configuration where safe; do not upgrade only one dashboard. Include map-picker surfaces in the audit while keeping their purpose distinct from report-browsing maps.
2. **Shared map keys.** Add appropriate visible, accessible, responsive legends to all maps:
   - Province-density maps: explain the actual zero/no-data appearance and the dynamic quartile bands computed from the currently filtered province counts.
   - Report markers: explain that category colors identify issue categories; include the categories actually present on that map, with the same colors the markers use.
   - Clustered points: identify clusters as counts of grouped report locations; ensure users can discover every report in a cluster and select it.
   - Selected report/location: identify the selected marker where it is displayed.
   - Report-location picker: retain its existing category key and ensure the selected-location symbol is distinguishable and explained.
   - Do not add priority or status legends unless a map actually encodes priority or status with color/symbol. If added, use the real supported values and separate keys from density/category legends.
   - Distinguish zero reports from an unavailable report/boundary dataset; do not label a failed/unavailable dataset as zero.
3. **Show all supplied report locations.** Full and compact browsing maps must represent every unique report with valid South African coordinates. Cluster nearby reports at useful zoom levels without dropping any cluster members; allow browsing/selecting all members and zoom in to individual markers. Report changes, filters, and map inputs should update markers and clusters.
4. **Geographic density behavior.** On maps intended for broad report exploration, preserve province polygon density shading based on actual filtered report records, province select/zoom, municipality-level association summaries, and the explicitly labelled point-based municipality fallback. Do not display province shading on one-report detail maps or the location-picker unless that map's purpose and available interactions make it appropriate.
5. **Map viewport.** Browsing maps should fit their valid report points on initial display or when the authorized report set changes, respecting sensible maximum zoom. Preserve the location picker's selected coordinate/search/geolocation centering and do not overwrite it with a report-set fit. Empty maps retain a useful South Africa overview.
6. **Report navigation.** Marker and cluster-member selection must use each page's existing destination/callback. Public, resident, staff, and detail map inputs remain unchanged in scope. Never fetch broad/private data to populate a map.
7. **Robustness and accessibility.** Deduplicate by report ID, safely skip invalid coordinates, keep zero-data and load-error states distinct, keep legend labels readable and keyboard-accessible, avoid covering important map controls, and support narrow/mobile layouts without overflowing long category lists.
8. **Data/dependencies.** Reuse existing Leaflet dependencies, report APIs, province data, and category colors. Do not add demo content, map providers, endpoints, dependencies, database changes, or municipality polygons without a verified source/license and clear need.
9. **Validation.** Run frontend lint/build and backend tests if backend code is changed. Verify each call site by role and map purpose; report actual checks and any browser/manual coverage honestly.

## Acceptance checklist

- [ ] Public landing overview has an appropriate legend and shows the public report set.
- [ ] Issues feed has a density/category/cluster key and its currently authorized report set.
- [ ] Resident dashboard map shows only that resident's reports and has an appropriate marker key.
- [ ] Staff dashboard map shows only authorized, filtered reports and keys matching the actual encodings.
- [ ] Resident and staff detail maps identify the single report marker without irrelevant choropleth or priority keys.
- [ ] Location picker retains exact-pin selection and explains its category markers and selected location.
- [ ] Every cluster member is visible/selectable; duplicate IDs and invalid coordinates are safe.
- [ ] Legend colors/labels exactly match actual styles and filters; zero vs unavailable is unambiguous.
- [ ] Empty starting data remains empty; no report or pin is fabricated.
- [ ] Frontend lint/build and relevant tests pass.
