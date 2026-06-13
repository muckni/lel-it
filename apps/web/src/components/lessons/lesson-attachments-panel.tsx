"use client";

import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PaperclipIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTRPC } from "@/trpc/client";

export function LessonAttachmentsPanel({
  lessonId,
  editable,
}: {
  lessonId: string;
  editable: boolean;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const listOpts = trpc.attachment.listByEntity.queryOptions({
    entityType: "lesson",
    entityId: lessonId,
  });
  const { data: files = [] } = useQuery(listOpts);
  const createIntent = useMutation(trpc.attachment.createUploadIntent.mutationOptions());
  const complete = useMutation(trpc.attachment.completeUpload.mutationOptions());
  const remove = useMutation(
    trpc.attachment.delete.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries(listOpts),
    })
  );
  const getUrl = useMutation(trpc.attachment.getDownloadUrl.mutationOptions());

  async function upload(file: File) {
    const intent = await createIntent.mutateAsync({
      entityType: "lesson",
      entityId: lessonId,
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
    });

    const response = await fetch(intent.signedUploadUrl, {
      method: "PUT",
      body: file,
      headers: { "content-type": file.type },
    });
    if (!response.ok) {
      throw new Error("Failed to upload attachment");
    }

    await complete.mutateAsync({
      attachmentId: intent.attachmentId,
      entityType: "lesson",
      entityId: lessonId,
      fileName: file.name,
      storagePath: intent.storagePath,
      mimeType: file.type,
      sizeBytes: file.size,
    });

    await queryClient.invalidateQueries(listOpts);
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Attachments</h3>
        {editable ? (
          <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()}>
            <PaperclipIcon className="size-4" />
            Add file
          </Button>
        ) : null}
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              void upload(file);
            }
            event.target.value = "";
          }}
        />
      </div>
      <ul className="space-y-1">
        {files.map((file) => (
          <li
            key={file.id}
            className="flex items-center justify-between rounded border px-3 py-2 text-sm"
          >
            <button
              type="button"
              className="truncate text-left hover:underline"
              onClick={async () => {
                const { url } = await getUrl.mutateAsync({ attachmentId: file.id });
                window.open(url, "_blank", "noopener,noreferrer");
              }}
            >
              {file.fileName}
            </button>
            {editable ? (
              <button
                type="button"
                onClick={() => remove.mutate({ attachmentId: file.id })}
                aria-label="Delete attachment"
              >
                <Trash2Icon className="size-4 text-muted-foreground hover:text-destructive" />
              </button>
            ) : null}
          </li>
        ))}
        {files.length === 0 ? (
          <li className="text-sm text-muted-foreground">No files attached.</li>
        ) : null}
      </ul>
    </section>
  );
}
