"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, Environment } from "@react-three/drei";
import { TurbineAsset } from "./assets/TurbineAsset";
import { FoundationAsset } from "./assets/FoundationAsset";
import { OSSAsset } from "./assets/OSSAsset";
import { GltfAsset } from "./assets/GltfAsset";
import { InterfacePointMarkers } from "./InterfacePointMarkers";
import type { WindFarmSceneProps } from "../types";

function SeaPlane() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
      <planeGeometry args={[200, 200]} />
      <meshStandardMaterial
        color="#1e40af"
        transparent
        opacity={0.35}
        roughness={0.1}
        metalness={0.1}
      />
    </mesh>
  );
}

function AssetRenderer({
  assets,
}: {
  assets: WindFarmSceneProps["assets"];
}) {
  return (
    <>
      {assets.map((a) => {
        const pos: [number, number, number] = [a.positionX, a.positionY, a.positionZ];
        if (a.modelUrl) {
          return (
            <GltfAsset
              key={a.id}
              url={a.modelUrl}
              position={pos}
              rotationY={a.rotationY}
            />
          );
        }

        switch (a.assetType) {
          case "turbine":
            return (
              <TurbineAsset key={a.id} position={pos} rotationY={a.rotationY} label={a.label} />
            );
          case "foundation":
            return (
              <FoundationAsset key={a.id} position={pos} rotationY={a.rotationY} />
            );
          case "oss":
            return (
              <OSSAsset key={a.id} position={pos} rotationY={a.rotationY} />
            );
          default:
            // Generic placeholder for other asset types
            return (
              <mesh key={a.id} position={pos}>
                <boxGeometry args={[2, 2, 2]} />
                <meshStandardMaterial color="#9CA3AF" />
              </mesh>
            );
        }
      })}
    </>
  );
}

export function WindFarmScene({
  assets,
  interfacePoints,
  onPointClick,
  selectedPointId,
  filterStatus,
  filterCriticality,
}: WindFarmSceneProps) {
  const visiblePoints = interfacePoints.filter((p) => {
    if (filterStatus && filterStatus !== "all" && p.status !== filterStatus) return false;
    if (filterCriticality && filterCriticality !== "all" && p.criticality !== filterCriticality) return false;
    return true;
  });

  return (
    <Canvas
      camera={{ position: [30, 30, 50], fov: 50 }}
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true }}
      style={{ background: "#0f172a" }}
    >
      <Suspense fallback={null}>
        {/* Lighting */}
        <ambientLight intensity={0.6} />
        <directionalLight
          position={[40, 60, 20]}
          intensity={1.2}
          castShadow
          shadow-mapSize={[2048, 2048]}
        />
        <hemisphereLight args={["#87CEEB", "#1e3a5f", 0.4]} />

        {/* Environment */}
        <fog attach="fog" args={["#0f172a", 80, 200]} />

        {/* Sea */}
        <SeaPlane />

        {/* Grid for reference */}
        <Grid
          args={[200, 200]}
          position={[0, -0.45, 0]}
          cellColor="#1e3a8a"
          sectionColor="#1d4ed8"
          cellSize={5}
          sectionSize={25}
          fadeDistance={120}
          fadeStrength={1}
          infiniteGrid
        />

        {/* Wind farm assets */}
        <AssetRenderer assets={assets} />

        {/* Interface point markers */}
        <InterfacePointMarkers
          points={visiblePoints}
          onPointClick={onPointClick}
          selectedPointId={selectedPointId}
        />

        {/* Camera controls */}
        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          minDistance={5}
          maxDistance={150}
          maxPolarAngle={Math.PI / 2.1}
        />
      </Suspense>
    </Canvas>
  );
}
