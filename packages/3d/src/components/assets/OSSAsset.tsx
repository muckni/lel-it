import * as THREE from "three";

interface Props {
  position: [number, number, number];
  rotationY?: number;
}

type Vec3 = [number, number, number];

const LEG_TOPS: Vec3[] = [
  [-3.5, 0, -3.5],
  [3.5, 0, -3.5],
  [3.5, 0, 3.5],
  [-3.5, 0, 3.5],
];

const LEG_BOTTOMS: Vec3[] = [
  [-5.5, -14, -5.5],
  [5.5, -14, -5.5],
  [5.5, -14, 5.5],
  [-5.5, -14, 5.5],
];

const UP = new THREE.Vector3(0, 1, 0);

function Strut({
  from,
  to,
  radius,
  color,
}: {
  from: Vec3;
  to: Vec3;
  radius: number;
  color: string;
}) {
  const fromVec = new THREE.Vector3(...from);
  const toVec = new THREE.Vector3(...to);
  const direction = toVec.clone().sub(fromVec);
  const length = direction.length();
  const mid = fromVec.clone().add(toVec).multiplyScalar(0.5);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    UP,
    direction.clone().normalize()
  );

  return (
    <mesh position={mid.toArray()} quaternion={quaternion}>
      <cylinderGeometry args={[radius, radius, length, 12]} />
      <meshStandardMaterial color={color} roughness={0.58} metalness={0.28} />
    </mesh>
  );
}

export function OSSAsset({ position, rotationY = 0 }: Props) {
  const legColor = "#6B7280";

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {LEG_TOPS.map((top, idx) => (
        <Strut key={`leg-${idx}`} from={top} to={LEG_BOTTOMS[idx]!} radius={0.35} color={legColor} />
      ))}

      {[-5, -10].map((level) => {
        const size = level === -5 ? 4.6 : 5.1;
        const points: Vec3[] = [
          [-size, level + 0.8, -size],
          [size, level + 0.8, -size],
          [size, level + 0.8, size],
          [-size, level + 0.8, size],
        ];

        return (
          <group key={`brace-level-${level}`}>
            {[0, 1, 2, 3].map((idx) => {
              const next = (idx + 1) % 4;
              const fromA = points[idx]!;
              const toA = points[next]!;
              const fromB: Vec3 = [fromA[0], fromA[1] - 1.6, fromA[2]];
              const toB: Vec3 = [toA[0], toA[1] - 1.6, toA[2]];
              return (
                <group key={`brace-${level}-${idx}`}>
                  <Strut from={fromA} to={toB} radius={0.1} color={legColor} />
                  <Strut from={toA} to={fromB} radius={0.1} color={legColor} />
                </group>
              );
            })}
          </group>
        );
      })}

      {LEG_BOTTOMS.map((leg, idx) => (
        <mesh key={`mudmat-${idx}`} position={[leg[0], leg[1] - 0.08, leg[2]]}>
          <boxGeometry args={[1.5, 0.15, 1.5]} />
          <meshStandardMaterial color={legColor} roughness={0.68} metalness={0.16} />
        </mesh>
      ))}

      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[11, 0.4, 11]} />
        <meshStandardMaterial color="#9CA3AF" roughness={0.5} metalness={0.18} />
      </mesh>

      <mesh position={[0, 4, 0]}>
        <boxGeometry args={[10, 0.4, 10]} />
        <meshStandardMaterial color="#7d8692" roughness={0.45} metalness={0.2} />
      </mesh>

      <mesh position={[-5, 4.45, 0]}>
        <boxGeometry args={[0.05, 0.8, 10]} />
        <meshStandardMaterial color="#d1d5db" roughness={0.42} />
      </mesh>
      <mesh position={[5, 4.45, 0]}>
        <boxGeometry args={[0.05, 0.8, 10]} />
        <meshStandardMaterial color="#d1d5db" roughness={0.42} />
      </mesh>
      <mesh position={[0, 4.45, -5]}>
        <boxGeometry args={[10, 0.8, 0.05]} />
        <meshStandardMaterial color="#d1d5db" roughness={0.42} />
      </mesh>
      <mesh position={[0, 4.45, 5]}>
        <boxGeometry args={[10, 0.8, 0.05]} />
        <meshStandardMaterial color="#d1d5db" roughness={0.42} />
      </mesh>

      <mesh position={[-2, 6.2, 0]}>
        <boxGeometry args={[2.5, 4, 2.5]} />
        <meshStandardMaterial color="#78716C" roughness={0.58} metalness={0.18} />
      </mesh>
      <mesh position={[2, 6.2, 0]}>
        <boxGeometry args={[2.5, 4, 2.5]} />
        <meshStandardMaterial color="#78716C" roughness={0.58} metalness={0.18} />
      </mesh>

      <mesh position={[0, 5.7, -3]}>
        <boxGeometry args={[4, 3, 2]} />
        <meshStandardMaterial color="#94A3B8" roughness={0.45} metalness={0.18} />
      </mesh>

      <mesh position={[0, 5.7, 3]}>
        <boxGeometry args={[3, 3, 2.5]} />
        <meshStandardMaterial color="#94A3B8" roughness={0.45} metalness={0.18} />
      </mesh>

      <mesh position={[3, 5.2, 3]}>
        <boxGeometry args={[1.5, 2, 1.5]} />
        <meshStandardMaterial color="#9CA3AF" roughness={0.48} metalness={0.16} />
      </mesh>

      <mesh position={[-3, 5.7, 2]}>
        <boxGeometry args={[2, 3, 3]} />
        <meshStandardMaterial color="#CBD5E1" roughness={0.4} metalness={0.1} />
      </mesh>

      {[-0.6, 0, 0.6].map((x, idx) => (
        <mesh key={`switchgear-${idx}`} position={[x, 7.0, -2.05]}>
          <boxGeometry args={[0.3, 1.5, 0.1]} />
          <meshStandardMaterial color="#1E3A5F" roughness={0.34} metalness={0.22} />
        </mesh>
      ))}

      <mesh position={[0, 12, 0]}>
        <cylinderGeometry args={[3.5, 3.5, 0.15, 8]} />
        <meshStandardMaterial color="#374151" roughness={0.4} metalness={0.25} />
      </mesh>
      <mesh position={[0, 12.09, 0]}>
        <boxGeometry args={[0.5, 0.02, 2.2]} />
        <meshStandardMaterial color="#f3f4f6" roughness={0.3} />
      </mesh>
      <mesh position={[0, 12.09, 0]}>
        <boxGeometry args={[1.8, 0.02, 0.5]} />
        <meshStandardMaterial color="#f3f4f6" roughness={0.3} />
      </mesh>

      {[[-2.2, 11.95, -2.2], [2.2, 11.95, -2.2], [2.2, 11.95, 2.2], [-2.2, 11.95, 2.2]].map((edge, idx) => (
        <Strut key={`heli-strut-${idx}`} from={edge as Vec3} to={[edge[0], 4.4, edge[2]]} radius={0.08} color={legColor} />
      ))}

      <mesh position={[3, 4.4, -3]}>
        <cylinderGeometry args={[0.3, 0.32, 1.0, 14]} />
        <meshStandardMaterial color="#F59E0B" roughness={0.4} metalness={0.25} />
      </mesh>
      <mesh position={[4.8, 5.65, -1.95]} rotation={[0, Math.PI / 4, -Math.PI / 6]}>
        <cylinderGeometry args={[0.08, 0.08, 5, 12]} />
        <meshStandardMaterial color="#F59E0B" roughness={0.4} metalness={0.25} />
      </mesh>

      {[-0.8, 0.8].map((x, idx) => (
        <group key={`pull-in-${idx}`}>
          <mesh position={[x, 0.25, 5.65]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.18, 0.18, 0.8, 12]} />
            <meshStandardMaterial color="#374151" roughness={0.45} metalness={0.28} />
          </mesh>
          <mesh position={[x, 0.25, 6.1]}>
            <boxGeometry args={[0.3, 0.3, 0.2]} />
            <meshStandardMaterial color="#374151" roughness={0.45} metalness={0.2} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
