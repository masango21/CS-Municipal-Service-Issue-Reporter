"use client";

import { useLanguage } from "@/context/LanguageContext";
import type { IssuePriority } from "@/types/issue";

const priorityStyles: Record<IssuePriority, string> = {
  Low: "bg-emerald-100 text-emerald-700",
  Medium: "bg-amber-100 text-amber-700",
  High: "bg-orange-100 text-orange-700",
  Critical: "bg-rose-100 text-rose-700",
};

export function PriorityBadge({ priority }: { priority: IssuePriority }) {
  const { t } = useLanguage();

  const translatedPriority: Record<IssuePriority, string> = {
    Low: t("priorityLow"),
    Medium: t("priorityMedium"),
    High: t("priorityHigh"),
    Critical: t("priorityCritical"),
  };

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${priorityStyles[priority]}`}>
      {translatedPriority[priority]}
    </span>
  );
}
