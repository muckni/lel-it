"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useTRPC } from "@/trpc/client";

type LessonCommentsThreadProps = {
  projectId: string;
  lessonId: string;
  canComment: boolean;
};

function extractMentionIds(
  content: string,
  members: Array<{ userId: string; email: string; name: string }>
) {
  const byEmail = new Map(
    members
      .filter((member) => member.email && member.email !== "—")
      .map((member) => [member.email.toLowerCase(), member.userId] as const)
  );

  const mentions = new Set<string>();
  const matches = content.match(/@([^\s,;:]+)/g) ?? [];
  for (const token of matches) {
    const key = token.slice(1).toLowerCase();
    const userId = byEmail.get(key);
    if (userId) mentions.add(userId);
  }
  return Array.from(mentions);
}

export function LessonCommentsThread({
  projectId,
  lessonId,
  canComment,
}: LessonCommentsThreadProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");

  const { data: members = [] } = useQuery(
    trpc.project.listMembers.queryOptions({ projectId })
  );
  const { data: comments = [] } = useQuery(
    trpc.comment.list.queryOptions({
      parentType: "lesson_learned",
      parentId: lessonId,
    })
  );

  const memberNameById = useMemo(
    () => new Map(members.map((member) => [member.userId, member.name || member.email])),
    [members]
  );

  const createComment = useMutation(
    trpc.comment.create.mutationOptions({
      onSuccess: async () => {
        setDraft("");
        await queryClient.invalidateQueries(
          trpc.comment.list.queryOptions({
            parentType: "lesson_learned",
            parentId: lessonId,
          })
        );
      },
    })
  );

  const deleteComment = useMutation(
    trpc.comment.delete.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(
          trpc.comment.list.queryOptions({
            parentType: "lesson_learned",
            parentId: lessonId,
          })
        );
      },
    })
  );

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="lesson-comment-input">Discussion</Label>
        <Textarea
          id="lesson-comment-input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={3}
          placeholder="Add context, decisions, or @email mentions"
          disabled={!canComment || createComment.isPending}
          aria-label="Lesson comment input"
        />
        <p className="text-[11px] text-muted-foreground">
          Mention teammates with their email, for example `@admin.review@owit.local`.
        </p>
        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={!canComment || !draft.trim() || createComment.isPending}
            onClick={() =>
              createComment.mutate({
                parentType: "lesson_learned",
                parentId: lessonId,
                content: draft.trim(),
                mentions: extractMentionIds(draft, members),
              })
            }
          >
            {createComment.isPending ? "Posting…" : "Post comment"}
          </Button>
        </div>
      </div>

      <div className="max-h-[360px] space-y-2 overflow-auto pr-1">
        {comments.length === 0 && (
          <p className="text-sm text-muted-foreground">No comments yet.</p>
        )}
        {comments.map((comment) => (
          <div key={comment.id} className="rounded-lg border p-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium">
                {memberNameById.get(comment.authorId) ?? "Team member"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
              </p>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm">{comment.content}</p>
            <div className="mt-2 flex items-center justify-between">
              <button
                type="button"
                className="text-xs text-primary underline-offset-2 hover:underline"
                onClick={() =>
                  setDraft((prev) =>
                    `${prev}${prev ? "\n" : ""}@${members.find((m) => m.userId === comment.authorId)?.email ?? ""} `
                  )
                }
              >
                Reply
              </button>
              <button
                type="button"
                className="text-xs text-muted-foreground underline-offset-2 hover:underline disabled:opacity-50"
                disabled={deleteComment.isPending}
                onClick={() => deleteComment.mutate({ id: comment.id })}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
