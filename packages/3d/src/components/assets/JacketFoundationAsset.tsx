import { Fragment } from "react";

interface Props {
  position: [number, number, number];
  rotationY?: number;
}

const LEG_POINTS = [
  [-1.6, -12, -1.6],
  [1.6, -12, -1.6],
  [1.6, -12, 1.6],
  [-1.6, -12, 1.6],
] as const;

const TOP_POINTS = [
  [-0.9, 3, -0.9],
  [0.9, 3, -0.9],
  [0.9, 3, 0.9],
  [-0.9, 3, 0.9],
] as const;

function Brace({ from, to, color = "#5B6370", radius = 0.09 }: { from: readonly [number, number, number]; to: readonly [number, number, number]; color?: string; radius?: number }) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const dz = to[2] - from[2];
  const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const mid: [number, number, number] = [
    (from[0] + to[0]) / 2,
    (from[1] + to[1]) / 2,
    (from[2] + to[2]) / 2,
  ];

  return (
    <mesh position={mid}>
      <cylinderGeometry args={[radius, radius, length, 10]} />
      <meshStandardMaterial color={color} roughness={0.55} metalness={0.3} />
    </mesh>
  );
}

export function JacketFoundationAsset({ position, rotationY = 0 }: Props) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {LEG_POINTS.map((base, idx) => {
        const top = TOP_POINTS[idx]!;
        const legLen = Math.sqrt(
          (top[0] - base[0]) ** 2 +
          (top[1] - base[1]) ** 2 +
          (top[2] - base[2]) ** 2
        );
        const mid: [number, number, number] = [
          (base[0] + top[0]) / 2,
          (base[1] + top[1]) / 2,
          (base[2] + top[2]) / 2,
        ];
        return (
          <Fragment key={idx}>
            <mesh position={mid}>
              <cylinderGeometry args={[0.16, 0.16, legLen, 12]} />
              <meshStandardMaterial color="#6B7280" roughness={0.58} metalness={0.32} />
            </mesh>
            <mesh position={[base[0], -11.85, base[2]]}>
              <cylinderGeometry args={[0.28, 0.24, 0.32, 12]} />
              <meshStandardMaterial color="#6B7280" roughness={0.6} metalness={0.26} />
            </mesh>
            <mesh position={[base[0], -12.05, base[2]]}>
              <boxGeometry args={[0.9, 0.08, 0.9]} />
              <meshStandardMaterial color="#5A4A3A" roughness={0.8} metalness={0.1} />
            </mesh>
          </Fragment>
        );
      })}

      <mesh position={[0, 3.15, 0]}>
        <cylinderGeometry args={[1.05, 0.95, 0.45, 14]} />
        <meshStandardMaterial color="#7a7f89" roughness={0.5} metalness={0.36} />
      </mesh>

      {[[-1.6, -12, -1.6], [1.6, -12, -1.6], [1.6, -12, 1.6], [-1.6, -12, 1.6]].map((_, idx) => {
        const next = (idx + 1) % 4;
        const lowA = [LEG_POINTS[idx]![0], -7.5, LEG_POINTS[idx]![2]] as const;
        const lowB = [LEG_POINTS[next]![0], -4.5, LEG_POINTS[next]![2]] as const;
        const highA = [TOP_POINTS[idx]![0], -2.5, TOP_POINTS[idx]![2]] as const;
        const highB = [TOP_POINTS[next]![0], 0.5, TOP_POINTS[next]![2]] as const;
        return (
          <Fragment key={`ring-${idx}`}>
            <Brace from={lowA} to={lowB} />
            <Brace from={highA} to={highB} />
            <Brace from={lowB} to={lowA} />
            <Brace from={highB} to={highA} />
          </Fragment>
        );
      })}

      <Brace from={[-1.6, -9, -1.6]} to={[1.6, -6.5, 1.6]} />
      <Brace from={[1.6, -9, -1.6]} to={[-1.6, -6.5, 1.6]} />

      <mesh position={[1.5, -8, 0]}>
        <sphereGeometry args={[0.11, 10, 10]} />
        <meshStandardMaterial color="#60a5fa" emissive="#60a5fa" emissiveIntensity={0.32} />
      </mesh>
      <mesh position={[1, -4, 0]}>
        <sphereGeometry args={[0.1, 10, 10]} />
        <meshStandardMaterial color="#fbbf24" emissive="#f59e0b" emissiveIntensity={0.26} />
      </mesh>
    </group>
  );
}
