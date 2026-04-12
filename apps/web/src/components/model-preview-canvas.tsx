"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Stage, useGLTF } from "@react-three/drei";

function ModelScene({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  return (
    <Stage adjustCamera intensity={0.5}>
      <primitive object={scene.clone(true)} />
    </Stage>
  );
}

export default function ModelPreviewCanvas({
  url,
  className,
}: {
  url: string;
  className?: string;
}) {
  return (
    <div className={className ?? "h-48 w-full rounded-lg border bg-muted"}>
      <Canvas camera={{ fov: 50 }}>
        <Suspense fallback={null}>
          <ModelScene url={url} />
        </Suspense>
      </Canvas>
    </div>
  );
}
