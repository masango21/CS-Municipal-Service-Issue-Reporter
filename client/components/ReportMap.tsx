"use client";

import dynamic from "next/dynamic";
import type { Issue } from "@/types/issue";

const MapView = dynamic(() => import("@/components/MapView").then((module) => module.MapView), {
  ssr: false,
});

type ReportMapProps = {
  issues: Issue[];
  emptyMessage?: string;
  onSelect?: (issue: Issue) => void;
  compact?: boolean;
};

export function ReportMap({ issues, emptyMessage, onSelect, compact = false }: ReportMapProps) {
  const mapIssues = issues.map((issue) => ({
    id: issue.id,
    title: issue.title,
    category: issue.category,
    location: {
      latitude: issue.location.latitude,
      longitude: issue.location.longitude,
      city: issue.location.city,
      municipality: issue.location.municipality,
      address: issue.location.address,
    },
  }));

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-sky-100 via-white to-emerald-50 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">South Africa</p>
          <h3 className="text-lg font-bold text-slate-900">Municipal issue map</h3>
        </div>
      </div>

      <div className={compact ? "p-3" : "p-4"}>
        {issues.length === 0 ? (
          <div className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 text-center">
            <p className="text-xl font-bold text-slate-700">No Reports Yet</p>
            <p className="mt-2 max-w-md text-sm text-slate-600">
              {emptyMessage ?? "There are currently no municipal issues reported. Once residents submit reports, their locations will appear on the map."}
            </p>
          </div>
        ) : (
          <MapView
            issues={mapIssues}
            heightClass={compact ? "h-[260px]" : "h-[420px]"}
            onSelectIssue={(issue) => {
              const match = issues.find((entry) => entry.id === issue.id);
              if (match) onSelect?.(match);
            }}
          />
        )}
      </div>

      {!compact && (
        <div className="border-t border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
          {issues.length > 0 ? (
            <span>{issues.length} issue pin{issues.length === 1 ? "" : "s"} currently visible.</span>
          ) : (
            <span>Map is ready and waiting for the first report.</span>
          )}
        </div>
      )}
    </div>
  );
}
