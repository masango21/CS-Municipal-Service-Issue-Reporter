"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Issue, IssueDraft, ResidentStatusUpdate, StaffNote } from "@/types/issue";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

type ReportStats = {
  total: number;
  reported: number;
  inProgress: number;
  resolved: number;
  critical: number;
  highPriority: number;
};

type TriageUpdate = Partial<Pick<Issue,
  "status" | "category" | "priority" | "verified" | "department" |
  "maintenanceTeam" | "assignedStaffId" | "duplicateOf"
>>;

type StaffDirectoryEntry = { id: string; name: string; email: string };

type ReportsContextValue = {
  reports: Issue[];
  isReportsReady: boolean;
  reportsError: string | null;
  addReport: (draft: IssueDraft) => Promise<Issue>;
  fetchMyReports: () => Promise<Issue[]>;
  refreshReports: (staffView?: boolean) => Promise<void>;
  updateReportTriage: (reportId: string, changes: TriageUpdate) => Promise<Issue>;
  fetchStaffReport: (reportId: string) => Promise<Issue>;
  fetchStaffDirectory: () => Promise<StaffDirectoryEntry[]>;
  addStaffNote: (reportId: string, text: string) => Promise<StaffNote>;
  addResidentUpdate: (reportId: string, status: Issue["status"], text: string) => Promise<ResidentStatusUpdate>;
  resetReports: () => Promise<void>;
  stats: ReportStats;
};

const ReportsContext = createContext<ReportsContextValue | undefined>(undefined);

async function fetchReportsFromApi(staffView = false): Promise<Issue[]> {
  const response = await fetch(`${API_BASE_URL}${staffView ? "/api/admin/reports" : "/api/reports"}`, {
    cache: "no-store",
    credentials: "include",
  });
  const payload = (await response.json()) as { reports?: Issue[]; message?: string };
  if (!response.ok) throw new Error(payload.message ?? "Reports are temporarily unavailable.");
  return Array.isArray(payload.reports) ? payload.reports : [];
}

async function staffRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const payload = await response.json() as T & { message?: string };
  if (!response.ok) throw new Error(payload.message ?? "Staff operation failed.");
  return payload;
}

export function ReportsProvider({ children }: { children: ReactNode }) {
  const [reports, setReports] = useState<Issue[]>([]);
  const [isReportsReady, setIsReportsReady] = useState(false);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const reportMutationVersion = useRef(0);
  const staffReportsAreActive = useRef(false);

  useEffect(() => {
    const bootstrapReports = async () => {
      const versionAtStart = reportMutationVersion.current;
      try {
        const backendReports = await fetchReportsFromApi();
        setReportsError(null);
        setReports((current) => {
          if (staffReportsAreActive.current) return current;
          if (reportMutationVersion.current === versionAtStart) {
            return backendReports;
          }

          const mergedReports = new Map(backendReports.map((report) => [report.id, report]));
          for (const report of current) {
            mergedReports.set(report.id, report);
          }
          return Array.from(mergedReports.values()).sort(
            (first, second) => new Date(second.reportedAt).getTime() - new Date(first.reportedAt).getTime(),
          );
        });
      } catch (error) {
        setReports([]);
        setReportsError(error instanceof Error ? error.message : "Reports are temporarily unavailable.");
      } finally {
        setIsReportsReady(true);
      }
    };

    void bootstrapReports();
  }, []);

  const addReport = async (draft: IssueDraft): Promise<Issue> => {
    const response = await fetch(`${API_BASE_URL}/api/reports`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...draft }),
    });
    const payload = (await response.json()) as { report?: Issue; message?: string };
    if (!response.ok || !payload.report) {
      throw new Error(payload.message ?? "Your report could not be saved. Please try again.");
    }

    reportMutationVersion.current += 1;
    setReports((current) => [payload.report!, ...current.filter((item) => item.id !== payload.report!.id)]);
    setReportsError(null);
    return payload.report;
  };

  const fetchMyReports = useCallback(async () => {
    const response = await fetch(`${API_BASE_URL}/api/my/reports`, {
      credentials: "include",
      cache: "no-store",
    });
    const payload = (await response.json()) as { reports?: Issue[]; message?: string };
    if (!response.ok) throw new Error(payload.message ?? "Unable to load your reports.");
    return Array.isArray(payload.reports) ? payload.reports : [];
  }, []);

  const refreshReports = useCallback(async (staffView = false) => {
    const versionAtStart = reportMutationVersion.current;
    const nextReports = await fetchReportsFromApi(staffView);
    setReportsError(null);
    if (staffView) {
      staffReportsAreActive.current = true;
      reportMutationVersion.current += 1;
      setReports(nextReports);
      return;
    }
    staffReportsAreActive.current = false;
    setReports((current) => {
      if (reportMutationVersion.current === versionAtStart) {
        return nextReports;
      }
      const mergedReports = new Map(nextReports.map((report) => [report.id, report]));
      for (const report of current) mergedReports.set(report.id, report);
      return Array.from(mergedReports.values());
    });
  }, []);

  const updateReportTriage = useCallback(async (reportId: string, changes: TriageUpdate) => {
    const payload = await staffRequest<{ report: Issue }>(`/api/reports/${reportId}/triage`, {
      method: "PATCH",
      body: JSON.stringify(changes),
    });
    reportMutationVersion.current += 1;
    setReports((current) => current.map((report) => report.id === reportId ? payload.report : report));
    return payload.report;
  }, []);

  const fetchStaffReport = useCallback(async (reportId: string) => {
    const payload = await staffRequest<{ report: Issue }>(`/api/admin/reports/${reportId}`);
    return payload.report;
  }, []);

  const fetchStaffDirectory = useCallback(async () => {
    const payload = await staffRequest<{ staff: StaffDirectoryEntry[] }>("/api/admin/staff");
    return payload.staff;
  }, []);

  const addStaffNote = useCallback(async (reportId: string, text: string) => {
    const payload = await staffRequest<{ note: StaffNote }>(`/api/reports/${reportId}/notes`, {
      method: "POST",
      body: JSON.stringify({ text }),
    });
    return payload.note;
  }, []);

  const addResidentUpdate = useCallback(async (reportId: string, status: Issue["status"], text: string) => {
    const payload = await staffRequest<{ update: ResidentStatusUpdate; report: Issue }>(`/api/reports/${reportId}/updates`, {
      method: "POST",
      body: JSON.stringify({ status, text }),
    });
    reportMutationVersion.current += 1;
    setReports((current) => current.map((report) => report.id === reportId ? payload.report : report));
    return payload.update;
  }, []);

  const resetReports = useCallback(async () => {
    const response = await fetch(`${API_BASE_URL}/api/reports`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!response.ok) throw new Error("Unable to reset reports.");
    reportMutationVersion.current += 1;
    setReports([]);
    setReportsError(null);
  }, []);

  const stats = useMemo<ReportStats>(() => {
    const total = reports.length;
    const reported = reports.filter((issue) => issue.status === "Reported").length;
    const inProgress = reports.filter((issue) =>
      ["Under Review", "Assigned", "In Progress"].includes(issue.status),
    ).length;
    const resolved = reports.filter((issue) => issue.status === "Resolved").length;
    const critical = reports.filter((issue) => issue.priority === "Critical").length;
    const highPriority = reports.filter((issue) => issue.priority === "High").length;

    return {
      total,
      reported,
      inProgress,
      resolved,
      critical,
      highPriority,
    };
  }, [reports]);

  return (
    <ReportsContext.Provider value={{
      reports,
      isReportsReady,
      reportsError,
      addReport,
      fetchMyReports,
      refreshReports,
      updateReportTriage,
      fetchStaffReport,
      fetchStaffDirectory,
      addStaffNote,
      addResidentUpdate,
      resetReports,
      stats,
    }}>
      {children}
    </ReportsContext.Provider>
  );
}

export function useReports() {
  const context = useContext(ReportsContext);

  if (!context) {
    throw new Error("useReports must be used inside ReportsProvider");
  }

  return context;
}
