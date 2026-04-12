import { describe, expect, it } from "vitest";
import {
  ASSET_ANCHOR_CATALOG,
  isValidAnchorForAssetType,
} from "@owit/shared";

describe("asset anchor catalog", () => {
  it("keeps unique anchor keys for each focused asset type", () => {
    for (const assetType of ["turbine", "oss"] as const) {
      const keys = ASSET_ANCHOR_CATALOG[assetType].map((anchor) => anchor.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it("contains required turbine and oss anchor keys", () => {
    const turbineKeys = ASSET_ANCHOR_CATALOG.turbine.map((anchor) => anchor.key);
    const ossKeys = ASSET_ANCHOR_CATALOG.oss.map((anchor) => anchor.key);

    expect(turbineKeys).toEqual(
      expect.arrayContaining([
        "tower_base",
        "transition_piece",
        "tower_mid",
        "yaw_system",
        "nacelle",
        "hub",
        "blade_root_a",
        "blade_root_b",
        "blade_root_c",
        "cable_entry",
      ])
    );
    expect(ossKeys).toEqual(
      expect.arrayContaining([
        "jacket_leg_nw",
        "jacket_leg_ne",
        "jacket_leg_sw",
        "jacket_leg_se",
        "cable_deck",
        "hv_room",
        "lv_room",
        "control_room",
        "transformer_area",
        "helideck",
      ])
    );
  });

  it("validates key membership by asset type", () => {
    expect(isValidAnchorForAssetType("turbine", "tower_base")).toBe(true);
    expect(isValidAnchorForAssetType("oss", "tower_base")).toBe(false);
    expect(isValidAnchorForAssetType("oss", "helideck")).toBe(true);
  });
});
