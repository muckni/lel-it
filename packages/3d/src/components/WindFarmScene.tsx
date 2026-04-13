"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, Grid, Stats } from "@react-three/drei";
import * as THREE from "three";
import { ASSET_ANCHOR_CATALOG } from "@owit/shared";
import { TurbineAsset } from "./assets/TurbineAsset";
import { MonopileAsset } from "./assets/MonopileAsset";
import { MonopileTPlessAsset } from "./assets/MonopileTPlessAsset";
import { JacketFoundationAsset } from "./assets/JacketFoundationAsset";
import { TripodAsset } from "./assets/TripodAsset";
import { PinpileCapAsset } from "./assets/PinpileCapAsset";
import { OSSAsset } from "./assets/OSSAsset";
import { GltfAsset } from "./assets/GltfAsset";
import { CableRoute } from "./assets/CableRoute";
import { InterfacePointMarkers } from "./InterfacePointMarkers";
import { MeasurementTool } from "./MeasurementTool";
import type { WindFarmSceneProps, CameraControl, CameraState } from "../types";

const REPRESENTATIVE_ASSET_POSITIONS: Record<
  "turbine" | "oss" | "monopile" | "monopile_tpless" | "jacket" | "tripod" | "pinpile",
  [number, number, number]
> = {
  turbine: [0, 9, 0],
  oss: [0, 2, 0],
  monopile: [0, 0, 0],
  monopile_tpless: [0, 0, 0],
  jacket: [0, 0, 0],
  tripod: [0, 0, 0],
  pinpile: [0, 0, 0],
};

function SeaSurface() {
  const meshRef = useRef<THREE.Mesh>(null);
  const frameRef = useRef(0);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const geo = mesh.geometry as THREE.BufferGeometry;
    const pos = geo.attributes.position;
    const t = clock.elapsedTime * 0.4;
    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, Math.sin(x * 0.3 + t) * 0.1 + Math.sin(z * 0.4 + t * 0.7) * 0.08);
    }
    pos.needsUpdate = true;
    frameRef.current += 1;
    // Recompute normals every other frame to keep wave shading smooth without unnecessary CPU cost.
    if (frameRef.current % 2 === 0) {
      geo.computeVertexNormals();
    }
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[300, 300, 50, 50]} />
      <meshStandardMaterial
        color="#1E40AF"
        transparent
        opacity={0.7}
        roughness={0.2}
        metalness={0.1}
      />
    </mesh>
  );
}

function SeabedPlane() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -12, 0]}>
      <planeGeometry args={[400, 400]} />
      <meshStandardMaterial color="#5C4A2A" roughness={0.9} />
    </mesh>
  );
}

/** Compute the LOD tier from distance (same thresholds as in the spec). */
function lodTierFromDistance(distance: number): number {
  if (distance > 500) return 4;
  if (distance > 200) return 3;
  if (distance > 100) return 2;
  return 0;
}

/**
 * AssetRenderer — layout mode.
 * For GLTF assets it tracks camera distance per frame and switches LOD tiers
 * without causing a re-render on every frame. Procedural assets are unaffected.
 */
function AssetRenderer({
  assets,
  cabledAssetIds,
}: {
  assets: WindFarmSceneProps["assets"];
  cabledAssetIds: Set<string>;
}) {
  const { camera } = useThree();

  // Separate GLTF assets so we can maintain LOD state for them
  const gltfAssets = assets.filter((a) => !!a.modelUrl);
  const proceduralAssets = assets.filter((a) => !a.modelUrl);

  // Per-asset LOD levels as React state (triggers re-render only on tier change)
  const [assetLodLevels, setAssetLodLevels] = useState<Record<string, number>>(
    () => Object.fromEntries(gltfAssets.map((a) => [a.id, a.lodLevel ?? 0]))
  );

  // Ref to track current tiers without causing re-renders on every frame
  const lodTierRef = useRef<Record<string, number>>(
    Object.fromEntries(gltfAssets.map((a) => [a.id, a.lodLevel ?? 0]))
  );

  // Scratch vector — allocate once outside the frame loop
  const _assetPos = useRef(new THREE.Vector3());

  useFrame(() => {
    let anyChanged = false;
    const nextTiers: Record<string, number> = { ...lodTierRef.current };

    for (const asset of gltfAssets) {
      _assetPos.current.set(asset.positionX, asset.positionY, asset.positionZ);
      const dist = camera.position.distanceTo(_assetPos.current);
      const newTier = lodTierFromDistance(dist);
      if (nextTiers[asset.id] !== newTier) {
        nextTiers[asset.id] = newTier;
        anyChanged = true;
      }
    }

    if (anyChanged) {
      lodTierRef.current = nextTiers;
      setAssetLodLevels({ ...nextTiers });
    }
  });

  return (
    <>
      {gltfAssets.map((a) => {
        const pos: [number, number, number] = [a.positionX, a.positionY, a.positionZ];
        return (
          <GltfAsset
            key={a.id}
            url={a.modelUrl!}
            position={pos}
            rotationY={a.rotationY}
            lodLevel={assetLodLevels[a.id] ?? 0}
          />
        );
      })}

      {proceduralAssets.map((a) => {
        const pos: [number, number, number] = [a.positionX, a.positionY, a.positionZ];
        switch (a.assetType) {
          case "turbine":
            return (
              <TurbineAsset
                key={a.id}
                position={pos}
                rotationY={a.rotationY}
                label={a.label}
                hasCableRiser={cabledAssetIds.has(a.id)}
              />
            );
          case "foundation": {
            const variant = a.foundationVariant;
            if (variant === "monopile_tpless") {
              return (
                <MonopileTPlessAsset
                  key={a.id}
                  position={pos}
                  rotationY={a.rotationY}
                  hasCableRiser={cabledAssetIds.has(a.id)}
                />
              );
            }
            if (variant === "jacket") {
              return (
                <JacketFoundationAsset
                  key={a.id}
                  position={pos}
                  rotationY={a.rotationY}
                  hasCableRiser={cabledAssetIds.has(a.id)}
                />
              );
            }
            if (variant === "tripod") {
              return (
                <TripodAsset
                  key={a.id}
                  position={pos}
                  rotationY={a.rotationY}
                  hasCableRiser={cabledAssetIds.has(a.id)}
                />
              );
            }
            if (variant === "pinpile") {
              return (
                <PinpileCapAsset
                  key={a.id}
                  position={pos}
                  rotationY={a.rotationY}
                />
              );
            }
            return (
              <MonopileAsset
                key={a.id}
                position={pos}
                rotationY={a.rotationY}
                hasCableRiser={cabledAssetIds.has(a.id)}
              />
            );
          }
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
  assetType: "turbine" | "oss" | "monopile" | "monopile_tpless" | "jacket" | "tripod" | "pinpile";
  modelUrl?: string | null;
}) {
  const position = REPRESENTATIVE_ASSET_POSITIONS[assetType];
  if (modelUrl) {
    // lodLevel intentionally omitted: representative mode renders at full fidelity (LOD 0).
    return <GltfAsset url={modelUrl} position={position} rotationY={0} />;
  }
  if (assetType === "turbine") return <TurbineAsset position={position} rotationY={0} label="WTG-Generic" />;
  if (assetType === "monopile") return <MonopileAsset position={position} rotationY={0} />;
  if (assetType === "monopile_tpless") return <MonopileTPlessAsset position={position} rotationY={0} />;
  if (assetType === "jacket") return <JacketFoundationAsset position={position} rotationY={0} />;
  if (assetType === "tripod") return <TripodAsset position={position} rotationY={0} />;
  if (assetType === "pinpile") return <PinpileCapAsset position={position} rotationY={0} />;
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

function CursorManager({ measurementActive }: { measurementActive: boolean }) {
  const { gl } = useThree();
  useEffect(() => {
    gl.domElement.style.cursor = measurementActive ? "crosshair" : "";
    return () => {
      gl.domElement.style.cursor = "";
    };
  }, [gl, measurementActive]);
  return null;
}

const CAMERA_PRESETS = {
  top: { position: [0, 200, 0] as [number, number, number], target: [0, 0, 0] as [number, number, number] },
  iso: { position: [100, 80, 100] as [number, number, number], target: [0, 0, 0] as [number, number, number] },
  side: { position: [200, 20, 0] as [number, number, number], target: [0, 0, 0] as [number, number, number] },
};

export function WindFarmScene({
  assets,
  cableRoutes = [],
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
  initialCamera,
  onOrbitEnd,
  cameraControlRef,
  measurementActive = false,
  showStats = false,
}: WindFarmSceneProps) {
  const orbitControlsRef = useRef<any>(null);

  // Wire up the imperative camera control ref for use by parent
  useEffect(() => {
    if (!cameraControlRef) return;
    cameraControlRef.current = {
      setPreset: (preset: "top" | "iso" | "side") => {
        const controls = orbitControlsRef.current;
        if (!controls) return;
        const p = CAMERA_PRESETS[preset];
        controls.object.position.set(...p.position);
        controls.target.set(...p.target);
        controls.update();
      },
    };
    return () => {
      if (cameraControlRef) cameraControlRef.current = null;
    };
  }, [cameraControlRef]);

  const visiblePoints = interfacePoints.filter((p) => {
    if (filterStatus && filterStatus !== "all" && p.status !== filterStatus) return false;
    if (filterCriticality && filterCriticality !== "all" && p.criticality !== filterCriticality) return false;
    return true;
  });

  const isRepresentative = sceneMode === "representative";
  const cabledAssetIds = useMemo(
    () => new Set((cableRoutes ?? []).flatMap((route) => [route.fromAssetId, route.toAssetId])),
    [cableRoutes]
  );
  const representativeAnchors = (anchorCatalog ?? ASSET_ANCHOR_CATALOG[focusAssetType]).map((anchor) => ({
    key: anchor.key,
    label: anchor.label,
    worldPosition: [
      anchor.position[0],
      anchor.position[1] + REPRESENTATIVE_ASSET_POSITIONS[focusAssetType][1],
      anchor.position[2],
    ] as [number, number, number],
  }));
  const anchorWorldPositions = Object.fromEntries(
    representativeAnchors.map((anchor) => [anchor.key, anchor.worldPosition])
  );
  const selectedPoint = visiblePoints.find((point) => point.id === mappingTargetPointId);

  const defaultPosition: [number, number, number] = initialCamera?.position
    ?? (isRepresentative
      ? focusAssetType === "turbine"
        ? [14, 18, 18]
        : focusAssetType === "oss"
          ? [24, 18, 28]
          : [18, 10, 18]
      : [30, 30, 50]);

  return (
    <Canvas
      camera={{
        position: defaultPosition,
        fov: 50,
      }}
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true }}
      style={{ background: "#0f172a" }}
    >
      <fog attach="fog" args={["#0f172a", 80, 220]} />
      <SeaSurface />
      <SeabedPlane />

      <Suspense fallback={null}>
        {/* Performance stats overlay (dev only) */}
        {showStats && <Stats />}

        {/* Lighting */}
        <ambientLight intensity={0.4} />
        <directionalLight
          position={[50, 100, 50]}
          intensity={1.2}
          castShadow
          shadow-mapSize={[2048, 2048]}
        />
        <hemisphereLight args={["#87CEEB", "#1E40AF", 0.3]} />

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
          <>
            <AssetRenderer assets={assets} cabledAssetIds={cabledAssetIds} />
            {cableRoutes.map((route) => {
              const fromAsset = assets.find((a) => a.id === route.fromAssetId);
              const toAsset = assets.find((a) => a.id === route.toAssetId);
              if (!fromAsset || !toAsset) return null;
              return (
                <CableRoute
                  key={route.id}
                  from={[fromAsset.positionX, fromAsset.positionY, fromAsset.positionZ]}
                  to={[toAsset.positionX, toAsset.positionY, toAsset.positionZ]}
                  cableType={route.cableType as "array_cable" | "export_cable"}
                  color={route.color ?? undefined}
                  waypoints={route.waypoints ?? undefined}
                />
              );
            })}
          </>
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

        {/* Cursor management for measurement mode */}
        <CursorManager measurementActive={measurementActive} />

        {/* Measurement tool — layout mode only */}
        {!isRepresentative && (
          <MeasurementTool active={measurementActive} />
        )}

        {/* Camera controls */}
        <OrbitControls
          ref={orbitControlsRef}
          enableDamping
          dampingFactor={0.05}
          target={
            initialCamera?.target ??
            (isRepresentative ? [0, focusAssetType === "turbine" ? 9 : 6, 0] : undefined)
          }
          minDistance={isRepresentative ? 4 : 5}
          maxDistance={isRepresentative ? 60 : 150}
          maxPolarAngle={Math.PI / 2.1}
          onEnd={() => {
            if (!onOrbitEnd || !orbitControlsRef.current) return;
            const controls = orbitControlsRef.current;
            const pos = controls.object.position;
            const tgt = controls.target;
            onOrbitEnd({
              position: [pos.x, pos.y, pos.z],
              target: [tgt.x, tgt.y, tgt.z],
            });
          }}
        />
      </Suspense>
    </Canvas>
  );
}
