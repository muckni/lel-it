"use client";

import { useState, useCallback } from "react";
import { Html, Line } from "@react-three/drei";
import { ThreeEvent } from "@react-three/fiber";

interface MeasurementToolProps {
  active: boolean;
}

export function MeasurementTool({ active }: MeasurementToolProps) {
  const [points, setPoints] = useState<
    [[number, number, number], [number, number, number]] | [[number, number, number]] | []
  >([]);

  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      if (!active) return;
      e.stopPropagation();
      const pos: [number, number, number] = [e.point.x, e.point.y, e.point.z];
      setPoints((prev) => {
        if (prev.length === 0 || prev.length === 2) return [pos];
        return [prev[0], pos];
      });
    },
    [active]
  );

  const distance =
    points.length === 2
      ? Math.sqrt(
          Math.pow(points[1][0] - points[0][0], 2) +
            Math.pow(points[1][1] - points[0][1], 2) +
            Math.pow(points[1][2] - points[0][2], 2)
        )
      : null;

  const midpoint: [number, number, number] | null =
    points.length === 2
      ? [
          (points[0][0] + points[1][0]) / 2,
          (points[0][1] + points[1][1]) / 2 + 2,
          (points[0][2] + points[1][2]) / 2,
        ]
      : null;

  return (
    <group onClick={active ? handleClick : undefined}>
      {/* Invisible plane to catch clicks on the ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} visible={false}>
        <planeGeometry args={[2000, 2000]} />
        <meshBasicMaterial />
      </mesh>

      {points.length >= 1 && (
        <mesh position={points[0]}>
          <sphereGeometry args={[0.5, 8, 8]} />
          <meshBasicMaterial color="#f59e0b" />
        </mesh>
      )}

      {points.length === 2 && (
        <>
          <mesh position={points[1]}>
            <sphereGeometry args={[0.5, 8, 8]} />
            <meshBasicMaterial color="#f59e0b" />
          </mesh>
          <Line points={[points[0], points[1]]} color="#f59e0b" lineWidth={2} dashed />
          {midpoint && distance !== null && (
            <Html position={midpoint} center>
              <div className="rounded bg-black/80 px-2 py-1 text-xs text-white whitespace-nowrap">
                {distance.toFixed(1)} m
              </div>
            </Html>
          )}
        </>
      )}
    </group>
  );
}
