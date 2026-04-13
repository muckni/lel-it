"use client";

import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ProjectLessonsModulePlaceholderPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Lessons Module</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Lessons Learned workspace is loading for project <span className="font-mono">{projectId}</span>.
        </CardContent>
      </Card>
    </div>
  );
}
