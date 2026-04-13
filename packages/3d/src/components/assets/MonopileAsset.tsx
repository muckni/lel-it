import { QuadraticBezierLine } from "@react-three/drei";

interface Props {
  position: [number, number, number];
  rotationY?: number;
  hasCableRiser?: boolean;
}

export function MonopileAsset({ position, rotationY = 0, hasCableRiser = false }: Props) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, -5, 0]}>
        <cylinderGeometry args={[0.6, 0.6, 10, 18]} />
        <meshStandardMaterial color="#7A5C3A" roughness={0.82} metalness={0.16} />
      </mesh>

      <mesh position={[0, 1.25, 0]}>
        <cylinderGeometry args={[0.75, 0.62, 2.5, 18]} />
        <meshStandardMaterial color="#909090" roughness={0.58} metalness={0.34} />
      </mesh>

      <mesh position={[0, 2.5, 0]}>
        <cylinderGeometry args={[0.82, 0.82, 0.18, 24]} />
        <meshStandardMaterial color="#6f6f6f" roughness={0.44} metalness={0.5} />
      </mesh>

      <mesh position={[0.95, -4.1, 0]} rotation={[0, 0, 0.08]}>
        <cylinderGeometry args={[0.08, 0.08, 9.4, 10]} />
        <meshStandardMaterial color="#7f7f7f" roughness={0.55} metalness={0.38} />
      </mesh>

      <mesh position={[0.95, -7, 0]}>
        <sphereGeometry args={[0.12, 10, 10]} />
        <meshStandardMaterial color="#60a5fa" emissive="#60a5fa" emissiveIntensity={0.3} />
      </mesh>

      {[0.2, 0.65, 1.1, 1.55].map((y) => (
        <mesh key={y} position={[0.72, y, 0]}>
          <boxGeometry args={[0.26, 0.04, 0.1]} />
          <meshStandardMaterial color="#a3a3a3" roughness={0.45} />
        </mesh>
      ))}

      {[...Array.from({ length: 12 })].map((_, idx) => {
        const angle = (idx / 12) * Math.PI * 2;
        const radius = 0.78;
        return (
          <mesh key={idx} position={[Math.cos(angle) * radius, 2.5, Math.sin(angle) * radius]}>
            <sphereGeometry args={[0.03, 8, 8]} />
            <meshStandardMaterial color="#3f3f46" />
          </mesh>
        );
      })}

      {hasCableRiser && (
        <QuadraticBezierLine
          start={[0, -0.3, 0]}
          mid={[0.75, 0.65, 0.2]}
          end={[0.8, 1.8, 0]}
          color="#374151"
          lineWidth={2}
          transparent
          opacity={0.85}
        />
      )}
    </group>
  );
}
