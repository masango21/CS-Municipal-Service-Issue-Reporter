"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GeoJSON, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  getDensityColor,
  getFeatureMunicipalityId,
  getFeatureMunicipalityName,
  getFeatureMunicipalityProvinceCode,
  getFeatureProvinceCode,
  getProvinceName,
  type MunicipalityCollection,
  type MunicipalityFeature,
  type ProvinceCollection,
  type ProvinceFeature,
} from "@/lib/reportDensity";
import { categoryColors, fallbackCategoryColor, fallbackSelectedLocationColor } from "@/lib/mapStyles";
import type { Feature } from "geojson";
import type { Layer, PathOptions } from "leaflet";
import { ReportMapLegend } from "@/components/ReportMapLegend";

const southAfricaCenter = [-30.5595, 22.9375] as [number, number];
const southAfricaBounds: [[number, number], [number, number]] = [
  [-35.0, 16.0],
  [-22.0, 33.0],
];
const southAfricaServiceBounds = {
  minLatitude: -35.5,
  maxLatitude: -22,
  minLongitude: 16,
  maxLongitude: 33,
};

type LocationData = {
  latitude: number;
  longitude: number;
  city?: string;
  municipality?: string;
  municipalityId?: string;
  province?: string;
  address?: string;
};

type MapIssue = {
  id: string;
  title: string;
  category: string;
  priority?: string;
  status?: string;
  reportedAt?: string;
  location: LocationData;
};

export type DensityMapOptions = {
  view: "national" | "province" | "municipality";
  boundaries: ProvinceCollection;
  municipalityBoundaries: MunicipalityCollection | null;
  provinceCounts: Record<string, number>;
  unresolvedCounts: Record<string, number>;
  municipalityReportCounts: Record<string, number>;
  selectedProvinceCode: string | null;
  selectedMunicipalityId: string | null;
  overviewResetKey: number;
  onSelectProvince: (provinceCode: string) => void;
  onSelectMunicipality: (municipalityId: string) => void;
};

type MapViewProps = {
  selectedLocation?: LocationData | null;
  selectedCategory?: string;
  issues?: MapIssue[];
  heightClass?: string;
  emptyMessage?: string;
  densityEnabled?: boolean;
  density?: DensityMapOptions;
  onSelectLocation?: (location: LocationData) => void;
  onSelectIssue?: (issue: MapIssue) => void;
};

type ReportCluster = {
  latitude: number;
  longitude: number;
  issues: MapIssue[];
};

function buildCategoryIcon(category: string, isSelected = false) {
  const color = isSelected
    ? categoryColors[category] ?? fallbackSelectedLocationColor
    : categoryColors[category] ?? fallbackCategoryColor;

  return L.divIcon({
    className: "custom-map-marker",
    html: `
      <div style="
        width: ${isSelected ? "22px" : "18px"};
        height: ${isSelected ? "22px" : "18px"};
        border-radius: 50%;
        background: ${color};
        border: ${isSelected ? "4px solid #1d4ed8" : "2px solid white"};
        box-shadow: 0 0 0 2px white, 0 6px 18px rgba(15, 23, 42, 0.35);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 10px;
        font-weight: 800;
      ">${category ? category.charAt(0).toUpperCase() : "•"}</div>
    `,
    iconSize: isSelected ? [22, 22] : [18, 18],
    iconAnchor: isSelected ? [11, 11] : [9, 9],
    popupAnchor: [0, -12],
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function MapClickHandler({ onSelectLocation }: { onSelectLocation?: MapViewProps["onSelectLocation"] }) {
  useMapEvents({
    click(event) {
      if (!onSelectLocation) return;

      onSelectLocation({
        latitude: Number(event.latlng.lat.toFixed(6)),
        longitude: Number(event.latlng.lng.toFixed(6)),
      });
    },
  });

  return null;
}

function MapCenterController({
  target,
}: {
  target?: { latitude: number; longitude: number } | null;
}) {
  const map = useMap();
  const targetLatitude = target?.latitude;
  const targetLongitude = target?.longitude;

  useEffect(() => {
    if (targetLatitude !== undefined && targetLongitude !== undefined) {
      map.setView([targetLatitude, targetLongitude], 14, { animate: true });
    }
  }, [map, targetLatitude, targetLongitude]);

  return null;
}

function provinceStyle(
  feature: Feature | undefined,
  density: DensityMapOptions,
  hovered = false,
): PathOptions {
  const provinceCode = feature
    ? getFeatureProvinceCode(feature as ProvinceFeature)
    : null;
  const count = provinceCode ? density.provinceCounts[provinceCode] ?? 0 : 0;
  const selected = provinceCode === density.selectedProvinceCode;
  return {
    color: hovered || selected ? "#0f172a" : "#ffffff",
    weight: hovered ? 3 : selected ? 2.5 : 1.25,
    opacity: 1,
    fillColor: getDensityColor(count, Object.values(density.provinceCounts)),
    fillOpacity: hovered ? 0.82 : selected ? 0.75 : 0.58,
  };
}

function provinceOutlineStyle(selected: boolean): PathOptions {
  return {
    color: selected ? "#064e3b" : "#64748b",
    weight: selected ? 4 : 2,
    opacity: 1,
    fillOpacity: 0,
    interactive: false,
  };
}

function ProvinceLayer({
  density,
}: {
  density: DensityMapOptions;
}) {
  const map = useMap();
  const densityRef = useRef(density);
  useEffect(() => {
    densityRef.current = density;
  }, [density]);
  const nationalStyle = useMemo(
    () => (feature: Feature | undefined) => provinceStyle(feature, density, false),
    [density],
  );
  const selectedProvinceStyle = useMemo(
    () => () => provinceOutlineStyle(true),
    [],
  );
  const onEachFeature = useMemo(() => {
    const createTooltip = (feature: Feature): HTMLElement => {
      const code = getFeatureProvinceCode(feature as ProvinceFeature);
      const name = code ? getProvinceName(code) : "South African province";
      const total = code ? densityRef.current.provinceCounts[code] ?? 0 : 0;
      const unresolved = code ? densityRef.current.unresolvedCounts[code] ?? 0 : 0;
      const tooltip = document.createElement("div");
      tooltip.textContent = `${name}: ${total} report${total === 1 ? "" : "s"} (${unresolved} unresolved)`;
      return tooltip;
    };

    return (feature: Feature, layer: Layer) => {
      layer.bindTooltip(createTooltip(feature), { sticky: true, direction: "top" });
      layer.on("mouseover", () => {
        if (layer instanceof L.Path && densityRef.current.view === "national") {
          layer.setStyle(provinceStyle(feature, densityRef.current, true));
          layer.bringToFront();
        }
        layer.getTooltip()?.setContent(createTooltip(feature));
      });
      layer.on("mouseout", () => {
        if (layer instanceof L.Path) {
          layer.setStyle(
            densityRef.current.view === "national"
              ? provinceStyle(feature, densityRef.current)
              : provinceOutlineStyle(true),
          );
        }
      });
      layer.on("click", () => {
        const code = getFeatureProvinceCode(feature as ProvinceFeature);
        if (code) densityRef.current.onSelectProvince(code);
      });
    };
  }, []);

  const selectedFeature = density.selectedProvinceCode
    ? density.boundaries.features.find(
        (feature) => getFeatureProvinceCode(feature) === density.selectedProvinceCode,
      )
    : undefined;
  const previousView = useRef({
    initialized: false,
    view: density.view,
    selectedProvinceCode: density.selectedProvinceCode,
    selectedMunicipalityId: density.selectedMunicipalityId,
    overviewResetKey: density.overviewResetKey,
  });

  useEffect(() => {
    const provinceChanged =
      density.selectedProvinceCode !== previousView.current.selectedProvinceCode;
    const municipalityChanged =
      density.selectedMunicipalityId !== previousView.current.selectedMunicipalityId;
    const resetRequested =
      density.overviewResetKey !== previousView.current.overviewResetKey;
    const firstView = !previousView.current.initialized;
    const previousMode = previousView.current.view;
    previousView.current = {
      initialized: true,
      view: density.view,
      selectedProvinceCode: density.selectedProvinceCode,
      selectedMunicipalityId: density.selectedMunicipalityId,
      overviewResetKey: density.overviewResetKey,
    };

    const selectedMunicipality = density.municipalityBoundaries?.features.find(
      (feature) => getFeatureMunicipalityId(feature) === density.selectedMunicipalityId,
    );
    if (
      density.view === "municipality" &&
      selectedMunicipality &&
      (municipalityChanged || previousMode !== "municipality")
    ) {
      const bounds = L.geoJSON(selectedMunicipality).getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [24, 24], maxZoom: 10, animate: true });
    } else if (
      density.view === "province" &&
      selectedFeature &&
      (provinceChanged || previousMode === "national" || previousMode === "municipality")
    ) {
      const bounds = L.geoJSON(selectedFeature).getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [24, 24], maxZoom: 8, animate: true });
      }
    } else if (
      density.view === "national" &&
      (firstView || resetRequested || previousMode !== "national")
    ) {
      const bounds = L.geoJSON(density.boundaries).getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [24, 24], maxZoom: 6, animate: true });
      }
    }
  }, [
    density.boundaries,
    density.municipalityBoundaries,
    density.overviewResetKey,
    density.selectedMunicipalityId,
    density.selectedProvinceCode,
    density.view,
    map,
    selectedFeature,
  ]);

  if (density.view === "national") {
    return <GeoJSON data={density.boundaries} style={nationalStyle} onEachFeature={onEachFeature} />;
  }
  return selectedFeature
    ? <GeoJSON data={selectedFeature} style={selectedProvinceStyle} onEachFeature={onEachFeature} />
    : null;
}

function municipalityStyle(
  feature: Feature | undefined,
  density: DensityMapOptions,
  hovered = false,
): PathOptions {
  const municipalityId = feature
    ? getFeatureMunicipalityId(feature as MunicipalityFeature)
    : null;
  const selected = municipalityId === density.selectedMunicipalityId;
  return {
    color: hovered || selected ? "#047857" : "#475569",
    weight: hovered ? 2.5 : selected ? 3 : 1,
    opacity: 0.9,
    fillColor: selected ? "#34d399" : "#cbd5e1",
    fillOpacity: selected ? 0.2 : 0.025,
  };
}

function MunicipalityLayer({ density }: { density: DensityMapOptions }) {
  const densityRef = useRef(density);
  useEffect(() => {
    densityRef.current = density;
  }, [density]);

  const features = useMemo(
    () => density.municipalityBoundaries?.features.filter(
      (feature) => getFeatureMunicipalityProvinceCode(feature) === density.selectedProvinceCode,
    ) ?? [],
    [density.municipalityBoundaries, density.selectedProvinceCode],
  );
  const provinceBoundaries: MunicipalityCollection = useMemo(
    () => ({ type: "FeatureCollection", features }),
    [features],
  );
  const style = useMemo(
    () => (feature: Feature | undefined) => municipalityStyle(feature, density),
    [density],
  );
  const onEachFeature = useMemo(() => (feature: Feature, layer: Layer) => {
    const municipality = feature as MunicipalityFeature;
    const municipalityId = getFeatureMunicipalityId(municipality);
    const createTooltip = () => {
      const name = getFeatureMunicipalityName(municipality);
      const reportCount = municipalityId
        ? densityRef.current.municipalityReportCounts[municipalityId] ?? 0
        : 0;
      const tooltip = document.createElement("div");
      tooltip.textContent = `${name}: ${reportCount} report${reportCount === 1 ? "" : "s"}`;
      return tooltip;
    };

    layer.bindTooltip(createTooltip(), { sticky: true, direction: "top" });
    layer.on("mouseover", () => {
      if (layer instanceof L.Path) {
        layer.setStyle(municipalityStyle(feature, densityRef.current, true));
        layer.bringToFront();
      }
      layer.getTooltip()?.setContent(createTooltip());
    });
    layer.on("mouseout", () => {
      if (layer instanceof L.Path) layer.setStyle(municipalityStyle(feature, densityRef.current));
    });
    layer.on("click", () => {
      if (municipalityId) densityRef.current.onSelectMunicipality(municipalityId);
    });
  }, []);

  if (features.length === 0) return null;
  return <GeoJSON data={provinceBoundaries} style={style} onEachFeature={onEachFeature} />;
}

function MapZoomTracker({ onZoomChange }: { onZoomChange: (zoom: number) => void }) {
  const map = useMap();

  useEffect(() => {
    const updateZoom = () => onZoomChange(map.getZoom());
    updateZoom();
    map.on("zoomend", updateZoom);
    return () => {
      map.off("zoomend", updateZoom);
    };
  }, [map, onZoomChange]);

  return null;
}

function isValidReportLocation(issue: MapIssue): boolean {
  const { latitude, longitude } = issue.location;
  return Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -35.5 &&
    latitude <= -22 &&
    longitude >= 16 &&
    longitude <= 33;
}

function uniqueLocatedIssues(issues: MapIssue[]): MapIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    if (seen.has(issue.id) || !isValidReportLocation(issue)) return false;
    seen.add(issue.id);
    return true;
  });
}

function createReportClusters(issues: MapIssue[], zoom: number): ReportCluster[] {
  const cellSize = Math.max(0.00001, 0.6 / 2 ** Math.max(0, zoom - 5));
  const clusters = new Map<string, ReportCluster>();
  for (const issue of issues) {
    const { latitude, longitude } = issue.location;
    const key = `${Math.floor(latitude / cellSize)}:${Math.floor(longitude / cellSize)}`;
    const cluster = clusters.get(key) ?? { latitude: 0, longitude: 0, issues: [] };
    cluster.issues.push(issue);
    cluster.latitude += latitude;
    cluster.longitude += longitude;
    clusters.set(key, cluster);
  }
  return Array.from(clusters.values(), (cluster) => ({
    ...cluster,
    latitude: cluster.latitude / cluster.issues.length,
    longitude: cluster.longitude / cluster.issues.length,
  }));
}

function ReportMapViewport({
  issues,
  target,
  densityEnabled,
}: {
  issues: MapIssue[];
  target?: LocationData | null;
  densityEnabled: boolean;
}) {
  const map = useMap();
  const coordinatesSignature = issues
    .map(({ id, location }) => `${id}:${location.latitude}:${location.longitude}`)
    .join("|");
  const previousSignature = useRef("");

  useEffect(() => {
    if (densityEnabled) return;
    if (target || !coordinatesSignature) {
      previousSignature.current = "";
      return;
    }
    if (coordinatesSignature === previousSignature.current) return;
    previousSignature.current = coordinatesSignature;

    const points = issues
      .filter(isValidReportLocation)
      .map(({ location }) => L.latLng(location.latitude, location.longitude));
    if (points.length === 0) return;

    if (points.length === 1) {
      map.setView(points[0], 13, { animate: true });
      return;
    }

    const bounds = L.latLngBounds(points);
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 10, animate: true });
    }
  }, [coordinatesSignature, densityEnabled, issues, map, target]);

  return null;
}

function ReportClusterMarker({
  cluster,
  icon,
  onSelectIssue,
}: {
  cluster: ReportCluster;
  icon: L.DivIcon;
  onSelectIssue?: MapViewProps["onSelectIssue"];
}) {
  const map = useMap();

  return (
    <Marker
      position={[cluster.latitude, cluster.longitude]}
      icon={icon}
      zIndexOffset={1000}
      eventHandlers={{
        click: (event) => {
          const nextZoom = Math.min(map.getZoom() + 2, 18);
          map.flyTo(event.latlng, nextZoom, { animate: true });
        },
      }}
    >
      <Popup>
        <div className="max-w-64 space-y-2 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">
            {cluster.issues.length} reports in this map cluster
          </p>
          <ul className="max-h-56 space-y-1 overflow-y-auto">
            {cluster.issues.map((issue) => (
              <li key={issue.id}>
                <button
                  type="button"
                  onClick={() => onSelectIssue?.(issue)}
                  className="flex max-w-full items-center gap-2 truncate text-left font-medium text-emerald-700 underline"
                >
                  <span
                    aria-hidden="true"
                    className="inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 border-white text-[9px] font-extrabold text-white shadow"
                    style={{ backgroundColor: categoryColors[issue.category] ?? fallbackCategoryColor }}
                  >
                    {issue.category.charAt(0).toUpperCase()}
                  </span>
                  {issue.title}
                </button>
                <span className="block text-xs text-slate-500">{issue.category} · {issue.status || "Status unavailable"}</span>
              </li>
            ))}
          </ul>
        </div>
      </Popup>
    </Marker>
  );
}

function buildClusterIcon(count: number): L.DivIcon {
  return L.divIcon({
    className: "report-cluster-marker",
    html: `<span role="img" aria-label="${count} grouped reports" title="${count} grouped reports">${count}</span>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

export function MapView({
  selectedLocation,
  selectedCategory,
  issues = [],
  heightClass = "h-[380px]",
  emptyMessage,
  densityEnabled = false,
  density,
  onSelectLocation,
  onSelectIssue,
}: MapViewProps) {
  const [searchText, setSearchText] = useState("");
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [searchError, setSearchError] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [zoom, setZoom] = useState(6);
  const validIssues = useMemo(() => uniqueLocatedIssues(issues), [issues]);
  const clusters = useMemo(
    () => createReportClusters(validIssues, zoom),
    [validIssues, zoom],
  );
  const onZoomChange = useMemo(() => (nextZoom: number) => setZoom(nextZoom), []);
  const categories = useMemo(
    () => Array.from(new Set(validIssues.map((issue) => issue.category))).sort(),
    [validIssues],
  );
  const hasClusters = clusters.some((cluster) => cluster.issues.length > 1);
  const hasUnmappableReports = issues.some((issue) => !isValidReportLocation(issue));

  const selectLocation = (location: LocationData, shouldCenter = false) => {
    setCurrentLocation(shouldCenter
      ? { latitude: location.latitude, longitude: location.longitude }
      : null);
    onSelectLocation?.(location);
  };

  const handleSearch = async () => {
    const query = searchText.trim();
    if (!query || isSearching) {
      setSearchError("Please enter a location to search.");
      return;
    }

    setSearchError("");
    setIsSearching(true);

    try {
      const searchUrl = new URL("https://nominatim.openstreetmap.org/search");
      searchUrl.searchParams.set("format", "jsonv2");
      searchUrl.searchParams.set("countrycodes", "za");
      searchUrl.searchParams.set("limit", "1");
      searchUrl.searchParams.set("q", query);
      const response = await fetch(searchUrl);
      if (!response.ok) throw new Error("Search service unavailable");
      const results: unknown = await response.json();

      if (!Array.isArray(results) || results.length === 0) {
        setSearchError("No matching South African location found.");
        return;
      }

      if (!isRecord(results[0])) {
        setSearchError("No matching South African location found.");
        return;
      }
      const place = results[0];
      const latitude = Number(place.lat);
      const longitude = Number(place.lon);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
          latitude < southAfricaServiceBounds.minLatitude ||
          latitude > southAfricaServiceBounds.maxLatitude ||
          longitude < southAfricaServiceBounds.minLongitude ||
          longitude > southAfricaServiceBounds.maxLongitude) {
        setSearchError("No matching South African location found.");
        return;
      }

      selectLocation({ latitude, longitude }, true);
    } catch {
      setSearchError("Search failed. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleUseMyLocation = () => {
    if (isLocating) return;
    if (!navigator.geolocation) {
      setSearchError("Geolocation is not supported in this browser.");
      return;
    }

    setSearchError("");
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLocation = {
          latitude: Number(position.coords.latitude.toFixed(6)),
          longitude: Number(position.coords.longitude.toFixed(6)),
        };

        setIsLocating(false);
        if (nextLocation.latitude < southAfricaServiceBounds.minLatitude ||
            nextLocation.latitude > southAfricaServiceBounds.maxLatitude ||
            nextLocation.longitude < southAfricaServiceBounds.minLongitude ||
            nextLocation.longitude > southAfricaServiceBounds.maxLongitude) {
          setSearchError("Your current location is outside the supported South African service area.");
          return;
        }
        selectLocation(nextLocation, true);
        setSearchError("");
      },
      (error) => {
        setIsLocating(false);
        if (error.code === error.PERMISSION_DENIED) {
          setSearchError("Location permission was denied. Allow location access in your browser settings or select a point on the map.");
        } else if (error.code === error.TIMEOUT) {
          setSearchError("Your current location could not be found in time. Please try again.");
        } else {
          setSearchError("Your current location is unavailable. Please try again or select a point on the map.");
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000,
      },
    );
  };

  return (
    <div className="space-y-3">
      <div className={`${heightClass} w-full overflow-hidden rounded-2xl border border-slate-200`}>
        <MapContainer
          center={southAfricaCenter}
          zoom={6}
          minZoom={5}
          maxZoom={18}
          maxBounds={southAfricaBounds}
          className="h-full w-full"
        >
          {density && density.view !== "national" && density.municipalityBoundaries && (
            <MunicipalityLayer density={density} />
          )}
          {density && <ProvinceLayer density={density} />}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapZoomTracker onZoomChange={onZoomChange} />
          <MapClickHandler onSelectLocation={selectLocation} />
          <MapCenterController target={currentLocation ?? selectedLocation ?? null} />
          <ReportMapViewport
            issues={validIssues}
            target={currentLocation ? null : selectedLocation}
            densityEnabled={densityEnabled}
          />

          {clusters.map((cluster) => cluster.issues.length === 1 ? (
            <Marker
              key={cluster.issues[0].id}
              position={[cluster.issues[0].location.latitude, cluster.issues[0].location.longitude]}
              icon={buildCategoryIcon(cluster.issues[0].category)}
              eventHandlers={{
                click: () => onSelectIssue?.(cluster.issues[0]),
              }}
            >
              <Popup>
                <div className="space-y-2 text-sm text-slate-700">
                  <div className="font-bold text-slate-900">{cluster.issues[0].title}</div>
                  <div>{cluster.issues[0].category}</div>
                  {cluster.issues[0].status && <div>{cluster.issues[0].status}</div>}
                  <div>{cluster.issues[0].location.city || "South Africa"}</div>
                </div>
              </Popup>
            </Marker>
          ) : (
            <ReportClusterMarker
              key={`${cluster.latitude}:${cluster.longitude}`}
              cluster={cluster}
              icon={buildClusterIcon(cluster.issues.length)}
              onSelectIssue={onSelectIssue}
            />
          ))}

          {selectedLocation && (
            <Marker
              position={[selectedLocation.latitude, selectedLocation.longitude]}
              icon={buildCategoryIcon(selectedCategory ?? "Selected", true)}
            >
              <Popup>
                <div className="space-y-1 text-sm">
                  <div className="font-bold">Selected location</div>
                  <div>{selectedLocation.city || "South Africa"}</div>
                  <div>{selectedLocation.address || "Exact issue point"}</div>
                </div>
              </Popup>
            </Marker>
          )}
        </MapContainer>
      </div>

      <ReportMapLegend
        categories={categories}
        hasClusters={hasClusters}
        hasSelectedLocation={Boolean(selectedLocation)}
        hasReports={issues.length > 0}
        allowsLocationSelection={Boolean(onSelectLocation)}
        selectedCategory={selectedCategory}
        hasUnmappableReports={hasUnmappableReports}
        geographicView={density?.view}
        hasMunicipalityBoundaries={Boolean(
          density?.view !== "national" && density?.municipalityBoundaries,
        )}
        hasSelectedMunicipality={Boolean(
          density?.view === "municipality" && density.municipalityBoundaries,
        )}
      />

      {issues.length > 0 && validIssues.length === 0 && !onSelectLocation && (
        <p role="status" className="text-sm text-slate-600">
          No report pins can be shown because these reports do not have valid South African coordinates.
        </p>
      )}
      {issues.length === 0 && !onSelectLocation && (
        <p role="status" className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-600">
          {emptyMessage ?? "No reports yet. This map is ready for the first report."}
        </p>
      )}

      <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            aria-label="Search for a place in South Africa"
            placeholder="Search for a place in South Africa"
            className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500"
          />
          <button
            type="button"
            onClick={handleSearch}
            disabled={isSearching}
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            {isSearching ? "Searching..." : "Search"}
          </button>
          <button
            type="button"
            onClick={handleUseMyLocation}
            disabled={isLocating}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-emerald-200 hover:text-emerald-700"
          >
            {isLocating ? "Finding location..." : "Use My Location"}
          </button>
        </div>

        {searchError && (
          <p role="alert" aria-live="polite" className="text-sm font-medium text-rose-600">{searchError}</p>
        )}

      </div>
    </div>
  );
}
