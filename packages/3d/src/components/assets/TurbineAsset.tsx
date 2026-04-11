import { useRef } from "react";
import * as THREE from "three";

interface Props {
  position: [number, number, number];
  rotationY?: number;
  label?: string;
}

// Parameterised turbine from primitives
// Attachment points: tower_base (0,-9,0), tower_flange (0,8,0), nacelle_yaw (0,9,0), blade_root (0,9,0)
export function TurbineAsset({ position, rotationY = 0 }: Props) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Tower — tall cylinder */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.4, 0.7, 18, 12]} />
        <meshStandardMaterial color="#c8c8c8" roughness={0.6} />
      </mesh>

      {/* Nacelle — box on top of tower */}
      <mesh position={[0, 10, 0]}>
        <boxGeometry args={[1.8, 1.0, 1.0]} />
        <meshStandardMaterial color="#d0d0d0" roughness={0.5} />
      </mesh>

      {/* Hub */}
      <mesh position={[0, 10, 0.6]}>
        <sphereGeometry args={[0.4, 8, 8]} />
        <meshStandardMaterial color="#b0b0b0" roughness={0.7} />
      </mesh>

      {/* 3 Blades */}
      {[0, 120, 240].map((deg, i) => {
        const rad = (deg * Math.PI) / 180;
        return (
          <mesh
            key={i}
            position={[
              Math.sin(rad) * 3,
              10 + Math.cos(rad) * 3,
              0.6,
            ]}
            rotation={[0, 0, rad]}
          >
            <boxGeometry args={[0.15, 6, 0.4]} />
            <meshStandardMaterial color="#e8e8e8" roughness={0.4} />
          </mesh>
        );
      })}

      {/* Tower attachment point indicator */}
      <mesh position={[0, -9, 0]}>
        <sphereGeometry args={[0.12, 6, 6]} />
        <meshStandardMaterial color="#60a5fa" emissive="#60a5fa" emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
}
