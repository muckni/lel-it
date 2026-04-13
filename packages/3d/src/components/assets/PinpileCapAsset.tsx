interface Props {
  position: [number, number, number];
  rotationY?: number;
}

const PILE_POSITIONS: [number, number, number][] = [
  [-1.5, -3, -1.5],
  [1.5, -3, -1.5],
  [-1.5, -3, 1.5],
  [1.5, -3, 1.5],
];

export function PinpileCapAsset({ position, rotationY = 0 }: Props) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, -0.25, 0]}>
        <boxGeometry args={[3.4, 0.5, 3.4]} />
        <meshStandardMaterial color="#6f6f72" roughness={0.62} metalness={0.2} />
      </mesh>

      <mesh position={[0, -0.02, 0]}>
        <boxGeometry args={[3.2, 0.04, 3.2]} />
        <meshStandardMaterial color="#8d8d90" roughness={0.46} metalness={0.28} />
      </mesh>

      <mesh position={[0, -0.03, 0]}>
        <boxGeometry args={[3.2, 0.06, 0.08]} />
        <meshStandardMaterial color="#a3a3a8" roughness={0.45} />
      </mesh>
      <mesh position={[0, -0.03, 0]}>
        <boxGeometry args={[0.08, 0.06, 3.2]} />
        <meshStandardMaterial color="#a3a3a8" roughness={0.45} />
      </mesh>

      {PILE_POSITIONS.map((pilePos, idx) => (
        <mesh key={idx} position={pilePos}>
          <cylinderGeometry args={[0.15, 0.15, 6, 12]} />
          <meshStandardMaterial color="#5f6368" roughness={0.7} metalness={0.18} />
        </mesh>
      ))}
    </group>
  );
}
