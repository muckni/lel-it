"use client";

import { useMemo } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PROJECT_MODULES,
  type ProjectModuleKey,
  inferProjectModuleFromPath,
} from "@/lib/project-modules";

export function ProjectModuleSwitcher() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const projectId = params.projectId as string;

  const activeModule = inferProjectModuleFromPath(pathname) ?? "lessons";

  const moduleTargetHref = useMemo(
    () =>
      (nextModule: ProjectModuleKey) =>
        `/projects/${projectId}/modules/${nextModule}${
          searchParams.toString() ? `?${searchParams.toString()}` : ""
        }`,
    [projectId, searchParams]
  );

  return (
    <div className="min-w-[180px]">
      <Select
        value={activeModule}
        onValueChange={(value) => {
          router.push(moduleTargetHref(value as ProjectModuleKey));
        }}
      >
        <SelectTrigger className="h-8" aria-label="Module switcher">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.values(PROJECT_MODULES).map((module) => (
            <SelectItem key={module.key} value={module.key}>
              {module.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="mt-1 text-[11px] text-muted-foreground">
        Switch project module context
      </div>
    </div>
  );
}
