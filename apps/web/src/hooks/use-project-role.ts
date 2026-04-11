"use client";

import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";

type Role = "admin" | "editor" | "viewer";

const RANK: Record<Role, number> = { viewer: 0, editor: 1, admin: 2 };

export function useProjectRole(projectId: string) {
  const trpc = useTRPC();
  const { data } = useQuery(
    trpc.project.myRole.queryOptions({ projectId })
  );

  const role = (data?.role ?? null) as Role | null;

  return {
    role,
    isAdmin: role === "admin",
    canEdit: role !== null && RANK[role] >= RANK["editor"],
    canView: role !== null,
    isLoading: data === undefined,
  };
}
