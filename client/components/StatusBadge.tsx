"use client";

import { useLanguage } from "@/context/LanguageContext";
import type { IssueStatus } from "@/types/issue";

const statusStyles: Record<IssueStatus, string> = {
  Reported: "bg-slate-100 text-slate-700",
  "Under Review": "bg-amber-100 text-amber-700",
  Assigned: "bg-blue-100 text-blue-700",
  "In Progress": "bg-indigo-100 text-indigo-700",
  Resolved: "bg-emerald-100 text-emerald-700",
  Closed: "bg-gray-200 text-gray-700",
};

export function StatusBadge({ status, staffView = false }: { status: IssueStatus; staffView?: boolean }) {
  const { t } = useLanguage();

  const translatedStatus: Record<IssueStatus, string> = {
    Reported: t("statusReported"),
    "Under Review": t("statusUnderReview"),
    Assigned: t("statusAssigned"),
    "In Progress": t("statusInProgress"),
    Resolved: t("statusResolved"),
    Closed: t("statusClosed"),
  };

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles[status]}`}>
      {staffView && status === "Reported" ? "New" : translatedStatus[status]}
    </span>
  );
}
