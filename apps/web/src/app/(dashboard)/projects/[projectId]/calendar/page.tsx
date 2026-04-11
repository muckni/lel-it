"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek, subMonths } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeftIcon, ChevronRightIcon, CalendarDaysIcon } from "lucide-react";
import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const ENTITY_LABELS: Record<string, string> = {
  interface_point: "Point",
  deliverable: "Deliverable",
  iq: "IQ",
};

const ENTITY_BADGE_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  interface_point: "outline",
  deliverable: "secondary",
  iq: "default",
};

export default function ProjectCalendarPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const trpc = useTRPC();
  const [month, setMonth] = useState(new Date());

  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const { data: deadlines = [], isLoading } = useQuery(
    trpc.deadline.listByProject.queryOptions({
      projectId,
      from: format(gridStart, "yyyy-MM-dd"),
      to: format(gridEnd, "yyyy-MM-dd"),
      includeClosed: false,
    })
  );

  const days = useMemo(
    () => eachDayOfInterval({ start: gridStart, end: gridEnd }),
    [gridStart, gridEnd]
  );

  const byDay = useMemo(() => {
    const map = new Map<string, typeof deadlines>();
    for (const item of deadlines) {
      const key = item.dueDate;
      const prev = map.get(key) ?? [];
      prev.push(item);
      map.set(key, prev);
    }
    return map;
  }, [deadlines]);

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarDaysIcon className="h-6 w-6 text-muted-foreground" />
            Deadline Calendar
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Interface points, deliverables, and IQ deadlines in one monthly view.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setMonth(subMonths(month, 1))}>
            <ChevronLeftIcon className="h-4 w-4" />
          </Button>
          <p className="w-40 text-center text-sm font-medium">
            {format(month, "MMMM yyyy")}
          </p>
          <Button variant="outline" size="sm" onClick={() => setMonth(addMonths(month, 1))}>
            <ChevronRightIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="grid grid-cols-7 gap-2">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <p key={d} className="text-xs font-medium text-muted-foreground px-1">
              {d}
            </p>
          ))}

          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const items = byDay.get(key) ?? [];
            return (
              <Card
                key={key}
                className={`min-h-36 ${isSameMonth(day, month) ? "" : "opacity-50"}`}
              >
                <CardHeader className="px-3 py-2">
                  <CardTitle className="text-xs font-medium">{format(day, "d")}</CardTitle>
                </CardHeader>
                <CardContent className="px-2 pb-2 pt-0 space-y-1.5">
                  {items.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground">No due dates</p>
                  ) : (
                    items.slice(0, 4).map((item) => (
                      <Link
                        key={`${item.entityType}-${item.entityId}`}
                        href={item.urlPath ?? "#"}
                        className="block rounded border px-2 py-1 hover:bg-muted transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant={ENTITY_BADGE_VARIANT[item.entityType]} className="text-[10px] px-1.5 py-0">
                            {ENTITY_LABELS[item.entityType]}
                          </Badge>
                          <span
                            className={`text-[10px] ${
                              item.bucket === "overdue"
                                ? "text-red-700"
                                : item.bucket === "due_today" || item.bucket === "due_soon"
                                  ? "text-amber-800"
                                  : "text-muted-foreground"
                            }`}
                          >
                            {item.bucket === "overdue"
                              ? "Overdue"
                              : item.bucket === "due_today"
                                ? "Today"
                                : item.bucket === "due_soon"
                                  ? "Soon"
                                  : ""}
                          </span>
                        </div>
                        <p className="text-[11px] mt-1 truncate">{item.title}</p>
                      </Link>
                    ))
                  )}
                  {items.length > 4 && (
                    <p className="text-[11px] text-muted-foreground px-1">
                      +{items.length - 4} more
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
