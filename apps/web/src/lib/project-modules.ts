export type ProjectModuleKey = "interfaces" | "lessons";

export type ModuleNavItem = {
  label: string;
  href: string;
};

export type ModuleContract = {
  key: ProjectModuleKey;
  label: string;
  shortLabel: string;
  accentClass: string;
  badgeClass: string;
  nav: ModuleNavItem[];
};

export const PROJECT_MODULES: Record<ProjectModuleKey, ModuleContract> = {
  interfaces: {
    key: "interfaces",
    label: "Interfaces Module",
    shortLabel: "Interfaces",
    accentClass: "border-cyan-500 text-cyan-700",
    badgeClass: "bg-cyan-100 text-cyan-800",
    nav: [
      { label: "Workspace", href: "/modules/interfaces" },
      { label: "Cases", href: "/cases" },
      { label: "Matrix", href: "/matrix" },
      { label: "Tracker", href: "/tracker" },
      { label: "MOC", href: "/moc" },
      { label: "Registers", href: "/registers" },
      { label: "Queries", href: "/queries" },
      { label: "Calendar", href: "/calendar" },
      { label: "3D View", href: "/3d-view" },
      { label: "Reports", href: "/reports" },
      { label: "Activity", href: "/activity" },
      { label: "Settings", href: "/settings" },
    ],
  },
  lessons: {
    key: "lessons",
    label: "Lessons Learned Tool",
    shortLabel: "Lessons",
    accentClass: "border-emerald-500 text-emerald-700",
    badgeClass: "bg-emerald-100 text-emerald-800",
    nav: [
      { label: "Cockpit", href: "/modules/lessons" },
    ],
  },
};

export function inferProjectModuleFromPath(pathname: string): ProjectModuleKey | null {
  if (pathname.includes("/modules/lessons")) return "lessons";
  if (pathname.includes("/modules/interfaces")) return "interfaces";

  // Legacy interfaces routes still count as Interfaces module context.
  if (
    pathname.includes("/cases") ||
    pathname.includes("/matrix") ||
    pathname.includes("/tracker") ||
    pathname.includes("/moc") ||
    pathname.includes("/registers") ||
    pathname.includes("/queries") ||
    pathname.includes("/calendar") ||
    pathname.includes("/3d-view") ||
    pathname.includes("/reports") ||
    pathname.includes("/activity")
  ) {
    return "interfaces";
  }

  return null;
}
