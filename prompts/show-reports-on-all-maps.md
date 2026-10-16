# Implementation Prompt: Show Authorized Reports Across All Maps

## Goal

Update the existing report-map surfaces so every submitted report supplied to a report-browsing map is visible as a map pin, consistently across compact and full-size maps. Preserve the existing report source of truth, map density experience, filters, navigation, and authorization boundaries.

## Existing application map surfaces

- `client/components/ReportMap.tsx` is the shared map wrapper. Full-size maps render `ReportDensityExplorer`; compact maps currently render `MapView` with individual report markers.
- The public landing page supplies the public report list from `ReportsContext`.
- The issues feed supplies public reports to unauthenticated visitors and the authenticated resident's own reports to that resident.
- The resident dashboard supplies only reports returned by `/api/my/reports`.
- The staff dashboard supplies its authorized municipality-scoped reports, further narrowed by its active filters.
- Issue details pages intentionally show only that report.
- `client/components/LocationPicker.tsx` is a report-submission pin selector, not a report-browsing map; preserve its selected-location behavior.

## Requirements

1. Inspect all existing map call sites and their data dependencies before editing. Do not change which records each view is authorized to receive.
2. Ensure every valid, unique report in a `ReportMap` input is represented on its map, including compact maps. Do not silently drop reports because the map is compact, because an overview layer is still loading, or because a map has low zoom. Where pins overlap or the list is dense, use the existing clustering/aggregation approach so each report remains discoverable and can be selected; zooming in should reveal individual report pins.
3. Make the initial map view useful for the reports passed to it: fit valid South African report coordinates to the visible bounds with sensible padding and a safe maximum zoom, while retaining the existing South Africa overview when no valid report coordinates exist. Respect a caller's selected-location behavior on the report submission map.
4. Keep all map representations synchronized with the reports supplied by their existing page/context: public maps show the public report set; a resident's private map shows only that resident's reports; a staff map shows only its authorized, currently filtered set; detail maps show their report. Do not fetch broader or private datasets to make maps look identical.
5. Preserve existing province shading, filters, hover/click interactions, report selection/navigation, compact/full-size layout intent, and report submission map behavior. Ensure list selection and pin selection both open the same existing detail destination for that caller.
6. Handle reports with duplicate IDs or invalid/out-of-South-Africa coordinates safely and consistently. Do not fabricate markers, counts, or report records; do not change stored reports or add sample data.
7. Provide an honest empty state for maps with no supplied reports or no valid report coordinates, and avoid hiding the map simply because a feed is empty. Preserve loading and error handling at existing page call sites.
8. Add/update focused tests for shared map-data preparation (deduplication, valid coordinates, cluster membership, and visible bounds) if the repository has a suitable test setup. Otherwise run the existing relevant checks and describe manual verification steps.

## Acceptance checks

- Every applicable map call site is accounted for and displays the complete authorized report set it receives.
- Compact and full-size maps both render/report all supplied records; crowded pins remain accessible through clustering and zoom detail.
- Public, resident, staff, and detail maps retain their existing scopes and navigation.
- The report pin-selection workflow remains usable and does not unintentionally expose other reports.
- Empty data and bad coordinates do not crash or create false pins.
- Run frontend lint/build and relevant tests; report exact results.
