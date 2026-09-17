"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { issueCategories } from "@/data/issueCategories";
import { IssueCard } from "@/components/IssueCard";
import { ReportMap } from "@/components/ReportMap";
import { useReports } from "@/context/ReportsContext";

const statusOptions = [
  "All Statuses",
  "Reported",
  "Under Review",
  "Assigned",
  "In Progress",
  "Resolved",
  "Closed",
] as const;

export default function AdminDashboardPage() {
  const { reports, stats } = useReports();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All Categories");
  const [selectedStatus, setSelectedStatus] = useState<(typeof statusOptions)[number]>("All Statuses");

  const filteredReports = useMemo(() => {
    return reports.filter((issue) => {
      const matchesSearch =
        issue.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        issue.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        issue.location.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        false;

      const matchesCategory =
        selectedCategory === "All Categories" || issue.category === selectedCategory;

      const matchesStatus =
        selectedStatus === "All Statuses" || issue.status === selectedStatus;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [reports, searchTerm, selectedCategory, selectedStatus]);

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

        <div className="mb-8 rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-[1.4fr_1fr_1fr]">
            <div>
              <label htmlFor="search" className="mb-2 block text-sm font-medium text-slate-300">
                Search reports
              </label>
              <input
                id="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by title, category, or city"
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="category" className="mb-2 block text-sm font-medium text-slate-300">
                Category
              </label>
              <select
                id="category"
                value={selectedCategory}
                onChange={(event) => setSelectedCategory(event.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white focus:border-cyan-500 focus:outline-none"
              >
                <option>All Categories</option>
                {issueCategories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="status" className="mb-2 block text-sm font-medium text-slate-300">
                Status
              </label>
              <select
                id="status"
                value={selectedStatus}
                onChange={(event) => setSelectedStatus(event.target.value as (typeof statusOptions)[number])}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white focus:border-cyan-500 focus:outline-none"
              >
                {statusOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4 shadow-sm">
            <ReportMap issues={filteredReports} emptyMessage="No submitted reports match the selected filters" />
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-white">Issue list</h2>
              <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-300">
                {filteredReports.length} shown
              </span>
            </div>

            <div className="space-y-4">
              {filteredReports.length > 0 ? (
                filteredReports.map((issue) => <IssueCard key={issue.id} issue={issue} />)
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-800 p-6 text-center">
                  <p className="text-base font-semibold text-slate-200">No reports match your filters.</p>
                  <p className="mt-2 text-sm text-slate-400">Try clearing the search or changing the selected category/status.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
