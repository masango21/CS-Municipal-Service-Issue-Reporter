"use client";

import type { Issue } from "@/types/issue";

type ReportMapProps = {
  issues: Issue[];
  emptyMessage?: string;
  onSelect?: (issue: Issue) => void;
  compact?: boolean;
};

export function ReportMap({ issues, emptyMessage, onSelect, compact = false }: ReportMapProps) {
  const markerStyle = (issue: Issue) => ({
    left: `${((issue.location.longitude - 15) / 18) * 100}%`,
    top: `${((35 + issue.location.latitude) / 13) * 100}%`,
  });

  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-sky-100 via-white to-emerald-50 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">South Africa</p>
          <h3 className="text-lg font-bold text-slate-900">Municipal issue map</h3>
        </div>
      </div>

      <div className={`relative ${compact ? "h-[260px]" : "h-[420px]"}`}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_30%,rgba(16,185,129,0.14),transparent_35%),linear-gradient(135deg,#e0f2fe_0%,#ecfeff_35%,#dcfce7_100%)]" />

        {issues.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
            <p className="text-xl font-bold text-slate-700">No Reports Yet</p>
            <p className="mt-2 max-w-md text-sm text-slate-600">There are currently no municipal issues reported. Once residents submit reports, their locations will appear on the map.</p>
          </div>
        ) : (
          issues.map((issue) => (
            <button
              key={issue.id}
              type="button"
              onClick={() => onSelect?.(issue)}
              className="absolute z-10 flex -translate-x-1/2 -translate-y-full flex-col items-center gap-1 text-xs font-semibold text-slate-700"
              style={markerStyle(issue)}
              title={`${issue.category} - ${issue.title}`}
            >
              <span className="rounded-full border-2 border-white bg-emerald-600 px-2 py-1 text-[10px] text-white shadow-md">
                {issue.category}
              </span>
              <span className="flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-rose-500 shadow-md">
                <span className="h-1.5 w-1.5 rounded-full bg-white" />
              </span>
            </button>
          ))
        )}

        {!issues.length && emptyMessage && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-slate-900/70 px-3 py-1 text-xs font-medium text-white">
            {emptyMessage}
          </div>
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
