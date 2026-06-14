"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTRPC } from "@/trpc/client";

type AssignToProjectDialogProps = {
  inboxItemId: string;
  defaultTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AssignToProjectDialog({
  inboxItemId,
  defaultTitle,
  open,
  onOpenChange,
}: AssignToProjectDialogProps) {
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [projectId, setProjectId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [title, setTitle] = useState(defaultTitle);

  // Reset the form whenever the dialog is (re)opened for a (new) item.
  useEffect(() => {
    if (open) {
      setProjectId("");
      setCategoryId("");
      setTitle(defaultTitle);
    }
  }, [open, defaultTitle]);

  const { data: portfolios = [] } = useQuery(trpc.portfolio.list.queryOptions());
  const { data: categories = [] } = useQuery(
    trpc.lessonV2.listCategories.queryOptions()
  );

  const projects = portfolios.flatMap((portfolio) => portfolio.projects ?? []);

  const assignToProject = useMutation(
    trpc.inbox.assignToProject.mutationOptions({
      onSuccess: async (result) => {
        await queryClient.invalidateQueries(trpc.inbox.list.queryOptions());
        onOpenChange(false);
        router.push(`/projects/${result.projectId}/lessons/${result.lessonId}`);
      },
    })
  );

  function handleConfirm() {
    if (!projectId || !categoryId) return;
    const trimmed = title.trim();
    assignToProject.mutate({
      inboxItemId,
      projectId,
      categoryId,
      title: trimmed.length > 0 ? trimmed : undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign to project</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Project</Label>
            <Select value={projectId} onValueChange={(value) => setProjectId(value ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={categoryId} onValueChange={(value) => setCategoryId(value ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="assign-title">Title</Label>
            <Input
              id="assign-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={200}
            />
          </div>

          {assignToProject.isError ? (
            <p className="text-sm text-destructive">
              {assignToProject.error.message || "Failed to assign. Please try again."}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={assignToProject.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!projectId || !categoryId || assignToProject.isPending}
          >
            Create draft lesson
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
