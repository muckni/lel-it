"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, Environment } from "@react-three/drei";
import { ASSET_ANCHOR_CATALOG } from "@owit/shared";
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

function RepresentativeAsset({
  assetType,
  modelUrl,
}: {
  assetType: "turbine" | "oss";
  modelUrl?: string | null;
}) {
  const position: [number, number, number] = assetType === "turbine" ? [0, 9, 0] : [0, 2, 0];
  if (modelUrl) {
    return <GltfAsset url={modelUrl} position={position} rotationY={0} />;
  }
  if (assetType === "turbine") return <TurbineAsset position={position} rotationY={0} label="WTG-Generic" />;
  return <OSSAsset position={position} rotationY={0} />;
}

function AnchorMarkers({
  anchors,
  selectedAnchorKey,
  onAnchorClick,
}: {
  anchors: readonly { key: string; label: string; worldPosition: [number, number, number] }[];
  selectedAnchorKey?: string | null;
  onAnchorClick?: (anchorKey: string) => void;
}) {
  return (
    <>
      {anchors.map((anchor) => {
        const isSelected = selectedAnchorKey === anchor.key;
        return (
          <group
            key={anchor.key}
            position={anchor.worldPosition}
            onClick={(event) => {
              event.stopPropagation();
              onAnchorClick?.(anchor.key);
            }}
          >
            <mesh>
              <sphereGeometry args={[isSelected ? 0.28 : 0.2, 12, 12]} />
              <meshStandardMaterial
                color={isSelected ? "#22c55e" : "#f97316"}
                emissive={isSelected ? "#16a34a" : "#ea580c"}
                emissiveIntensity={0.45}
              />
            </mesh>
          </group>
        );
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
  sceneMode = "layout",
  focusAssetType = "turbine",
  anchorCatalog,
  representativeModelUrl,
  mappingTargetPointId,
  onAnchorClick,
}: WindFarmSceneProps) {
  const visiblePoints = interfacePoints.filter((p) => {
    if (filterStatus && filterStatus !== "all" && p.status !== filterStatus) return false;
    if (filterCriticality && filterCriticality !== "all" && p.criticality !== filterCriticality) return false;
    return true;
  });

  const isRepresentative = sceneMode === "representative";
  const representativeAnchors = (anchorCatalog ?? ASSET_ANCHOR_CATALOG[focusAssetType]).map((anchor) => ({
    key: anchor.key,
    label: anchor.label,
    worldPosition: [
      anchor.position[0],
      anchor.position[1] + (focusAssetType === "turbine" ? 9 : 2),
      anchor.position[2],
    ] as [number, number, number],
  }));
  const anchorWorldPositions = Object.fromEntries(
    representativeAnchors.map((anchor) => [anchor.key, anchor.worldPosition])
  );
  const selectedPoint = visiblePoints.find((point) => point.id === mappingTargetPointId);

  return (
    <Canvas
      camera={{
        position: isRepresentative
          ? focusAssetType === "turbine"
            ? [14, 18, 18]
            : [24, 18, 28]
          : [30, 30, 50],
        fov: 50,
      }}
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

        {isRepresentative ? (
          <RepresentativeAsset assetType={focusAssetType} modelUrl={representativeModelUrl} />
        ) : (
          <AssetRenderer assets={assets} />
        )}

        {/* Interface point markers */}
        <InterfacePointMarkers
          points={visiblePoints}
          onPointClick={onPointClick}
          selectedPointId={selectedPointId}
          sceneMode={sceneMode}
          anchorWorldPositions={anchorWorldPositions}
        />

        {isRepresentative && selectedPoint && (
          <AnchorMarkers
            anchors={representativeAnchors}
            selectedAnchorKey={selectedPoint.assetPositionRef}
            onAnchorClick={onAnchorClick}
          />
        )}

        {/* Camera controls */}
        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          target={isRepresentative ? [0, focusAssetType === "turbine" ? 9 : 6, 0] : undefined}
          minDistance={isRepresentative ? 4 : 5}
          maxDistance={isRepresentative ? 60 : 150}
          maxPolarAngle={Math.PI / 2.1}
        />
      </Suspense>
    </Canvas>
  );
}
