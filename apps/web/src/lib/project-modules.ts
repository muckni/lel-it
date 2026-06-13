export type ProjectModuleKey = "lessons";

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
  lessons: {
    key: "lessons",
    label: "Lessons Learned Tool",
    shortLabel: "Lessons",
    accentClass: "border-emerald-500 text-emerald-700",
    badgeClass: "bg-emerald-100 text-emerald-800",
    nav: [
      { label: "Cockpit", href: "/lessons-v2" },
    ],
  },
};

export function inferProjectModuleFromPath(pathname: string): ProjectModuleKey | null {
  if (pathname.includes("/lessons-v2")) return "lessons";
  return null;
}
