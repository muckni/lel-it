"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { AttachmentList } from "@/components/attachments/attachment-list";
import { AttachmentUpload } from "@/components/attachments/attachment-upload";

type AttachmentEntityType = "interface_point" | "deliverable" | "iq_response";

type Props = {
  entityType: AttachmentEntityType;
  entityId: string;
  canManage?: boolean;
};

export function EntityAttachments({ entityType, entityId, canManage }: Props) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  async function refresh() {
    await queryClient.invalidateQueries(
      trpc.attachment.listByEntity.queryOptions({ entityType, entityId })
    );
  }

  return (
    <div className="space-y-3">
      {canManage && (
        <AttachmentUpload
          entityType={entityType}
          entityId={entityId}
          onUploaded={() => {
            refresh().catch(() => {});
          }}
        />
      )}
      <AttachmentList entityType={entityType} entityId={entityId} canDelete={canManage} />
    </div>
  );
}
