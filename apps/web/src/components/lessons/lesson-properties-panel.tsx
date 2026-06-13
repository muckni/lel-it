"use client";

import type { ReactNode } from "react";
import {
  CONFIDENTIALITY_LEVELS,
  LESSON_TYPES,
  LESSON_V2_STATUSES,
} from "@owit/shared";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  lesson: {
    type: string;
    status: string;
    categoryId: string;
    confidentialityLevel: string;
    observedDate: string | null;
  };
  categories: Array<{ id: string; name: string }>;
  editable: boolean;
  onPatch: (patch: Record<string, unknown>) => void;
};

export function LessonPropertiesPanel({ lesson, categories, editable, onPatch }: Props) {
  return (
    <aside className="w-72 shrink-0 space-y-4 border-l pl-4">
      <Field label="Status">
        <PropSelect
          value={lesson.status}
          disabled={!editable}
          options={LESSON_V2_STATUSES}
          onChange={(value) => onPatch({ status: value })}
        />
      </Field>
      <Field label="Type">
        <PropSelect
          value={lesson.type}
          disabled={!editable}
          options={LESSON_TYPES}
          onChange={(value) => onPatch({ type: value })}
        />
      </Field>
      <Field label="Category">
        <Select
          value={lesson.categoryId}
          disabled={!editable}
          onValueChange={(value) => {
            if (value) {
              onPatch({ categoryId: value });
            }
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Confidentiality">
        <PropSelect
          value={lesson.confidentialityLevel}
          disabled={!editable}
          options={CONFIDENTIALITY_LEVELS}
          onChange={(value) => onPatch({ confidentialityLevel: value })}
        />
      </Field>
      <Field label="Observed date">
        <Input
          type="date"
          value={lesson.observedDate ?? ""}
          disabled={!editable}
          onChange={(event) =>
            onPatch({ observedDate: event.target.value ? event.target.value : null })
          }
        />
      </Field>
    </aside>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function PropSelect({
  value,
  options,
  disabled,
  onChange,
}: {
  value: string;
  options: readonly string[];
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <Select
      value={value}
      disabled={disabled}
      onValueChange={(nextValue) => {
        if (nextValue) {
          onChange(nextValue);
        }
      }}
    >
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {option.replace(/_/g, " ")}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
