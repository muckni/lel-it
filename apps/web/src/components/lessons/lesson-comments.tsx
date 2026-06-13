"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useTRPC } from "@/trpc/client";

export function LessonComments({
  projectId,
  lessonId,
}: {
  projectId: string;
  lessonId: string;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const listOpts = trpc.lessonV2.listComments.queryOptions({ projectId, lessonId });
  const { data: comments = [] } = useQuery(listOpts);
  const add = useMutation(
    trpc.lessonV2.addComment.mutationOptions({
      onSuccess: () => {
        setBody("");
        void queryClient.invalidateQueries(listOpts);
      },
    })
  );

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-medium">Comments</h3>
      <ul className="space-y-2">
        {comments.map((comment) => (
          <li key={comment.id} className="rounded border p-2 text-sm">
            <p className="whitespace-pre-wrap">{comment.body}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {new Date(comment.createdAt).toLocaleString("en-GB")}
            </p>
          </li>
        ))}
      </ul>
      <div className="space-y-2">
        <Textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Add a comment…"
        />
        <Button
          size="sm"
          disabled={!body.trim() || add.isPending}
          onClick={() => add.mutate({ projectId, lessonId, body })}
        >
          Comment
        </Button>
      </div>
    </section>
  );
}
