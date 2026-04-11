"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { CRITICALITIES, PROJECT_PHASES } from "@owit/shared";

const schema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  criticality: z.enum(CRITICALITIES),
  phase: z.enum(PROJECT_PHASES).optional(),
  dueDate: z.string().optional(),
});

export type InterfacePointFormValues = z.infer<typeof schema>;

interface Props {
  defaultValues?: Partial<InterfacePointFormValues>;
  onSubmit: (values: InterfacePointFormValues) => void;
  isLoading?: boolean;
}

export function InterfacePointForm({ defaultValues, onSubmit, isLoading }: Props) {
  const form = useForm<InterfacePointFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { criticality: "minor", ...defaultValues },
  });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label>Title *</Label>
        <Input placeholder="Tower base flange connection" {...form.register("title")} />
        {form.formState.errors.title && (
          <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Criticality</Label>
          <Select
            defaultValue="minor"
            onValueChange={(v) => form.setValue("criticality", v as typeof CRITICALITIES[number])}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CRITICALITIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Phase</Label>
          <Select onValueChange={(v) => form.setValue("phase", v as typeof PROJECT_PHASES[number])}>
            <SelectTrigger>
              <SelectValue placeholder="Any phase" />
            </SelectTrigger>
            <SelectContent>
              {PROJECT_PHASES.map((p) => (
                <SelectItem key={p} value={p}>
                  {p.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Due Date</Label>
        <Input type="date" {...form.register("dueDate")} />
      </div>
      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea rows={3} {...form.register("description")} />
      </div>
      <Button type="submit" disabled={isLoading}>
        {isLoading ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
