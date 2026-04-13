import { Fragment } from "react";
import { QuadraticBezierLine } from "@react-three/drei";
import { OrientedCylinder } from "./helpers";

interface Props {
  position: [number, number, number];
  rotationY?: number;
  hasCableRiser?: boolean;
}

const ARM_ANGLES = [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3] as const;

export function TripodAsset({ position, rotationY = 0, hasCableRiser = false }: Props) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, -2, 0]}>
        <cylinderGeometry args={[0.62, 0.72, 12, 18]} />
        <meshStandardMaterial color="#6b7280" roughness={0.56} metalness={0.33} />
      </mesh>

      <mesh position={[0, 4, 0]}>
        <cylinderGeometry args={[0.82, 0.76, 0.28, 18]} />
        <meshStandardMaterial color="#7a818e" roughness={0.52} metalness={0.34} />
      </mesh>

      {ARM_ANGLES.map((angle, idx) => {
        const top: [number, number, number] = [
          Math.cos(angle) * 0.75,
          0.8,
          Math.sin(angle) * 0.75,
        ];
        const bottom: [number, number, number] = [
          Math.cos(angle) * 2.2,
          -8,
          Math.sin(angle) * 2.2,
        ];
        const pileTop: [number, number, number] = [
          Math.cos(angle) * 2.2,
          -7.6,
          Math.sin(angle) * 2.2,
        ];

        return (
          <Fragment key={idx}>
            <OrientedCylinder
              from={top}
              to={bottom}
              radiusTop={0.13}
              color="#64748b"
              radialSegments={10}
              roughness={0.58}
              metalness={0.3}
            />
            <mesh position={pileTop}>
              <cylinderGeometry args={[0.42, 0.42, 0.8, 14]} />
              <meshStandardMaterial color="#6b7280" roughness={0.6} metalness={0.25} />
            </mesh>
          </Fragment>
        );
      })}

      {ARM_ANGLES.map((angle, idx) => {
        const next = ARM_ANGLES[(idx + 1) % ARM_ANGLES.length]!;
        const a: [number, number, number] = [Math.cos(angle) * 1.6, -4.2, Math.sin(angle) * 1.6];
        const b: [number, number, number] = [Math.cos(next) * 1.6, -4.2, Math.sin(next) * 1.6];
        return (
          <OrientedCylinder
            key={`cross-${idx}`}
            from={a}
            to={b}
            radiusTop={0.08}
            color="#64748b"
            radialSegments={10}
            roughness={0.58}
            metalness={0.3}
          />
        );
      })}

      <mesh position={[1.2, -6, 0]}>
        <sphereGeometry args={[0.1, 10, 10]} />
        <meshStandardMaterial color="#60a5fa" emissive="#60a5fa" emissiveIntensity={0.32} />
      </mesh>

      {hasCableRiser && (
        <QuadraticBezierLine
          start={[0, -0.3, 0]}
          mid={[1.0, 0.15, 0.2]}
          end={[1.1, 0.5, 0]}
          color="#374151"
          lineWidth={2}
          transparent
          opacity={0.85}
        />
      )}
    </group>
  );
}
