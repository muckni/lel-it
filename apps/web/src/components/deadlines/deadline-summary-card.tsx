"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangleIcon, Clock3Icon, CalendarDaysIcon } from "lucide-react";
import { useTRPC } from "@/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function DeadlineSummaryCard({ projectId }: { projectId: string }) {
  const trpc = useTRPC();
  const { data, isLoading } = useQuery(
    trpc.deadline.summary.queryOptions({ projectId })
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <CalendarDaysIcon className="h-4 w-4 text-muted-foreground" />
          Deadlines
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading || !data ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded border p-2">
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <AlertTriangleIcon className="h-3 w-3 text-red-600" />
                  Overdue
                </p>
                <p className="text-xl font-semibold text-red-700">{data.overdue}</p>
              </div>
              <div className="rounded border p-2">
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Clock3Icon className="h-3 w-3 text-amber-700" />
                  Due Today
                </p>
                <p className="text-xl font-semibold text-amber-800">{data.dueToday}</p>
              </div>
              <div className="rounded border p-2">
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <CalendarDaysIcon className="h-3 w-3 text-amber-700" />
                  Due 7 Days
                </p>
                <p className="text-xl font-semibold text-amber-800">{data.dueSoon}</p>
              </div>
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <p>
                Points: {data.byType.interface_point.overdue} overdue ·{" "}
                {data.byType.interface_point.dueToday + data.byType.interface_point.dueSoon} upcoming
              </p>
              <p>
                Deliverables: {data.byType.deliverable.overdue} overdue ·{" "}
                {data.byType.deliverable.dueToday + data.byType.deliverable.dueSoon} upcoming
              </p>
              <p>
                IQs: {data.byType.iq.overdue} overdue ·{" "}
                {data.byType.iq.dueToday + data.byType.iq.dueSoon} upcoming
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
