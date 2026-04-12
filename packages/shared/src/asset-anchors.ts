export const FOCUSED_ASSET_TYPES = ["turbine", "oss"] as const;
export type FocusedAssetType = (typeof FOCUSED_ASSET_TYPES)[number];

export interface AssetAnchorDefinition {
  key: string;
  label: string;
  position: [number, number, number];
  normal?: [number, number, number];
}

const turbineAnchors = [
  { key: "tower_base", label: "Tower Base", position: [0, 0.2, 0] as [number, number, number] },
  { key: "transition_piece", label: "Transition Piece", position: [0, 2.5, 0] as [number, number, number] },
  { key: "tower_mid", label: "Tower Mid", position: [0, 6, 0] as [number, number, number] },
  { key: "yaw_system", label: "Yaw System", position: [0, 9.4, 0] as [number, number, number] },
  { key: "nacelle", label: "Nacelle", position: [0.7, 10, 0] as [number, number, number] },
  { key: "hub", label: "Hub", position: [0, 10, 0.8] as [number, number, number] },
  { key: "blade_root_a", label: "Blade Root A", position: [0, 13, 0.8] as [number, number, number] },
  { key: "blade_root_b", label: "Blade Root B", position: [2.6, 8.7, 0.8] as [number, number, number] },
  { key: "blade_root_c", label: "Blade Root C", position: [-2.6, 8.7, 0.8] as [number, number, number] },
  { key: "cable_entry", label: "Cable Entry", position: [0, 0.6, -0.5] as [number, number, number] },
] as const satisfies readonly AssetAnchorDefinition[];

const ossAnchors = [
  { key: "jacket_leg_nw", label: "Jacket Leg NW", position: [-2, -1.5, -2] as [number, number, number] },
  { key: "jacket_leg_ne", label: "Jacket Leg NE", position: [2, -1.5, -2] as [number, number, number] },
  { key: "jacket_leg_sw", label: "Jacket Leg SW", position: [-2, -1.5, 2] as [number, number, number] },
  { key: "jacket_leg_se", label: "Jacket Leg SE", position: [2, -1.5, 2] as [number, number, number] },
  { key: "cable_deck", label: "Cable Deck", position: [0, 5.5, 3] as [number, number, number] },
  { key: "hv_room", label: "HV Room", position: [1.4, 8.2, 1.2] as [number, number, number] },
  { key: "lv_room", label: "LV Room", position: [-1.2, 8.2, 1.2] as [number, number, number] },
  { key: "control_room", label: "Control Room", position: [0, 9.4, -1.6] as [number, number, number] },
  { key: "transformer_area", label: "Transformer Area", position: [0, 8.2, 0] as [number, number, number] },
  { key: "helideck", label: "Helideck", position: [-1, 12.2, 0] as [number, number, number] },
] as const satisfies readonly AssetAnchorDefinition[];

export const ASSET_ANCHOR_CATALOG = {
  turbine: turbineAnchors,
  oss: ossAnchors,
} as const;

type Catalog = typeof ASSET_ANCHOR_CATALOG;
export type AssetAnchorKey = Catalog[keyof Catalog][number]["key"];

export function isValidAnchorForAssetType(
  assetType: FocusedAssetType,
  anchorKey: string
): anchorKey is AssetAnchorKey {
  return ASSET_ANCHOR_CATALOG[assetType].some((anchor) => anchor.key === anchorKey);
}

export function getAnchorLabel(
  assetType: FocusedAssetType | null | undefined,
  anchorKey: string | null | undefined
) {
  if (!assetType || !anchorKey) return null;
  const anchor = ASSET_ANCHOR_CATALOG[assetType].find((entry) => entry.key === anchorKey);
  return anchor?.label ?? null;
}
