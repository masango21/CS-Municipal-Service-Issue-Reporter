import Link from "next/link";
import type { Issue } from "@/types/issue";
import { PriorityBadge } from "@/components/PriorityBadge";
import { StatusBadge } from "@/components/StatusBadge";

export function IssueCard({ issue }: { issue: Issue }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-emerald-200 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{issue.id}</p>
          <h3 className="mt-2 text-xl font-bold text-slate-900">{issue.title}</h3>
        </div>
        <PriorityBadge priority={issue.priority} />
      </div>

      <p className="mt-3 text-sm text-slate-600">{issue.category}</p>
      <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{issue.description}</p>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span>{issue.location.city ?? "South Africa"}</span>
        <span>•</span>
        <span>{new Date(issue.reportedAt).toLocaleDateString("en-ZA")}</span>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <StatusBadge status={issue.status} />
        <Link
          href={`/issues/${issue.id}`}
          className="text-sm font-semibold text-emerald-700 transition hover:text-emerald-800"
        >
          View Details
        </Link>
      </div>
    </article>
  );
}
