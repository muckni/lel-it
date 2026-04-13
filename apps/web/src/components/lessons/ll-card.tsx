"use client";

import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { LLStatusBadge, LLTypeBadge } from "@/components/lessons/ll-badge";

export type LessonCardItem = {
  id: string;
  title: string;
  description: string;
  type: "problem" | "success" | "risk" | "improvement" | "process_deviation";
  status: "draft" | "validated" | "consolidated" | "closed";
  discipline: string;
  updatedAt: Date | string;
  workPackage: { id: string; code: string; name: string; color: string | null } | null;
  linkedPoints: Array<{
    interfacePoint: {
      id: string;
      code: string;
      title: string;
    };
  }>;
  pendingChangeRequest?: { id: string } | null;
};

type LessonCardProps = {
  lesson: LessonCardItem;
  canEdit: boolean;
  isAdmin: boolean;
  onOpen: (id: string) => void;
  onValidate: (id: string) => void;
  onConsolidate: (id: string) => void;
  onClose: (id: string) => void;
  busy: boolean;
};

export function LessonCard({
  lesson,
  canEdit,
  isAdmin,
  onOpen,
  onValidate,
  onConsolidate,
  onClose,
  busy,
}: LessonCardProps) {
  return (
    <Card className="h-full">
      <CardHeader className="space-y-3 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <LLStatusBadge status={lesson.status} />
          <LLTypeBadge type={lesson.type} />
          {lesson.pendingChangeRequest && (
            <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
              Pending review
            </span>
          )}
        </div>
        <CardTitle className="text-base leading-tight">{lesson.title}</CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        <p className="line-clamp-3 text-sm text-muted-foreground">{lesson.description}</p>

        <div className="space-y-1 text-xs text-muted-foreground">
          <p>Discipline: {lesson.discipline.replace(/_/g, " ")}</p>
          {lesson.workPackage ? (
            <p>
              Work package: {lesson.workPackage.code} - {lesson.workPackage.name}
            </p>
          ) : (
            <p>Work package: not set</p>
          )}
          <p>
            Linked points: {lesson.linkedPoints.length}
          </p>
          <p>
            Updated {formatDistanceToNow(new Date(lesson.updatedAt), { addSuffix: true })}
          </p>
        </div>
      </CardContent>

      <CardFooter className="flex flex-wrap items-center gap-2 border-t pt-4">
        <Button size="sm" variant="outline" onClick={() => onOpen(lesson.id)}>
          Details
        </Button>

        {canEdit && lesson.status === "draft" && (
          <Button size="sm" onClick={() => onValidate(lesson.id)} disabled={busy}>
            Validate
          </Button>
        )}
        {isAdmin && lesson.status === "validated" && (
          <>
            <Button size="sm" onClick={() => onConsolidate(lesson.id)} disabled={busy}>
              Consolidate
            </Button>
            <Button size="sm" variant="outline" onClick={() => onClose(lesson.id)} disabled={busy}>
              Close
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  );
}
