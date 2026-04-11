import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import type { Object3D } from "three";

interface Props {
  url: string;
  position: [number, number, number];
  rotationY?: number;
}

export function GltfAsset({ url, position, rotationY = 0 }: Props) {
  const gltf = useGLTF(url);
  const cloned = useMemo(() => gltf.scene.clone(true) as Object3D, [gltf.scene]);

  return (
    <primitive
      object={cloned}
      position={position}
      rotation={[0, rotationY, 0]}
      dispose={null}
    />
  );
}

useGLTF.preload = useGLTF.preload;
