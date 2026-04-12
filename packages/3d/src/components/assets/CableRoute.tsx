"use client";

import { Line } from "@react-three/drei";

interface CableRouteProps {
  from: [number, number, number];
  to: [number, number, number];
  color?: string;
  cableType: "array_cable" | "export_cable";
  waypoints?: [number, number, number][];
}

export function CableRoute({ from, to, color, cableType, waypoints = [] }: CableRouteProps) {
  const lineColor = color ?? (cableType === "export_cable" ? "#e11d48" : "#6366f1");
  const lineWidth = cableType === "export_cable" ? 3 : 2;

  // All cables run at seabed level (y = -0.3)
  const points: [number, number, number][] = [
    [from[0], -0.3, from[2]],
    ...waypoints.map(([x, , z]) => [x, -0.3, z] as [number, number, number]),
    [to[0], -0.3, to[2]],
  ];

  return (
    <Line
      points={points}
      color={lineColor}
      lineWidth={lineWidth}
      dashed={false}
    />
  );
}
