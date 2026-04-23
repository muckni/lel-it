"use client";

import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LESSON_DISCIPLINES, LESSON_TYPES, PROJECT_PHASES } from "@owit/shared";
import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import { Textarea } from "@/components/ui/textarea";

const schema = z.object({
  title: z.string().min(1, "Title is required").max(500),
  type: z.enum(LESSON_TYPES),
  tags: z.string().max(500).optional(),
  location: z.string().max(500).optional(),
  problem: z.string().min(1, "Problem is required").max(5000),
  solution: z.string().max(5000).optional(),
  outcomes: z.string().max(5000).optional(),
  attachments: z.string().max(5000).optional(),
  discipline: z.enum(LESSON_DISCIPLINES).optional(),
  projectPhase: z.enum(PROJECT_PHASES).optional(),
  workPackageId: z.string().uuid().optional(),
});

type FormValues = z.infer<typeof schema>;

type WorkPackageOption = {
  id: string;
  code: string;
  name: string;
};

type CreateLessonDialogProps = {
  projectId: string;
  projectName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workPackages: WorkPackageOption[];
  defaultInterfacePointId?: string;
  onCreated?: (lessonId: string) => void;
};

const PHASE_LABELS: Record<(typeof PROJECT_PHASES)[number], string> = {
  maturation: "Maturation",
  feed: "FEED",
  detailed_design: "Detailed Design",
  procurement: "Procurement",
  fabrication: "Fabrication",
  installation: "Installation",
  commissioning: "Commissioning",
  operations: "Operations",
};

const DISCIPLINE_LABELS: Record<(typeof LESSON_DISCIPLINES)[number], string> = {
  engineering: "Engineering",
  procurement: "Procurement",
  construction: "Construction",
  installation: "Installation",
  commissioning: "Commissioning",
  project_management: "Project Management",
  hse: "HSE",
  commercial: "Commercial",
  other: "Other",
};

const TYPE_LABELS: Record<(typeof LESSON_TYPES)[number], string> = {
  problem: "Problem",
  success: "Success",
  risk: "Risk",
  improvement: "Improvement",
  process_deviation: "Process Deviation",
};

export function CreateLessonDialog({
  projectId,
  projectName,
  open,
  onOpenChange,
  workPackages,
  defaultInterfacePointId,
  onCreated,
}: CreateLessonDialogProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      type: "problem",
      tags: "",
      location: "",
      problem: "",
      solution: "",
      outcomes: "",
      attachments: "",
      discipline: undefined,
      projectPhase: undefined,
      workPackageId: undefined,
    },
  });

  useEffect(() => {
    if (!open) {
      setSubmitError(null);
      form.reset();
    }
  }, [form, open]);

  const createLesson = useMutation(
    trpc.lessonLearned.create.mutationOptions({
      onSuccess: async (lesson) => {
        await queryClient.invalidateQueries(
          trpc.lessonLearned.list.queryOptions({ projectId })
        );
        await queryClient.invalidateQueries(
          trpc.lessonLearned.listPendingReviews.queryOptions({ projectId })
        );
        await queryClient.invalidateQueries(
          trpc.lessonOps.listIntake.queryOptions({ projectId })
        );
        onOpenChange(false);
        onCreated?.(lesson.id);
      },
      onError: (error) => {
        setSubmitError(error.message);
      },
    })
  );

  const isSubmitting = createLesson.isPending;

  const packageOptions = useMemo(
    () => [...workPackages].sort((a, b) => a.code.localeCompare(b.code)),
    [workPackages]
  );

  function suggestCategory() {
    const text = `${form.getValues("title")} ${form.getValues("problem")} ${form.getValues("outcomes")}`.toLowerCase();

    if (/delay|late|slip|overrun|risk/.test(text)) form.setValue("type", "risk");
    else if (/deviation|non.?conform|incident/.test(text)) form.setValue("type", "process_deviation");
    else if (/improv|optimi|better/.test(text)) form.setValue("type", "improvement");
    else if (/success|good practice|effective|best practice/.test(text)) form.setValue("type", "success");
    else form.setValue("type", "problem");

    if (/hse|safety|permit/.test(text)) form.setValue("discipline", "hse");
    else if (/cable|electrical|hv|lv|control/.test(text)) form.setValue("discipline", "engineering");
    else if (/install|vessel|marine|hook-up/.test(text)) form.setValue("discipline", "installation");
    else if (/procure|supplier|vendor/.test(text)) form.setValue("discipline", "procurement");
    else if (/commission/.test(text)) form.setValue("discipline", "commissioning");
  }

  function onSubmit(values: FormValues) {
    setSubmitError(null);

    const descriptionParts = [
      `Problem:\n${values.problem.trim()}`,
      values.outcomes?.trim() ? `Outcomes/Impacts:\n${values.outcomes.trim()}` : null,
    ].filter(Boolean);

    const recommendationParts = [
      values.solution?.trim() ? `Solution:\n${values.solution.trim()}` : null,
      values.attachments?.trim() ? `Attachments:\n${values.attachments.trim()}` : null,
    ].filter(Boolean);

    createLesson.mutate({
      projectId,
      title: values.title.trim(),
      type: values.type,
      description: descriptionParts.join("\n\n"),
      recommendation: recommendationParts.join("\n\n") || undefined,
      discipline: values.discipline ?? "other",
      projectPhase: values.projectPhase ?? undefined,
      workPackageId: values.workPackageId ?? undefined,
      interfacePointIds: defaultInterfacePointId ? [defaultInterfacePointId] : undefined,
      location: values.location?.trim() || undefined,
      tags: values.tags
        ? values.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean)
        : undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Capture Lesson Learned</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="lesson-title">Title</Label>
            <Input id="lesson-title" {...form.register("title")} placeholder="Concise lesson title" />
            {form.formState.errors.title && (
              <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={form.watch("type")}
                onValueChange={(value) => form.setValue("type", (value ?? "problem") as FormValues["type"])}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select lesson type" />
                </SelectTrigger>
                <SelectContent>
                  {LESSON_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Discipline (optional)</Label>
              <Select
                value={form.watch("discipline") ?? "none"}
                onValueChange={(value) =>
                  form.setValue(
                    "discipline",
                    !value || value === "none" ? undefined : (value as FormValues["discipline"])
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select discipline" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not set</SelectItem>
                  {LESSON_DISCIPLINES.map((discipline) => (
                    <SelectItem key={discipline} value={discipline}>
                      {DISCIPLINE_LABELS[discipline]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="button" size="sm" variant="outline" onClick={suggestCategory}>
              Suggest Category
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Project</Label>
              <Input value={projectName ?? projectId} disabled aria-label="Project" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lesson-location">Location (optional)</Label>
              <Input id="lesson-location" {...form.register("location")} placeholder="WTG TP / OSS / cable route" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="lesson-tags">Tags (optional)</Label>
              <Input id="lesson-tags" {...form.register("tags")} placeholder="cable, logistics, weather" />
            </div>
            <div className="space-y-1.5">
              <Label>Project phase (optional)</Label>
              <Select
                value={form.watch("projectPhase") ?? "none"}
                onValueChange={(value) =>
                  form.setValue(
                    "projectPhase",
                    !value || value === "none" ? undefined : (value as FormValues["projectPhase"])
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select phase" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not set</SelectItem>
                  {PROJECT_PHASES.map((phase) => (
                    <SelectItem key={phase} value={phase}>
                      {PHASE_LABELS[phase]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lesson-problem">Problem</Label>
            <Textarea
              id="lesson-problem"
              rows={4}
              {...form.register("problem")}
              placeholder="What happened and why did it matter?"
            />
            {form.formState.errors.problem && (
              <p className="text-xs text-destructive">{form.formState.errors.problem.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lesson-solution">Solution (optional)</Label>
            <Textarea
              id="lesson-solution"
              rows={3}
              {...form.register("solution")}
              placeholder="What action solved or could solve it?"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lesson-outcomes">Outcomes / Impacts (optional)</Label>
            <Textarea
              id="lesson-outcomes"
              rows={3}
              {...form.register("outcomes")}
              placeholder="Cost, schedule, quality, HSE, and operational impact"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lesson-attachments">Attachments / References (optional)</Label>
            <Textarea
              id="lesson-attachments"
              rows={2}
              {...form.register("attachments")}
              placeholder="Paste one URL or document reference per line"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Work package (optional)</Label>
            <Select
              value={form.watch("workPackageId") ?? "none"}
              onValueChange={(value) =>
                form.setValue("workPackageId", !value || value === "none" ? undefined : value)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select work package" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not set</SelectItem>
                {packageOptions.map((workPackage) => (
                  <SelectItem key={workPackage.id} value={workPackage.id}>
                    {workPackage.code} - {workPackage.name}
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
              {isSubmitting ? "Saving…" : "Create Lesson"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
