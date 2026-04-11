"use client";

import { useParams } from "next/navigation";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  MessageSquareIcon,
  CheckCircle2Icon,
  XCircleIcon,
  PlusCircleIcon,
  RefreshCwIcon,
  FileTextIcon,
} from "lucide-react";

const EVENT_META: Record<
  string,
  { label: string; icon: React.ReactNode; color: string }
> = {
  "iq.raised": {
    label: "raised an IQ",
    icon: <PlusCircleIcon className="h-4 w-4" />,
    color: "text-blue-600 bg-blue-50",
  },
  "iq.responded": {
    label: "responded to an IQ",
    icon: <MessageSquareIcon className="h-4 w-4" />,
    color: "text-indigo-600 bg-indigo-50",
  },
  "iq.accepted": {
    label: "accepted an IQ response",
    icon: <CheckCircle2Icon className="h-4 w-4" />,
    color: "text-green-600 bg-green-50",
  },
  "iq.rejected": {
    label: "rejected an IQ response",
    icon: <XCircleIcon className="h-4 w-4" />,
    color: "text-red-600 bg-red-50",
  },
  "deliverable.status_changed": {
    label: "updated a deliverable",
    icon: <RefreshCwIcon className="h-4 w-4" />,
    color: "text-amber-600 bg-amber-50",
  },
};

function ActivityItem({ activity }: { activity: any }) {
  const meta = EVENT_META[activity.eventType] ?? {
    label: activity.eventType.replace(/\./g, " "),
    icon: <FileTextIcon className="h-4 w-4" />,
    color: "text-gray-600 bg-gray-50",
  };

  const [iconColor, bgColor] = meta.color.split(" ");

  return (
    <div className="flex gap-3 py-3">
      <div
        className={`mt-0.5 h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${bgColor} ${iconColor}`}
      >
        {meta.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm">
          <span className="font-medium">{activity.actorName}</span>{" "}
          <span className="text-muted-foreground">{meta.label}</span>
        </p>
        <p className="text-sm font-medium truncate mt-0.5">{activity.entityLabel}</p>
        {activity.meta?.status && (
          <p className="text-xs text-muted-foreground mt-0.5">
            Status →{" "}
            <span className="font-medium capitalize">
              {String(activity.meta.status).replace(/_/g, " ")}
            </span>
          </p>
        )}
        {activity.meta?.resolution && (
          <p className="text-xs text-muted-foreground mt-0.5">
            Resolution:{" "}
            <span className="font-medium capitalize">{activity.meta.resolution}</span>
          </p>
        )}
      </div>
      <time className="text-xs text-muted-foreground shrink-0 mt-1">
        {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
      </time>
    </div>
  );
}

export default function ActivityPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const trpc = useTRPC();

  const { data: activities = [], isLoading } = useQuery({
    ...trpc.activity.list.queryOptions({ projectId, limit: 100 }),
    refetchInterval: 30000,
  });

  return (
    <div className="flex flex-1 flex-col gap-4 p-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Activity Feed</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Recent events across all registers, queries, and deliverables
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : activities.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <RefreshCwIcon className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm font-medium">No activity yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Activities will appear here as your team raises queries, responds, and updates deliverables.
          </p>
        </div>
      ) : (
        <div className="divide-y rounded-lg border bg-background px-4">
          {activities.map((a: any) => (
            <ActivityItem key={a.id} activity={a} />
          ))}
        </div>
      )}
    </div>
  );
}
