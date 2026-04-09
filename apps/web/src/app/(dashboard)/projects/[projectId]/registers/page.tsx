import { ListIcon } from "lucide-react";

export default function RegistersPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8">
      <ListIcon className="h-12 w-12 text-muted-foreground mb-4" />
      <h2 className="text-lg font-semibold">Interface Registers</h2>
      <p className="text-sm text-muted-foreground mt-1">
        Interface registers will be managed here. Coming in Phase 1.
      </p>
    </div>
  );
}
