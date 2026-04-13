export const FOCUSED_ASSET_TYPES = [
  "turbine",
  "oss",
  "monopile",
  "monopile_tpless",
  "jacket",
  "tripod",
  "pinpile",
] as const;
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

const monopileAnchors = [
  { key: "tower_base", label: "Tower Base", position: [0, 2.5, 0] as [number, number, number] },
  { key: "j_tube_entry", label: "J-tube Entry", position: [1.0, -7, 0] as [number, number, number] },
  { key: "cable_hang_off", label: "Cable Hang-off", position: [0.8, 1.8, 0] as [number, number, number] },
] as const satisfies readonly AssetAnchorDefinition[];

const tplessAnchors = [
  { key: "tower_base", label: "Tower Base", position: [0, 0.4, 0] as [number, number, number] },
  { key: "grouted_collar", label: "Grouted Collar", position: [0, 0.2, 0] as [number, number, number] },
  { key: "pile_above_water", label: "Pile Above Waterline", position: [0, -0.8, 0] as [number, number, number] },
] as const satisfies readonly AssetAnchorDefinition[];

const jacketAnchors = [
  { key: "tp_flange", label: "TP Flange", position: [0, 3.2, 0] as [number, number, number] },
  { key: "cable_j_tube", label: "Cable J-tube", position: [1.5, -8, 0] as [number, number, number] },
  { key: "anode_cluster", label: "Anode Cluster", position: [1.0, -4, 0] as [number, number, number] },
] as const satisfies readonly AssetAnchorDefinition[];

const tripodAnchors = [
  { key: "tp_flange", label: "TP Flange", position: [0, 4, 0] as [number, number, number] },
  { key: "cable_j_tube", label: "Cable J-tube", position: [1.2, -6, 0] as [number, number, number] },
] as const satisfies readonly AssetAnchorDefinition[];

const pinpileAnchors = [
  { key: "frame_top", label: "Frame Top", position: [0, 0, 0] as [number, number, number] },
  { key: "pile_nw", label: "Pile NW", position: [-1.5, -3, -1.5] as [number, number, number] },
  { key: "pile_ne", label: "Pile NE", position: [1.5, -3, -1.5] as [number, number, number] },
  { key: "pile_sw", label: "Pile SW", position: [-1.5, -3, 1.5] as [number, number, number] },
  { key: "pile_se", label: "Pile SE", position: [1.5, -3, 1.5] as [number, number, number] },
] as const satisfies readonly AssetAnchorDefinition[];

export const ASSET_ANCHOR_CATALOG = {
  turbine: turbineAnchors,
  oss: ossAnchors,
  monopile: monopileAnchors,
  monopile_tpless: tplessAnchors,
  jacket: jacketAnchors,
  tripod: tripodAnchors,
  pinpile: pinpileAnchors,
} as const;

type Catalog = typeof ASSET_ANCHOR_CATALOG;
export type AssetAnchorKey = Catalog[keyof Catalog][number]["key"];

export type AnchorDefinition = {
  id?: string;
  key: string;
  label: string;
  assetType: string;
  position: [number, number, number];
  normal?: [number, number, number];
  isCustom: boolean;
};

export function mergeAnchors(
  defaults: typeof ASSET_ANCHOR_CATALOG,
  custom: Array<{ id: string; key: string; label: string; assetType: string; positionX: number; positionY: number; positionZ: number; normalX?: number | null; normalY?: number | null; normalZ?: number | null }>
): AnchorDefinition[] {
  const result: AnchorDefinition[] = Object.entries(defaults).flatMap(([assetType, anchors]) =>
    anchors.map(a => ({ key: a.key, label: a.label, assetType, position: a.position as [number, number, number], isCustom: false }))
  );
  for (const c of custom) {
    result.push({
      id: c.id,
      key: c.key,
      label: c.label,
      assetType: c.assetType,
      position: [c.positionX, c.positionY, c.positionZ],
      normal: c.normalX != null && c.normalY != null && c.normalZ != null ? [c.normalX, c.normalY, c.normalZ] : undefined,
      isCustom: true,
    });
  }
  return result;
}

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
