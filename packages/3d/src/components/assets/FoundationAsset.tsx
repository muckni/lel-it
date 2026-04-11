interface Props {
  position: [number, number, number];
  rotationY?: number;
}

// Monopile foundation: pile below water + transition piece above
export function FoundationAsset({ position, rotationY = 0 }: Props) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Monopile — extends below waterline */}
      <mesh position={[0, -6, 0]}>
        <cylinderGeometry args={[0.9, 0.9, 12, 12]} />
        <meshStandardMaterial color="#8B7355" roughness={0.8} />
      </mesh>

      {/* Transition piece */}
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[1.2, 0.9, 3, 12]} />
        <meshStandardMaterial color="#9E9E9E" roughness={0.6} />
      </mesh>

      {/* TP flange top — connection point for tower */}
      <mesh position={[0, 2, 0]}>
        <cylinderGeometry args={[1.3, 1.3, 0.2, 12]} />
        <meshStandardMaterial color="#707070" roughness={0.4} />
      </mesh>

      {/* J-tube entry indicator */}
      <mesh position={[0.9, -4, 0]}>
        <sphereGeometry args={[0.12, 6, 6]} />
        <meshStandardMaterial color="#60a5fa" emissive="#60a5fa" emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
}
