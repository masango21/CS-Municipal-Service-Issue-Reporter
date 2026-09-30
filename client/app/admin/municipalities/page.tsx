"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  fetchAdminMunicipalities,
  fetchAdminMunicipalityReports,
  generateMunicipalityAccessCode,
  setMunicipalityActive,
  type Municipality,
} from "@/lib/municipalities";
import type { Issue } from "@/types/issue";

export default function MunicipalityAdminPage() {
  const router = useRouter();
  const { adminUser, residentUser, isAuthReady, logout } = useAuth();
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [reports, setReports] = useState<Issue[]>([]);
  const [search, setSearch] = useState("");
  const [generatedCode, setGeneratedCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isAuthReady) return;
    if (adminUser?.role !== "super_admin") {
      router.replace(residentUser ? "/dashboard" : adminUser ? "/admin/dashboard" : "/admin/login");
      return;
    }
    let active = true;
    void fetchAdminMunicipalities()
      .then(({ municipalities: records }) => {
        if (active) setMunicipalities(records);
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load the official municipality directory.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => { active = false; };
  }, [adminUser, isAuthReady, residentUser, router]);

  const selectedMunicipality = municipalities.find((municipality) => municipality.id === selectedId);
  const filteredMunicipalities = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return municipalities.filter((municipality) =>
      `${municipality.name} ${municipality.province} ${municipality.code}`.toLowerCase().includes(normalizedSearch),
    );
  }, [municipalities, search]);

  const viewReports = async () => {
    if (!selectedId) return;
    setIsLoadingReports(true);
    setError("");
    setReports([]);
    try {
      const result = await fetchAdminMunicipalityReports(selectedId);
      setReports(result.reports);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load municipality reports.");
    } finally {
      setIsLoadingReports(false);
    }
  };

  const generateCode = async () => {
    if (!selectedId) return;
    setIsSaving(true);
    setError("");
    setMessage("");
    setGeneratedCode("");
    try {
      const result = await generateMunicipalityAccessCode(selectedId);
      setGeneratedCode(result.accessCode);
      setMessage(result.message);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to generate an access code.");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleMunicipality = async () => {
    if (!selectedMunicipality) return;
    setIsSaving(true);
    setError("");
    try {
      await setMunicipalityActive(selectedId, selectedMunicipality.active === false);
      const result = await fetchAdminMunicipalities();
      setMunicipalities(result.municipalities);
      setGeneratedCode("");
      setMessage("Municipality status updated. Existing staff verification has been invalidated.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update municipality status.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isAuthReady || !adminUser || adminUser.role !== "super_admin") {
    return <main className="flex min-h-[60vh] items-center justify-center bg-slate-950 text-white" aria-busy="true"><p role="status">Checking super-admin access...</p></main>;
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-400">System administration</p>
            <h1 className="mt-2 text-3xl font-bold">Municipalities</h1>
            <p className="mt-2 text-sm text-slate-400">{municipalities.length} official municipal boundaries loaded</p>
          </div>
          <div className="flex gap-3">
            <Link href="/admin/staff" className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-900">Staff access</Link>
            <button type="button" onClick={() => void logout()} className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-900">Sign out</button>
          </div>
        </header>

        {error && <p role="alert" className="mb-5 rounded-lg border border-rose-900 bg-rose-950/50 px-4 py-3 text-sm text-rose-200">{error}</p>}

        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <section aria-label="Municipality directory" className="min-w-0">
            <label htmlFor="municipality-search" className="mb-2 block text-sm font-medium text-slate-300">Find municipality</label>
            <input id="municipality-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, province, or code" className="mb-4 w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-white placeholder:text-slate-500" />
            {isLoading ? <p role="status" className="p-5 text-sm text-slate-400">Loading MDB municipality directory...</p> : (
              <div className="max-h-[68vh] overflow-auto border-y border-slate-800">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-slate-900 text-xs uppercase text-slate-400">
                    <tr><th className="px-3 py-3">Municipality</th><th className="px-3 py-3">Province</th><th className="px-3 py-3">Reports</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {filteredMunicipalities.map((municipality) => (
                      <tr key={municipality.id} className={selectedId === municipality.id ? "bg-slate-900" : "hover:bg-slate-900/60"}>
                        <td className="px-3 py-3">
                          <button type="button" onClick={() => { setSelectedId(municipality.id); setReports([]); setGeneratedCode(""); setMessage(""); }} className="text-left font-medium text-white hover:text-cyan-300">{municipality.name}</button>
                          <p className="mt-1 text-xs text-slate-500">{municipality.code} · Category {municipality.type || "not specified"}</p>
                        </td>
                        <td className="px-3 py-3 text-slate-300">{municipality.province || "—"}</td>
                        <td className="px-3 py-3 text-slate-300">{municipality.reportCount ?? 0}</td>
                      </tr>
                    ))}
                    {!filteredMunicipalities.length && <tr><td colSpan={3} className="px-3 py-8 text-center text-slate-400">No municipalities match this search.</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section aria-label="Selected municipality details" className="min-w-0">
            {!selectedMunicipality ? (
              <p className="border-y border-slate-800 py-8 text-sm text-slate-400">Select a municipality to review its reports and access settings.</p>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 pb-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-cyan-400">{selectedMunicipality.province} · Category {selectedMunicipality.type || "—"}</p>
                    <h2 className="mt-2 text-2xl font-bold">{selectedMunicipality.name}</h2>
                    <p className={`mt-1 text-sm ${selectedMunicipality.accessCodeConfigured ? "text-emerald-300" : "text-amber-300"}`}>
                      Access code: {selectedMunicipality.accessCodeConfigured ? "configured" : "not set"}
                    </p>
                    <p className="mt-1 text-sm text-slate-400">{selectedMunicipality.reportCount ?? 0} reports · {selectedMunicipality.staffCount ?? 0} assigned staff</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${selectedMunicipality.active === false ? "bg-rose-950 text-rose-300" : "bg-emerald-950 text-emerald-300"}`}>
                    {selectedMunicipality.active === false ? "Inactive" : "Active"}
                  </span>
                </div>

                <div className="flex flex-wrap gap-3 border-b border-slate-800 py-5">
                  <button type="button" onClick={() => void viewReports()} disabled={isLoadingReports} className="rounded-lg bg-cyan-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-600 disabled:opacity-50">{isLoadingReports ? "Loading reports..." : "View reports"}</button>
                  <button type="button" onClick={() => void generateCode()} disabled={isSaving} className="rounded-lg border border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-100 hover:bg-slate-900 disabled:opacity-50">Generate / reset access code</button>
                  <button type="button" onClick={() => void toggleMunicipality()} disabled={isSaving} className="rounded-lg border border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-900 disabled:opacity-50">{selectedMunicipality.active === false ? "Activate" : "Deactivate"}</button>
                </div>

                {message && <p role="status" className="mt-4 text-sm text-emerald-300">{message}</p>}
                {generatedCode && (
                  <div className="mt-4 border-l-2 border-amber-400 bg-amber-950/30 p-4">
                    <p className="text-sm font-semibold text-amber-200">One-time access code</p>
                    <p className="mt-1 text-xs text-amber-100/80">Copy and share this only with staff assigned to this municipality. It will not be shown again.</p>
                    <code className="mt-3 block break-all rounded bg-slate-950 p-3 font-mono text-sm text-white">{generatedCode}</code>
                    <button type="button" onClick={() => void navigator.clipboard.writeText(generatedCode)} className="mt-3 text-sm font-semibold text-cyan-300 underline">Copy code</button>
                  </div>
                )}

                <div className="mt-8">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold">Reports</h3>
                    {reports.length > 0 && <span className="text-xs text-slate-400">{reports.length} loaded</span>}
                  </div>
                  {isLoadingReports ? <p role="status" className="py-6 text-sm text-slate-400">Loading reports...</p> : reports.length ? (
                    <ul className="divide-y divide-slate-800 border-y border-slate-800">
                      {reports.map((report) => (
                        <li key={report.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                          <div>
                            <Link href={`/admin/reports/${report.id}`} className="font-semibold text-white hover:text-cyan-300">{report.title}</Link>
                            <p className="mt-1 text-sm text-slate-400">{report.category} · {report.location.address || report.location.municipality} · {report.status}</p>
                          </div>
                          <time className="text-xs text-slate-500" dateTime={report.reportedAt}>{new Date(report.reportedAt).toLocaleDateString()}</time>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="border-y border-dashed border-slate-800 py-6 text-sm text-slate-400">No reports have been loaded for this municipality.</p>}
                </div>
              </>
            )}
          </section>
        </div>

        <p className="mt-8 border-t border-slate-800 pt-4 text-xs text-slate-500">
          Boundaries: Municipal Demarcation Board. The public item is titled Local Municipalities 2021, while its linked feature service describes 2018 boundaries; verify current data before public launch.
        </p>
      </div>
    </main>
  );
}