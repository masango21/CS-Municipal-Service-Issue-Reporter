"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Issue, IssueDraft } from "@/types/issue";

const STORAGE_KEY = "municipal-service-issues";

type ReportStats = {
  total: number;
  reported: number;
  inProgress: number;
  resolved: number;
  critical: number;
  highPriority: number;
};

type ReportsContextValue = {
  reports: Issue[];
  addReport: (draft: IssueDraft) => Issue;
  stats: ReportStats;
};

const ReportsContext = createContext<ReportsContextValue | undefined>(undefined);

function readStoredReports(): Issue[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const storedReports = window.localStorage.getItem(STORAGE_KEY);
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

export function ReportsProvider({ children }: { children: ReactNode }) {
  const [reports, setReports] = useState<Issue[]>(readStoredReports);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
  }, [reports]);

  const addReport = (draft: IssueDraft) => {
    const nextReport: Issue = {
      id: `MSR-${Date.now()}`,
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

    setReports((current) => [nextReport, ...current]);
    return nextReport;
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
    <ReportsContext.Provider value={{ reports, addReport, stats }}>
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
