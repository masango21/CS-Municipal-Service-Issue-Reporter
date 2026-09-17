"use client";

import Link from "next/link";
import { IssueCard } from "@/components/IssueCard";
import { ReportMap } from "@/components/ReportMap";
import { useReports } from "@/context/ReportsContext";

export default function AdminDashboardPage() {
  const { reports, stats } = useReports();

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">Admin dashboard</p>
            <h1 className="mt-2 text-3xl font-bold text-white">Municipal operations overview</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/issues" className="rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200">
              View Reports
            </Link>
          </div>
        </div>

        <div className="mb-8 grid gap-4 md:grid-cols-5">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Total Reports</p>
            <p className="mt-3 text-3xl font-bold text-white">{stats.total}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Reported</p>
            <p className="mt-3 text-3xl font-bold text-white">{stats.reported}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">In Progress</p>
            <p className="mt-3 text-3xl font-bold text-white">{stats.inProgress}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Resolved</p>
            <p className="mt-3 text-3xl font-bold text-white">{stats.resolved}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Critical</p>
            <p className="mt-3 text-3xl font-bold text-white">{stats.critical}</p>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4 shadow-sm">
            <ReportMap issues={reports} emptyMessage="No submitted reports yet" />
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-sm">
            <h2 className="text-xl font-bold text-white">Latest reports</h2>
            <div className="mt-5 space-y-4">
              {reports.length > 0 ? (
                reports.map((issue) => <IssueCard key={issue.id} issue={issue} />)
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-800 p-6 text-center">
                  <p className="text-base font-semibold text-slate-200">No reports yet.</p>
                  <p className="mt-2 text-sm text-slate-400">The admin map will show real report pins once residents submit issues.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
