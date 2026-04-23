# Codex Prompt 3 — OSS Asset Overhaul + Cable Pull-In & Switchgear

## Context

This is OWIT (Offshore Wind Interface Tool), a Next.js 16 / React Three Fiber monorepo.

**Read `apps/web/AGENTS.md` before touching any Next.js files.**

**Scene scale:** 1 unit ≈ 6–7 m.

This prompt covers two things:
1. Overhauling the OSS (Offshore SubStation) procedural asset
2. Adding cable pull-in heads and switchgear as anchor-point indicators on the OSS and WTG tower base

---

## Task A — OSS Asset Overhaul

### Step 1 — Rewrite `packages/3d/src/components/assets/OSSAsset.tsx`

Read the existing file first.

The current OSS is a jacket + plain box. Replace it with a more realistic representation:

#### Jacket substructure
- 4 legs: cylinders, radius 0.35, splayed from (±3.5, 0, ±3.5) at waterline down to (±5.5, −14, ±5.5) at mudline. Use a `CylinderGeometry` with slant: create each leg as a group positioned at midpoint, rotated to angle.
- Two levels of X-bracing: at y = −5 and y = −10, 4 diagonal braces per level using thin cylinders (radius 0.1)
- Mudmat plates (flat boxes 1.5 × 0.15 × 1.5) at each leg base
- Color: jacket grey `#6B7280`

#### Cellar deck (lowest equipment deck)
- Box 11 × 0.4 × 11 at y = 0
- Color: `#9CA3AF`

#### Main deck
- Box 10 × 0.4 × 10 at y = 4
- Handrail suggestion: thin box frame around edge (0.05 × 0.8 × 10 on each side)

#### Equipment module layout on main deck (y = 4.2 to y = 9):
- **Transformer bays** (2): two box modules, 2.5 × 4 × 2.5, at [−2, 6.2, 0] and [2, 6.2, 0], color `#78716C`
- **HV switchgear room**: box 4 × 3 × 2 at [0, 5.7, −3], color `#94A3B8`
- **Control/LV room**: box 3 × 3 × 2.5 at [0, 5.7, 3], color `#94A3B8`
- **Diesel generator enclosure**: smaller box 1.5 × 2 × 1.5 at [3, 5.2, 3], color `#9CA3AF`
- **Living quarters / office**: box 2 × 3 × 3 at [−3, 5.7, 2], lighter color `#CBD5E1`

#### Helideck
- Octagonal platform at y = 12 (use CylinderGeometry with radialSegments 8, radius 3.5, height 0.15)
- "H" marking: two thin flat boxes forming the letter
- Support struts: 4 diagonal cylinders from deck edge down to main deck
- Color: dark grey `#374151`

#### Crane
- Pedestal: short thick cylinder at [3, 4.4, −3]
- Boom: long thin cylinder angled upward ~30° from pedestal, length 5 units
- Color: yellow `#F59E0B`

#### Cable deck / J-tube area
- Two cable pull-in racks visible on cellar deck (see Task B below)

Keep props compatible:
```tsx
interface Props {
  position: [number, number, number];
  rotationY?: number;
}
```
Named export: `export function OSSAsset(...)`.

### Step 2 — Update OSS anchor positions in `packages/shared/src/asset-anchors.ts`

The existing OSS anchors were based on the old simple geometry. Update them to match the new structure:

```ts
const ossAnchors = [
  { key: "jacket_leg_nw",     label: "Jacket Leg NW",      position: [-3.5, 0, -3.5] },
  { key: "jacket_leg_ne",     label: "Jacket Leg NE",      position: [3.5,  0, -3.5] },
  { key: "jacket_leg_sw",     label: "Jacket Leg SW",      position: [-3.5, 0,  3.5] },
  { key: "jacket_leg_se",     label: "Jacket Leg SE",      position: [3.5,  0,  3.5] },
  { key: "cable_deck",        label: "Cable Deck / J-Tube Area", position: [0, 0.5, 5] },
  { key: "hv_room",           label: "HV Switchgear Room", position: [0, 5.7, -3] },
  { key: "lv_room",           label: "LV / Control Room",  position: [0, 5.7, 3] },
  { key: "transformer_area",  label: "Transformer Bays",   position: [0, 6.2, 0] },
  { key: "helideck",          label: "Helideck",           position: [0, 12.2, 0] },
  { key: "crane",             label: "Crane Pedestal",     position: [3, 4.4, -3] },
];
```

---

## Task B — Cable Pull-In Head and Switchgear Indicators

These are not standalone asset types — they are visual indicators shown at specific anchor points when the user is in representative mode. Implement them as small indicative geometry added to `TurbineAsset` and `OSSAsset`.

### Cable pull-in head (on WTG tower base and OSS cable deck)

Add to `TurbineAsset` at the `cable_entry` position:
- A short horizontal cylinder (the bellmouth / pull-in tube), radius 0.18, length 0.6, pointing outward from the tower
- A termination head box (0.3 × 0.3 × 0.2) at the outer end
- Color: `#374151`

Add to `OSSAsset` at the cable deck: 2× pull-in bellmouth tubes on the south face of the cellar deck, slightly spaced apart.

### Switchgear visual indicator

Add to `OSSAsset` in the HV switchgear room area:
- A row of 3 vertical box "panel" shapes (0.3 × 1.5 × 0.1 each, spaced 0.4 apart) inside the HV room position to indicate GIS/switchgear bays
- Color: dark blue-grey `#1E3A5F`

Add a `switchgear_bay_1`, `switchgear_bay_2`, `switchgear_bay_3` anchor group to `ossAnchors`:
```ts
{ key: "switchgear_bay_1", label: "Switchgear Bay 1", position: [-0.6, 7.0, -3] },
{ key: "switchgear_bay_2", label: "Switchgear Bay 2", position: [0.0,  7.0, -3] },
{ key: "switchgear_bay_3", label: "Switchgear Bay 3", position: [0.6,  7.0, -3] },
```

### Step 3 — Build and test

```bash
pnpm --filter @owit/web build
pnpm --filter @owit/web test -- --run
```

### Step 4 — Commit

```bash
git add packages/3d/src/components/assets/OSSAsset.tsx packages/3d/src/components/assets/TurbineAsset.tsx packages/shared/src/asset-anchors.ts
git commit -m "feat(3d): overhaul OSS asset, add cable pull-in heads and switchgear indicators"
```
