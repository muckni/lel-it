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
import { DISCIPLINES } from "@owit/shared";

const schema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  discipline: z.enum(DISCIPLINES).optional(),
});

export type AgreementFormValues = z.infer<typeof schema>;

interface Props {
  defaultValues?: Partial<AgreementFormValues>;
  onSubmit: (values: AgreementFormValues) => void;
  isLoading?: boolean;
}

export function AgreementForm({ defaultValues, onSubmit, isLoading }: Props) {
  const form = useForm<AgreementFormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label>Title *</Label>
        <Input placeholder="Tower Flange Interface Agreement" {...form.register("title")} />
        {form.formState.errors.title && (
          <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label>Discipline</Label>
        <Select onValueChange={(v) => form.setValue("discipline", v as typeof DISCIPLINES[number])}>
          <SelectTrigger>
            <SelectValue placeholder="Select discipline…" />
          </SelectTrigger>
          <SelectContent>
            {DISCIPLINES.map((d) => (
              <SelectItem key={d} value={d}>
                {d.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
