"use client";

import { AlertTriangleIcon, Clock3Icon } from "lucide-react";
import { classifyDeadline, diffDays, isEntityClosed, type DeadlineEntityType } from "@owit/shared";

type Props = {
  dueDate?: string | null;
  entityType: DeadlineEntityType;
  status?: string | null;
};

export function getDeadlineRowClassName(
  dueDate: string | null | undefined,
  entityType: DeadlineEntityType,
  status: string | null | undefined
): string {
  const bucket = classifyDeadline(dueDate, isEntityClosed(entityType, status));
  if (bucket === "overdue") return "bg-red-50/60";
  if (bucket === "due_soon" || bucket === "due_today") return "bg-amber-50/60";
  return "";
}

export function DeadlineBadge({ dueDate, entityType, status }: Props) {
  const bucket = classifyDeadline(dueDate, isEntityClosed(entityType, status));
  if (bucket === "none" || !dueDate) return null;

  const days = diffDays(new Date(), new Date(dueDate));

  if (bucket === "overdue") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium bg-red-100 text-red-800">
        <AlertTriangleIcon className="h-3 w-3" />
        Overdue
      </span>
    );
  }

  if (bucket === "due_today") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium bg-amber-100 text-amber-900">
        <Clock3Icon className="h-3 w-3" />
        Due Today
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium bg-amber-100 text-amber-900">
      <Clock3Icon className="h-3 w-3" />
      Due in {days}d
    </span>
  );
}
