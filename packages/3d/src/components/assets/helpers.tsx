import { useMemo } from "react";
import * as THREE from "three";

type Vec3 = readonly [number, number, number];

const UP = new THREE.Vector3(0, 1, 0);

interface OrientedCylinderProps {
  from: Vec3;
  to: Vec3;
  radiusTop: number;
  radiusBottom?: number;
  color: string;
  radialSegments?: number;
  roughness?: number;
  metalness?: number;
}

export function OrientedCylinder({
  from,
  to,
  radiusTop,
  radiusBottom,
  color,
  radialSegments = 12,
  roughness = 0.58,
  metalness = 0.28,
}: OrientedCylinderProps) {
  const { midpoint, quaternion, length } = useMemo(() => {
    const fromVec = new THREE.Vector3(...from);
    const toVec = new THREE.Vector3(...to);
    const direction = toVec.clone().sub(fromVec);
    const distance = direction.length();
    const mid = fromVec.clone().add(toVec).multiplyScalar(0.5);
    const quat = new THREE.Quaternion().setFromUnitVectors(
      UP,
      direction.clone().normalize()
    );

    return {
      midpoint: mid.toArray() as [number, number, number],
      quaternion: quat,
      length: distance,
    };
  }, [from, to]);

  return (
    <mesh position={midpoint} quaternion={quaternion}>
      <cylinderGeometry args={[radiusTop, radiusBottom ?? radiusTop, length, radialSegments]} />
      <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} />
    </mesh>
  );
}
