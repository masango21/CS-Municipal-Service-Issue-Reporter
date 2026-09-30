"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ReportMap } from "@/components/ReportMap";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useReports } from "@/context/ReportsContext";

export default function HomePage() {
  const router = useRouter();
  const { residentUser, adminUser } = useAuth();
  const { reports, stats, isReportsReady, reportsError } = useReports();
  const { t } = useLanguage();

  useEffect(() => {
    if (residentUser) {
      router.replace("/dashboard");
      return;
    }

    if (adminUser) {
      router.replace("/admin/dashboard");
    }
  }, [adminUser, residentUser, router]);

  const isLoggedIn = Boolean(residentUser || adminUser);

  return (
    <main className="min-h-screen bg-slate-50 px-4 pb-16 pt-10 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl">
        <div className="grid gap-8 overflow-hidden rounded-[2rem] border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-cyan-50 p-8 shadow-sm lg:grid-cols-[1.1fr_0.9fr] lg:p-12">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-700">{t("heroTag")}</p>
            <h1 className="mt-5 max-w-xl text-4xl font-black tracking-tight text-slate-900 sm:text-5xl">
              {t("heroTitle")}
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">
              {t("heroDescription")}
            </p>

            {isLoggedIn ? (
              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <Link
                  href={residentUser ? "/dashboard" : "/admin/dashboard"}
                  className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-6 py-3 text-base font-semibold text-white transition hover:bg-emerald-700"
                >
                  {residentUser ? "Open resident dashboard" : "Open operations dashboard"}
                </Link>
              </div>
            ) : (
              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <Link
                  href="/report"
                  className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-6 py-3 text-base font-semibold text-white transition hover:bg-emerald-700"
                >
                  {t("ctaReport")}
                </Link>
                <Link
                  href="/admin/login"
                  className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-6 py-3 text-base font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
                >
                  {t("staffLogin")}
                </Link>
              </div>
            )}

            {reportsError && <p role="alert" className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{reportsError}</p>}

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
                <p className="text-sm text-slate-500">{t("totalReports")}</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{reportsError ? "—" : isReportsReady ? stats.total : "…"}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
                <p className="text-sm text-slate-500">{t("inProgress")}</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{reportsError ? "—" : isReportsReady ? stats.inProgress : "…"}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
                <p className="text-sm text-slate-500">{t("resolved")}</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{reportsError ? "—" : isReportsReady ? stats.resolved : "…"}</p>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-emerald-100 bg-slate-900 p-4 text-white shadow-lg sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">{t("liveStatus")}</p>
                <h2 className="mt-2 text-2xl font-bold">{t("mapTitle")}</h2>
              </div>
              {!reportsError && <span className="rounded-full bg-emerald-500/20 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                {isReportsReady ? stats.total : "…"} {t("totalReports").toLowerCase()}
              </span>}
            </div>

            <div className="mt-6">
              {reportsError ? <p role="alert" className="p-8 text-center text-sm text-rose-200">Live issue data is temporarily unavailable.</p> : <ReportMap issues={reports} compact emptyMessage={t("mapEmpty")} />}
            </div>

            <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
              {t("aiTranslate")}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
