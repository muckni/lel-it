interface Props {
  position: [number, number, number];
  rotationY?: number;
}

export function MonopileTPlessAsset({ position, rotationY = 0 }: Props) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, -5, 0]}>
        <cylinderGeometry args={[0.6, 0.52, 10, 18]} />
        <meshStandardMaterial color="#7A5C3A" roughness={0.82} metalness={0.14} />
      </mesh>

      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.72, 0.7, 0.35, 20]} />
        <meshStandardMaterial color="#8f8f8f" roughness={0.58} metalness={0.35} />
      </mesh>

      <mesh position={[0, 0.38, 0]}>
        <cylinderGeometry args={[0.63, 0.63, 0.12, 20]} />
        <meshStandardMaterial color="#6f6f6f" roughness={0.4} metalness={0.46} />
      </mesh>

      {[...Array.from({ length: 10 })].map((_, idx) => {
        const angle = (idx / 10) * Math.PI * 2;
        const radius = 0.68;
        return (
          <mesh key={idx} position={[Math.cos(angle) * radius, 0.35, Math.sin(angle) * radius]}>
            <sphereGeometry args={[0.028, 8, 8]} />
            <meshStandardMaterial color="#3f3f46" />
          </mesh>
        );
      })}
    </group>
  );
}
