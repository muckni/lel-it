import { BoxIcon } from "lucide-react";

export default function ThreeDViewPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8">
      <BoxIcon className="h-12 w-12 text-muted-foreground mb-4" />
      <h2 className="text-lg font-semibold">3D Wind Farm View</h2>
      <p className="text-sm text-muted-foreground mt-1">
        Interactive 3D visualization of the wind farm with interface points.
        Coming in Phase 3.
      </p>
    </div>
  );
}
