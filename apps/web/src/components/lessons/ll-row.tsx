"use client";

import { ChevronRightIcon } from "lucide-react";
import { useState } from "react";
import type { LessonStatus, LessonType } from "@owit/shared";
import { LLStatusBadge, LLTypeBadge } from "@/components/lessons/ll-badge";

const TYPE_ACCENT: Record<LessonType, string> = {
  problem: "#BE123C",
  success: "#15803D",
  risk: "#B45309",
  improvement: "#4338CA",
  process_deviation: "#C2410C",
};

const DISC_LABELS: Record<string, string> = {
  engineering: "Engineering",
  procurement: "Procurement",
  construction: "Construction",
  installation: "Installation",
  commissioning: "Commissioning",
  project_management: "Project Management",
  hse: "HSE",
  commercial: "Commercial",
  other: "Other",
};

const PHASE_LABELS: Record<string, string> = {
  maturation: "Maturation",
  feed: "FEED",
  detailed_design: "Detailed Design",
  procurement: "Procurement",
  fabrication: "Fabrication",
  installation: "Installation",
  commissioning: "Commissioning",
  operations: "Operations",
};

export type LessonRowItem = {
  id: string;
  title: string;
  description: string;
  type: LessonType;
  status: LessonStatus;
  discipline: string;
  projectPhase?: string | null;
  createdAt: string | Date;
  workPackage?: { code: string; name: string; color?: string | null } | null;
};

type LessonRowProps = {
  lesson: LessonRowItem;
  selected: boolean;
  onClick: () => void;
};

export function LessonRow({ lesson, selected, onClick }: LessonRowProps) {
  const [hovered, setHovered] = useState(false);
  const accent = TYPE_ACCENT[lesson.type] ?? "#6B7280";
  const disciplineLabel = DISC_LABELS[lesson.discipline] ?? lesson.discipline;
  const phaseLabel = lesson.projectPhase ? (PHASE_LABELS[lesson.projectPhase] ?? lesson.projectPhase) : null;
  const showPhase = Boolean(phaseLabel && phaseLabel !== disciplineLabel);

  return (
    <div
      onClick={onClick}
      className="group flex cursor-pointer items-stretch border-b border-[#F3F4F6] transition-colors hover:bg-[#FAFAF9]"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: selected ? "#F8FAFF" : undefined,
        fontFamily: "var(--font-ibm-plex-sans)",
      }}
      role="button"
      aria-pressed={selected}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
    >
      <div
        className="w-[3px] shrink-0"
        style={{
          background: selected || hovered ? accent : "transparent",
        }}
      />

      <div className="min-w-0 flex-1 px-3.5 py-3">
        <div className="mb-1 flex items-start gap-2.5">
          <p className="flex-1 text-[13px] font-medium leading-snug text-[#111827]">{lesson.title}</p>
          <div className="flex shrink-0 items-center gap-1 pt-px">
            <LLTypeBadge type={lesson.type} />
            <LLStatusBadge status={lesson.status} />
          </div>
        </div>

        <p className="mb-1.5 truncate text-[12px] leading-relaxed text-[#6B7280]">{lesson.description}</p>

        <div className="flex items-center gap-2 text-[11px] text-[#9CA3AF]">
          {lesson.workPackage ? (
            <span
              className="rounded px-1.5 py-0.5 text-[10px] font-medium"
              style={{
                backgroundColor: `${lesson.workPackage.color ?? "#6366F1"}22`,
                color: lesson.workPackage.color ?? "#6366F1",
              }}
            >
              {lesson.workPackage.code}
            </span>
          ) : null}

          <span>{disciplineLabel}</span>

          {showPhase ? (
            <>
              <span className="text-[#E5E7EB]">·</span>
              <span>{phaseLabel}</span>
            </>
          ) : null}

          <span className="text-[#E5E7EB]">·</span>
          <span
            className="tabular-nums"
            style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
          >
            {new Date(lesson.createdAt).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
            })}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center pr-3.5" style={{ color: selected ? "#2563EB" : "#D1D5DB" }}>
        <ChevronRightIcon className="h-4 w-4" />
      </div>
    </div>
  );
}
