export const DEMAND_DELIVERY_CATEGORIES = [
  "material",
  "video",
  "mixed",
  "excluded",
] as const;

export type DemandDeliveryCategory = (typeof DEMAND_DELIVERY_CATEGORIES)[number];

type DemandTypeLike = {
  code?: string | null;
  name?: string | null;
  config?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function normalizeDemandDeliveryCategory(
  value: unknown,
): DemandDeliveryCategory | null {
  return typeof value === "string" &&
    DEMAND_DELIVERY_CATEGORIES.includes(value as DemandDeliveryCategory)
    ? (value as DemandDeliveryCategory)
    : null;
}

export function resolveDemandTypeDeliveryCategory(
  demandType?: DemandTypeLike | null,
): DemandDeliveryCategory | null {
  const config = asRecord(demandType?.config);
  const configuredCategory = normalizeDemandDeliveryCategory(config?.deliveryCategory);
  if (configuredCategory) {
    return configuredCategory;
  }

  // Compatibility fallback for deployments that have not populated demand_types.config yet.
  const identity = `${demandType?.code || ""} ${demandType?.name || ""}`.trim().toLowerCase();
  if (
    identity.includes("video") ||
    identity.includes("\u89c6\u9891") ||
    identity.includes("\u526a\u8f91")
  ) {
    return "video";
  }
  if (
    identity.includes("graphic") ||
    identity.includes("campaign") ||
    identity.includes("ui_design") ||
    identity.includes("\u7d20\u6750") ||
    identity.includes("banner") ||
    identity.includes("\u8bbe\u8ba1")
  ) {
    return "material";
  }
  return null;
}

export function isDepartmentDemandTypeRequired(
  departmentConfig: unknown,
  departmentSlug?: string | null,
  departmentName?: string | null,
): boolean {
  const config = asRecord(departmentConfig);
  const demandTypes = asRecord(config?.demandTypes);

  if (typeof demandTypes?.required === "boolean") {
    return demandTypes.required;
  }
  if (typeof config?.requireDemandType === "boolean") {
    return config.requireDemandType;
  }
  if (typeof config?.demandTypeRequired === "boolean") {
    return config.demandTypeRequired;
  }

  // Creative must remain protected even if an older environment misses the config backfill.
  return (
    (departmentSlug || "").trim().toLowerCase() === "creative" ||
    (departmentName || "").includes("\u521b\u610f")
  );
}
