# Codex Prompt 2 — WTG Asset Overhaul (Tower, Nacelle, Hub, Blades)

## Context

This is OWIT (Offshore Wind Interface Tool), a Next.js 16 / React Three Fiber monorepo.

**Read `apps/web/AGENTS.md` before touching any Next.js files.**

The current `TurbineAsset.tsx` is a rough placeholder: a plain cylinder tower, box nacelle, sphere hub, 3 box blades. It needs to be significantly more recognisable as an offshore wind turbine so the 3D view is credible in demos to industry customers.

**Scene scale:** 1 unit ≈ 6–7 m. Tower is 18 units tall ≈ 108 m. Keep this.

---

## Task

### Step 1 — Rewrite `packages/3d/src/components/assets/TurbineAsset.tsx`

Read the existing file first. Replace it with a more realistic procedural model built entirely from Three.js primitives. No external model files.

#### Tower
- Tapered cylinder: base radius 0.75 units, top radius 0.35 units, height 18 units, 16 segments
- Subtle door opening: a thin dark box (0.15 × 1.0 × 0.05) at tower base front face
- Color: off-white `#D8D8D8`, metallic-look roughness 0.4

#### Transition piece (between tower base and foundation)
- Short wider cylinder, radius 0.95, height 1.5 units, positioned at y = −9.5
- Flanged top ring: flat cylinder (radius 1.05, height 0.15) at top of TP
- Color: medium grey `#A0A0A0`

#### Nacelle
- Main body: box 3.0 × 1.2 × 1.4 (L × H × W) positioned at [0, 9.3, 0]
- Rear fairing: slightly tapered box behind main body
- Small ventilation boxes on top of nacelle
- Spinner fairing: elongated cone (ConeGeometry, pointing forward toward hub) at nacelle front
- Color: light grey `#CECECE`, roughness 0.35

#### Hub
- Sphere, radius 0.55, at [0, 9.3, 0.85] (front of nacelle)
- 3 blade root flanges: small flat cylinders (radius 0.25, height 0.1) radiating from hub at 120° intervals
- Color: darker grey `#B0B0B0`

#### Blades
Replace the box blades with more realistic aerofoil cross-section approximation:
- Use a `CylinderGeometry` with radiusTop 0.05, radiusBottom 0.4, height 8, radialSegments 6 (gives a tapered profile)
- Twist each blade slightly: `rotation.x = 0.15`
- 3 blades at 120° intervals, extending outward from hub
- Color: white `#EFEFEF`, roughness 0.3

#### Lightning protection rod
- Thin cylinder on top of nacelle, height 0.8, radius 0.025

#### Props interface (keep compatible with existing usage):
```tsx
interface Props {
  position: [number, number, number];
  rotationY?: number;
  label?: string;
}
```

The component must still be a named export: `export function TurbineAsset(...)`.

### Step 2 — Verify anchor positions still match

Read `packages/shared/src/asset-anchors.ts`. The turbine anchor positions are in the coordinate space of `TurbineAsset` — they assume the group is positioned at the given `position` prop. Verify the following anchors still make sense with the new geometry:

- `tower_base` [0, 0.2, 0] — should be at bottom of tower, just above TP. **If the TP was at y = −9 before, adjust to match new TP position.**
- `yaw_system` [0, 9.4, 0] — should be at nacelle yaw bearing. Check new nacelle y.
- `nacelle` [0.7, 10, 0] — nacelle body centre.
- `hub` [0, 10, 0.8] — hub centre.
- `cable_entry` [0, 0.6, −0.5] — cable entry at tower base.

If any anchor positions are now clearly wrong (more than 0.5 units off the geometry), update them in `asset-anchors.ts`. Add a comment explaining the coordinate assumptions.

### Step 3 — Build and test

```bash
pnpm --filter @owit/web build
pnpm --filter @owit/web test -- --run
```

All 32 existing tests must pass.

### Step 4 — Commit

```bash
git add packages/3d/src/components/assets/TurbineAsset.tsx packages/shared/src/asset-anchors.ts
git commit -m "feat(3d): overhaul WTG procedural asset with realistic tower, nacelle, and blades"
```
