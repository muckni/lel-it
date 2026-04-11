"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PHASE_OPTIONS = [
  { value: "maturation", label: "Maturation" },
  { value: "feed", label: "FEED" },
  { value: "detailed_design", label: "Detailed Design" },
  { value: "procurement", label: "Procurement" },
  { value: "fabrication", label: "Fabrication" },
  { value: "installation", label: "Installation" },
  { value: "commissioning", label: "Commissioning" },
  { value: "operations", label: "Operations" },
] as const;

const schema = z.object({
  name: z.string().min(1, "Project name is required").max(255),
  description: z.string().optional(),
  phase: z.enum(PHASE_OPTIONS.map((option) => option.value) as [string, ...string[]]).optional(),
});

type CreateProjectFormValues = z.infer<typeof schema>;

type CreateProjectDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CreateProjectDialog({ open, onOpenChange }: CreateProjectDialogProps) {
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<CreateProjectFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      description: "",
      phase: undefined,
    },
  });

  const { data: portfolios = [] } = useQuery(trpc.portfolio.list.queryOptions());

  const createPortfolio = useMutation(trpc.portfolio.create.mutationOptions());
  const createProject = useMutation(trpc.portfolio.createProject.mutationOptions());

  useEffect(() => {
    if (!open) {
      setSubmitError(null);
      form.reset();
    }
  }, [form, open]);

  async function handleSubmit(values: CreateProjectFormValues) {
    setSubmitError(null);

    try {
      let portfolioId = portfolios[0]?.id;

      if (!portfolioId) {
        const portfolio = await createPortfolio.mutateAsync({ name: "My Portfolio" });
        portfolioId = portfolio.id;
      }

      const project = await createProject.mutateAsync({
        portfolioId,
        name: values.name.trim(),
        description: values.description?.trim() || undefined,
        phase: (values.phase || undefined) as
          | "maturation" | "feed" | "detailed_design" | "procurement"
          | "fabrication" | "installation" | "commissioning" | "operations"
          | undefined,
      });

      await queryClient.invalidateQueries(trpc.portfolio.list.queryOptions());
      onOpenChange(false);
      router.push(`/projects/${project.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create project";
      setSubmitError(message);
    }
  }

  const isSubmitting = createPortfolio.isPending || createProject.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="project-name">Project name</Label>
            <Input
              id="project-name"
              placeholder="e.g. Baltic Alpha Offshore Wind Farm"
              {...form.register("name")}
            />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="project-description">Description (optional)</Label>
            <Textarea
              id="project-description"
              placeholder="Add a short summary of scope, timeline, or key goals"
              rows={4}
              {...form.register("description")}
            />
            {form.formState.errors.description && (
              <p className="text-xs text-destructive">{form.formState.errors.description.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Phase (optional)</Label>
            <Select
              value={form.watch("phase") ?? "none"}
              onValueChange={(value) =>
                form.setValue("phase", value === "none" ? undefined : (value as CreateProjectFormValues["phase"]))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select project phase" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not set</SelectItem>
                {PHASE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {submitError && <p className="text-sm text-destructive">{submitError}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating…" : "Create Project"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
