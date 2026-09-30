"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  assignStaffMunicipality,
  fetchAdminMunicipalities,
  fetchAdminStaff,
  removeStaffMunicipality,
  setStaffActive,
  type Municipality,
  type StaffMember,
} from "@/lib/municipalities";

export default function StaffAdminPage() {
  const router = useRouter();
  const { adminUser, residentUser, isAuthReady, logout } = useAuth();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [selectedMunicipalityId, setSelectedMunicipalityId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadDirectory = async () => {
    const [staffResult, municipalityResult] = await Promise.all([
      fetchAdminStaff(),
      fetchAdminMunicipalities(),
    ]);
    setStaff(staffResult.staff);
    setMunicipalities(municipalityResult.municipalities);
    setSelectedStaffId((current) => current || staffResult.staff.find((member) => member.role === "staff")?.id || "");
    setSelectedMunicipalityId((current) => current || municipalityResult.municipalities[0]?.id || "");
  };

  useEffect(() => {
    if (!isAuthReady) return;
    if (adminUser?.role !== "super_admin") {
      router.replace(residentUser ? "/dashboard" : adminUser ? "/admin/dashboard" : "/admin/login");
      return;
    }
    let active = true;
    void Promise.resolve().then(loadDirectory)
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load staff access.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => { active = false; };
  }, [adminUser, isAuthReady, residentUser, router]);

  const selectedStaff = staff.find((member) => member.id === selectedStaffId);
  const availableMunicipalities = municipalities.filter((municipality) =>
    !selectedStaff?.municipalities.some((assigned) => assigned.id === municipality.id),
  );

  const assignSelectedMunicipality = async () => {
    if (!selectedStaffId || !selectedMunicipalityId) return;
    setIsSaving(true);
    setError("");
    setMessage("");
    try {
      await assignStaffMunicipality(selectedStaffId, selectedMunicipalityId);
      await loadDirectory();
      setMessage("Municipality access assigned.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to assign municipality access.");
    } finally {
      setIsSaving(false);
    }
  };

  const removeAssignment = async (staffId: string, municipalityId: string) => {
    setIsSaving(true);
    setError("");
    setMessage("");
    try {
      await removeStaffMunicipality(staffId, municipalityId);
      await loadDirectory();
      setMessage("Municipality access removed. Existing verified sessions are no longer authorized.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to remove municipality access.");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleStaffStatus = async (member: StaffMember) => {
    setIsSaving(true);
    setError("");
    setMessage("");
    try {
      await setStaffActive(member.id, member.active === false);
      await loadDirectory();
      setMessage(member.active === false ? "Staff account activated." : "Staff account deactivated; active sessions are now rejected.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update staff account.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isAuthReady || !adminUser || adminUser.role !== "super_admin") {
    return <main className="flex min-h-[60vh] items-center justify-center bg-slate-950 text-white" aria-busy="true"><p role="status">Checking super-admin access...</p></main>;
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-400">System administration</p>
            <h1 className="mt-2 text-3xl font-bold">Staff access</h1>
          </div>
          <div className="flex gap-3">
            <Link href="/admin/municipalities" className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-900">Municipalities</Link>
            <button type="button" onClick={() => void logout()} className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-900">Sign out</button>
          </div>
        </header>

        {error && <p role="alert" className="mb-5 rounded-lg border border-rose-900 bg-rose-950/50 px-4 py-3 text-sm text-rose-200">{error}</p>}
        {message && <p role="status" className="mb-5 text-sm text-emerald-300">{message}</p>}

        <section aria-label="Assign municipality access" className="mb-8 grid gap-4 border-y border-slate-800 py-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div>
            <label htmlFor="staff-member" className="mb-2 block text-sm font-medium text-slate-300">Staff member</label>
            <select id="staff-member" value={selectedStaffId} onChange={(event) => setSelectedStaffId(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-white">
              {staff.filter((member) => member.role === "staff").map((member) => <option key={member.id} value={member.id}>{member.name} · {member.email}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="municipality" className="mb-2 block text-sm font-medium text-slate-300">Municipality</label>
            <select id="municipality" value={selectedMunicipalityId} onChange={(event) => setSelectedMunicipalityId(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-white">
              {availableMunicipalities.map((municipality) => <option key={municipality.id} value={municipality.id}>{municipality.name} · {municipality.province}</option>)}
            </select>
          </div>
          <button type="button" onClick={() => void assignSelectedMunicipality()} disabled={isSaving || !selectedStaffId || !availableMunicipalities.some((item) => item.id === selectedMunicipalityId)} className="rounded-lg bg-cyan-700 px-4 py-3 text-sm font-semibold text-white hover:bg-cyan-600 disabled:opacity-50">Assign</button>
        </section>

        {isLoading ? <p role="status" className="py-8 text-sm text-slate-400">Loading staff directory...</p> : staff.length ? (
          <div className="overflow-x-auto border-y border-slate-800">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="text-xs uppercase text-slate-400"><tr><th className="px-3 py-3">Staff member</th><th className="px-3 py-3">Role</th><th className="px-3 py-3">Municipality access</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Action</th></tr></thead>
              <tbody className="divide-y divide-slate-800">
                {staff.map((member) => (
                  <tr key={member.id}>
                    <td className="px-3 py-4"><p className="font-semibold text-white">{member.name}</p><p className="mt-1 text-xs text-slate-400">{member.email}</p></td>
                    <td className="px-3 py-4 text-slate-300">{member.role === "super_admin" ? "Super admin" : "Staff"}</td>
                    <td className="px-3 py-4">
                      {member.municipalities.length ? <ul className="space-y-2">{member.municipalities.map((municipality) => (
                        <li key={municipality.id} className="flex items-center justify-between gap-3 text-slate-300">
                          <span>{municipality.name}</span>
                          {member.role === "staff" && <button type="button" disabled={isSaving} onClick={() => void removeAssignment(member.id, municipality.id)} aria-label={`Remove ${member.name} from ${municipality.name}`} className="text-xs font-semibold text-rose-300 hover:text-rose-200">Remove</button>}
                        </li>
                      ))}</ul> : <span className="text-slate-500">None assigned</span>}
                    </td>
                    <td className="px-3 py-4"><span className={member.active === false ? "text-rose-300" : "text-emerald-300"}>{member.active === false ? "Inactive" : "Active"}</span></td>
                    <td className="px-3 py-4">{member.role === "staff" && <button type="button" disabled={isSaving} onClick={() => void toggleStaffStatus(member)} className="text-xs font-semibold text-cyan-300 hover:text-cyan-200">{member.active === false ? "Activate" : "Deactivate"}</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="border-y border-dashed border-slate-800 py-8 text-sm text-slate-400">No staff accounts are registered yet.</p>}
      </div>
    </main>
  );
}