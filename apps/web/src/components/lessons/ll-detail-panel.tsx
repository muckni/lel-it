"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { XIcon } from "lucide-react";
import type { LessonOwnershipState, LessonStatus, LessonType } from "@owit/shared";
import {
  LLOwnershipBadge,
  LLStatusBadge,
  LLTypeBadge,
} from "@/components/lessons/ll-badge";
import { LessonCommentsThread } from "@/components/lessons/lesson-comments-thread";
import { Button } from "@/components/ui/button";

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

export type DetailLesson = {
  id: string;
  title: string;
  description: string;
  recommendation?: string | null;
  type: LessonType;
  status: LessonStatus;
  discipline: string;
  ownershipState: LessonOwnershipState;
  projectPhase?: string | null;
  location?: string | null;
  tags?: string[];
  createdAt: string | Date;
  workPackage?: { id: string; code: string; name: string; color?: string | null } | null;
  linkedPoints?: Array<{ interfacePoint: { id: string; code: string; title: string } }>;
  workflowState?: string;
};

type LessonDetailPanelProps = {
  lesson: DetailLesson;
  projectId: string;
  canEdit: boolean;
  canComment: boolean;
  isAdmin: boolean;
  busy: boolean;
  onClose: () => void;
  onValidate: (id: string) => void;
  onConsolidate: (id: string) => void;
  onCloseLesson: (id: string) => void;
};

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section>
      <p
        className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-[#9CA3AF]"
        style={{ fontFamily: "var(--font-ibm-plex-sans)" }}
      >
        {label}
      </p>
      {children}
    </section>
  );
}

export function LessonDetailPanel({
  lesson,
  projectId,
  canEdit,
  canComment,
  isAdmin,
  busy,
  onClose,
  onValidate,
  onConsolidate,
  onCloseLesson,
}: LessonDetailPanelProps) {
  const [tab, setTab] = useState<"detail" | "comments">("detail");

  const discipline = DISC_LABELS[lesson.discipline] ?? lesson.discipline;
  const phase = lesson.projectPhase ? (PHASE_LABELS[lesson.projectPhase] ?? lesson.projectPhase) : null;

  const linkedPoints = useMemo(
    () => lesson.linkedPoints?.map((item) => item.interfacePoint) ?? [],
    [lesson.linkedPoints]
  );

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/15" onClick={onClose} aria-hidden />

      <aside
        className="fixed right-0 top-0 z-50 flex h-full w-[480px] flex-col border-l border-[#E5E7EB] bg-white shadow-[-4px_0_24px_rgba(0,0,0,0.08)]"
        style={{ fontFamily: "var(--font-ibm-plex-sans)" }}
        aria-label="Lesson details"
      >
        <div className="shrink-0 border-b border-[#F3F4F6] px-5 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex flex-wrap gap-1.5">
                <LLTypeBadge type={lesson.type} />
                <LLStatusBadge status={lesson.status} />
                <LLOwnershipBadge ownershipState={lesson.ownershipState} />
                {lesson.workPackage ? (
                  <span
                    className="rounded px-2 py-0.5 text-[10px] font-medium"
                    style={{
                      backgroundColor: `${lesson.workPackage.color ?? "#6366F1"}22`,
                      color: lesson.workPackage.color ?? "#6366F1",
                    }}
                  >
                    {lesson.workPackage.code}
                  </span>
                ) : null}
              </div>

              <h2 className="text-[14px] font-semibold leading-snug text-[#111827]">{lesson.title}</h2>
              <p className="mt-1 text-[11px] text-[#9CA3AF]">
                {discipline}
                {phase ? ` · ${phase}` : ""}
                {` · ${new Date(lesson.createdAt).toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}`}
              </p>
            </div>

            <button
              type="button"
              className="shrink-0 p-1 text-[#9CA3AF] hover:text-[#374151]"
              onClick={onClose}
              aria-label="Close lesson detail panel"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 flex border-b border-[#F3F4F6]">
            {(["detail", "comments"] as const).map((entry) => {
              const active = tab === entry;
              return (
                <button
                  key={entry}
                  type="button"
                  className="px-3.5 pb-2 pt-2 text-[13px] font-medium"
                  style={{
                    color: active ? "#111827" : "#6B7280",
                    borderBottom: active ? "2px solid #0F172A" : "2px solid transparent",
                  }}
                  onClick={() => setTab(entry)}
                >
                  {entry === "detail" ? "Detail" : "Comments"}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-auto px-5 py-4">
          {tab === "detail" ? (
            <div className="flex flex-col gap-4">
              <Section label="What happened">
                <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-[#374151]">{lesson.description}</p>
              </Section>

              {lesson.recommendation ? (
                <Section label="Recommendation">
                  <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-[#374151]">
                    {lesson.recommendation}
                  </p>
                </Section>
              ) : null}

              <Section label="Location/Asset">
                <p className="text-[13px] text-[#374151]">{lesson.location?.trim() || "—"}</p>
              </Section>

              <Section label="Tags">
                {lesson.tags && lesson.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {lesson.tags.map((tag) => (
                      <span key={tag} className="rounded bg-[#F3F4F6] px-2 py-0.5 text-[11px] text-[#6B7280]">
                        #{tag}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[13px] text-[#9CA3AF]">—</p>
                )}
              </Section>

              <Section label="Linked Interface Points">
                {linkedPoints.length > 0 ? (
                  <div className="flex flex-col gap-1.5">
                    {linkedPoints.map((point) => (
                      <Link
                        key={point.id}
                        href={`/projects/${projectId}/modules/interfaces?pointId=${point.id}`}
                        className="text-[12px] text-[#1D4ED8] underline-offset-2 hover:underline"
                      >
                        {point.code} · {point.title}
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-[13px] text-[#9CA3AF]">—</p>
                )}
              </Section>

              <Section label="Workflow State">
                <p className="text-[13px] capitalize text-[#374151]">
                  {lesson.workflowState?.replace(/_/g, " ") ?? "—"}
                </p>
              </Section>
            </div>
          ) : (
            <LessonCommentsThread projectId={projectId} lessonId={lesson.id} canComment={canComment} />
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-[#F3F4F6] px-5 py-3.5">
          {canEdit && lesson.status === "draft" ? (
            <Button
              size="sm"
              className="bg-[#2563EB] text-white hover:bg-[#1D4ED8]"
              disabled={busy}
              onClick={() => onValidate(lesson.id)}
            >
              Validate
            </Button>
          ) : null}

          {isAdmin && lesson.status === "validated" ? (
            <Button
              size="sm"
              className="bg-[#15803D] text-white hover:bg-[#166534]"
              disabled={busy}
              onClick={() => onConsolidate(lesson.id)}
            >
              Consolidate
            </Button>
          ) : null}

          {isAdmin && lesson.status === "validated" ? (
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => onCloseLesson(lesson.id)}
            >
              Archive
            </Button>
          ) : null}
        </div>
      </aside>
    </>
  );
}
