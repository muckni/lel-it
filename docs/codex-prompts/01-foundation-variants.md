# Codex Prompt 1 — Foundation Variant Asset Components

## Context

This is OWIT (Offshore Wind Interface Tool), a Next.js 16 / React Three Fiber monorepo.

**Read `apps/web/AGENTS.md` before touching any Next.js files.**

The 3D scene (`packages/3d`) has a layout mode (bird's-eye wind farm) and a representative mode (single close-up asset). Assets are rendered by `AssetRenderer` in `packages/3d/src/components/WindFarmScene.tsx`. Currently, the `"foundation"` asset type always renders `FoundationAsset` — a simple monopile with transition piece. We need 5 distinct foundation variants as separate R3F components.

**Scene scale:** 1 unit ≈ 6–7 m real-world. The tower in `TurbineAsset.tsx` is 18 units tall ≈ 108 m. Use this scale for all geometry.

---

## Task

### Step 1 — Create 5 new foundation asset components

All files go in `packages/3d/src/components/assets/`.

**Read `packages/3d/src/components/assets/FoundationAsset.tsx` first** to understand the existing component pattern.

---

#### `MonopileAsset.tsx` — Standard monopile + transition piece

Replaces the current `FoundationAsset`. Monopile: large diameter steel cylinder (diameter ≈ 1.2 units) extending from seabed (y = −10) up through waterline. Transition piece: slightly wider tapered cylinder above waterline (y 0 to y 2.5), with a prominent bolted flange ring at top. Boat landing rungs (thin boxes) on one side. J-tube (small cylinder) running along the outside from seabed to just above TP. Color: monopile = rusty brown `#7A5C3A`, TP = steel grey `#909090`.

Attachment points (match anchor keys in `asset-anchors.ts`):
- `tower_base` at [0, 2.5, 0] (top of TP flange)
- `j_tube_entry` at [1.0, −7, 0] (J-tube seabed entry)
- `cable_hang_off` at [0.8, 1.8, 0] (cable termination on TP)

---

#### `MonopileTPlessAsset.tsx` — TP-less monopile (direct drive-in, grouted connection)

Same monopile pile but no separate transition piece — tower bolts directly onto the pile top via a grouted connection collar. The collar is a short wide ring at y 0. More slender than the standard MP above waterline. No boat landing rungs (they bolt to the tower instead).

---

#### `JacketFoundationAsset.tsx` — 3-legged or 4-legged jacket

4-legged lattice jacket: 4 main legs (thin cylinders, slightly splayed outward) from seabed (y = −12) converging to a transition node deck at y = 3. Add X-bracing between legs at two elevation levels using thin cylinders. Mudmat plates (flat boxes) at each leg base. Grouted leg pile sleeves at mudline. Color: jacket steel `#6B7280`, bracing `#5B6370`, mudmats `#5A4A3A`.

Attachment points:
- `tp_flange` at [0, 3.2, 0]
- `cable_j_tube` at [1.5, −8, 0]
- `anode_cluster` at [1.0, −4, 0]

---

#### `TripodAsset.tsx` — Tripod foundation

3-legged structure: central pile/column (large cylinder, y −8 to y 4) with 3 diagonal brace arms extending outward at ~45° down to driven piles at seabed. Each pile sleeve is a short wide cylinder. Cross bracing between brace arms. Distinctive "spider" shape when viewed from above.

Attachment points:
- `tp_flange` at [0, 4.0, 0]
- `cable_j_tube` at [1.2, −6, 0]

---

#### `PinpileCapAsset.tsx` — Pin-pile cluster with levelling frame

Used for jackets or floating platform mooring. A square levelling frame (flat box, y −0.5 to 0) with 4 pin piles (smaller cylinders, ~0.3 unit diameter) driven straight down from the frame corners. The levelling frame has grout lines indicated as thin box outlines. This asset sits at seabed level — position it with positionY such that the top of the frame is at y = 0.

Attachment points:
- `frame_top` at [0, 0, 0]
- `pile_nw` at [−1.5, −3, −1.5]
- `pile_ne` at [1.5, −3, −1.5]
- `pile_sw` at [−1.5, −3, 1.5]
- `pile_se` at [1.5, −3, 1.5]

---

### Step 2 — Add foundation variant to AssetPlacement metadata

The `assetPlacements` table already has a `metadata jsonb` column. No schema migration is needed.

In `packages/3d/src/types.ts`, extend `AssetPlacement` to read a `foundationVariant` field from metadata:

```ts
// In AssetPlacement interface, add:
foundationVariant?: "monopile" | "monopile_tpless" | "jacket" | "tripod" | "pinpile" | null;
```

The page already passes `metadata` through the asset object — check `apps/web/src/app/(dashboard)/projects/[projectId]/3d-view/page.tsx` for how assets are queried and mapped. If `metadata` isn't already forwarded, add it to the mapped asset object:

```ts
foundationVariant: (a.metadata as Record<string, unknown>)?.foundationVariant as AssetPlacement["foundationVariant"] ?? null,
```

### Step 3 — Update `AssetRenderer` in `WindFarmScene.tsx`

Replace the current `case "foundation":` branch with variant-aware rendering:

```tsx
case "foundation": {
  const variant = a.foundationVariant;
  if (variant === "monopile_tpless")
    return <MonopileTPlessAsset key={a.id} position={pos} rotationY={a.rotationY} />;
  if (variant === "jacket")
    return <JacketFoundationAsset key={a.id} position={pos} rotationY={a.rotationY} />;
  if (variant === "tripod")
    return <TripodAsset key={a.id} position={pos} rotationY={a.rotationY} />;
  if (variant === "pinpile")
    return <PinpileCapAsset key={a.id} position={pos} rotationY={a.rotationY} />;
  // default: standard monopile with TP
  return <MonopileAsset key={a.id} position={pos} rotationY={a.rotationY} />;
}
```

Import all new components at the top of `WindFarmScene.tsx`.

### Step 4 — Update "Add Asset" form to allow selecting foundation variant

In `apps/web/src/app/(dashboard)/projects/[projectId]/3d-view/page.tsx`:

1. Add `foundationVariant` to the `addAssetSchema` as optional:
   ```ts
   foundationVariant: z.enum(["monopile","monopile_tpless","jacket","tripod","pinpile"]).optional(),
   ```
2. When `assetType === "foundation"` is selected in the Add Asset dialog, show a "Foundation type" select dropdown with options: Monopile (default), Monopile TP-less, Jacket, Tripod, Pin-pile cluster.
3. On submit, include `foundationVariant` in the `metadata` field passed to the `create` mutation:
   ```ts
   metadata: values.assetType === "foundation" && values.foundationVariant
     ? { foundationVariant: values.foundationVariant }
     : undefined,
   ```
   Check `asset-placement.ts` router to confirm `metadata` is accepted in the `create` input — if not, add it as `metadata: z.record(z.unknown()).optional()`.

### Step 5 — Update anchor catalog in `packages/shared/src/asset-anchors.ts`

Add anchor arrays for the new variants and add them to `ASSET_ANCHOR_CATALOG`:

```ts
export const ASSET_ANCHOR_CATALOG = {
  turbine: turbineAnchors,
  oss: ossAnchors,
  monopile: monopileAnchors,        // new
  monopile_tpless: tplessAnchors,   // new
  jacket: jacketAnchors,            // new
  tripod: tripodAnchors,            // new
  pinpile: pinpileAnchors,          // new
} as const;
```

Also update `FOCUSED_ASSET_TYPES` and `FocusedAssetType` to include the new foundation variants so they can be selected in representative mode.

### Step 6 — Build and test

```bash
pnpm --filter @owit/web build
pnpm --filter @owit/web test -- --run
```

Fix any TypeScript errors. All 32 existing tests must still pass.

### Step 7 — Commit

```bash
git add packages/3d/src/components/assets/ packages/3d/src/components/WindFarmScene.tsx packages/3d/src/types.ts packages/shared/src/asset-anchors.ts apps/web/src/app/(dashboard)/projects/[projectId]/3d-view/page.tsx apps/web/src/server/routers/asset-placement.ts
git commit -m "feat(3d): add foundation variant assets (monopile, TP-less, jacket, tripod, pin-pile)"
```
