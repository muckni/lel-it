import "server-only";

import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import type { TRPCQueryOptions } from "@trpc/tanstack-react-query";
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";
import { cache } from "react";
import { createTRPCContext } from "./init";
import { makeQueryClient } from "./query-client";
import { appRouter } from "@/server/routers/_app";

export const getQueryClient = cache(makeQueryClient);

export const trpc = createTRPCOptionsProxy({
  ctx: createTRPCContext,
  router: appRouter,
  queryClient: getQueryClient,
});

// Server-side caller for direct use in server components
const createCaller = appRouter.createCaller;
export async function caller() {
  const ctx = await createTRPCContext();
  return createCaller(ctx);
}

export function HydrateClient(props: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {props.children}
    </HydrationBoundary>
  );
}

export function prefetch<T extends ReturnType<TRPCQueryOptions<any>>>(
  queryOptions: T
) {
  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(queryOptions as any);
}
