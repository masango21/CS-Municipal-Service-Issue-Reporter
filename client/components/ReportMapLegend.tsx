"use client";

import { categoryColors, fallbackCategoryColor, fallbackSelectedLocationColor } from "@/lib/mapStyles";

type ReportMapLegendProps = {
  categories: string[];
  hasClusters: boolean;
  hasSelectedLocation: boolean;
  hasReports: boolean;
  allowsLocationSelection: boolean;
  selectedCategory?: string;
  hasUnmappableReports: boolean;
  geographicView?: "national" | "province" | "municipality";
  hasMunicipalityBoundaries: boolean;
  hasSelectedMunicipality: boolean;
};

export function ReportMapLegend({
  categories,
  hasClusters,
  hasSelectedLocation,
  hasReports,
  allowsLocationSelection,
  selectedCategory,
  hasUnmappableReports,
  geographicView,
  hasMunicipalityBoundaries,
  hasSelectedMunicipality,
}: ReportMapLegendProps) {
  const shownCategories = categories.length > 0
    ? categories
    : selectedCategory
      ? [selectedCategory]
      : [];

  return (
    <details className="rounded-xl border border-slate-200 bg-white p-3" open>
      <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">
        Map key
      </summary>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-700">
        {geographicView && geographicView !== "national" && (
          <span className="inline-flex items-center gap-2">
            <span aria-hidden="true" className="h-3 w-5 border-y-2 border-emerald-800" />
            Selected province outline
          </span>
        )}
        {hasMunicipalityBoundaries && (
          <span className="inline-flex items-center gap-2">
            <span aria-hidden="true" className="h-3 w-5 border border-slate-600 bg-slate-300/20" />
            Municipality boundaries
          </span>
        )}
        {hasSelectedMunicipality && (
          <span className="inline-flex items-center gap-2">
            <span aria-hidden="true" className="h-3 w-5 border-2 border-emerald-700 bg-emerald-400/20" />
            Selected municipality
          </span>
        )}
        {shownCategories.map((category) => (
          <span key={category} className="inline-flex items-center gap-2">
            <span
              aria-hidden="true"
              className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 border-white text-[9px] font-extrabold text-white shadow"
              style={{ backgroundColor: categoryColors[category] ?? fallbackCategoryColor }}
            >
              {category.charAt(0).toUpperCase()}
            </span>
            {category}
          </span>
        ))}
        {shownCategories.length === 0 && !hasClusters && !hasSelectedLocation && !hasUnmappableReports && hasReports && (
          <span>Report markers show municipal issue locations.</span>
        )}
        {!hasReports && allowsLocationSelection && (
          <span>Click or tap the map to place a report pin.</span>
        )}
        {!hasReports && !allowsLocationSelection && (
          <span>No reports (0 report locations).</span>
        )}
        {hasClusters && (
          <span className="inline-flex items-center gap-2">
            <span
              aria-hidden="true"
              className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-white bg-blue-700 px-1 text-[10px] font-bold text-white shadow"
            >
              #
            </span>
            Multiple reports grouped at this location; open the cluster to select any report.
          </span>
        )}
        {hasSelectedLocation && (
          <span className="inline-flex items-center gap-2">
            <span
              aria-hidden="true"
              className="inline-flex h-[18px] w-[18px] rounded-full border-[4px] border-blue-700 shadow"
              style={{ backgroundColor: categoryColors[selectedCategory ?? ""] ?? fallbackSelectedLocationColor }}
            />
            {selectedCategory ? `Selected location · ${selectedCategory}` : "Selected location"}
          </span>
        )}
        {hasUnmappableReports && (
          <span className="w-full text-slate-500">
            Some reports have invalid or out-of-country coordinates and cannot be placed on the map.
          </span>
        )}
      </div>
    </details>
  );
}
