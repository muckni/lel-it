import { MessageSquareIcon } from "lucide-react";

export default function QueriesPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8">
      <MessageSquareIcon className="h-12 w-12 text-muted-foreground mb-4" />
      <h2 className="text-lg font-semibold">Interface Queries</h2>
      <p className="text-sm text-muted-foreground mt-1">
        Interface queries workflow will be managed here. Coming in Phase 2.
      </p>
    </div>
  );
}
