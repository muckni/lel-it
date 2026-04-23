# Codex Prompt 4 — Cable Visualization (Array, Export, Pull-In) + Scene Polish

## Context

This is OWIT (Offshore Wind Interface Tool), a Next.js 16 / React Three Fiber monorepo.

**Read `apps/web/AGENTS.md` before touching any Next.js files.**

**Scene scale:** 1 unit ≈ 6–7 m.

The `CableRoute` component in `packages/3d/src/components/assets/CableRoute.tsx` renders cables as straight or waypointed lines at y = −0.3 (seabed). This prompt improves the cable visuals and adds a pull-in cable visualization connecting the seabed route up to the tower entry point on each asset.

---

## Task A — Improve CableRoute component

### Step 1 — Read existing CableRoute

Read `packages/3d/src/components/assets/CableRoute.tsx` and `packages/3d/src/types.ts`.

### Step 2 — Add catenary-style cable curve

Instead of straight lines, cables should sag slightly (catenary drape). Use `@react-three/drei`'s `CatmullRomLine` (or `QuadraticBezierLine`) to create a gentle sag:

```tsx
import { CatmullRomLine } from "@react-three/drei";

// Add a midpoint sag: compute midpoint between from and to, lower it by 0.5 units
const mid: [number, number, number] = [
  (from[0] + to[0]) / 2,
  Math.min(from[1], to[1]) - 0.5,
  (from[2] + to[2]) / 2,
];

// Build points: from → any waypoints → mid (if no waypoints) → to
// All at y = -0.3 except the sag mid
```

Keep the same `CableRouteProps` interface — this is purely a visual change.

### Step 3 — Improve cable visual weight

- Array cable: `lineWidth` 2, color `#6366f1` (indigo), slightly transparent
- Export cable: `lineWidth` 4, color `#DC2626` (red), solid
- Add a subtle glow effect for export cables: render the same line twice — once at full width, once at 1.5× width with 30% opacity (gives a soft bloom effect in software rendering)

### Step 4 — Add J-tube riser on each asset endpoint

Where the cable route starts/ends at an asset, draw a short curved riser from seabed level (y = −0.3) up the outside of the foundation to the cable entry point at the tower base (y ≈ 0.5). Use a `QuadraticBezierLine` curving from [asset.x, −0.3, asset.z] up to the `cable_entry` anchor position on the asset.

This riser should only draw when there is at least one cable route connected to this asset. Pass an optional `hasCableRiser?: boolean` prop to the asset components.

In `WindFarmScene.tsx`, after resolving cable routes, check which asset IDs appear as `fromAssetId` or `toAssetId` in cable routes, and pass `hasCableRiser={true}` to those `TurbineAsset` / foundation asset components.

### Step 5 — Update `WindFarmScene.tsx` to pass hasCableRiser

Read `packages/3d/src/components/WindFarmScene.tsx` and find the `AssetRenderer` function. Compute a `Set<string>` of asset IDs that are cable endpoints:

```tsx
const cabledAssetIds = new Set(
  (cableRoutes ?? []).flatMap(r => [r.fromAssetId, r.toAssetId])
);
```

Pass `hasCableRiser={cabledAssetIds.has(a.id)}` to `TurbineAsset` and all foundation variant components. Update their Props interfaces to accept `hasCableRiser?: boolean`.

---

## Task B — Scene Environment Polish

### Step 6 — Improve sea surface

Read the current sea plane in `WindFarmScene.tsx`. Replace the plain semi-transparent blue plane with:

```tsx
// Animated sea — gentle wave effect using vertex displacement in useFrame
// Keep it simple: use a PlaneGeometry with enough segments (50×50) and
// animate vertex Y positions using a sine wave pattern
function SeaSurface() {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const geo = mesh.geometry as THREE.BufferGeometry;
    const pos = geo.attributes.position;
    const t = clock.elapsedTime * 0.4;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, Math.sin(x * 0.3 + t) * 0.1 + Math.sin(z * 0.4 + t * 0.7) * 0.08);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
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
```

### Step 7 — Add seabed plane

A dark sandy seabed plane at y = −12 (below the foundations):

```tsx
<mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -12, 0]}>
  <planeGeometry args={[400, 400]} />
  <meshStandardMaterial color="#5C4A2A" roughness={0.9} />
</mesh>
```

### Step 8 — Improve ambient lighting

Read current lighting setup in `WindFarmScene.tsx`. Replace or supplement with:

```tsx
<ambientLight intensity={0.4} />
<directionalLight
  position={[50, 100, 50]}
  intensity={1.2}
  castShadow
  shadow-mapSize={[2048, 2048]}
/>
{/* Soft fill light from below (light reflected from sea) */}
<hemisphereLight skyColor="#87CEEB" groundColor="#1E40AF" intensity={0.3} />
```

### Step 9 — Build and test

```bash
pnpm --filter @owit/web build
pnpm --filter @owit/web test -- --run
```

### Step 10 — Commit

```bash
git add packages/3d/src/components/assets/CableRoute.tsx packages/3d/src/components/assets/TurbineAsset.tsx packages/3d/src/components/WindFarmScene.tsx
git commit -m "feat(3d): catenary cables, J-tube risers, animated sea surface, improved lighting"
```

---

## Important Notes

- Do NOT install new npm packages. All tools used (`CatmullRomLine`, `QuadraticBezierLine`, `useFrame`) are already available from `@react-three/drei` and `@react-three/fiber`.
- The animated sea surface adds `useFrame` — check it doesn't conflict with the existing `useFrame` in `AssetRenderer`. Use separate components to avoid conflicts.
- Keep the seabed and sea surface outside the `Suspense` boundary (they use no async resources).
- `castShadow` on the directional light requires `shadows` prop on the `<Canvas>` — add `shadows` to the Canvas in `WindFarmScene.tsx` if not already present.
