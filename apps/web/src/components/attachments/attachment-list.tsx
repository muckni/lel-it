"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { DownloadIcon, Trash2Icon, FileIcon } from "lucide-react";
import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { formatFileSize } from "@/lib/attachments";

type AttachmentEntityType = "interface_point" | "deliverable" | "iq_response";

type Props = {
  entityType: AttachmentEntityType;
  entityId: string;
  canDelete?: boolean;
};

export function AttachmentList({ entityType, entityId, canDelete }: Props) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const listQuery = useQuery(
    trpc.attachment.listByEntity.queryOptions({ entityType, entityId })
  );

  const download = useMutation(trpc.attachment.getDownloadUrl.mutationOptions());
  const remove = useMutation(
    trpc.attachment.delete.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(
          trpc.attachment.listByEntity.queryOptions({ entityType, entityId })
        );
      },
    })
  );

  async function handleDownload(attachmentId: string) {
    const result = await download.mutateAsync({ attachmentId });
    window.open(result.url, "_blank", "noopener,noreferrer");
  }

  if (listQuery.isLoading) {
    return <p className="text-xs text-muted-foreground">Loading attachments…</p>;
  }

  const attachments = listQuery.data ?? [];

  if (attachments.length === 0) {
    return <p className="text-xs text-muted-foreground">No attachments yet.</p>;
  }

  return (
    <div className="space-y-2">
      {attachments.map((attachment) => (
        <div key={attachment.id} className="rounded border px-3 py-2">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium truncate inline-flex items-center gap-1.5">
                <FileIcon className="h-3.5 w-3.5 text-muted-foreground" />
                {attachment.fileName}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {format(new Date(attachment.createdAt), "dd MMM yyyy HH:mm")} ·{" "}
                {attachment.uploader.name} · {formatFileSize(attachment.sizeBytes)}
              </p>
            </div>
            <div className="shrink-0 flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => handleDownload(attachment.id).catch(() => {})}
                disabled={download.isPending}
                title="Download"
              >
                <DownloadIcon className="h-3.5 w-3.5" />
              </Button>
              {canDelete && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => remove.mutate({ attachmentId: attachment.id })}
                  disabled={remove.isPending}
                  title="Delete"
                >
                  <Trash2Icon className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
