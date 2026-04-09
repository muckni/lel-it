import { Settings2Icon } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8">
      <Settings2Icon className="h-12 w-12 text-muted-foreground mb-4" />
      <h2 className="text-lg font-semibold">Project Settings</h2>
      <p className="text-sm text-muted-foreground mt-1">
        Manage work packages, team members, and project details here.
      </p>
    </div>
  );
}
