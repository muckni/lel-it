const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

function envEnabled(value: string | undefined, defaultValue = false) {
  if (value == null) return defaultValue;
  return TRUE_VALUES.has(value.toLowerCase());
}

export const featureFlags = {
  interfaceComplianceV2: envEnabled(process.env.NEXT_PUBLIC_FF_INTERFACE_COMPLIANCE_V2, true),
  interfaceMatrixGeneration: envEnabled(
    process.env.NEXT_PUBLIC_FF_INTERFACE_MATRIX_GENERATION,
    true
  ),
  interfaceTrackerImport: envEnabled(process.env.NEXT_PUBLIC_FF_INTERFACE_TRACKER_IMPORT, true),
  interfaceWorkspaceV2: envEnabled(process.env.NEXT_PUBLIC_FF_INTERFACE_WORKSPACE_V2, true),
  threeDModelRegistry: envEnabled(process.env.NEXT_PUBLIC_FF_THREED_MODEL_REGISTRY, true),
  threeDRepresentativeMode: envEnabled(
    process.env.NEXT_PUBLIC_FF_THREED_REPRESENTATIVE_MODE,
    true
  ),
};
