"use client";

import Link from "next/link";
import { useReports } from "@/context/ReportsContext";

export default function HomePage() {
  const { stats } = useReports();

  return (
    <main className="min-h-screen bg-slate-50 px-4 pb-16 pt-10 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl">
        <div className="grid gap-8 overflow-hidden rounded-[2rem] border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-cyan-50 p-8 shadow-sm lg:grid-cols-[1.1fr_0.9fr] lg:p-12">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-700">Municipal service reporting</p>
            <h1 className="mt-5 max-w-xl text-4xl font-black tracking-tight text-slate-900 sm:text-5xl">
              Report service issues in South Africa.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">
              Residents can submit service problems with exact map pin locations, while municipal staff can review all reports and monitor issues from one dashboard.
            </p>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <Link
                href="/report"
                className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-6 py-3 text-base font-semibold text-white transition hover:bg-emerald-700"
              >
                Report an Issue
              </Link>
              <Link
                href="/admin/dashboard"
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-6 py-3 text-base font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
              >
                Admin Dashboard
              </Link>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
                <p className="text-sm text-slate-500">Total reports</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{stats.total}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
                <p className="text-sm text-slate-500">In progress</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{stats.inProgress}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
                <p className="text-sm text-slate-500">Resolved</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{stats.resolved}</p>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-emerald-100 bg-slate-900 p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">Live status</p>
                <h2 className="mt-2 text-2xl font-bold">South Africa Map</h2>
              </div>
              <span className="rounded-full bg-emerald-500/20 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                0 reports
              </span>
            </div>

            <div className="mt-6 h-[300px] rounded-2xl border border-slate-700 bg-gradient-to-br from-sky-950 via-slate-900 to-emerald-950 p-4">
              <div className="relative h-full w-full overflow-hidden rounded-xl border border-slate-700 bg-[radial-gradient(circle_at_35%_30%,rgba(34,197,94,0.2),transparent_25%),linear-gradient(135deg,#082f49_0%,#111827_40%,#022c22_100%)]">
                <div className="absolute left-[18%] top-[28%] h-2 w-2 rounded-full bg-cyan-400" />
                <div className="absolute left-[34%] top-[36%] h-2 w-2 rounded-full bg-cyan-400" />
                <div className="absolute left-[62%] top-[28%] h-2 w-2 rounded-full bg-cyan-400" />
                <div className="absolute left-[74%] top-[52%] h-2 w-2 rounded-full bg-cyan-400" />
                <div className="absolute inset-x-0 bottom-0 border-t border-slate-700 bg-slate-900/60 p-3 text-xs text-slate-300">
                  No reports yet. The map awaits the first resident submission.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
