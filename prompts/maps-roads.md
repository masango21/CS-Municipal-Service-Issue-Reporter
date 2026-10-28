# Implementation Prompt: Restore Road Maps

## Goal

Make the real street and road map tiles reliably visible in the report-location picker and all report map views. The current report form screenshot shows Leaflet controls and attribution over a solid gray tile area, so diagnose the tile rendering failure rather than adding decorative road lines or fabricated map content.

## Existing implementation

- `client/components/MapView.tsx` is the shared Leaflet map used by the report location picker and report browsing views.
- It currently uses OpenStreetMap standard raster tiles at `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` with OpenStreetMap attribution.
- The component already supports South Africa bounds, report markers, issue clusters, selected coordinates, and location search/geolocation.
- No local Leaflet CSS override that deliberately hides or grays tile images was found in the inspected client styles.

## Requirements

1. Trace and fix the root cause of the gray map so actual OpenStreetMap roads, place labels, and other normal map details render in the shared component, including on the deployed report page.
2. Keep the existing provider and its proper visible attribution if it is functioning as intended. Do not switch providers, introduce credentials, or add dependencies unless diagnosis establishes that a provider change is necessary and the chosen service is suitable for the project's public pilot, with documented usage limits and attribution.
3. Keep the map working for all existing `MapView` callers. Preserve location pin selection, saved coordinates, search/geolocation centering, report markers/clusters, South Africa bounds, and each map's existing report scope.
4. Do not draw fake roads, add example reports/pins, change report data, or display a success-shaped blank fallback. If tile requests fail, make the problem detectable and provide a clear, accessible indication while leaving map controls and coordinate selection usable.
5. Keep styling responsive and avoid overlays that obscure controls, attribution, roads, or selected pins.
6. Avoid unrelated map redesigns and data/API changes.

## Validation

- Run the existing frontend lint and production build.
- Verify the report location picker and at least one report-browsing map show actual road tiles at useful South African zoom levels.
- Confirm pin selection still records the clicked coordinates and existing report markers remain intact.
- If live provider validation is unavailable, state that limitation and give exact browser steps to verify tile requests and the deployed map.

## Acceptance criteria

- The map no longer appears as a solid gray rectangle when tile requests succeed.
- Road and place-label tiles and required provider attribution are visible.
- Tile failures are surfaced accessibly and do not break map interactions.
- No fake roads, reports, pins, provider secrets, or unrelated features are introduced.
- Lint and production build pass.
