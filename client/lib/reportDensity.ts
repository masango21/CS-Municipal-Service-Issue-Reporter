import type { Feature, FeatureCollection, Geometry, Position } from "geojson";
import type { Issue } from "@/types/issue";

export type ProvinceProperties = {
  shapeISO?: string;
  shapeName?: string;
  [property: string]: unknown;
};

export type ProvinceFeature = Feature<Geometry, ProvinceProperties>;
export type ProvinceCollection = FeatureCollection<Geometry, ProvinceProperties>;

export type MunicipalityProperties = {
  MUNICNAME: string;
  NAMECODE: string;
  PROVINCE: string;
  CATEGORY?: string;
  [property: string]: unknown;
};

export type MunicipalityFeature = Feature<Geometry, MunicipalityProperties>;
export type MunicipalityCollection = FeatureCollection<Geometry, MunicipalityProperties>;

const provinceNames: Record<string, string> = {
  EC: "Eastern Cape",
  FS: "Free State",
  GT: "Gauteng",
  KZ: "KwaZulu-Natal",
  LI: "Limpopo",
  MP: "Mpumalanga",
  NC: "Northern Cape",
  NW: "North West",
  WC: "Western Cape",
};

const provinceAliases: Record<string, string> = {
  EC: "EC",
  "EASTERN CAPE": "EC",
  FS: "FS",
  "FREE STATE": "FS",
  GP: "GT",
  GT: "GT",
  GAUTENG: "GT",
  KZ: "KZ",
  KZN: "KZ",
  "KWAZULU-NATAL": "KZ",
  LI: "LI",
  LP: "LI",
  LIM: "LI",
  LIMPOPO: "LI",
  MP: "MP",
  MPUMALANGA: "MP",
  NC: "NC",
  "NORTHERN CAPE": "NC",
  NW: "NW",
  "NORTH WEST": "NW",
  WC: "WC",
  "WESTERN CAPE": "WC",
};

export type LocatedIssue = {
  issue: Issue;
  provinceCode: string | null;
};

export type MunicipalitySummary = {
  key: string;
  id: string | null;
  name: string;
  province: string;
  reports: Issue[];
  reportCount: number;
  unresolvedCount: number;
};

export type DensityLegendBand = {
  color: string;
  label: string;
};

const DENSITY_COLORS = ["#22c55e", "#eab308", "#f97316", "#ef4444"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPosition(value: unknown): value is Position {
  return Array.isArray(value) &&
    value.length >= 2 &&
    value.every((coordinate) => typeof coordinate === "number" && Number.isFinite(coordinate));
}

function isLinearRing(value: unknown): value is Position[] {
  return Array.isArray(value) && value.length >= 4 && value.every(isPosition);
}

function isPolygonCoordinates(value: unknown): value is Position[][] {
  return Array.isArray(value) && value.length > 0 && value.every(isLinearRing);
}

function isMultiPolygonCoordinates(value: unknown): value is Position[][][] {
  return Array.isArray(value) && value.length > 0 && value.every(isPolygonCoordinates);
}

function isProvinceGeometry(value: unknown): value is Geometry {
  if (!isRecord(value)) return false;
  if (value.type === "Polygon") return isPolygonCoordinates(value.coordinates);
  if (value.type === "MultiPolygon") return isMultiPolygonCoordinates(value.coordinates);
  return false;
}

export function isProvinceCollection(value: unknown): value is ProvinceCollection {
  if (!isRecord(value) || value.type !== "FeatureCollection" || !Array.isArray(value.features)) {
    return false;
  }
  return value.features.length > 0 && value.features.every((feature) =>
    isRecord(feature) &&
    feature.type === "Feature" &&
    isRecord(feature.properties) &&
    typeof feature.properties.shapeISO === "string" &&
    isProvinceGeometry(feature.geometry),
  );
}

export function isMunicipalityCollection(value: unknown): value is MunicipalityCollection {
  if (!isRecord(value) || value.type !== "FeatureCollection" || !Array.isArray(value.features)) {
    return false;
  }
  return value.features.length > 0 && value.features.every((feature) =>
    isRecord(feature) &&
    feature.type === "Feature" &&
    isRecord(feature.properties) &&
    typeof feature.properties.MUNICNAME === "string" &&
    typeof feature.properties.NAMECODE === "string" &&
    typeof feature.properties.PROVINCE === "string" &&
    isProvinceGeometry(feature.geometry),
  );
}

export function getProvinceName(code: string): string {
  return provinceNames[code] ?? code;
}

export function normalizeMunicipalityId(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  const source = value.trim();
  return (source.match(/\(([A-Z0-9-]+)\)$/i)?.[1] ?? source).toUpperCase();
}

export function getFeatureMunicipalityId(feature: MunicipalityFeature): string | null {
  return normalizeMunicipalityId(feature.properties.NAMECODE);
}

export function getFeatureMunicipalityProvinceCode(feature: MunicipalityFeature): string | null {
  return getProvinceCode(feature.properties.PROVINCE);
}

export function getFeatureMunicipalityName(feature: MunicipalityFeature): string {
  return feature.properties.MUNICNAME.trim();
}

export function getDensityColor(count: number, counts: number[]): string {
  if (count === 0) return "#e2e8f0";
  const positiveCounts = counts.filter((value) => value > 0).sort((first, second) => first - second);
  const quantile = (position: number) =>
    positiveCounts[Math.floor((positiveCounts.length - 1) * position)] ?? count;
  if (count <= quantile(0.25)) return DENSITY_COLORS[0];
  if (count <= quantile(0.5)) return DENSITY_COLORS[1];
  if (count <= quantile(0.75)) return DENSITY_COLORS[2];
  return DENSITY_COLORS[3];
}

export function getDensityLegendBands(counts: number[]): DensityLegendBand[] {
  const countsByColor = new Map<string, number[]>();
  for (const count of new Set(counts.filter((value) => value > 0))) {
    const color = getDensityColor(count, counts);
    countsByColor.set(color, [...(countsByColor.get(color) ?? []), count]);
  }

  const densityLabels = new Map<string, string>([
    [DENSITY_COLORS[0], "Low"],
    [DENSITY_COLORS[1], "Moderate"],
    [DENSITY_COLORS[2], "High"],
    [DENSITY_COLORS[3], "Very high"],
  ]);
  const reportRange = (values: number[]) => {
    const minimum = Math.min(...values);
    const maximum = Math.max(...values);
    return minimum === maximum
      ? `${minimum} report${minimum === 1 ? "" : "s"}`
      : `${minimum}–${maximum} reports`;
  };

  return [
    { color: "#e2e8f0", label: "0 reports" },
    ...DENSITY_COLORS.flatMap((color) => {
      const values = countsByColor.get(color);
      return values
        ? [{ color, label: `${densityLabels.get(color)} · ${reportRange(values)}` }]
        : [];
    }),
  ];
}

export function getProvinceCode(value: string | undefined): string | null {
  if (!value) return null;
  return provinceAliases[value.trim().toUpperCase()] ?? null;
}

export function getFeatureProvinceCode(feature: ProvinceFeature): string | null {
  return getProvinceCode(feature.properties?.shapeISO) ??
    getProvinceCode(feature.properties?.shapeName);
}

export function isValidSouthAfricanLocation(issue: Issue): boolean {
  const { latitude, longitude } = issue.location;
  return Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -35.5 &&
    latitude <= -22 &&
    longitude >= 16 &&
    longitude <= 33;
}

function pointInRing(longitude: number, latitude: number, ring: Position[]): boolean {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const [currentLongitude, currentLatitude] = ring[index];
    const [previousLongitude, previousLatitude] = ring[previous];
    const crossesLatitude = (currentLatitude > latitude) !== (previousLatitude > latitude);
    if (
      crossesLatitude &&
      longitude <
        ((previousLongitude - currentLongitude) * (latitude - currentLatitude)) /
          (previousLatitude - currentLatitude) +
          currentLongitude
    ) {
      inside = !inside;
    }
  }
  return inside;
}

function pointInPolygon(longitude: number, latitude: number, polygon: Position[][]): boolean {
  const [outerRing, ...holes] = polygon;
  if (!outerRing || !pointInRing(longitude, latitude, outerRing)) return false;
  return !holes.some((hole) => pointInRing(longitude, latitude, hole));
}

function geometryContainsPoint(geometry: Geometry | null, longitude: number, latitude: number): boolean {
  if (!geometry) return false;
  if (geometry.type === "Polygon") {
    return pointInPolygon(longitude, latitude, geometry.coordinates);
  }
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.some((polygon) => pointInPolygon(longitude, latitude, polygon));
  }
  return false;
}

export function locateIssues(
  issues: Issue[],
  boundaries: ProvinceCollection | null,
): LocatedIssue[] {
  const seen = new Set<string>();
  return issues.flatMap((issue) => {
    if (seen.has(issue.id)) return [];
    seen.add(issue.id);

    const explicitProvince = getProvinceCode(issue.location.province);
    const hasValidLocation = isValidSouthAfricanLocation(issue);
    const matchingFeature = explicitProvince || !hasValidLocation
      ? undefined
      : boundaries?.features.find((feature) =>
          geometryContainsPoint(feature.geometry, issue.location.longitude, issue.location.latitude),
        );
    const provinceCode = explicitProvince ??
      (matchingFeature ? getFeatureProvinceCode(matchingFeature) : null);
    return [{ issue, provinceCode }];
  });
}

export function getMunicipalityKey(issue: Issue, provinceCode: string): string {
  const municipalityId = normalizeMunicipalityId(issue.location.municipalityId);
  if (municipalityId) return `${provinceCode}:id:${municipalityId}`;
  return `${provinceCode}:unknown`;
}

function municipalityFeatureForIssue(
  issue: Issue,
  features: MunicipalityFeature[],
): MunicipalityFeature | undefined {
  const municipalityId = normalizeMunicipalityId(issue.location.municipalityId);
  if (municipalityId) {
    return features.find((feature) => getFeatureMunicipalityId(feature) === municipalityId);
  }
  if (!isValidSouthAfricanLocation(issue)) return undefined;
  const matches = features.filter((feature) =>
    geometryContainsPoint(feature.geometry, issue.location.longitude, issue.location.latitude),
  );
  return matches.length === 1 ? matches[0] : undefined;
}

export function summarizeMunicipalities(
  issues: Issue[],
  provinceCode: string,
  boundaries?: MunicipalityCollection | null,
): MunicipalitySummary[] {
  if (boundaries) {
    const provinceFeatures = boundaries.features.filter(
      (feature) => getFeatureMunicipalityProvinceCode(feature) === provinceCode,
    );
    const reportsById = new Map<string, Issue[]>();
    for (const issue of issues) {
      const feature = municipalityFeatureForIssue(issue, provinceFeatures);
      const municipalityId = feature ? getFeatureMunicipalityId(feature) : null;
      if (!municipalityId) continue;
      reportsById.set(municipalityId, [...(reportsById.get(municipalityId) ?? []), issue]);
    }

    return provinceFeatures.flatMap((feature) => {
      const id = getFeatureMunicipalityId(feature);
      const name = getFeatureMunicipalityName(feature);
      const reports = id ? reportsById.get(id) ?? [] : [];
      return id ? [{
        key: `${provinceCode}:id:${id}`,
        id,
        name,
        province: getProvinceName(provinceCode),
        reports,
        reportCount: reports.length,
        unresolvedCount: reports.filter(
          (issue) => issue.status !== "Resolved" && issue.status !== "Closed",
        ).length,
      }] : [];
    }).sort(
      (first, second) =>
        second.reportCount - first.reportCount || first.name.localeCompare(second.name),
    );
  }

  const municipalities = new Map<string, MunicipalitySummary>();
  for (const issue of issues) {
    const municipalityId = normalizeMunicipalityId(issue.location.municipalityId);
    if (!municipalityId) continue;
    const key = getMunicipalityKey(issue, provinceCode);
    const municipalityName = issue.location.municipality?.trim() || municipalityId;
    const summary = municipalities.get(key) ?? {
      key,
      id: municipalityId,
      name: municipalityName,
      province: getProvinceName(provinceCode),
      reports: [],
      reportCount: 0,
      unresolvedCount: 0,
    };
    summary.reports.push(issue);
    summary.reportCount += 1;
    if (issue.status !== "Resolved" && issue.status !== "Closed") {
      summary.unresolvedCount += 1;
    }
    municipalities.set(key, summary);
  }
  return Array.from(municipalities.values()).sort(
    (first, second) =>
      second.reportCount - first.reportCount || first.name.localeCompare(second.name),
  );
}
