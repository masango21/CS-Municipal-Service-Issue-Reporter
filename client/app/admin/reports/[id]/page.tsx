"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { PriorityBadge } from "@/components/PriorityBadge";
import { ReportMap } from "@/components/ReportMap";
import { StatusBadge } from "@/components/StatusBadge";
import { issueCategories } from "@/data/issueCategories";
import { useAuth } from "@/context/AuthContext";
import { useReports } from "@/context/ReportsContext";
import type { Issue, IssueStatus, ResidentStatusUpdate, StaffNote } from "@/types/issue";

const statuses: IssueStatus[] = ["Reported", "Under Review", "Assigned", "In Progress", "Resolved", "Closed"];
type StaffDirectoryEntry = { id: string; name: string; email: string };

export default function StaffReportPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const reportId = params.id;
  const { adminUser, isAuthReady } = useAuth();
  const { reports, refreshReports, fetchStaffReport, fetchStaffDirectory, updateReportTriage, addStaffNote, addResidentUpdate } = useReports();
  const [issue, setIssue] = useState<Issue | null>(null);
  const [staff, setStaff] = useState<StaffDirectoryEntry[]>([]);
  const [status, setStatus] = useState<IssueStatus>("Reported");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState<Issue["priority"]>("Medium");
  const [department, setDepartment] = useState("");
  const [maintenanceTeam, setMaintenanceTeam] = useState("");
  const [assignedStaffId, setAssignedStaffId] = useState("");
  const [duplicateOf, setDuplicateOf] = useState("");
  const [verified, setVerified] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [updateText, setUpdateText] = useState("");
  const [updateStatus, setUpdateStatus] = useState<IssueStatus>("Under Review");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isAuthReady) return;
    if (!adminUser?.token) {
      router.replace("/admin/login");
      return;
    }

    let active = true;
    void Promise.all([
      fetchStaffReport(reportId, adminUser.token),
      fetchStaffDirectory(adminUser.token),
      refreshReports(adminUser.token),
    ]).then(([loadedIssue, loadedStaff]) => {
      if (!active) return;
      setIssue(loadedIssue);
      setStaff(loadedStaff);
      setStatus(loadedIssue.status);
      setCategory(loadedIssue.category);
      setPriority(loadedIssue.priority);
      setDepartment(loadedIssue.department ?? "");
      setMaintenanceTeam(loadedIssue.maintenanceTeam ?? "");
      setAssignedStaffId(loadedIssue.assignedStaffId ?? "");
      setDuplicateOf(loadedIssue.duplicateOf ?? "");
      setVerified(Boolean(loadedIssue.verified));
    }).catch((loadError: unknown) => {
      if (!active) return;
      setError(loadError instanceof Error ? loadError.message : "Unable to load this report.");
    });

    return () => { active = false; };
  }, [adminUser?.token, fetchStaffDirectory, fetchStaffReport, isAuthReady, refreshReports, reportId, router]);

  const saveTriage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!adminUser?.token) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const updated = await updateReportTriage(reportId, {
        status,
        category,
        priority,
        verified,
        department,
        maintenanceTeam,
        assignedStaffId,
        duplicateOf,
      }, adminUser.token);
      setIssue(updated);
      setMessage("Triage changes saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save triage changes.");
    } finally {
      setBusy(false);
    }
  };

  const submitStaffNote = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!issue || !adminUser?.token || !noteText.trim()) return;
    setBusy(true);
    setError("");
    try {
      const note = await addStaffNote(issue.id, noteText.trim(), adminUser.token);
      setIssue((current) => current ? { ...current, staffNotes: [...(current.staffNotes ?? []), note] } : current);
      setNoteText("");
    } catch (noteError) {
      setError(noteError instanceof Error ? noteError.message : "Unable to add staff note.");
    } finally {
      setBusy(false);
    }
  };

  const publishUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!issue || !adminUser?.token || !updateText.trim()) return;
    setBusy(true);
    setError("");
    try {
      const update = await addResidentUpdate(issue.id, updateStatus, updateText.trim(), adminUser.token);
      setIssue((current) => current ? {
        ...current,
        status: update.status,
        residentUpdates: [...(current.residentUpdates ?? []), update],
      } : current);
      setStatus(update.status);
      setUpdateText("");
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to publish resident update.");
    } finally {
      setBusy(false);
    }
  };

  if (!isAuthReady || !adminUser?.token || !issue) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center bg-slate-950 px-4 text-white" aria-busy="true">
        <p role={error ? "alert" : "status"} className="text-sm text-slate-300">{error || "Loading report operations..."}</p>
      </main>
    );
  }

  const linkedReport = reports.find((report) => report.id === issue.duplicateOf);
  const duplicateCandidates = reports.filter((report) => report.id !== issue.id);

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/admin/dashboard" className="text-sm font-semibold text-cyan-300 hover:text-cyan-200">Operations queue</Link>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">Report triage · {issue.id}</p>
            <h1 className="mt-2 text-3xl font-bold">{issue.title}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2"><StatusBadge status={issue.status} staffView /><PriorityBadge priority={issue.priority} /><span className="text-sm text-slate-400">{issue.location.city} · {issue.category}</span></div>
          </div>
          <Link href={`/issues/${issue.id}`} className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-cyan-400">Resident view</Link>
        </div>

        {error && <p role="alert" className="mb-5 rounded-lg border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</p>}
        {message && <p role="status" className="mb-5 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">{message}</p>}

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            <section className="rounded-xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Triage</p><h2 className="mt-1 text-xl font-semibold">Report handling</h2></div>
                <span className="text-sm text-slate-400">Reported {new Date(issue.reportedAt).toLocaleDateString("en-ZA")}</span>
              </div>
              <form onSubmit={saveTriage} className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm text-slate-300">Status
                  <select value={status} onChange={(event) => setStatus(event.target.value as IssueStatus)} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-white">
                    {statuses.map((item) => <option key={item} value={item}>{item === "Reported" ? "New" : item}</option>)}
                  </select>
                </label>
                <label className="text-sm text-slate-300">Category
                  <select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-white">
                    {issueCategories.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>
                <label className="text-sm text-slate-300">Priority
                  <select value={priority} onChange={(event) => setPriority(event.target.value as Issue["priority"])} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-white">
                    {["Critical", "High", "Medium", "Low"].map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>
                <label className="flex items-center gap-3 self-end rounded-lg border border-slate-700 bg-slate-800 px-3 py-3 text-sm text-slate-200">
                  <input type="checkbox" checked={verified} onChange={(event) => setVerified(event.target.checked)} className="h-4 w-4 accent-cyan-500" />
                  Verified by municipal staff
                </label>
                <label className="text-sm text-slate-300">Department
                  <input value={department} onChange={(event) => setDepartment(event.target.value)} placeholder="e.g. Roads and Stormwater" className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-white placeholder:text-slate-500" />
                </label>
                <label className="text-sm text-slate-300">Maintenance team
                  <input value={maintenanceTeam} onChange={(event) => setMaintenanceTeam(event.target.value)} placeholder="e.g. Central maintenance crew" className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-white placeholder:text-slate-500" />
                </label>
                <label className="text-sm text-slate-300">Responsible staff member
                  <select value={assignedStaffId} onChange={(event) => setAssignedStaffId(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-white">
                    <option value="">Unassigned</option>
                    {staff.map((member) => <option key={member.id} value={member.id}>{member.name} · {member.email}</option>)}
                  </select>
                </label>
                <label className="text-sm text-slate-300">Duplicate of
                  <select value={duplicateOf} onChange={(event) => setDuplicateOf(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-white">
                    <option value="">Not a duplicate</option>
                    {duplicateCandidates.map((report) => <option key={report.id} value={report.id}>{report.id} · {report.title}</option>)}
                  </select>
                </label>
                <div className="sm:col-span-2"><button disabled={busy} type="submit" className="rounded-lg bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-60">{busy ? "Saving..." : "Save triage"}</button></div>
              </form>
              {linkedReport && <p className="mt-4 rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">Duplicate linked to <Link className="font-semibold underline" href={`/admin/reports/${linkedReport.id}`}>{linkedReport.id} · {linkedReport.title}</Link></p>}
              {issue.duplicateReports?.length ? (
                <div className="mt-4 rounded-lg border border-slate-700 px-3 py-3 text-sm">
                  <p className="font-semibold text-slate-200">Reports linked as duplicates</p>
                  <ul className="mt-2 space-y-2">
                    {issue.duplicateReports.map((duplicate) => <li key={duplicate.id}><Link className="text-cyan-300 underline" href={`/admin/reports/${duplicate.id}`}>{duplicate.id} · {duplicate.title}</Link></li>)}
                  </ul>
                </div>
              ) : null}
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
                <h2 className="text-lg font-semibold">Internal staff notes</h2>
                <form onSubmit={submitStaffNote} className="mt-4 space-y-3">
                  <label htmlFor="staff-note" className="sr-only">Add an internal staff note</label>
                  <textarea id="staff-note" rows={3} value={noteText} onChange={(event) => setNoteText(event.target.value)} placeholder="Record inspection details or handover notes" className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder:text-slate-500" />
                  <button disabled={busy || !noteText.trim()} className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-100 hover:border-cyan-400 disabled:opacity-50">Add private note</button>
                </form>
                <ol className="mt-5 space-y-3">
                  {(issue.staffNotes ?? []).slice().reverse().map((note: StaffNote) => <li key={note.id} className="border-l-2 border-slate-600 pl-3"><p className="text-sm text-slate-200">{note.text}</p><p className="mt-1 text-xs text-slate-400">{note.authorName} · {new Date(note.createdAt).toLocaleString("en-ZA")}</p></li>)}
                  {!issue.staffNotes?.length && <li className="text-sm text-slate-400">No internal notes yet.</li>}
                </ol>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
                <h2 className="text-lg font-semibold">Resident status update</h2>
                <form onSubmit={publishUpdate} className="mt-4 space-y-3">
                  <label htmlFor="resident-update-status" className="sr-only">Status for resident update</label>
                  <select id="resident-update-status" value={updateStatus} onChange={(event) => setUpdateStatus(event.target.value as IssueStatus)} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white">
                    {statuses.map((item) => <option key={item} value={item}>{item === "Reported" ? "New" : item}</option>)}
                  </select>
                  <label htmlFor="resident-update" className="sr-only">Message visible to the resident</label>
                  <textarea id="resident-update" rows={3} value={updateText} onChange={(event) => setUpdateText(event.target.value)} placeholder="Share a clear progress update with the resident" className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder:text-slate-500" />
                  <button disabled={busy || !updateText.trim()} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">Publish update</button>
                </form>
                <ol className="mt-5 space-y-3">
                  {(issue.residentUpdates ?? []).slice().reverse().map((update: ResidentStatusUpdate) => <li key={update.id} className="border-l-2 border-emerald-500 pl-3"><p className="text-sm text-slate-200">{update.text}</p><p className="mt-1 text-xs text-slate-400">{update.status === "Reported" ? "New" : update.status} · {update.authorName} · {new Date(update.createdAt).toLocaleString("en-ZA")}</p></li>)}
                  {!issue.residentUpdates?.length && <li className="text-sm text-slate-400">No resident updates published.</li>}
                </ol>
              </div>
            </section>
          </div>

          <aside className="space-y-5 xl:sticky xl:top-6">
            <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <h2 className="mb-3 text-base font-semibold">Resident report location</h2>
              <ReportMap issues={[issue]} compact />
              <p className="mt-3 text-xs text-slate-400">{issue.location.latitude.toFixed(5)}, {issue.location.longitude.toFixed(5)} · {issue.location.municipality}</p>
            </section>
            <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <h2 className="text-base font-semibold">Report description</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-300">{issue.description}</p>
              <p className="mt-4 text-xs text-slate-400">Submitted by {issue.reportedBy}</p>
              {issue.image && <img src={issue.image} alt={`Evidence for ${issue.title}`} className="mt-4 max-h-56 w-full rounded-lg object-cover" />}
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}