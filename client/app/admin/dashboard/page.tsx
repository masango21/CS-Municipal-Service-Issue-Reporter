"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useMemo, useState } from "react";
import { issueCategories } from "@/data/issueCategories";
import { IssueCard } from "@/components/IssueCard";
import { ReportMap } from "@/components/ReportMap";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useReports } from "@/context/ReportsContext";
import {
  fetchStaffMunicipalities,
  lockStaffMunicipality,
  verifyStaffMunicipality,
  type Municipality,
} from "@/lib/municipalities";

const statusOptions = [
  "Reported",
  "Under Review",
  "Assigned",
  "In Progress",
  "Resolved",
  "Closed",
] as const;

export default function AdminDashboardPage() {
  const router = useRouter();
  const { adminUser, residentUser, isAuthReady } = useAuth();
  const { reports, stats, refreshReports } = useReports();
  const { t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All Categories");
  const [selectedStatus, setSelectedStatus] = useState("All Statuses");
  const [selectedPriority, setSelectedPriority] = useState("All Priorities");
  const [selectedDepartment, setSelectedDepartment] = useState("All Departments");
  const [selectedDate, setSelectedDate] = useState("");
  const [loadError, setLoadError] = useState("");
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [selectedMunicipalityId, setSelectedMunicipalityId] = useState("");
  const [verifiedMunicipalityId, setVerifiedMunicipalityId] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [accessError, setAccessError] = useState("");
  const [accessMessage, setAccessMessage] = useState("");
  const [isMunicipalityLoading, setIsMunicipalityLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    if (!isAuthReady || adminUser) return;
    router.replace(residentUser ? "/dashboard" : "/admin/login");
  }, [adminUser, isAuthReady, residentUser, router]);

  useEffect(() => {
    if (isAuthReady && adminUser?.role === "super_admin") router.replace("/admin/municipalities");
  }, [adminUser, isAuthReady, router]);

  useEffect(() => {
    if (!adminUser || adminUser.role === "super_admin") return;
    let active = true;
    void fetchStaffMunicipalities()
      .then(({ municipalities: assigned, verifiedMunicipalityId: verified }) => {
        if (!active) return;
        setMunicipalities(assigned);
        setSelectedMunicipalityId(verified || assigned[0]?.id || "");
        setVerifiedMunicipalityId(verified || "");
        setAccessError("");
      })
      .catch((error: unknown) => {
        if (active) setAccessError(error instanceof Error ? error.message : "Unable to load assigned municipalities.");
      })
      .finally(() => {
        if (active) setIsMunicipalityLoading(false);
      });
    return () => { active = false; };
  }, [adminUser]);

  useEffect(() => {
    if (!adminUser || adminUser.role === "super_admin" || !verifiedMunicipalityId) return;
    void refreshReports(true)
      .then(() => setLoadError(""))
      .catch((error: unknown) => {
        setVerifiedMunicipalityId("");
        setAccessError(error instanceof Error ? error.message : "Municipality access expired. Verify access again.");
      });
  }, [adminUser, refreshReports, verifiedMunicipalityId]);

  const handleMunicipalityChange = async (municipalityId: string) => {
    setAccessError("");
    setAccessMessage("");
    if (verifiedMunicipalityId) {
      try {
        await lockStaffMunicipality();
      } catch (error) {
        setAccessError(error instanceof Error ? error.message : "Unable to lock the current municipality.");
        return;
      }
    }
    setVerifiedMunicipalityId("");
    setAccessCode("");
    setSelectedMunicipalityId(municipalityId);
  };

  const handleVerifyAccess = async () => {
    if (!selectedMunicipalityId || !accessCode) return;
    setIsVerifying(true);
    setAccessError("");
    setAccessMessage("");
    try {
      const result = await verifyStaffMunicipality(selectedMunicipalityId, accessCode);
      setVerifiedMunicipalityId(selectedMunicipalityId);
      setAccessCode("");
      setAccessMessage(result.message);
    } catch (error) {
      setAccessError(error instanceof Error ? error.message : "Unable to verify municipality access.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleLockMunicipality = async () => {
    try {
      await lockStaffMunicipality();
      setVerifiedMunicipalityId("");
      setAccessMessage("");
      setAccessCode("");
    } catch (error) {
      setAccessError(error instanceof Error ? error.message : "Unable to lock the municipality workspace.");
    }
  };

  const filteredReports = useMemo(() => {
    return reports.filter((issue) => {
      const matchesSearch =
        issue.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        issue.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        issue.location.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        issue.location.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        issue.location.municipality?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        false;

      const matchesCategory =
        selectedCategory === "All Categories" || issue.category === selectedCategory;

      const matchesStatus =
        selectedStatus === "All Statuses" || issue.status === selectedStatus;

      const matchesPriority = selectedPriority === "All Priorities" || issue.priority === selectedPriority;
      const matchesDepartment = selectedDepartment === "All Departments" || issue.department === selectedDepartment;
      const matchesDate = !selectedDate || new Date(issue.reportedAt).toISOString().slice(0, 10) === selectedDate;

      return matchesSearch && matchesCategory && matchesStatus && matchesPriority && matchesDepartment && matchesDate;
    });
  }, [reports, searchTerm, selectedCategory, selectedDepartment, selectedPriority, selectedStatus, selectedDate]);

  const departmentOptions = Array.from(new Set(reports.map((issue) => issue.department).filter(Boolean))) as string[];

  if (!isAuthReady || !adminUser) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center bg-slate-950 px-4 text-white" aria-busy="true">
        <p role="status" className="text-sm font-medium text-slate-300">Checking staff access...</p>
      </main>
    );
  }

  if (adminUser.role === "super_admin") return null;

  const selectedMunicipality = municipalities.find((municipality) => municipality.id === selectedMunicipalityId);

  if (!verifiedMunicipalityId) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-10 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">Staff workspace</p>
          <h1 className="mt-2 text-3xl font-bold">Municipality access</h1>
          <p className="mt-2 text-sm text-slate-300">Signed in as {adminUser.name}</p>
          {isMunicipalityLoading ? (
            <p role="status" className="mt-8 text-sm text-slate-300">Loading assigned municipalities...</p>
          ) : municipalities.length === 0 ? (
            <p className="mt-8 rounded-xl border border-slate-700 bg-slate-900 p-5 text-sm text-slate-200">
              You are not authorized to manage issues for any municipality. Please contact your administrator.
            </p>
          ) : (
            <section className="mt-8 space-y-5 rounded-xl border border-slate-700 bg-slate-900 p-6">
              <div>
                <label htmlFor="municipality" className="mb-2 block text-sm font-medium text-slate-200">Your municipalities</label>
                <select id="municipality" value={selectedMunicipalityId} onChange={(event) => void handleMunicipalityChange(event.target.value)} className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-3 text-white">
                  {municipalities.map((municipality) => <option key={municipality.id} value={municipality.id}>{municipality.name} · {municipality.province}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="municipality-access-code" className="mb-2 block text-sm font-medium text-slate-200">
                  Access code for {selectedMunicipality?.name}
                </label>
                <input id="municipality-access-code" type="password" autoComplete="one-time-code" value={accessCode} onChange={(event) => setAccessCode(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void handleVerifyAccess(); }} className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-3 text-white" />
              </div>
              {accessError && <p role="alert" className="text-sm text-rose-300">{accessError}</p>}
              {accessMessage && <p role="status" className="text-sm text-emerald-300">{accessMessage}</p>}
              <button type="button" disabled={!accessCode || isVerifying} onClick={() => void handleVerifyAccess()} className="rounded-lg bg-cyan-600 px-4 py-3 font-semibold text-white disabled:opacity-50">
                {isVerifying ? "Verifying..." : "Verify access"}
              </button>
            </section>
          )}
          {accessError && municipalities.length === 0 && <p role="alert" className="mt-5 text-sm text-rose-300">{accessError}</p>}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">{t("adminDashboardTag")}</p>
            <h1 className="mt-2 text-3xl font-bold text-white">{t("adminDashboardTitle")}</h1>
            {adminUser && (
              <p className="mt-2 text-sm text-slate-300">Operations mode active for {adminUser.name}. Focused on service delivery and triage.</p>
            )}
          </div>
          <button type="button" onClick={() => void handleLockMunicipality()} className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-900">Lock municipality</button>
        </div>

        {loadError && <p role="alert" className="mb-6 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{loadError}</p>}

        <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Total reports</p>
            <p className="mt-3 text-3xl font-bold text-white">{stats.total}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">New</p>
            <p className="mt-3 text-3xl font-bold text-white">{stats.reported}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">{t("inProgressCard")}</p>
            <p className="mt-3 text-3xl font-bold text-white">{stats.inProgress}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">{t("resolvedCard")}</p>
            <p className="mt-3 text-3xl font-bold text-white">{stats.resolved}</p>
          </div>
        </div>

        <section aria-label="Priority overview" className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(["Critical", "High", "Medium", "Low"] as const).map((priority) => (
            <div key={priority} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
              <span className="text-sm text-slate-300">{priority} priority</span>
              <span className="text-lg font-bold text-white">{reports.filter((issue) => issue.priority === priority).length}</span>
            </div>
          ))}
        </section>

        <div className="mb-8 rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
            <div>
              <label htmlFor="search" className="mb-2 block text-sm font-medium text-slate-300">
                {t("searchReports")}
              </label>
              <input
                id="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={t("searchPlaceholder")}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="category" className="mb-2 block text-sm font-medium text-slate-300">
                {t("categoryLabel")}
              </label>
              <select
                id="category"
                value={selectedCategory}
                onChange={(event) => setSelectedCategory(event.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white focus:border-cyan-500 focus:outline-none"
              >
                <option>{t("allCategories")}</option>
                {issueCategories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="status" className="mb-2 block text-sm font-medium text-slate-300">
                {t("statusLabel")}
              </label>
              <select
                id="status"
                value={selectedStatus}
                onChange={(event) => setSelectedStatus(event.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white focus:border-cyan-500 focus:outline-none"
              >
                <option>All Statuses</option>
                {statusOptions.map((item) => (
                  <option key={item} value={item}>
                    {item === "Reported" ? "New" : item}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="priority" className="mb-2 block text-sm font-medium text-slate-300">Priority</label>
              <select id="priority" value={selectedPriority} onChange={(event) => setSelectedPriority(event.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white focus:border-cyan-500 focus:outline-none">
                <option>All Priorities</option>
                {(["Critical", "High", "Medium", "Low"] as const).map((priority) => <option key={priority}>{priority}</option>)}
              </select>
            </div>

            <div>
              <label htmlFor="department" className="mb-2 block text-sm font-medium text-slate-300">Department</label>
              <select id="department" value={selectedDepartment} onChange={(event) => setSelectedDepartment(event.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white focus:border-cyan-500 focus:outline-none">
                <option>All Departments</option>
                {departmentOptions.map((department) => <option key={department}>{department}</option>)}
              </select>
            </div>

            <div>
              <label htmlFor="report-date" className="mb-2 block text-sm font-medium text-slate-300">Date</label>
              <input id="report-date" type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white focus:border-cyan-500 focus:outline-none" />
            </div>
          </div>
        </div>

        <div id="queue" className="grid gap-8 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 p-3">
            <ReportMap issues={filteredReports} emptyMessage={t("noSubmittedReports")} onSelect={(issue) => router.push(`/admin/reports/${issue.id}`)} />
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-white">{t("issueList")}</h2>
              <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-300">
                {filteredReports.length} {t("shownCount")}
              </span>
            </div>

            <div className="space-y-4">
              {filteredReports.length > 0 ? (
                filteredReports.map((issue) => <IssueCard key={issue.id} issue={issue} detailsHref={`/admin/reports/${issue.id}`} />)
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-800 p-6 text-center">
                  <p className="text-base font-semibold text-slate-200">{t("noReportsMatchFilters")}</p>
                  <p className="mt-2 text-sm text-slate-400">{t("filtersHint")}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
