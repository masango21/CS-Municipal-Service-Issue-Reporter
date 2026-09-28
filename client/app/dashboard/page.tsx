"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { IssueCard } from "@/components/IssueCard";
import { ReportMap } from "@/components/ReportMap";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useReports } from "@/context/ReportsContext";

export default function ResidentDashboardPage() {
  const router = useRouter();
  const { residentUser, adminUser, isAuthReady } = useAuth();
  const { reports, stats } = useReports();
  const { t } = useLanguage();

  useEffect(() => {
    if (!isAuthReady || residentUser) return;
    router.replace(adminUser ? "/admin/dashboard" : "/login");
  }, [adminUser, isAuthReady, residentUser, router]);

  if (!isAuthReady || !residentUser) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center bg-slate-50 px-4" aria-busy="true">
        <p role="status" className="text-sm font-medium text-slate-600">Checking resident access...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">{t("residentDashboardTag")}</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">{t("residentDashboardTitle")}</h1>
            {residentUser && (
              <p className="mt-2 text-sm text-slate-600">Welcome back, {residentUser.name}. Your resident workspace is ready.</p>
            )}
          </div>

          <Link
            href="/report"
            className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            {t("reportNewIssue")}
          </Link>
        </div>

        <div className="mb-8 grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">{t("totalReportsCard")}</p>
            <p className="mt-3 text-3xl font-bold text-slate-900">{stats.total}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">{t("reportedCard")}</p>
            <p className="mt-3 text-3xl font-bold text-slate-900">{stats.reported}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">{t("inProgressCard")}</p>
            <p className="mt-3 text-3xl font-bold text-slate-900">{stats.inProgress}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">{t("resolvedCard")}</p>
            <p className="mt-3 text-3xl font-bold text-slate-900">{stats.resolved}</p>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-xl font-bold text-slate-900">{t("yourIssueLocations")}</h2>
              {reports.length > 0 ? (
                <ReportMap issues={reports} compact />
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                  <p className="text-lg font-semibold text-slate-700">{t("noResidentReports")}</p>
                  <p className="mt-2 text-sm text-slate-500">{t("residentReportsHint")}</p>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">{t("recentReports")}</h2>
            <div className="mt-5 space-y-4">
              {reports.length > 0 ? (
                reports.slice(0, 3).map((issue) => <IssueCard key={issue.id} issue={issue} />)
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                  <p className="text-base font-semibold text-slate-700">{t("noReportsCard")}</p>
                  <Link href="/report" className="mt-3 inline-block text-sm font-semibold text-emerald-700">
                    {t("reportNewIssue")}
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
