"use client";

import dynamic from "next/dynamic";
import type { Issue } from "@/types/issue";

const MapView = dynamic(() => import("@/components/MapView").then((module) => module.MapView), {
  ssr: false,
});
const ReportDensityExplorer = dynamic(
  () => import("@/components/ReportDensityExplorer").then((module) => module.ReportDensityExplorer),
  {
    ssr: false,
    loading: () => <p role="status" className="p-6 text-center text-sm text-slate-600">Loading the interactive report map...</p>,
  },
);

type ReportMapProps = {
  issues: Issue[];
  emptyMessage?: string;
  onSelect?: (issue: Issue) => void;
  compact?: boolean;
  exploreGeography?: boolean;
};

export function ReportMap({
  issues,
  emptyMessage,
  onSelect,
  compact = false,
  exploreGeography = false,
}: ReportMapProps) {
  if (!compact || exploreGeography || issues.length > 1) {
    return (
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-sky-100 via-white to-emerald-50 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">South Africa</p>
            <h3 className="text-lg font-bold text-slate-900">Municipal issue map</h3>
          </div>
        </div>

        <div className="space-y-4 p-4">
          <ReportDensityExplorer
            issues={issues}
            emptyMessage={emptyMessage}
            onSelectIssue={onSelect}
            compact={compact}
          />
        </div>

        <div className="border-t border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
          {issues.length} issue{issues.length === 1 ? "" : "s"} supplied by the current authorized report view.
        </div>
      </div>
    );
  }

  const mapIssues = issues.map((issue) => ({
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
  }));

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-sky-100 via-white to-emerald-50 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">South Africa</p>
          <h3 className="text-lg font-bold text-slate-900">Municipal issue map</h3>
        </div>
      </div>

      <div className="p-3">
        <MapView
          issues={mapIssues}
          heightClass="h-[260px]"
          emptyMessage={emptyMessage}
          onSelectIssue={(issue) => {
            const match = issues.find((entry) => entry.id === issue.id);
            if (match) onSelect?.(match);
          }}
        />
      </div>
    </div>
  );
}
