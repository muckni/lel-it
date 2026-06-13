import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TRPCReactProvider } from "@/trpc/client";
import { caller } from "@/trpc/server";

type SidebarProject = {
  id: string;
  name: string;
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const trpc = await caller();
  const portfolios = await trpc.portfolio.list();
  const projects: SidebarProject[] = portfolios.flatMap((portfolio) =>
    (portfolio.projects ?? []).map((project) => ({
      id: project.id,
      name: project.name,
    }))
  );

  return (
    <TRPCReactProvider>
      <TooltipProvider>
        <SidebarProvider>
          <AppSidebar initialProjects={projects} />
          <SidebarInset>{children}</SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
    </TRPCReactProvider>
  );
}
