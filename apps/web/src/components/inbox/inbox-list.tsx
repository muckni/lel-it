"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PaperclipIcon } from "lucide-react";

import { AssignToProjectDialog } from "@/components/inbox/assign-to-project-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useTRPC } from "@/trpc/client";

function formatReceivedAt(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleString();
}

export function InboxList() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [assigning, setAssigning] = useState<
    { id: string; subject: string } | null
  >(null);

  const { data, isPending } = useQuery(trpc.inbox.list.queryOptions());

  const discard = useMutation(
    trpc.inbox.discard.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(trpc.inbox.list.queryOptions());
      },
    })
  );

  function handleDiscard(inboxItemId: string) {
    if (!window.confirm("Discard this email? This cannot be undone.")) return;
    discard.mutate({ inboxItemId });
  }

  if (isPending) {
    return <p className="text-muted-foreground text-sm">Loading inbox…</p>;
  }

  const items = data?.items ?? [];

  if (items.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Your inbox is empty. Forward an email to capture a lesson.
      </p>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {items.map((item) => (
          <Card key={item.id}>
            <CardContent className="space-y-3 pt-6">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 space-y-1">
                  <p className="text-muted-foreground text-xs">
                    {item.fromName ? `${item.fromName} ` : ""}
                    {`<${item.fromEmail}>`}
                  </p>
                  <p className="font-semibold">{item.subject || "(no subject)"}</p>
                  {item.snippet ? (
                    <p className="text-muted-foreground line-clamp-2 text-sm">
                      {item.snippet}
                    </p>
                  ) : null}
                </div>
                {item.attachmentCount > 0 ? (
                  <Badge variant="secondary">
                    <PaperclipIcon className="size-3" />
                    {item.attachmentCount}
                  </Badge>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-muted-foreground text-xs">
                  {formatReceivedAt(item.receivedAt)}
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() =>
                      setAssigning({ id: item.id, subject: item.subject })
                    }
                  >
                    Assign to project
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={discard.isPending}
                    onClick={() => handleDiscard(item.id)}
                  >
                    Discard
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {assigning ? (
        <AssignToProjectDialog
          inboxItemId={assigning.id}
          defaultTitle={assigning.subject}
          open={assigning !== null}
          onOpenChange={(open) => {
            if (!open) setAssigning(null);
          }}
        />
      ) : null}
    </>
  );
}
