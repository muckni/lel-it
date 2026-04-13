"use client";

import { CatmullRomLine } from "@react-three/drei";

interface CableRouteProps {
  from: [number, number, number];
  to: [number, number, number];
  color?: string;
  cableType: "array_cable" | "export_cable";
  waypoints?: [number, number, number][];
}

export function CableRoute({ from, to, color, cableType, waypoints = [] }: CableRouteProps) {
  const lineColor = color ?? (cableType === "export_cable" ? "#DC2626" : "#6366f1");
  const lineWidth = cableType === "export_cable" ? 4 : 2;
  const opacity = cableType === "export_cable" ? 1 : 0.78;

  // All cables run at seabed level (y = -0.3)
  const start: [number, number, number] = [from[0], -0.3, from[2]];
  const end: [number, number, number] = [to[0], -0.3, to[2]];
  const seabedWaypoints = waypoints.map(([x, , z]) => [x, -0.3, z] as [number, number, number]);
  const sagMid: [number, number, number] = [
    (from[0] + to[0]) / 2,
    Math.min(from[1], to[1]) - 0.5,
    (from[2] + to[2]) / 2,
  ];
  const points: [number, number, number][] =
    seabedWaypoints.length > 0
      ? [start, ...seabedWaypoints, end]
      : [start, sagMid, end];

  return (
    <>
      <CatmullRomLine
        points={points}
        color={lineColor}
        lineWidth={lineWidth}
        transparent
        opacity={opacity}
      />
      {cableType === "export_cable" && (
        <CatmullRomLine
          points={points}
          color={lineColor}
          lineWidth={lineWidth * 1.5}
          transparent
          opacity={0.3}
        />
      )}
    </>
  );
}
