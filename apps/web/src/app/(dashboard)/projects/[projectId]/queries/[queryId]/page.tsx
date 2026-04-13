"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle2Icon,
  XCircleIcon,
  MessageSquareIcon,
  SendIcon,
  Trash2Icon,
} from "lucide-react";
import { QUERY_STATUSES, QUERY_PRIORITIES } from "@owit/shared";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useProjectRole } from "@/hooks/use-project-role";
import { EntityAttachments } from "@/components/attachments/entity-attachments";

const priorityColors: Record<string, string> = {
  urgent: "bg-red-100 text-red-800",
  high: "bg-orange-100 text-orange-800",
  medium: "bg-blue-100 text-blue-800",
  low: "bg-gray-100 text-gray-600",
};

const statusColors: Record<string, string> = {
  open: "bg-amber-100 text-amber-800",
  responded: "bg-blue-100 text-blue-800",
  accepted: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  closed: "bg-gray-100 text-gray-600",
};

const responseSchema = z.object({
  content: z.string().min(1),
});
type ResponseFormValues = z.infer<typeof responseSchema>;

const commentSchema = z.object({ content: z.string().min(1) });
type CommentFormValues = z.infer<typeof commentSchema>;

export default function QueryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const queryId = params.queryId as string;
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { canEdit } = useProjectRole(projectId);

  const { data: iq, isLoading } = useQuery(
    trpc.interfaceQuery.getById.queryOptions({ id: queryId })
  );

  const { data: comments = [] } = useQuery(
    trpc.comment.list.queryOptions({
      parentType: "interface_query",
      parentId: queryId,
    })
  );

  const updateIQ = useMutation(
    trpc.interfaceQuery.update.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries(
          trpc.interfaceQuery.getById.queryOptions({ id: queryId })
        ),
    })
  );

  const respond = useMutation(
    trpc.interfaceQuery.respond.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(
          trpc.interfaceQuery.getById.queryOptions({ id: queryId })
        );
        responseForm.reset();
      },
    })
  );

  const resolveResponse = useMutation(
    trpc.interfaceQuery.resolveResponse.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries(
          trpc.interfaceQuery.getById.queryOptions({ id: queryId })
        ),
    })
  );

  const addComment = useMutation(
    trpc.comment.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(
          trpc.comment.list.queryOptions({
            parentType: "interface_query",
            parentId: queryId,
          })
        );
        commentForm.reset();
      },
    })
  );

  const deleteComment = useMutation(
    trpc.comment.delete.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries(
          trpc.comment.list.queryOptions({
            parentType: "interface_query",
            parentId: queryId,
          })
        ),
    })
  );

  const responseForm = useForm<ResponseFormValues>({
    resolver: zodResolver(responseSchema),
  });
  const commentForm = useForm<CommentFormValues>({
    resolver: zodResolver(commentSchema),
  });

  function handleRespond(values: ResponseFormValues) {
    respond.mutate({
      queryId,
      content: values.content,
    });
  }

  function handleComment(values: CommentFormValues) {
    addComment.mutate({
      parentType: "interface_query",
      parentId: queryId,
      content: values.content,
    });
  }

  if (isLoading)
    return (
      <div className="p-6 text-sm text-muted-foreground">Loading…</div>
    );
  if (!iq)
    return (
      <div className="p-6 text-sm text-destructive">
        Interface query not found.
      </div>
    );

  const isClosed = iq.status === "closed" || iq.status === "accepted";
  const canRespond = iq.status === "open" && iq.responses.length === 0;
  const canResolve = iq.status === "responded";

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-vertical:h-4 data-vertical:self-auto"
          />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href={`/projects/${projectId}/queries`}>
                  Queries
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>{iq.code}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-6 p-6 max-w-3xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs text-muted-foreground">
                {iq.code}
              </span>
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${priorityColors[iq.priority]}`}
              >
                {iq.priority}
              </span>
            </div>
            <h1 className="text-2xl font-bold">{iq.subject}</h1>
            {iq.description && (
              <p className="text-sm text-muted-foreground mt-2">
                {iq.description}
              </p>
            )}
          </div>
          <div className="shrink-0">
            <Select
              defaultValue={iq.status}
              onValueChange={(v) =>
                v && updateIQ.mutate({ id: queryId, status: v as any })
              }
            >
              <SelectTrigger className="w-36 h-8 text-xs">
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${statusColors[iq.status]}`}
                >
                  {iq.status.replace(/_/g, " ")}
                </span>
              </SelectTrigger>
              <SelectContent>
                {QUERY_STATUSES.map((s) => (
                  <SelectItem key={s} value={s} className="text-xs capitalize">
                    {s.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Meta */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Raised By</p>
            <p className="font-medium flex items-center gap-1 mt-0.5">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: iq.raisedByPackage.color }}
              />
              {iq.raisedByPackage.code} — {iq.raisedByPackage.name ?? "Unknown package"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Assigned To</p>
            <p className="font-medium flex items-center gap-1 mt-0.5">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: iq.assignedToPackage.color }}
              />
              {iq.assignedToPackage.code} — {iq.assignedToPackage.name ?? "Unknown package"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Interface Point</p>
            <p className="font-medium font-mono text-xs mt-0.5">
              {iq.interfacePoint.code}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Due Date</p>
            <p className="font-medium mt-0.5">
              {iq.dueDate
                ? format(new Date(iq.dueDate), "dd MMM yyyy")
                : "—"}
            </p>
          </div>
        </div>

        {/* Responses */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Responses
              {iq.responses.length > 0 && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({iq.responses.length})
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {iq.responses.length === 0 && !canRespond && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No responses yet.
              </p>
            )}

            {iq.responses.map((r: any) => (
              <div key={r.id} className="rounded-lg border p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm">{r.content}</p>
                      {r.documentRef && (
                        <a
                          href={r.documentRef}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline mt-1 block"
                        >
                          View Document →
                        </a>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(r.createdAt), "dd MMM yyyy HH:mm")}
                      </p>
                    </div>
                    {r.status === "submitted" && (
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded ml-2">
                        Pending review
                      </span>
                    )}
                    {r.status === "accepted" && (
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded ml-2 flex items-center gap-1">
                        <CheckCircle2Icon className="h-3 w-3" /> Accepted
                      </span>
                    )}
                    {r.status === "rejected" && (
                      <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded ml-2 flex items-center gap-1">
                        <XCircleIcon className="h-3 w-3" /> Rejected
                      </span>
                    )}
                  </div>
                  <div className="pt-1">
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      Attachments
                    </p>
                    <EntityAttachments
                      entityType="iq_response"
                      entityId={r.id}
                      canManage={canEdit}
                    />
                  </div>
                  {canResolve && r.status === "submitted" && (
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        className="h-7 text-xs bg-green-600 hover:bg-green-700"
                        onClick={() =>
                          resolveResponse.mutate({
                            responseId: r.id,
                            queryId,
                            resolution: "accepted",
                          })
                        }
                        disabled={resolveResponse.isPending}
                      >
                        <CheckCircle2Icon className="h-3 w-3 mr-1" /> Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-7 text-xs"
                        onClick={() =>
                          resolveResponse.mutate({
                            responseId: r.id,
                            queryId,
                            resolution: "rejected",
                          })
                        }
                        disabled={resolveResponse.isPending}
                      >
                        <XCircleIcon className="h-3 w-3 mr-1" /> Reject
                      </Button>
                    </div>
                  )}
                </div>
            ))}

            {canRespond && (
              <form
                onSubmit={responseForm.handleSubmit(handleRespond)}
                className="space-y-3 pt-2 border-t"
              >
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Add Response
                </p>
                <Textarea
                  rows={3}
                  placeholder="Provide your response…"
                  {...responseForm.register("content")}
                />
                {responseForm.formState.errors.content && (
                  <p className="text-xs text-destructive">
                    {responseForm.formState.errors.content.message}
                  </p>
                )}
                <Button
                  type="submit"
                  size="sm"
                  disabled={respond.isPending}
                >
                  <SendIcon className="h-3.5 w-3.5 mr-1" />
                  {respond.isPending ? "Sending…" : "Submit Response"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Comments */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquareIcon className="h-4 w-4" />
              Discussion
              {comments.length > 0 && (
                <span className="text-sm font-normal text-muted-foreground">
                  ({comments.length})
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {comments.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No comments yet.
              </p>
            )}
            {comments.map((c: any) => (
              <div
                key={c.id}
                className="flex items-start gap-3 py-2 border-b last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{c.content}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(c.createdAt), "dd MMM yyyy HH:mm")}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                  onClick={() => deleteComment.mutate({ id: c.id })}
                >
                  <Trash2Icon className="h-3 w-3" />
                </Button>
              </div>
            ))}
            <form
              onSubmit={commentForm.handleSubmit(handleComment)}
              className="flex gap-2 pt-2"
            >
              <Textarea
                rows={1}
                placeholder="Add a comment…"
                className="text-sm resize-none"
                {...commentForm.register("content")}
              />
              <Button
                type="submit"
                size="icon"
                className="shrink-0"
                disabled={addComment.isPending}
              >
                <SendIcon className="h-4 w-4" />
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
