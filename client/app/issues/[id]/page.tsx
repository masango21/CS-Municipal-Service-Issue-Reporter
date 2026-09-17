"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import { PriorityBadge } from "@/components/PriorityBadge";
import { ReportMap } from "@/components/ReportMap";
import { StatusBadge } from "@/components/StatusBadge";
import { useReports } from "@/context/ReportsContext";

export default function IssueDetailsPage({ params }: { params: { id: string } }) {
  const { reports } = useReports();
  const issue = reports.find((item) => item.id === params.id);

  if (!issue) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">Issue details</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">{issue.title}</h1>
          </div>
          <Link href="/issues" className="text-sm font-semibold text-emerald-700">
            Back to Feed
          </Link>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">{issue.id}</span>
              <StatusBadge status={issue.status} />
              <PriorityBadge priority={issue.priority} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Category</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">{issue.category}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Location</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">{issue.location.city ?? "South Africa"}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Municipality</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">{issue.location.municipality ?? "Municipality not specified"}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Date reported</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">
                  {new Date(issue.reportedAt).toLocaleDateString("en-ZA")}
                </p>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Description</p>
              <p className="mt-2 text-base leading-7 text-slate-700">{issue.description}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Latitude</p>
                <p className="mt-2 text-base font-medium text-slate-900">{issue.location.latitude.toFixed(4)}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Longitude</p>
                <p className="mt-2 text-base font-medium text-slate-900">{issue.location.longitude.toFixed(4)}</p>
              </div>
            </div>

            {issue.image && (
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <img src={issue.image} alt={issue.title} className="h-64 w-full object-cover" />
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">Issue map</h2>
            <div className="mt-4">
              <ReportMap issues={[issue]} compact />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
