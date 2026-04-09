import { BarChart3Icon } from "lucide-react";

export default function ReportsPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8">
      <BarChart3Icon className="h-12 w-12 text-muted-foreground mb-4" />
      <h2 className="text-lg font-semibold">Reports & Dashboards</h2>
      <p className="text-sm text-muted-foreground mt-1">
        Status dashboards and reporting will be available here. Coming in Phase
        4.
      </p>
    </div>
  );
}
