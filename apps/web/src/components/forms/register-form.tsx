"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const schema = z.object({
  name: z.string().min(1).max(255),
  packageAId: z.string().uuid("Select Package A"),
  packageBId: z.string().uuid("Select Package B"),
});

export type RegisterFormValues = z.infer<typeof schema>;

interface WorkPackage {
  id: string;
  code: string;
  name: string;
  color: string;
}

interface Props {
  workPackages: WorkPackage[];
  onSubmit: (values: RegisterFormValues) => void;
  isLoading?: boolean;
}

export function RegisterForm({ workPackages, onSubmit, isLoading }: Props) {
  const form = useForm<RegisterFormValues>({ resolver: zodResolver(schema) });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label>Name *</Label>
        <Input placeholder="WTG–Foundation Interface Register" {...form.register("name")} />
        {form.formState.errors.name && (
          <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Package A *</Label>
          <Select onValueChange={(v) => form.setValue("packageAId", v as string)}>
            <SelectTrigger>
              <SelectValue placeholder="Select package…" />
            </SelectTrigger>
            <SelectContent>
              {workPackages.map((wp) => (
                <SelectItem key={wp.id} value={wp.id}>
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block h-3 w-3 rounded-full"
                      style={{ background: wp.color }}
                    />
                    {wp.code} – {wp.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {form.formState.errors.packageAId && (
            <p className="text-xs text-destructive">{form.formState.errors.packageAId.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>Package B *</Label>
          <Select onValueChange={(v) => form.setValue("packageBId", v as string)}>
            <SelectTrigger>
              <SelectValue placeholder="Select package…" />
            </SelectTrigger>
            <SelectContent>
              {workPackages.map((wp) => (
                <SelectItem key={wp.id} value={wp.id}>
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block h-3 w-3 rounded-full"
                      style={{ background: wp.color }}
                    />
                    {wp.code} – {wp.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {form.formState.errors.packageBId && (
            <p className="text-xs text-destructive">{form.formState.errors.packageBId.message}</p>
          )}
        </div>
      </div>
      <Button type="submit" disabled={isLoading}>
        {isLoading ? "Creating…" : "Create Register"}
      </Button>
    </form>
  );
}
