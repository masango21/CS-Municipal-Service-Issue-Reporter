import type { IssueStatus } from "@/types/issue";

const statusStyles: Record<IssueStatus, string> = {
  Reported: "bg-slate-100 text-slate-700",
  "Under Review": "bg-amber-100 text-amber-700",
  Assigned: "bg-blue-100 text-blue-700",
  "In Progress": "bg-indigo-100 text-indigo-700",
  Resolved: "bg-emerald-100 text-emerald-700",
  Closed: "bg-gray-200 text-gray-700",
};

export function StatusBadge({ status }: { status: IssueStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles[status]}`}>
      {status}
    </span>
  );
}
