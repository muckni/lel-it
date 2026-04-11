"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const schema = z.object({
  code: z.string().min(1).max(10),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  responsibleOrg: z.string().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export type WorkPackageFormValues = z.infer<typeof schema>;

interface Props {
  defaultValues?: Partial<WorkPackageFormValues>;
  onSubmit: (values: WorkPackageFormValues) => void;
  isLoading?: boolean;
}

export function WorkPackageForm({ defaultValues, onSubmit, isLoading }: Props) {
  const form = useForm<WorkPackageFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { color: "#6366F1", ...defaultValues },
  });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="code">Code *</Label>
          <Input id="code" placeholder="WTG" {...form.register("code")} />
          {form.formState.errors.code && (
            <p className="text-xs text-destructive">{form.formState.errors.code.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="color">Colour *</Label>
          <div className="flex gap-2">
            <Input type="color" id="color" className="w-12 p-1 h-9" {...form.register("color")} />
            <Input {...form.register("color")} placeholder="#6366F1" />
          </div>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="name">Name *</Label>
        <Input id="name" placeholder="Wind Turbine Generator" {...form.register("name")} />
        {form.formState.errors.name && (
          <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="responsibleOrg">Responsible Organisation</Label>
        <Input id="responsibleOrg" placeholder="Siemens Gamesa" {...form.register("responsibleOrg")} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" rows={3} {...form.register("description")} />
      </div>
      <Button type="submit" disabled={isLoading}>
        {isLoading ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
