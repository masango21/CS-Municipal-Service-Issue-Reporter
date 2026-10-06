"use client";

import { useEffect, useState } from "react";
import { IssueCard } from "@/components/IssueCard";
import { ReportMap } from "@/components/ReportMap";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useReports } from "@/context/ReportsContext";
import type { Issue } from "@/types/issue";

export default function IssueFeedPage() {
  const { residentUser } = useAuth();
  const { reports: publicReports, isReportsReady, reportsError: publicReportsError, fetchMyReports } = useReports();
  const { t } = useLanguage();
  const [residentFeed, setResidentFeed] = useState<{
    ownerId: string;
    reports: Issue[];
    error: string;
  } | null>(null);
  const residentId = residentUser?.id;

  useEffect(() => {
    if (!residentId) return;
    let active = true;
    fetchMyReports()
      .then((myReports) => {
        if (!active) return;
        setResidentFeed({ ownerId: residentId, reports: myReports, error: "" });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setResidentFeed({
          ownerId: residentId,
          reports: [],
          error: error instanceof Error ? error.message : "Unable to load your reports.",
        });
      });
    return () => { active = false; };
  }, [fetchMyReports, residentId]);

  const hasResidentFeed = Boolean(residentId && residentFeed?.ownerId === residentId);
  const reports = residentUser ? (hasResidentFeed ? residentFeed!.reports : []) : publicReports;
  const reportsReady = residentUser ? hasResidentFeed : isReportsReady;
  const reportsError = residentUser
    ? (hasResidentFeed ? residentFeed!.error : "")
    : publicReportsError;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">{residentUser ? "Resident reports" : t("issueFeedHeading")}</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">{residentUser ? "My reports" : t("municipalIssuesHeading")}</h1>
        </div>

        {reportsError && <p role="alert" className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{reportsError}</p>}

        <div className="mb-8 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          {!reportsReady && !reportsError ? (
            <p role="status" className="p-8 text-center text-sm text-slate-500">Loading reports...</p>
          ) : reportsError ? (
            <p className="p-8 text-center text-sm text-slate-500">The public report map is unavailable right now.</p>
          ) : reports.length > 0 ? (
            <ReportMap issues={reports} />
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <p className="text-xl font-bold text-slate-700">{t("noReportsYet")}</p>
              <p className="mt-2 text-sm text-slate-500">{t("firstReportHint")}</p>
            </div>
          )}
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {!reportsReady && !reportsError ? (
            <p role="status" className="col-span-full p-8 text-center text-sm text-slate-500">Loading reports...</p>
          ) : reportsError ? (
            <p className="col-span-full p-8 text-center text-sm text-slate-500">Reports could not be loaded. Please retry later.</p>
          ) : reports.length > 0 ? (
            reports.map((issue) => <IssueCard key={issue.id} issue={issue} />)
          ) : (
            <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
              <p className="text-xl font-bold text-slate-700">{t("noReportsYet")}</p>
              <p className="mt-2 text-sm text-slate-500">{t("issueFeedEmptyHint")}</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
