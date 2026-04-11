"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { AgreementForm, type AgreementFormValues } from "@/components/forms/agreement-form";
import { AgreementStatusBadge } from "@/components/status-badge";
import { PlusIcon, ChevronRightIcon, FileTextIcon } from "lucide-react";

export default function RegisterDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const registerId = params.registerId as string;
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: register, isLoading } = useQuery(
    trpc.register.getById.queryOptions({ id: registerId })
  );

  const { data: agreements = [] } = useQuery(
    trpc.agreement.list.queryOptions({ registerId })
  );

  const createMutation = useMutation(
    trpc.agreement.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.agreement.list.queryOptions({ registerId }));
        setOpen(false);
      },
    })
  );

  function handleCreate(values: AgreementFormValues) {
    createMutation.mutate({ registerId, ...values });
  }

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (!register) return <div className="p-6 text-sm text-destructive">Register not found.</div>;

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 data-vertical:h-4 data-vertical:self-auto" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href={`/projects/${projectId}/registers`}>Registers</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>{register.code}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-6 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{register.name}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {register.code} ·{" "}
              <span style={{ color: register.packageA.color }}>{register.packageA.code}</span>
              {" ↔ "}
              <span style={{ color: register.packageB.color }}>{register.packageB.code}</span>
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button><PlusIcon className="h-4 w-4 mr-1" />New Agreement</Button>} />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Interface Agreement</DialogTitle>
              </DialogHeader>
              <AgreementForm onSubmit={handleCreate} isLoading={createMutation.isPending} />
            </DialogContent>
          </Dialog>
        </div>

        {agreements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <FileTextIcon className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-sm font-medium">No agreements yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Create interface agreements to group related interface points.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {agreements.map((agreement) => (
              <Card
                key={agreement.id}
                className="cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() =>
                  router.push(
                    `/projects/${projectId}/registers/${registerId}/agreements/${agreement.id}`
                  )
                }
              >
                <CardContent className="flex items-center gap-4 py-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{agreement.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {agreement.code}
                      {agreement.discipline && ` · ${agreement.discipline.replace(/_/g, " ")}`}
                      {" · "}
                      {agreement.points?.length ?? 0} point
                      {(agreement.points?.length ?? 0) !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <AgreementStatusBadge status={agreement.status} />
                  <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
