"use client";

import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { use } from "react";
import { PriorityBadge } from "@/components/PriorityBadge";
import { ReportMap } from "@/components/ReportMap";
import { StatusBadge } from "@/components/StatusBadge";
import { useLanguage } from "@/context/LanguageContext";
import { useReports } from "@/context/ReportsContext";

export default function IssueDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { reports, isReportsReady } = useReports();
  const { t } = useLanguage();
  const resolvedParams = use(params);

  if (!isReportsReady) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-600">Loading</p>
          <h1 className="mt-3 text-2xl font-bold text-slate-900">Loading issue details...</h1>
        </div>
      </main>
    );
  }

  const issue = reports.find((item) => item.id === resolvedParams.id);

  if (!issue) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">{t("issueDetails")}</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">{issue.title}</h1>
          </div>
          <Link href="/issues" className="text-sm font-semibold text-emerald-700">
            {t("backToFeed")}
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
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{t("categoryLabel")}</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">{issue.category}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{t("locationCard")}</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">{issue.location.city ?? t("location")}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{t("municipalityCard")}</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">{issue.location.municipality ?? t("municipalityNotSpecified")}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{t("dateReported")}</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">
                  {new Date(issue.reportedAt).toLocaleDateString("en-ZA")}
                </p>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{t("descriptionCard")}</p>
              <p className="mt-2 text-base leading-7 text-slate-700">{issue.description}</p>
            </div>

            {issue.duplicateOf && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-800">Duplicate report</p>
                <Link href={`/issues/${issue.duplicateOf}`} className="mt-2 inline-block text-sm font-semibold text-amber-900 underline">
                  View the linked report
                </Link>
              </div>
            )}
            {issue.duplicateReports?.length ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-800">Related duplicate reports</p>
                <ul className="mt-2 space-y-1">
                  {issue.duplicateReports.map((duplicate) => <li key={duplicate.id}><Link className="text-sm font-semibold text-amber-900 underline" href={`/issues/${duplicate.id}`}>{duplicate.title}</Link></li>)}
                </ul>
              </div>
            ) : null}

            <section className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
              <h2 className="text-sm font-semibold text-emerald-950">Municipal updates</h2>
              {issue.residentUpdates?.length ? (
                <ol className="mt-4 space-y-4">
                  {issue.residentUpdates.slice().reverse().map((update) => (
                    <li key={update.id} className="border-l-2 border-emerald-500 pl-3">
                      <p className="text-sm font-semibold text-slate-900">{update.status === "Reported" ? "New" : update.status}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-700">{update.text}</p>
                      <p className="mt-1 text-xs text-slate-500">{update.authorName} · {new Date(update.createdAt).toLocaleString("en-ZA")}</p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-2 text-sm text-slate-600">The municipality has not posted an update yet.</p>
              )}
            </section>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{t("latitude")}</p>
                <p className="mt-2 text-base font-medium text-slate-900">{issue.location.latitude.toFixed(4)}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{t("longitude")}</p>
                <p className="mt-2 text-base font-medium text-slate-900">{issue.location.longitude.toFixed(4)}</p>
              </div>
            </div>

            {issue.image && (
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <Image
                  src={issue.image}
                  alt={issue.title}
                  width={1200}
                  height={800}
                  unoptimized
                  className="h-64 w-full object-cover"
                />
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">{t("issueMapHeading")}</h2>
            <div className="mt-4">
              <ReportMap issues={[issue]} compact />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
