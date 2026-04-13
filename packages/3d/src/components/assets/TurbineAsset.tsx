interface Props {
  position: [number, number, number];
  rotationY?: number;
  label?: string;
}

export function TurbineAsset({ position, rotationY = 0 }: Props) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.35, 0.75, 18, 16]} />
        <meshStandardMaterial color="#D8D8D8" roughness={0.4} metalness={0.28} />
      </mesh>

      <mesh position={[0, -8.45, 0.73]}>
        <boxGeometry args={[0.15, 1.0, 0.05]} />
        <meshStandardMaterial color="#2f2f33" roughness={0.8} metalness={0.05} />
      </mesh>

      <mesh position={[0, -9.5, 0]}>
        <cylinderGeometry args={[0.95, 0.95, 1.5, 16]} />
        <meshStandardMaterial color="#A0A0A0" roughness={0.5} metalness={0.24} />
      </mesh>

      <mesh position={[0, -8.75, 0]}>
        <cylinderGeometry args={[1.05, 1.05, 0.15, 22]} />
        <meshStandardMaterial color="#8e8e8e" roughness={0.42} metalness={0.35} />
      </mesh>

      <mesh position={[0, 9.3, 0]}>
        <boxGeometry args={[1.4, 1.2, 3.0]} />
        <meshStandardMaterial color="#CECECE" roughness={0.35} metalness={0.26} />
      </mesh>

      <mesh position={[0, 9.2, -1.9]}>
        <boxGeometry args={[1.0, 0.9, 1.0]} />
        <meshStandardMaterial color="#bfc1c6" roughness={0.38} metalness={0.24} />
      </mesh>

      <mesh position={[-0.26, 10.0, -0.1]}>
        <boxGeometry args={[0.22, 0.2, 0.5]} />
        <meshStandardMaterial color="#b9bcc2" roughness={0.34} metalness={0.24} />
      </mesh>
      <mesh position={[0.26, 10.0, -0.1]}>
        <boxGeometry args={[0.22, 0.2, 0.5]} />
        <meshStandardMaterial color="#b9bcc2" roughness={0.34} metalness={0.24} />
      </mesh>

      <mesh position={[0, 9.3, 1.55]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.4, 1.2, 16]} />
        <meshStandardMaterial color="#d4d4d6" roughness={0.32} metalness={0.2} />
      </mesh>

      <mesh position={[0, 9.3, 0.85]}>
        <sphereGeometry args={[0.55, 18, 16]} />
        <meshStandardMaterial color="#B0B0B0" roughness={0.38} metalness={0.24} />
      </mesh>

      {[0, 120, 240].map((deg, index) => {
        const rad = (deg * Math.PI) / 180;
        const flangeX = Math.sin(rad) * 0.58;
        const flangeY = 9.3 + Math.cos(rad) * 0.58;
        return (
          <mesh key={`flange-${index}`} position={[flangeX, flangeY, 0.86]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.25, 0.25, 0.1, 14]} />
            <meshStandardMaterial color="#9fa1a8" roughness={0.4} metalness={0.26} />
          </mesh>
        );
      })}

      {[0, 120, 240].map((deg, index) => {
        const rad = (deg * Math.PI) / 180;
        const bladeX = Math.sin(rad) * 4.2;
        const bladeY = 9.3 + Math.cos(rad) * 4.2;
        return (
          <mesh key={`blade-${index}`} position={[bladeX, bladeY, 0.9]} rotation={[0.15, 0, rad]}>
            <cylinderGeometry args={[0.05, 0.4, 8, 6]} />
            <meshStandardMaterial color="#EFEFEF" roughness={0.3} metalness={0.08} />
          </mesh>
        );
      })}

      <mesh position={[0, -8.4, -0.9]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.18, 0.18, 0.6, 14]} />
        <meshStandardMaterial color="#374151" roughness={0.45} metalness={0.28} />
      </mesh>
      <mesh position={[0, -8.4, -1.25]}>
        <boxGeometry args={[0.3, 0.3, 0.2]} />
        <meshStandardMaterial color="#374151" roughness={0.45} metalness={0.2} />
      </mesh>

      <mesh position={[0, 10.45, -0.2]}>
        <cylinderGeometry args={[0.025, 0.025, 0.8, 8]} />
        <meshStandardMaterial color="#d0d0d0" roughness={0.35} metalness={0.25} />
      </mesh>
    </group>
  );
}
