import { useEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { Object3D } from "three";

interface Props {
  url: string;
  position: [number, number, number];
  rotationY?: number;
  lodLevel?: number; // 0-2: full model, 3-4: bounding box wireframe
}

export function GltfAsset({ url, position, rotationY = 0, lodLevel = 0 }: Props) {
  const gltf = useGLTF(url);
  const groupRef = useRef<THREE.Group>(null);

  // Enable frustum culling explicitly on all meshes after load
  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.frustumCulled = true;
        }
      });
    }
  }, [url]); // re-run when model changes

  const renderedContent = useMemo(() => {
    if (lodLevel >= 3) {
      // LOD 3-4: render as bounding box wireframe
      const box = new THREE.Box3().setFromObject(gltf.scene);
      const size = new THREE.Vector3();
      box.getSize(size);
      if (!Number.isFinite(size.x) || !Number.isFinite(size.y) || !Number.isFinite(size.z) || size.lengthSq() === 0) {
        size.set(1, 1, 1);
      }

      return (
        <mesh>
          <boxGeometry args={[size.x, size.y, size.z]} />
          <meshStandardMaterial
            color="#888"
            wireframe
            opacity={0.5}
            transparent
          />
        </mesh>
      );
    }

    // LOD 0-2: render full GLTF
    const cloned = gltf.scene.clone(true) as Object3D;
    return <primitive object={cloned} dispose={null} />;
  }, [gltf.scene, lodLevel]);

  return (
    <group ref={groupRef} position={position} rotation={[0, rotationY, 0]}>
      {renderedContent}
    </group>
  );
}

useGLTF.preload = useGLTF.preload;
