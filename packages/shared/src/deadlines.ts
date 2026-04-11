export const DEADLINE_ENTITY_TYPES = [
  "interface_point",
  "deliverable",
  "iq",
] as const;

export type DeadlineEntityType = (typeof DEADLINE_ENTITY_TYPES)[number];

export const DEADLINE_BUCKETS = [
  "none",
  "overdue",
  "due_today",
  "due_soon",
] as const;

export type DeadlineBucket = (typeof DEADLINE_BUCKETS)[number];

export function normalizeDateOnly(value: Date | string): Date {
  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    return new Date(year, month, day);
  }

  const parsed = new Date(value);
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function diffDays(from: Date, to: Date): number {
  const ms = normalizeDateOnly(to).getTime() - normalizeDateOnly(from).getTime();
  return Math.round(ms / 86400000);
}

export function isEntityClosed(
  entityType: DeadlineEntityType,
  status: string | null | undefined
): boolean {
  if (!status) return false;
  if (entityType === "interface_point") {
    return status === "resolved" || status === "closed";
  }
  if (entityType === "deliverable") {
    return status === "accepted";
  }
  return status === "accepted" || status === "rejected" || status === "closed";
}

export function classifyDeadline(
  dueDate: Date | string | null | undefined,
  isClosed: boolean,
  todayInput: Date = new Date()
): DeadlineBucket {
  if (!dueDate || isClosed) return "none";

  const due = normalizeDateOnly(dueDate);
  const today = normalizeDateOnly(todayInput);
  const days = diffDays(today, due);

  if (days < 0) return "overdue";
  if (days === 0) return "due_today";
  if (days <= 7) return "due_soon";
  return "none";
}
