"use client";

import { IssueCard } from "@/components/IssueCard";
import { ReportMap } from "@/components/ReportMap";
import { useReports } from "@/context/ReportsContext";

export default function IssueFeedPage() {
  const { reports } = useReports();

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">Issue feed</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Municipal service issues</h1>
        </div>

        <div className="mb-8 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          {reports.length > 0 ? (
            <ReportMap issues={reports} />
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <p className="text-xl font-bold text-slate-700">No Reports Yet</p>
              <p className="mt-2 text-sm text-slate-500">Residents will appear here once the first report is submitted.</p>
            </div>
          )}
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {reports.length > 0 ? (
            reports.map((issue) => <IssueCard key={issue.id} issue={issue} />)
          ) : (
            <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
              <p className="text-xl font-bold text-slate-700">No Reports Yet</p>
              <p className="mt-2 text-sm text-slate-500">The issue feed is empty until a resident submits the first report.</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
