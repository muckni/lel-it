const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

function envEnabled(value: string | undefined, defaultValue = false) {
  if (value == null) return defaultValue;
  return TRUE_VALUES.has(value.toLowerCase());
}

export const featureFlags = {
  threeDModelRegistry: envEnabled(process.env.NEXT_PUBLIC_FF_THREED_MODEL_REGISTRY, true),
  threeDRepresentativeMode: envEnabled(
    process.env.NEXT_PUBLIC_FF_THREED_REPRESENTATIVE_MODE,
    true
  ),
};
