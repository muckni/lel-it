"use client";

import {
  LESSON_OWNERSHIP_STATES,
  LESSON_STATUSES,
  LESSON_TYPES,
  type LessonOwnershipState,
  type LessonStatus,
  type LessonType,
} from "@owit/shared";
import { Badge } from "@/components/ui/badge";

const STATUS_LABEL: Record<LessonStatus, string> = {
  draft: "Draft",
  validated: "Validated",
  consolidated: "Consolidated",
  closed: "Closed",
};

const STATUS_CLASS: Record<LessonStatus, string> = {
  draft: "bg-slate-100 text-slate-700",
  validated: "bg-blue-100 text-blue-800",
  consolidated: "bg-emerald-100 text-emerald-800",
  closed: "bg-zinc-200 text-zinc-700",
};

const TYPE_LABEL: Record<LessonType, string> = {
  problem: "Problem",
  success: "Success",
  risk: "Risk",
  improvement: "Improvement",
  process_deviation: "Process Deviation",
};

const TYPE_CLASS: Record<LessonType, string> = {
  problem: "bg-rose-100 text-rose-800",
  success: "bg-emerald-100 text-emerald-800",
  risk: "bg-amber-100 text-amber-800",
  improvement: "bg-indigo-100 text-indigo-800",
  process_deviation: "bg-orange-100 text-orange-800",
};

const OWNERSHIP_LABEL: Record<LessonOwnershipState, string> = {
  permissive: "Permissive",
  restricted: "Restricted",
  prohibited: "Prohibited",
  unclear: "Unclear",
};

const OWNERSHIP_CLASS: Record<LessonOwnershipState, string> = {
  permissive: "bg-emerald-100 text-emerald-800",
  restricted: "bg-amber-100 text-amber-800",
  prohibited: "bg-rose-100 text-rose-800",
  unclear: "bg-slate-100 text-slate-700",
};

export function LLStatusBadge({ status }: { status: LessonStatus }) {
  return (
    <Badge className={STATUS_CLASS[status] ?? STATUS_CLASS.draft}>
      {STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

export function LLTypeBadge({ type }: { type: LessonType }) {
  return (
    <Badge variant="outline" className={TYPE_CLASS[type] ?? TYPE_CLASS.problem}>
      {TYPE_LABEL[type] ?? type}
    </Badge>
  );
}

export function LLOwnershipBadge({ ownershipState }: { ownershipState: LessonOwnershipState }) {
  return (
    <Badge variant="outline" className={OWNERSHIP_CLASS[ownershipState] ?? OWNERSHIP_CLASS.permissive}>
      {OWNERSHIP_LABEL[ownershipState] ?? ownershipState}
    </Badge>
  );
}

export const LESSON_STATUS_OPTIONS = LESSON_STATUSES.map((value) => ({
  value,
  label: STATUS_LABEL[value],
}));

export const LESSON_TYPE_OPTIONS = LESSON_TYPES.map((value) => ({
  value,
  label: TYPE_LABEL[value],
}));

export const LESSON_OWNERSHIP_OPTIONS = LESSON_OWNERSHIP_STATES.map((value) => ({
  value,
  label: OWNERSHIP_LABEL[value],
}));
