# 3D Model Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve OWIT's 3D visualization from a proof-of-concept into a production-grade spatial interface management tool — the product's core USP. Focus on making the 3D view actionable for interface managers: spatial context for scope-split decisions, cable routing awareness, measurement tooling, and GLTF model quality assurance.

**Architecture:** The 3D system uses React Three Fiber (R3F) inside a Next.js 16 app. It has two scene modes: **Layout** (bird's-eye wind farm with all assets) and **Representative** (single asset close-up for anchor mapping). Assets are either procedural geometry or GLTF models from Supabase Storage. Interface points are mapped to predefined anchor positions on turbines and OSS structures.

**Tech Stack:** React Three Fiber, @react-three/drei, Three.js, Next.js 16.2, tRPC v11, Drizzle ORM, Supabase Storage, Vitest.

**IMPORTANT:** Read `apps/web/AGENTS.md` before writing any code. This is Next.js 16 with breaking changes.

---

## Current State Summary

### What works:
- Two scene modes (Layout + Representative) with feature flag control
- 3 procedural asset types (turbine, foundation, OSS) with realistic proportions
- GLTF/GLB model upload, versioning, and rendering pipeline
- 20 predefined anchor points (10 turbine, 10 OSS) for interface point mapping
- Topic mapping sidebar for associating interface points with 3D anchors
- Status/criticality coloring and filtering
- Demo layout seeding (3x3 turbines + 1 OSS)
- Full RBAC protection on all 3D mutations

### What's missing (prioritized):
1. **P0 — LOD rendering** — LOD level stored but never used
2. **P0 — Spatial fallback positioning** — `spatialX/Y/Z` fields exist but unused
3. **P1 — Cable routing visualization** — cables are just gray boxes
4. **P1 — Model validation & preview** — no GLTF validity check or thumbnail
5. **P1 — Custom anchors per project** — hardcoded catalog, not editable
6. **P2 — Measurement/distance tool** — no ruler between two points
7. **P2 — Camera presets & persistence** — camera resets on reload
8. **P2 — Asset layout import/export** — no CSV/Excel import
9. **P2 — Frustum culling & performance** — all assets always rendered
10. **P3 — Advanced effects** — no wave animation, depth fog, or custom shaders

---

## Task 1: Activate LOD rendering for GLTF models

**Files:**
- Modify: `packages/3d/src/components/assets/GltfAsset.tsx`
- Modify: `packages/3d/src/types.ts`

The `lodLevel` field (0-4) is stored on each `AssetPlacement` but never used in rendering. GltfAsset always renders the full model.

- [ ] **Step 1: Read existing GltfAsset component**

Read `packages/3d/src/components/assets/GltfAsset.tsx` and `packages/3d/src/types.ts` to understand the current model loading.

- [ ] **Step 2: Add LOD-based rendering using drei's `<Detailed>`**

`@react-three/drei` provides a `<Detailed>` component that works with Three.js `LOD`. For now, implement a simpler approach: use the `lodLevel` prop to control mesh simplification via Three.js `Box3` bounding-box fallback:

```tsx
import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

interface GltfAssetProps {
  url: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  lodLevel?: number; // 0=full, 1-2=medium, 3-4=bounding box
}

export function GltfAsset({ url, position, rotation, scale = 1, lodLevel = 0 }: GltfAssetProps) {
  const { scene } = useGLTF(url);
  
  const renderedScene = useMemo(() => {
    if (lodLevel >= 3) {
      // LOD 3-4: render as bounding box wireframe
      const box = new THREE.Box3().setFromObject(scene);
      const size = new THREE.Vector3();
      box.getSize(size);
      return (
        <mesh>
          <boxGeometry args={[size.x, size.y, size.z]} />
          <meshStandardMaterial color="#888" wireframe opacity={0.5} transparent />
        </mesh>
      );
    }
    // LOD 0-2: render full GLTF
    const cloned = scene.clone(true);
    return <primitive object={cloned} />;
  }, [scene, lodLevel]);

  return (
    <group position={position} rotation={rotation} scale={scale}>
      {renderedScene}
    </group>
  );
}
```

- [ ] **Step 3: Pass lodLevel from WindFarmScene to GltfAsset**

In `packages/3d/src/components/WindFarmScene.tsx`, pass `lodLevel={asset.lodLevel ?? 0}` to `<GltfAsset>`.

- [ ] **Step 4: Verify build passes**

Run: `pnpm --filter @owit/web build`

- [ ] **Step 5: Commit**

```bash
git add packages/3d/src/components/assets/GltfAsset.tsx packages/3d/src/components/WindFarmScene.tsx packages/3d/src/types.ts
git commit -m "feat(3d): activate LOD rendering for GLTF models"
```

---

## Task 2: Activate spatial fallback positioning for interface points

**Files:**
- Modify: `packages/3d/src/components/InterfacePointMarkers.tsx`
- Modify: `apps/web/src/app/(dashboard)/projects/[projectId]/3d-view/page.tsx`

Interface points have `spatialX/Y/Z` fields in the DB but these are never used for positioning in the scene. Only anchor-based positioning works. Points without anchors are either filtered out (representative mode) or placed in a fallback grid (layout mode).

- [ ] **Step 1: Read InterfacePointMarkers to understand current positioning**

Read `packages/3d/src/components/InterfacePointMarkers.tsx`.

- [ ] **Step 2: Use spatialX/Y/Z when available in layout mode**

Update the layout mode positioning logic: if a point has `spatialX/Y/Z` set, position it there. Otherwise, fall back to the existing grid layout:

```tsx
// In layout mode positioning:
if (point.spatialX != null && point.spatialY != null && point.spatialZ != null) {
  position = [point.spatialX, point.spatialY, point.spatialZ];
} else {
  // existing fallback grid logic
  position = [fallbackX, 1, fallbackZ];
}
```

- [ ] **Step 3: Add drag-to-reposition in layout mode**

Use drei's `useDrag` or a click-to-place interaction so editors can manually position points in 3D space. When a point is repositioned, call `interfacePoint.update` with the new `spatialX/Y/Z` values.

This is a stretch goal — implement only the read side (use existing spatial coords) first.

- [ ] **Step 4: Verify build passes**

Run: `pnpm --filter @owit/web build`

- [ ] **Step 5: Commit**

```bash
git add packages/3d/src/components/InterfacePointMarkers.tsx
git commit -m "feat(3d): use spatial coordinates for interface point positioning"
```

---

## Task 3: Cable routing visualization

**Files:**
- Create: `packages/3d/src/components/assets/CableRoute.tsx`
- Modify: `packages/3d/src/components/WindFarmScene.tsx`
- Modify: `packages/3d/src/types.ts`
- Modify: `packages/db/src/schema.ts`
- Create migration for cable route data

Array cables and export cables are currently rendered as generic gray boxes. For an offshore wind interface tool, visualizing cable routes between assets is critical — many interface points exist at cable entry/exit locations.

- [ ] **Step 1: Define CableRoute type**

In `packages/3d/src/types.ts`:

```ts
export interface CableRoute {
  id: string;
  cableType: "array_cable" | "export_cable";
  fromAssetId: string;
  toAssetId: string;
  label: string;
  color?: string;
  waypoints?: [number, number, number][]; // optional intermediate points
}
```

- [ ] **Step 2: Create CableRoute component**

In `packages/3d/src/components/assets/CableRoute.tsx`, render a tube or line between two asset positions. Use drei's `<Line>` or `<QuadraticBezierLine>` for smooth cable paths:

```tsx
"use client";

import { Line } from "@react-three/drei";

interface CableRouteProps {
  from: [number, number, number];
  to: [number, number, number];
  color?: string;
  cableType: "array_cable" | "export_cable";
  waypoints?: [number, number, number][];
}

export function CableRoute({ from, to, color, cableType, waypoints = [] }: CableRouteProps) {
  const lineColor = color ?? (cableType === "export_cable" ? "#e11d48" : "#6366f1");
  const lineWidth = cableType === "export_cable" ? 3 : 2;
  
  // Build points array: from → waypoints → to
  // All cables run at seabed level (y = -0.3)
  const points: [number, number, number][] = [
    [from[0], -0.3, from[2]],
    ...waypoints.map(([x, , z]) => [x, -0.3, z] as [number, number, number]),
    [to[0], -0.3, to[2]],
  ];

  return (
    <Line
      points={points}
      color={lineColor}
      lineWidth={lineWidth}
      dashed={false}
    />
  );
}
```

- [ ] **Step 3: Add cable_routes table to schema**

In `packages/db/src/schema.ts`:

```ts
export const cableRoutes = pgTable("cable_routes", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  cableType: varchar("cable_type", { length: 20 }).notNull(), // "array_cable" | "export_cable"
  fromAssetId: uuid("from_asset_id").notNull().references(() => assetPlacements.id, { onDelete: "cascade" }),
  toAssetId: uuid("to_asset_id").notNull().references(() => assetPlacements.id, { onDelete: "cascade" }),
  label: varchar("label", { length: 255 }).notNull(),
  color: varchar("color", { length: 7 }),
  waypoints: json("waypoints").$type<[number, number, number][]>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

- [ ] **Step 4: Generate migration**

Run: `pnpm --filter @owit/db db:generate`

- [ ] **Step 5: Create cable route CRUD router**

Create `apps/web/src/server/routers/cable-route.ts` with `list`, `create`, `delete` procedures. Register it in `_app.ts`.

- [ ] **Step 6: Wire CableRoute rendering into WindFarmScene**

In layout mode, query cable routes for the project, resolve `fromAssetId`/`toAssetId` to positions, and render `<CableRoute>` components.

- [ ] **Step 7: Add "Add Cable" dialog in the 3d-view page**

Simple form: select fromAsset, toAsset, cableType, label.

- [ ] **Step 8: Verify build + tests pass**

- [ ] **Step 9: Commit**

```bash
git commit -m "feat(3d): add cable routing visualization between assets"
```

---

## Task 4: GLTF model validation and preview thumbnail

**Files:**
- Modify: `apps/web/src/server/routers/model-registry.ts`
- Create: `apps/web/src/components/model-preview.tsx`
- Modify: `apps/web/src/app/(dashboard)/projects/[projectId]/3d-view/page.tsx`

Currently, GLTF models are accepted without any validation. Users can't see a preview before or after upload. A model preview component would also be useful in the model registry sidebar.

- [ ] **Step 1: Create ModelPreview component**

A small R3F canvas that renders a GLTF model in isolation with auto-centering and auto-scaling. Use drei's `<Stage>` for simple studio-like rendering:

```tsx
"use client";

import dynamic from "next/dynamic";
import { Canvas } from "@react-three/fiber";
import { Stage, useGLTF } from "@react-three/drei";
import { Suspense } from "react";

function ModelScene({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  return (
    <Stage adjustCamera intensity={0.5}>
      <primitive object={scene.clone(true)} />
    </Stage>
  );
}

export function ModelPreview({ url, className }: { url: string; className?: string }) {
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
```

Use `dynamic(() => import(...)`, { ssr: false })` to wrap this for the page.

- [ ] **Step 2: Show preview after upload in model registry**

After a model is uploaded successfully, show the `ModelPreview` in the model registry sidebar/dialog.

- [ ] **Step 3: Add basic GLTF validation in completeUpload**

In `model-registry.ts` `completeUpload`, after confirming the file exists in storage, verify:
- File size > 0
- MIME type is `model/gltf-binary` or `model/gltf+json`
- File extension is `.glb` or `.gltf`

This is server-side validation. More advanced mesh validation would require parsing the GLTF, which is out of scope.

- [ ] **Step 4: Verify build passes**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(3d): add model preview component and upload validation"
```

---

## Task 5: Camera presets and persistence

**Files:**
- Modify: `packages/3d/src/components/WindFarmScene.tsx`
- Modify: `packages/3d/src/types.ts`
- Modify: `apps/web/src/app/(dashboard)/projects/[projectId]/3d-view/page.tsx`

Camera state resets on every page load. Users frequently need to return to the same viewpoint.

- [ ] **Step 1: Add camera preset buttons**

Create preset buttons in the 3D view toolbar:
- **Top-down** — camera at (0, 200, 0) looking down
- **Isometric** — camera at (100, 80, 100) looking at center
- **Side view** — camera at (200, 20, 0) looking at center
- **Fit all** — calculate bounding box of all assets and frame camera

Implement via `OrbitControls` ref:

```tsx
const controlsRef = useRef<any>(null);

function setCameraPreset(preset: "top" | "iso" | "side" | "fit") {
  const controls = controlsRef.current;
  if (!controls) return;
  // ... set target and position based on preset
  controls.update();
}
```

- [ ] **Step 2: Persist camera state in URL search params**

Store camera position/target in URL params so refresh preserves the view:

```
?cx=100&cy=80&cz=100&tx=0&ty=0&tz=0
```

Read on mount, write on orbit end (debounced).

- [ ] **Step 3: Verify build passes**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(3d): add camera presets and URL persistence"
```

---

## Task 6: Measurement tool

**Files:**
- Create: `packages/3d/src/components/MeasurementTool.tsx`
- Modify: `packages/3d/src/components/WindFarmScene.tsx`
- Modify: `apps/web/src/app/(dashboard)/projects/[projectId]/3d-view/page.tsx`

Interface managers need to measure distances between assets or anchor points.

- [ ] **Step 1: Create MeasurementTool component**

A two-click tool: click first point, click second point, show distance label floating at the midpoint.

```tsx
interface MeasurementToolProps {
  active: boolean;
  onMeasure?: (distance: number, from: [number, number, number], to: [number, number, number]) => void;
}
```

- Use raycasting to detect click positions on the scene.
- Render a dashed `<Line>` between the two points.
- Show distance label using drei's `<Html>` component at the midpoint.
- Support clearing measurements.

- [ ] **Step 2: Add "Measure" toggle button in toolbar**

Toggle the measurement mode on/off. When active, cursor changes to crosshair and clicks record measurement points instead of selecting assets.

- [ ] **Step 3: Show measurement results**

Display distance in meters (assuming scene units = meters). Show in the legend sidebar.

- [ ] **Step 4: Verify build passes**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(3d): add measurement tool for distance between points"
```

---

## Task 7: Frustum culling and performance optimization

**Files:**
- Modify: `packages/3d/src/components/WindFarmScene.tsx`
- Modify: `packages/3d/src/components/assets/GltfAsset.tsx`

For large wind farms (100+ turbines), rendering all assets regardless of camera visibility is wasteful.

- [ ] **Step 1: Enable frustum culling**

Three.js frustum culling is enabled by default on `Mesh` objects but can be defeated by complex group hierarchies. Ensure all asset groups have correct bounding boxes:

```tsx
// In each asset component, after creating the group:
useEffect(() => {
  if (groupRef.current) {
    groupRef.current.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.frustumCulled = true;
      }
    });
  }
}, []);
```

- [ ] **Step 2: Add distance-based LOD switching**

In `WindFarmScene`, calculate distance from camera to each asset and automatically set LOD:

```tsx
// Per frame (in useFrame hook):
assets.forEach(asset => {
  const distance = camera.position.distanceTo(assetPosition);
  if (distance > 500) lodLevel = 4;      // bounding box only
  else if (distance > 200) lodLevel = 3;  // simplified
  else if (distance > 100) lodLevel = 2;  // medium
  else lodLevel = 0;                       // full detail
});
```

- [ ] **Step 3: Add instance rendering for repeated assets**

Use drei's `<Instances>` for assets of the same type with the same model, reducing draw calls significantly:

```tsx
import { Instances, Instance } from "@react-three/drei";

// Group same-type procedural assets
<Instances>
  {turbineAssets.map(asset => (
    <Instance key={asset.id} position={[asset.positionX, asset.positionY, asset.positionZ]} />
  ))}
</Instances>
```

This is a stretch goal — only implement if performance issues are measured.

- [ ] **Step 4: Add performance stats toggle**

Add a debug toggle that shows drei's `<Stats>` component (FPS, draw calls, triangles).

- [ ] **Step 5: Verify build passes**

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(3d): add frustum culling and performance optimizations"
```

---

## Task 8: Custom anchor definitions per project

**Files:**
- Modify: `packages/db/src/schema.ts`
- Create migration
- Create: `apps/web/src/server/routers/anchor-catalog.ts`
- Modify: `packages/shared/src/asset-anchors.ts`
- Modify: `apps/web/src/app/(dashboard)/projects/[projectId]/3d-view/page.tsx`

Currently, anchors are hardcoded in `packages/shared/src/asset-anchors.ts`. Different projects may have different assets with different anchor points. Allow project-level anchor customization.

- [ ] **Step 1: Create custom_anchor_definitions table**

```ts
export const customAnchorDefinitions = pgTable("custom_anchor_definitions", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  assetType: varchar("asset_type", { length: 50 }).notNull(),
  key: varchar("key", { length: 50 }).notNull(),
  label: varchar("label", { length: 255 }).notNull(),
  positionX: doublePrecision("position_x").notNull(),
  positionY: doublePrecision("position_y").notNull(),
  positionZ: doublePrecision("position_z").notNull(),
  normalX: doublePrecision("normal_x"),
  normalY: doublePrecision("normal_y"),
  normalZ: doublePrecision("normal_z"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("custom_anchor_project_asset_key").on(table.projectId, table.assetType, table.key),
]);
```

- [ ] **Step 2: Create anchor-catalog router**

CRUD for custom anchors. `list` merges defaults + custom. `create` allows adding new anchors. `delete` only removes custom ones (not defaults).

- [ ] **Step 3: Update anchor validation in interface-point router**

The `set3dAnchor` mutation currently validates against the hardcoded catalog. Update it to also check custom anchors for the project.

- [ ] **Step 4: Update 3D view to load merged anchor catalog**

Query custom anchors, merge with defaults, pass to WindFarmScene.

- [ ] **Step 5: Add anchor editor UI**

In representative mode sidebar, add an "Edit Anchors" section where admins can add/remove/reposition anchors for the selected asset type.

- [ ] **Step 6: Verify build + tests pass**

- [ ] **Step 7: Commit**

```bash
git commit -m "feat(3d): support custom anchor definitions per project"
```

---

## Task 9: Asset layout import/export (Excel)

**Files:**
- Modify: `apps/web/src/app/(dashboard)/projects/[projectId]/3d-view/page.tsx`
- Modify: `apps/web/src/server/routers/asset-placement.ts`

Users managing large wind farms (60+ turbines) need to import asset positions from Excel/CSV rather than placing them one by one.

- [ ] **Step 1: Add export endpoint**

Add a `exportLayout` procedure that returns all asset placements as a JSON array. In the UI, convert to Excel using SheetJS (already in the project from Phase 4):

```ts
// Columns: label, assetType, positionX, positionY, positionZ, rotationY
```

- [ ] **Step 2: Add import endpoint**

Add an `importLayout` procedure that accepts a JSON array of placements and bulk-upserts them. Validate each row.

- [ ] **Step 3: Add import/export buttons in the 3D view**

"Export Layout" downloads Excel. "Import Layout" opens a file picker, reads Excel with SheetJS, and calls the import endpoint.

- [ ] **Step 4: Verify build passes**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(3d): add asset layout import/export via Excel"
```

---

## Priority Matrix

| Task | Priority | Effort | Impact | Dependencies |
|------|----------|--------|--------|-------------|
| 1. LOD rendering | P0 | Small | Medium | None |
| 2. Spatial fallback positioning | P0 | Small | High | None |
| 3. Cable routing | P1 | Large | High | Schema migration |
| 4. Model validation & preview | P1 | Medium | Medium | None |
| 5. Camera presets | P2 | Small | Medium | None |
| 6. Measurement tool | P2 | Medium | High | None |
| 7. Performance optimization | P2 | Medium | High | Task 1 |
| 8. Custom anchors | P1 | Large | High | Schema migration |
| 9. Layout import/export | P2 | Medium | High | None |

**Recommended execution order:** 1 → 2 → 5 → 4 → 3 → 8 → 6 → 7 → 9

Tasks 1, 2, 5 are quick wins that improve the existing experience. Tasks 3 and 8 are the most impactful for offshore wind interface management but require DB schema changes. Task 7 should be done after measuring actual performance with realistic data.

---

## Items NOT in this plan (future work)

- **Wave animation** — animated sea surface shader
- **Wind direction indicator** — compass rose and wind arrows
- **Turbine rotation animation** — spinning blade animation
- **Collision detection** — prevent overlapping asset placements
- **VR/AR mode** — WebXR support for immersive walkthroughs
- **Multi-user real-time** — cursor sharing and live editing
- **Point cloud import** — LiDAR scan overlay
- **Terrain/bathymetry** — seabed elevation map
- **Shadow study** — time-of-day shadow simulation
- **Markup/annotation** — 3D sticky notes on assets
