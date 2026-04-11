"use client";

import { useState } from "react";
import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BellIcon, CheckCheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

export function NotificationBell() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: countData } = useQuery({
    ...trpc.notification.unreadCount.queryOptions(),
    refetchInterval: 30000, // poll every 30s
  });

  const { data: notifications = [] } = useQuery({
    ...trpc.notification.list.queryOptions(),
    enabled: open,
  });

  const markRead = useMutation(
    trpc.notification.markRead.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.notification.unreadCount.queryOptions());
        queryClient.invalidateQueries(trpc.notification.list.queryOptions());
      },
    })
  );

  const markAllRead = useMutation(
    trpc.notification.markAllRead.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.notification.unreadCount.queryOptions());
        queryClient.invalidateQueries(trpc.notification.list.queryOptions());
      },
    })
  );

  const unreadCount = countData?.count ?? 0;

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="relative h-8 w-8"
        onClick={() => setOpen((o) => !o)}
      >
        <BellIcon className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-9 z-50 w-80 rounded-lg border bg-background shadow-lg">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <p className="text-sm font-semibold">Notifications</p>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => markAllRead.mutate()}
                >
                  <CheckCheckIcon className="h-3 w-3 mr-1" />
                  Mark all read
                </Button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No notifications yet.
                </p>
              ) : (
                notifications.map((n: any) => (
                  <div
                    key={n.id}
                    className={`px-4 py-3 border-b last:border-0 cursor-pointer hover:bg-muted/30 transition-colors ${!n.read ? "bg-blue-50/50" : ""}`}
                    onClick={() => {
                      if (!n.read) markRead.mutate({ id: n.id });
                    }}
                  >
                    <p className="text-xs text-foreground leading-relaxed">{n.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {format(new Date(n.createdAt), "dd MMM HH:mm")}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
