"use client";

import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { UploadIcon, AlertCircleIcon, CheckCircle2Icon, Loader2Icon } from "lucide-react";
import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import {
  MAX_ATTACHMENT_BYTES,
  hasAllowedAttachmentType,
  formatFileSize,
} from "@/lib/attachments";

type AttachmentEntityType = "interface_point" | "deliverable" | "iq_response";

type UploadStatus = "pending" | "uploading" | "success" | "error";

type UploadItem = {
  id: string;
  fileName: string;
  progress: number;
  status: UploadStatus;
  error?: string;
};

type Props = {
  entityType: AttachmentEntityType;
  entityId: string;
  disabled?: boolean;
  onUploaded?: () => void;
};

function uploadWithProgress(
  signedUploadUrl: string,
  file: File,
  onProgress: (value: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUploadUrl);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error("Upload failed"));
    xhr.send(file);
  });
}

export function AttachmentUpload({
  entityType,
  entityId,
  disabled,
  onUploaded,
}: Props) {
  const trpc = useTRPC();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const createIntent = useMutation(
    trpc.attachment.createUploadIntent.mutationOptions()
  );
  const completeUpload = useMutation(
    trpc.attachment.completeUpload.mutationOptions()
  );

  function updateItem(id: string, patch: Partial<UploadItem>) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  async function processFile(file: File) {
    const itemId = crypto.randomUUID();
    const fallbackMime = file.type || "";

    setItems((prev) => [
      {
        id: itemId,
        fileName: file.name,
        progress: 0,
        status: "pending",
      },
      ...prev,
    ]);

    if (file.size > MAX_ATTACHMENT_BYTES) {
      updateItem(itemId, {
        status: "error",
        error: `File exceeds 50 MB (${formatFileSize(file.size)})`,
      });
      return;
    }

    if (!hasAllowedAttachmentType({ name: file.name, type: file.type })) {
      updateItem(itemId, {
        status: "error",
        error: "Unsupported file type",
      });
      return;
    }

    try {
      updateItem(itemId, { status: "uploading", progress: 5 });
      const intent = await createIntent.mutateAsync({
        entityType,
        entityId,
        fileName: file.name,
        mimeType: fallbackMime,
        sizeBytes: file.size,
      });

      await uploadWithProgress(intent.signedUploadUrl, file, (progress) =>
        updateItem(itemId, { progress: Math.max(progress, 10) })
      );

      await completeUpload.mutateAsync({
        attachmentId: intent.attachmentId,
        entityType,
        entityId,
        fileName: file.name,
        storagePath: intent.storagePath,
        mimeType: fallbackMime,
        sizeBytes: file.size,
      });

      updateItem(itemId, { status: "success", progress: 100 });
      onUploaded?.();
    } catch (error) {
      updateItem(itemId, {
        status: "error",
        error: error instanceof Error ? error.message : "Upload failed",
      });
    }
  }

  async function handleFiles(files: FileList | null) {
    if (!files || disabled) return;
    for (const file of Array.from(files)) {
      // Sequential upload keeps UI and error handling stable.
      // eslint-disable-next-line no-await-in-loop
      await processFile(file);
    }
  }

  return (
    <div className="space-y-3">
      <div
        className={`rounded-lg border-2 border-dashed p-4 text-center transition-colors ${
          dragOver ? "border-primary bg-primary/5" : "border-border"
        } ${disabled ? "opacity-50 pointer-events-none" : "cursor-pointer hover:bg-muted/40"}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          handleFiles(event.dataTransfer.files).catch(() => {});
        }}
      >
        <UploadIcon className="h-5 w-5 mx-auto text-muted-foreground mb-1.5" />
        <p className="text-sm font-medium">Drop files here or click to upload</p>
        <p className="text-xs text-muted-foreground mt-1">
          PDF, DWG, XLSX, images · max 50 MB each
        </p>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          multiple
          onChange={(event) => {
            handleFiles(event.target.files).catch(() => {});
            event.currentTarget.value = "";
          }}
        />
      </div>

      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="rounded border px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-medium truncate">{item.fileName}</p>
                <div className="shrink-0">
                  {item.status === "uploading" && (
                    <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                      <Loader2Icon className="h-3 w-3 animate-spin" />
                      {item.progress}%
                    </span>
                  )}
                  {item.status === "success" && (
                    <span className="text-xs text-green-700 inline-flex items-center gap-1">
                      <CheckCircle2Icon className="h-3 w-3" />
                      Uploaded
                    </span>
                  )}
                  {item.status === "error" && (
                    <span className="text-xs text-destructive inline-flex items-center gap-1">
                      <AlertCircleIcon className="h-3 w-3" />
                      Failed
                    </span>
                  )}
                </div>
              </div>

              {item.status === "uploading" && (
                <div className="mt-2 h-1.5 rounded bg-muted">
                  <div
                    className="h-1.5 rounded bg-primary transition-[width] duration-200"
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              )}

              {item.error && (
                <p className="text-xs text-destructive mt-1">{item.error}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
      >
        Choose Files
      </Button>
    </div>
  );
}
