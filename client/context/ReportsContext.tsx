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

const STORAGE_KEY = "municipal-service-issues";
const INITIALIZATION_KEY = "municipal-service-initialized";
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
  addReport: (draft: IssueDraft) => Promise<Issue>;
  refreshReports: (token?: string) => Promise<void>;
  updateReportTriage: (reportId: string, changes: TriageUpdate, token: string) => Promise<Issue>;
  fetchStaffReport: (reportId: string, token: string) => Promise<Issue>;
  fetchStaffDirectory: (token: string) => Promise<StaffDirectoryEntry[]>;
  addStaffNote: (reportId: string, text: string, token: string) => Promise<StaffNote>;
  addResidentUpdate: (reportId: string, status: Issue["status"], text: string, token: string) => Promise<ResidentStatusUpdate>;
  resetReports: () => void;
  stats: ReportStats;
};

const ReportsContext = createContext<ReportsContextValue | undefined>(undefined);

function readStoredReports(): Issue[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const initialized = window.localStorage.getItem(INITIALIZATION_KEY);
    const storedReports = window.localStorage.getItem(STORAGE_KEY);

    if (!initialized) {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.setItem(INITIALIZATION_KEY, "true");
      return [];
    }

    if (!storedReports) {
      return [];
    }

    const parsed = JSON.parse(storedReports) as Issue[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Unable to parse saved reports", error);
    return [];
  }
}

async function fetchReportsFromApi(token?: string): Promise<Issue[]> {
  try {
    const response = await fetch(`${API_BASE_URL}${token ? "/api/admin/reports" : "/api/reports"}`, {
      cache: "no-store",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });

    if (!response.ok) {
      throw new Error(`Unexpected status: ${response.status}`);
    }

    const payload = (await response.json()) as { reports?: Issue[] };
    return Array.isArray(payload.reports) ? payload.reports : [];
  } catch (error) {
    console.warn("Backend reports unavailable; using local data fallback.", error);
    if (token) throw error;
    return readStoredReports();
  }
}

async function staffRequest<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
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
  const reportMutationVersion = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const alreadyInitialized = window.localStorage.getItem(INITIALIZATION_KEY);
    if (!alreadyInitialized) {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.setItem(INITIALIZATION_KEY, "true");
    }

    const bootstrapReports = async () => {
      const versionAtStart = reportMutationVersion.current;
      try {
        const backendReports = await fetchReportsFromApi();
        setReports((current) => {
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
      } finally {
        setIsReportsReady(true);
      }
    };

    void bootstrapReports();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
  }, [reports]);

  const addReport = async (draft: IssueDraft): Promise<Issue> => {
    const nextReport: Issue = {
      id: `MSR-local-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      title: draft.title,
      category: draft.category,
      description: draft.description,
      location: draft.location,
      priority: draft.priority,
      status: draft.status ?? "Reported",
      reportedBy: draft.reportedBy ?? "Resident",
      reportedAt: new Date().toISOString(),
      image: draft.image,
    };

    reportMutationVersion.current += 1;
    setReports((current) => [nextReport, ...current]);

    try {
      const response = await fetch(`${API_BASE_URL}/api/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
          location: {
            latitude: draft.location.latitude,
            longitude: draft.location.longitude,
            address: draft.location.address,
            city: draft.location.city,
            municipality: draft.location.municipality,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Unexpected backend status: ${response.status}`);
      }

      const payload = (await response.json()) as { report?: Issue };
      if (!payload.report) {
        return nextReport;
      }

      setReports((current) => [
        payload.report!,
        ...current.filter((item) => item.id !== nextReport.id && item.id !== payload.report!.id),
      ]);
      return payload.report;
    } catch (error) {
      console.warn("Report could not be synced to backend; kept local state.", error);
      return nextReport;
    }
  };

  const refreshReports = useCallback(async (token?: string) => {
    const versionAtStart = reportMutationVersion.current;
    const nextReports = await fetchReportsFromApi(token);
    setReports((current) => {
      if (reportMutationVersion.current === versionAtStart) {
        return nextReports;
      }
      const mergedReports = new Map(nextReports.map((report) => [report.id, report]));
      for (const report of current) mergedReports.set(report.id, report);
      return Array.from(mergedReports.values());
    });
  }, []);

  const updateReportTriage = useCallback(async (reportId: string, changes: TriageUpdate, token: string) => {
    const payload = await staffRequest<{ report: Issue }>(`/api/reports/${reportId}/triage`, token, {
      method: "PATCH",
      body: JSON.stringify(changes),
    });
    reportMutationVersion.current += 1;
    setReports((current) => current.map((report) => report.id === reportId ? payload.report : report));
    return payload.report;
  }, []);

  const fetchStaffReport = useCallback(async (reportId: string, token: string) => {
    const payload = await staffRequest<{ report: Issue }>(`/api/admin/reports/${reportId}`, token);
    return payload.report;
  }, []);

  const fetchStaffDirectory = useCallback(async (token: string) => {
    const payload = await staffRequest<{ staff: StaffDirectoryEntry[] }>("/api/admin/staff", token);
    return payload.staff;
  }, []);

  const addStaffNote = useCallback(async (reportId: string, text: string, token: string) => {
    const payload = await staffRequest<{ note: StaffNote }>(`/api/reports/${reportId}/notes`, token, {
      method: "POST",
      body: JSON.stringify({ text }),
    });
    return payload.note;
  }, []);

  const addResidentUpdate = useCallback(async (reportId: string, status: Issue["status"], text: string, token: string) => {
    const payload = await staffRequest<{ update: ResidentStatusUpdate; report: Issue }>(`/api/reports/${reportId}/updates`, token, {
      method: "POST",
      body: JSON.stringify({ status, text }),
    });
    reportMutationVersion.current += 1;
    setReports((current) => current.map((report) => report.id === reportId ? payload.report : report));
    return payload.update;
  }, []);

  const resetReports = () => {
    reportMutationVersion.current += 1;
    setReports([]);

    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(INITIALIZATION_KEY);
    }

    void fetch(`${API_BASE_URL}/api/reports`, {
      method: "DELETE",
    }).catch((error) => {
      console.warn("Backend reset failed; local state was cleared anyway.", error);
    });
  };

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
      addReport,
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
