"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { JSONContent } from "@tiptap/react";
import { ArrowLeftIcon } from "lucide-react";
import { LessonAttachmentsPanel } from "@/components/lessons/lesson-attachments-panel";
import { LessonComments } from "@/components/lessons/lesson-comments";
import { LessonEditor } from "@/components/lessons/lesson-editor";
import { LessonPropertiesPanel } from "@/components/lessons/lesson-properties-panel";
import { Input } from "@/components/ui/input";
import { useTRPC } from "@/trpc/client";

export default function LessonDetailPage() {
  const { projectId, lessonId } = useParams<{ projectId: string; lessonId: string }>();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [saveState, setSaveState] = useState<"idle" | "saving" | "error">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lessonOpts = trpc.lessonV2.getLesson.queryOptions({ projectId, lessonId });
  const { data: lesson } = useQuery(lessonOpts);
  const { data: categories = [] } = useQuery(trpc.lessonV2.listCategories.queryOptions());
  const update = useMutation(
    trpc.lessonV2.updateLesson.mutationOptions({
      onMutate: () => setSaveState("saving"),
      onError: () => setSaveState("error"),
      onSuccess: () => {
        setSaveState("idle");
        void queryClient.invalidateQueries(lessonOpts);
      },
    })
  );

  useEffect(() => {
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    };
  }, []);

  const patch = useCallback(
    (patchValue: Record<string, unknown>) => {
      update.mutate({ projectId, lessonId, ...patchValue });
    },
    [update, projectId, lessonId]
  );

  const onBody = useCallback(
    (content: JSONContent) => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
      setSaveState("saving");
      timer.current = setTimeout(() => {
        update.mutate({ projectId, lessonId, content: content as Record<string, unknown> });
      }, 800);
    },
    [update, projectId, lessonId]
  );

  if (!lesson) {
    return <div className="p-6 text-sm text-muted-foreground">Loading lesson…</div>;
  }

  const editable = lesson.status !== "archived";

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <Link
          href={`/projects/${projectId}/lessons`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="size-4" />
          Back to lessons
        </Link>
        <span className="text-xs text-muted-foreground">
          {saveState === "saving"
            ? "Saving…"
            : saveState === "error"
              ? "Save failed — retrying on next edit"
              : "Saved"}
        </span>
      </div>

      <Input
        defaultValue={lesson.title}
        disabled={!editable}
        className="border-0 px-0 text-2xl font-semibold shadow-none focus-visible:ring-0"
        onBlur={(event) => {
          const nextTitle = event.target.value.trim();
          if (nextTitle && nextTitle !== lesson.title) {
            patch({ title: nextTitle });
          }
        }}
      />

      <div className="flex gap-6">
        <div className="min-w-0 flex-1 space-y-6">
          <LessonEditor
            initialContent={(lesson.content as JSONContent | null) ?? null}
            editable={editable}
            onChange={onBody}
          />
          <LessonAttachmentsPanel lessonId={lessonId} editable={editable} />
          <LessonComments projectId={projectId} lessonId={lessonId} />
        </div>
        <LessonPropertiesPanel
          lesson={{
            type: lesson.type,
            status: lesson.status,
            categoryId: lesson.categoryId,
            confidentialityLevel: lesson.confidentialityLevel,
            observedDate: lesson.observedDate,
          }}
          categories={categories}
          editable={editable}
          onPatch={patch}
        />
      </div>
    </div>
  );
}
