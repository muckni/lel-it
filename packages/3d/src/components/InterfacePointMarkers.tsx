import { Html } from "@react-three/drei";
import type { InterfacePointMarker } from "../types";

const STATUS_COLORS: Record<string, string> = {
  open: "#F59E0B",
  in_progress: "#3B82F6",
  resolved: "#10B981",
  closed: "#9CA3AF",
};

const CRITICALITY_SIZES: Record<string, number> = {
  critical: 0.35,
  major: 0.26,
  minor: 0.18,
};

interface Props {
  points: InterfacePointMarker[];
  onPointClick?: (id: string) => void;
  selectedPointId?: string | null;
  colorBy?: "status" | "criticality";
  anchorWorldPositions?: Record<string, [number, number, number]>;
  sceneMode?: "representative" | "layout";
}

export function InterfacePointMarkers({
  points,
  onPointClick,
  selectedPointId,
  colorBy = "status",
  anchorWorldPositions,
  sceneMode = "layout",
}: Props) {
  const positionedPoints = points
    .map((point, i) => {
      // Representative mode: use anchor-based positioning
      if (
        sceneMode === "representative" &&
        point.assetPositionRef &&
        anchorWorldPositions?.[point.assetPositionRef]
      ) {
        return { point, position: anchorWorldPositions[point.assetPositionRef] };
      }

      // Layout mode: use spatial coordinates if available, otherwise grid layout
      const x = point.spatialX ?? (i % 10) * 3 - 15;
      const y = point.spatialY ?? 2;
      const z = point.spatialZ ?? Math.floor(i / 10) * 3 - 15;
      return { point, position: [x, y, z] as [number, number, number] };
    })
    .filter((entry) => (sceneMode === "representative" ? !!entry.point.assetPositionRef : true));

  return (
    <>
      {positionedPoints.map(({ point, position }) => {
        const color = STATUS_COLORS[point.status] ?? "#9CA3AF";
        const size = CRITICALITY_SIZES[point.criticality] ?? 0.22;
        const isSelected = selectedPointId === point.id;

        return (
          <group
            key={point.id}
            position={position}
            onClick={(e) => {
              e.stopPropagation();
              onPointClick?.(point.id);
            }}
          >
            <mesh>
              <sphereGeometry args={[isSelected ? size * 1.5 : size, 10, 10]} />
              <meshStandardMaterial
                color={color}
                emissive={isSelected ? color : "#000"}
                emissiveIntensity={isSelected ? 0.5 : 0}
                roughness={0.3}
                metalness={0.1}
              />
            </mesh>
            {isSelected && (
              <Html distanceFactor={20} center>
                <div className="bg-white border rounded-lg shadow-lg p-2 text-xs w-44 pointer-events-none">
                  <p className="font-mono text-gray-500">{point.code}</p>
                  <p className="font-semibold leading-tight mt-0.5">{point.title}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: color }}
                    />
                    <span className="capitalize text-gray-600">{point.status.replace(/_/g, " ")}</span>
                  </div>
                </div>
              </Html>
            )}
          </group>
        );
      })}
    </>
  );
}
