interface Props {
  position: [number, number, number];
  rotationY?: number;
}

// Offshore Substation: jacket legs + topside box
export function OSSAsset({ position, rotationY = 0 }: Props) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* 4 Jacket legs */}
      {[[-2, -2], [2, -2], [-2, 2], [2, 2]].map(([x, z], i) => (
        <mesh key={i} position={[x as number, -3, z as number]}>
          <cylinderGeometry args={[0.3, 0.3, 14, 8]} />
          <meshStandardMaterial color="#888" roughness={0.7} />
        </mesh>
      ))}

      {/* Cross bracing (simplified) */}
      <mesh position={[0, -3, 0]} rotation={[0, 0, Math.PI / 4]}>
        <cylinderGeometry args={[0.1, 0.1, 6, 6]} />
        <meshStandardMaterial color="#777" roughness={0.8} />
      </mesh>

      {/* Topside deck */}
      <mesh position={[0, 5, 0]}>
        <boxGeometry args={[7, 0.5, 7]} />
        <meshStandardMaterial color="#A0A0A0" roughness={0.5} />
      </mesh>

      {/* Topside equipment box */}
      <mesh position={[0, 7.5, 0]}>
        <boxGeometry args={[5, 5, 5]} />
        <meshStandardMaterial color="#B8B8C0" roughness={0.4} />
      </mesh>

      {/* Crane */}
      <mesh position={[2.5, 11, 0]}>
        <boxGeometry args={[0.3, 4, 0.3]} />
        <meshStandardMaterial color="#FFD700" roughness={0.5} />
      </mesh>

      {/* Helideck */}
      <mesh position={[-1, 12, 0]}>
        <cylinderGeometry args={[2, 2, 0.2, 16]} />
        <meshStandardMaterial color="#404040" roughness={0.3} />
      </mesh>

      {/* Cable deck indicator */}
      <mesh position={[0, 5.5, 3]}>
        <sphereGeometry args={[0.18, 6, 6]} />
        <meshStandardMaterial color="#60a5fa" emissive="#60a5fa" emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
}
