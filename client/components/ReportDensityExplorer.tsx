"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MapView, type DensityMapOptions } from "@/components/MapView";
import {
  getDensityLegendBands,
  getFeatureProvinceCode,
  getProvinceName,
  isMunicipalityCollection,
  isProvinceCollection,
  isValidSouthAfricanLocation,
  locateIssues,
  summarizeMunicipalities,
  type MunicipalityCollection,
  type MunicipalitySummary,
  type ProvinceCollection,
} from "@/lib/reportDensity";
import type { Issue } from "@/types/issue";

type ReportDensityExplorerProps = {
  issues: Issue[];
  emptyMessage?: string;
  onSelectIssue?: (issue: Issue) => void;
  compact?: boolean;
};

type ReportBreakdown = {
  name: string;
  count: number;
};

function countBy(
  issues: Issue[],
  getName: (issue: Issue) => string | undefined,
): ReportBreakdown[] {
  const counts = new Map<string, number>();
  for (const issue of issues) {
    const name = getName(issue)?.trim();
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return Array.from(counts, ([name, count]) => ({ name, count })).sort(
    (first, second) => second.count - first.count || first.name.localeCompare(second.name),
  );
}

function displayDate(value: string | undefined): string {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleDateString("en-ZA");
}

function reportTimestamp(issue: Issue): number {
  const timestamp = new Date(issue.reportedAt).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

let provinceBoundaryRequest: Promise<ProvinceCollection> | undefined;

function fetchProvinceBoundaries(): Promise<ProvinceCollection> {
  if (!provinceBoundaryRequest) {
    provinceBoundaryRequest = fetch("/geojson/south-africa-provinces.geojson", { cache: "force-cache" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Province boundaries could not be loaded (HTTP ${response.status}).`);
        }
        const payload: unknown = await response.json();
        if (!isProvinceCollection(payload)) {
          throw new Error("The local province boundary dataset is invalid.");
        }
        return payload;
      })
      .catch((error: unknown) => {
        provinceBoundaryRequest = undefined;
        throw error;
      });
  }
  return provinceBoundaryRequest;
}

let municipalityBoundaryRequest: Promise<MunicipalityCollection> | undefined;

function fetchMunicipalityBoundaries(): Promise<MunicipalityCollection> {
  if (!municipalityBoundaryRequest) {
    municipalityBoundaryRequest = fetch("/geojson/south-africa-municipalities.geojson", { cache: "force-cache" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Municipality boundaries could not be loaded (HTTP ${response.status}).`);
        }
        const payload: unknown = await response.json();
        if (!isMunicipalityCollection(payload)) {
          throw new Error("The local municipality boundary dataset is invalid.");
        }
        return payload;
      })
      .catch((error: unknown) => {
        municipalityBoundaryRequest = undefined;
        throw error;
      });
  }
  return municipalityBoundaryRequest;
}

export function ReportDensityExplorer({
  issues,
  emptyMessage,
  onSelectIssue,
  compact = false,
}: ReportDensityExplorerProps) {
  const [boundaries, setBoundaries] = useState<ProvinceCollection | null>(null);
  const [boundaryError, setBoundaryError] = useState<string | null>(null);
  const [municipalityBoundaries, setMunicipalityBoundaries] = useState<MunicipalityCollection | null>(null);
  const [municipalityBoundaryError, setMunicipalityBoundaryError] = useState<string | null>(null);
  const [selectedProvinceCode, setSelectedProvinceCode] = useState<string | null>(null);
  const [selectedMunicipalityKey, setSelectedMunicipalityKey] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [overviewResetKey, setOverviewResetKey] = useState(0);

  useEffect(() => {
    let active = true;
    fetchProvinceBoundaries()
      .then((collection) => {
        if (active) {
          setBoundaries(collection);
          setBoundaryError(null);
        }
      })
      .catch((error: unknown) => {
        if (!active) return;
        setBoundaryError(
          error instanceof Error ? error.message : "Province boundaries could not be loaded.",
        );
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedProvinceCode) return;
    let active = true;
    fetchMunicipalityBoundaries()
      .then((collection) => {
        if (active) {
          setMunicipalityBoundaries(collection);
          setMunicipalityBoundaryError(null);
        }
      })
      .catch((error: unknown) => {
        if (!active) return;
        setMunicipalityBoundaryError(
          error instanceof Error ? error.message : "Municipality boundaries could not be loaded.",
        );
      });
    return () => {
      active = false;
    };
  }, [selectedProvinceCode]);

  const locatedIssues = useMemo(
    () => locateIssues(issues, boundaries),
    [boundaries, issues],
  );
  const filteredLocatedIssues = useMemo(
    () =>
      locatedIssues
        .filter(({ issue }) =>
          (!categoryFilter || issue.category === categoryFilter) &&
          (!priorityFilter || issue.priority === priorityFilter) &&
          (!statusFilter || issue.status === statusFilter),
        )
        .sort(
          (first, second) =>
            reportTimestamp(second.issue) - reportTimestamp(first.issue),
        ),
    [categoryFilter, locatedIssues, priorityFilter, statusFilter],
  );

  const selectedProvinceIssues = useMemo(
    () =>
      selectedProvinceCode
        ? filteredLocatedIssues.filter(
            ({ provinceCode }) => provinceCode === selectedProvinceCode,
          )
        : [],
    [filteredLocatedIssues, selectedProvinceCode],
  );
  const municipalityOptions = useMemo(
    () =>
      selectedProvinceCode
        ? summarizeMunicipalities(
            selectedProvinceIssues.map(({ issue }) => issue),
            selectedProvinceCode,
            municipalityBoundaries,
          )
        : [],
    [municipalityBoundaries, selectedProvinceCode, selectedProvinceIssues],
  );
  const selectedMunicipality = municipalityOptions.find(
    (municipality) => municipality.key === selectedMunicipalityKey,
  );
  const activeMunicipalityKey = selectedMunicipality ? selectedMunicipalityKey : "";
  const displayedLocatedIssues = useMemo(() => {
    if (selectedMunicipality && selectedProvinceCode) {
      return selectedMunicipality.reports.map((issue) => ({ issue, provinceCode: selectedProvinceCode }));
    }
    return selectedProvinceCode ? selectedProvinceIssues : filteredLocatedIssues;
  }, [
    filteredLocatedIssues,
    selectedMunicipality,
    selectedProvinceCode,
    selectedProvinceIssues,
  ]);
  const displayedIssues = useMemo(
    () => displayedLocatedIssues.map(({ issue }) => issue),
    [displayedLocatedIssues],
  );
  const categoryOptions = useMemo(
    () => Array.from(new Set(locatedIssues.map(({ issue }) => issue.category))).sort(),
    [locatedIssues],
  );
  const priorityOptions = useMemo(
    () => Array.from(new Set(locatedIssues.map(({ issue }) => issue.priority))).sort(),
    [locatedIssues],
  );
  const statusOptions = useMemo(
    () => Array.from(new Set(locatedIssues.map(({ issue }) => issue.status))).sort(),
    [locatedIssues],
  );
  const provinceCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const { provinceCode } of filteredLocatedIssues) {
      if (provinceCode) counts[provinceCode] = (counts[provinceCode] ?? 0) + 1;
    }
    return counts;
  }, [filteredLocatedIssues]);
  const provinceBreakdown = useMemo(
    () => Object.entries(provinceCounts)
      .map(([code, count]) => ({ name: getProvinceName(code), count }))
      .sort((first, second) => second.count - first.count || first.name.localeCompare(second.name)),
    [provinceCounts],
  );
  const unresolvedCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const { issue, provinceCode } of filteredLocatedIssues) {
      if (
        provinceCode &&
        issue.status !== "Resolved" &&
        issue.status !== "Closed"
      ) {
        counts[provinceCode] = (counts[provinceCode] ?? 0) + 1;
      }
    }
    return counts;
  }, [filteredLocatedIssues]);
  const municipalityReportCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const municipality of municipalityOptions) {
      if (municipality.id) counts[municipality.id] = municipality.reportCount;
    }
    return counts;
  }, [municipalityOptions]);
  const geographicView = selectedMunicipality
    ? "municipality"
    : selectedProvinceCode
      ? "province"
      : "national";
  const densityOptions = useMemo<DensityMapOptions | undefined>(
    () =>
      boundaries
        ? {
            view: geographicView,
            boundaries,
            municipalityBoundaries,
            provinceCounts,
            unresolvedCounts,
            municipalityReportCounts,
            selectedProvinceCode,
            selectedMunicipalityId: selectedMunicipality?.id ?? null,
            overviewResetKey,
            onSelectProvince: (provinceCode) => {
              setSelectedProvinceCode(provinceCode);
              setSelectedMunicipalityKey("");
            },
            onSelectMunicipality: (municipalityId) => {
              if (selectedProvinceCode) {
                setSelectedMunicipalityKey(`${selectedProvinceCode}:id:${municipalityId}`);
              }
            },
          }
        : undefined,
    [
      boundaries,
      geographicView,
      municipalityBoundaries,
      municipalityReportCounts,
      overviewResetKey,
      provinceCounts,
      selectedMunicipality,
      selectedProvinceCode,
      unresolvedCounts,
    ],
  );
  const provinceSummaries = useMemo<MunicipalitySummary[]>(
    () =>
      selectedProvinceCode
        ? municipalityOptions
        : [],
    [municipalityOptions, selectedProvinceCode],
  );
  const categoryBreakdown = useMemo(
    () => countBy(displayedIssues, (issue) => issue.category),
    [displayedIssues],
  );
  const priorityBreakdown = useMemo(
    () => countBy(displayedIssues, (issue) => issue.priority),
    [displayedIssues],
  );
  const statusBreakdown = useMemo(
    () => countBy(displayedIssues, (issue) => issue.status),
    [displayedIssues],
  );
  const unresolvedCount = displayedIssues.filter(
    (issue) => issue.status !== "Resolved" && issue.status !== "Closed",
  ).length;
  const resolvedCount = displayedIssues.length - unresolvedCount;
  const plottedReportCount = displayedIssues.filter(isValidSouthAfricanLocation).length;
  const unplottableReportCount = displayedIssues.length - plottedReportCount;
  const provinceName = selectedProvinceCode
    ? getProvinceName(selectedProvinceCode)
    : "South Africa";
  const summaryName = selectedMunicipality?.name ?? provinceName;
  const unassignedProvinceCount = filteredLocatedIssues.filter(
    ({ provinceCode }) => provinceCode === null,
  ).length;

  const resetFilters = () => {
    setSelectedProvinceCode(null);
    setSelectedMunicipalityKey("");
    setCategoryFilter("");
    setPriorityFilter("");
    setStatusFilter("");
    setOverviewResetKey((current) => current + 1);
  };
  const returnToOverview = () => {
    setSelectedProvinceCode(null);
    setSelectedMunicipalityKey("");
    setOverviewResetKey((current) => current + 1);
  };
  const returnToProvince = () => setSelectedMunicipalityKey("");

  return (
    <div className="space-y-4">
      {!compact && <section
        aria-label="Report map filters"
        className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 xl:grid-cols-5"
      >
        <label className="space-y-1 text-sm font-medium text-slate-700">
          <span>Province</span>
          <select
            value={selectedProvinceCode ?? ""}
            onChange={(event) => {
              setSelectedProvinceCode(event.target.value || null);
              setSelectedMunicipalityKey("");
            }}
            disabled={!boundaries}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
          >
            <option value="">All provinces</option>
            {boundaries?.features.map((feature) => {
              const code = getFeatureProvinceCode(feature);
              return code ? (
                <option key={code} value={code}>{getProvinceName(code)}</option>
              ) : null;
            })}
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          <span>Municipality</span>
          <select
            value={activeMunicipalityKey}
            onChange={(event) => setSelectedMunicipalityKey(event.target.value)}
            disabled={!selectedProvinceCode || municipalityOptions.length === 0}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
          >
            <option value="">All municipalities</option>
            {municipalityOptions.map((municipality) => (
              <option key={municipality.key} value={municipality.key}>
                {municipality.name} ({municipality.reportCount})
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          <span>Category</span>
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
          >
            <option value="">All categories</option>
            {categoryOptions.map((category) => <option key={category}>{category}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          <span>Priority</span>
          <select
            value={priorityFilter}
            onChange={(event) => setPriorityFilter(event.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
          >
            <option value="">All priorities</option>
            {priorityOptions.map((priority) => <option key={priority}>{priority}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          <span>Status</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
          >
            <option value="">All statuses</option>
            {statusOptions.map((status) => <option key={status}>{status}</option>)}
          </select>
        </label>
        <div className="flex flex-wrap gap-2 sm:col-span-2 xl:col-span-5">
          <button
            type="button"
            onClick={returnToOverview}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            South Africa overview
          </button>
          <button
            type="button"
            onClick={resetFilters}
            className="rounded-lg border border-emerald-700 px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50"
          >
            Reset filters
          </button>
        </div>
      </section>}

      {boundaryError && (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {boundaryError} Province selection and national density shading are unavailable; report pins remain usable.
        </p>
      )}
      {!boundaries && !boundaryError && (
        <p role="status" className="text-sm text-slate-600">Loading South African province boundaries...</p>
      )}
      {selectedProvinceCode && municipalityBoundaryError && (
        <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {municipalityBoundaryError} Municipality boundary selection is unavailable; report associations and province reports remain available.
        </p>
      )}
      {selectedProvinceCode && !municipalityBoundaries && !municipalityBoundaryError && (
        <p role="status" className="text-sm text-slate-600">Loading municipality boundaries...</p>
      )}

      <MapView
        densityEnabled
        issues={displayedIssues.map((issue) => ({
          id: issue.id,
          title: issue.title,
          category: issue.category,
          priority: issue.priority,
          status: issue.status,
          reportedAt: issue.reportedAt,
          location: {
            latitude: issue.location.latitude,
            longitude: issue.location.longitude,
            city: issue.location.city,
            municipality: issue.location.municipality,
            municipalityId: issue.location.municipalityId,
            province: issue.location.province,
            address: issue.location.address,
          },
        }))}
        heightClass={compact ? "h-[260px]" : "h-[420px]"}
        density={densityOptions}
        onSelectIssue={(mapIssue) => {
          const selected = displayedIssues.find((issue) => issue.id === mapIssue.id);
          if (selected) onSelectIssue?.(selected);
        }}
      />

      {compact ? (
        <section aria-label={`${summaryName} report summary`} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                {selectedMunicipality
                  ? "Municipality summary"
                  : selectedProvinceCode
                    ? "Province summary"
                    : "South Africa overview"}
              </p>
              <h4 className="mt-1 font-bold text-slate-900">{summaryName}</h4>
              <p className="mt-1 text-sm text-slate-600">
                {displayedIssues.length} report{displayedIssues.length === 1 ? "" : "s"} · {plottedReportCount} plottable · {unplottableReportCount} without valid coordinates
              </p>
              {selectedMunicipality && (
                <p className="mt-1 text-xs text-slate-500">In {selectedMunicipality.province} · {unresolvedCount} unresolved</p>
              )}
              {selectedProvinceCode && municipalityBoundaries && (
                <p className="mt-1 text-xs text-slate-500">{municipalityOptions.length} municipalities in this province</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedMunicipality && (
                <button
                  type="button"
                  onClick={returnToProvince}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Entire province
                </button>
              )}
              {selectedProvinceCode && (
              <button
                type="button"
                onClick={returnToOverview}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                South Africa overview
              </button>
              )}
            </div>
          </div>
          {!selectedProvinceCode && (
            <div>
              <h5 className="text-sm font-semibold text-slate-900">Province report density</h5>
              <ul className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-700 sm:grid-cols-3">
                {boundaryError ? (
                  <li className="col-span-full text-slate-600">Province density is unavailable because boundary data failed to load.</li>
                ) : (
                  getDensityLegendBands(Object.values(provinceCounts)).map((band) => (
                    <LegendItem key={band.color} color={band.color} label={band.label} />
                  ))
                )}
              </ul>
              {!boundaryError && (
                <p className="mt-1 text-xs text-slate-500">
                  Quartiles use the authorized reports shown on this map.
                </p>
              )}
            </div>
          )}
          {selectedProvinceCode ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <Breakdown title="Reports by category" rows={categoryBreakdown} />
              <Breakdown title="Reports by priority" rows={priorityBreakdown} />
              <Breakdown title="Reports by status" rows={statusBreakdown} />
            </div>
          ) : (
            <Breakdown title="Reports by province" rows={provinceBreakdown} />
          )}
        </section>
      ) : <section
        aria-label={`${summaryName} report summary`}
        className="grid gap-5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"
      >
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
              {selectedMunicipality ? "Municipality summary" : selectedProvinceCode ? "Province summary" : "South Africa overview"}
            </p>
            <h4 className="mt-1 text-xl font-bold text-slate-900">{summaryName}</h4>
            <p className="mt-1 text-sm text-slate-600">
              {displayedIssues.length} filtered report{displayedIssues.length === 1 ? "" : "s"} in this view
              {selectedMunicipality && ` · ${selectedMunicipality.province}`}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs text-slate-600">Total</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{displayedIssues.length}</p>
            </div>
            <div className="rounded-xl bg-sky-50 p-3">
              <p className="text-xs text-sky-800">Plotted</p>
              <p className="mt-1 text-2xl font-bold text-sky-950">{plottedReportCount}</p>
            </div>
            <div className="rounded-xl bg-slate-100 p-3">
              <p className="text-xs text-slate-600">No valid location</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{unplottableReportCount}</p>
            </div>
            <div className="rounded-xl bg-amber-50 p-3">
              <p className="text-xs text-amber-800">Unresolved</p>
              <p className="mt-1 text-2xl font-bold text-amber-950">{unresolvedCount}</p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-3">
              <p className="text-xs text-emerald-800">Resolved</p>
              <p className="mt-1 text-2xl font-bold text-emerald-950">{resolvedCount}</p>
            </div>
          </div>
          {!selectedProvinceCode && unassignedProvinceCount > 0 && (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              {unassignedProvinceCount} report{unassignedProvinceCount === 1 ? " is" : "s are"} not associated with a province and are not included in province shading.
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Breakdown title="Reports by category" rows={categoryBreakdown} />
            <Breakdown title="Reports by priority" rows={priorityBreakdown} />
            <Breakdown title="Reports by status" rows={statusBreakdown} />
          </div>

          {selectedProvinceCode && (
            <div>
              <h5 className="text-sm font-semibold text-slate-900">
                Municipalities in {provinceName} ({municipalityOptions.length})
              </h5>
              {provinceSummaries.length > 0 ? (
                <ul className="mt-2 space-y-1 text-sm text-slate-700">
                  {provinceSummaries.slice(0, 5).map((municipality) => (
                    <li key={municipality.key} className="flex justify-between gap-3">
                      <span className="truncate">{municipality.name}</span>
                      <span className="shrink-0 font-semibold">{municipality.reportCount}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-slate-500">No municipality boundaries are available for this selection.</p>
              )}
            </div>
          )}

          {!selectedProvinceCode && (
            <div>
              <h5 className="text-sm font-semibold text-slate-900">Province density legend</h5>
              <ul className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-700">
                {boundaryError ? (
                  <li className="col-span-2 text-slate-600">Province density is unavailable because boundary data failed to load.</li>
                ) : (
                  getDensityLegendBands(Object.values(provinceCounts)).map((band) => (
                    <LegendItem key={band.color} color={band.color} label={band.label} />
                  ))
                )}
              </ul>
              {!boundaryError && (
                <p className="mt-1 text-xs text-slate-500">
                  Quartiles are recalculated from the current filtered province totals; tied counts may share a band.
                </p>
              )}
            </div>
          )}
          <p className="text-xs leading-5 text-slate-500">
            Map clusters group report locations only and are not administrative boundaries.
            {(boundaries || municipalityBoundaries) && (
              <>
                {boundaries && <>{" "}Province boundaries: geoBoundaries ADM1 (2020), sourced from OCHA ROSEA and the South African Municipal Demarcation Board, CC BY 3.0 IGO.</>}
                {municipalityBoundaries && <>{" "}Municipality boundaries: Municipal Demarcation Board Local Municipalities 2021, generalized for display; not for surveying. MDB public-use terms prohibit commercial use and require attribution.</>}
                {" "}
                <Link
                  href="/geojson/ATTRIBUTION.md"
                  target="_blank"
                  className="font-medium text-emerald-700 underline"
                >
                  Dataset attribution
                </Link>
                .
              </>
            )}
          </p>
        </div>

        <div className="min-w-0">
          <div className="flex items-baseline justify-between gap-3">
            <h5 className="text-sm font-semibold text-slate-900">Relevant reports</h5>
            <span className="text-xs text-slate-500">{displayedIssues.length} matching</span>
          </div>
          {displayedIssues.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
              {emptyMessage ?? "No reports in this area match the selected filters."}
            </p>
          ) : (
            <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
              {displayedIssues.map((issue) => (
                <li key={issue.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      {onSelectIssue ? (
                        <button
                          type="button"
                          onClick={() => onSelectIssue(issue)}
                          className="break-words text-left text-sm font-semibold text-emerald-800 underline"
                        >
                          {issue.title}
                        </button>
                      ) : (
                        <Link
                          href={`/issues/${encodeURIComponent(issue.id)}`}
                          className="break-words text-sm font-semibold text-emerald-800 underline"
                        >
                          {issue.title}
                        </Link>
                      )}
                      <p className="mt-1 text-xs text-slate-600">
                        {issue.category} · {issue.priority || "Priority unavailable"} · {issue.status || "Status unavailable"}
                      </p>
                    </div>
                    <time className="shrink-0 text-xs text-slate-500">{displayDate(issue.reportedAt)}</time>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>}
    </div>
  );
}

function Breakdown({ title, rows }: { title: string; rows: ReportBreakdown[] }) {
  return (
    <div>
      <h5 className="text-sm font-semibold text-slate-900">{title}</h5>
      {rows.length > 0 ? (
        <ul className="mt-2 space-y-1 text-sm text-slate-700">
          {rows.slice(0, 5).map((row) => (
            <li key={row.name} className="flex justify-between gap-3">
              <span className="truncate">{row.name}</span>
              <span className="shrink-0 font-semibold">{row.count}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-slate-500">No report data.</p>
      )}
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <span className="h-3 w-3 shrink-0 rounded-sm border border-slate-300" style={{ backgroundColor: color }} />
      <span>{label}</span>
    </li>
  );
}
