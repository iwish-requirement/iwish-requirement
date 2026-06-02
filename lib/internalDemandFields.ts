const DEFAULT_SCHEDULED_DATE_FIELD_KEY = "scheduled_start_date";

type DepartmentLike = {
  slug?: string | null;
  name?: string | null;
  config?: unknown;
};

function pickString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed || null;
}

function getStatsConfig(config: unknown): Record<string, unknown> {
  if (!config || typeof config !== "object") {
    return {};
  }
  const root = config as Record<string, unknown>;
  if (root.stats && typeof root.stats === "object") {
    return root.stats as Record<string, unknown>;
  }
  if (root.statsConfig && typeof root.statsConfig === "object") {
    return root.statsConfig as Record<string, unknown>;
  }
  return {};
}

function isCreativeDepartment(department: DepartmentLike | null | undefined): boolean {
  const identity = `${department?.slug || ""} ${department?.name || ""}`.toLowerCase();
  return identity.includes("design") || identity.includes("creative") || identity.includes("创意");
}

export function getDepartmentScheduledDateFieldKey(
  department: DepartmentLike | null | undefined,
): string | null {
  const statsConfig = getStatsConfig(department?.config);
  return (
    pickString(statsConfig.scheduledDateFieldKey) ||
    pickString(statsConfig.scheduledFieldKey) ||
    (isCreativeDepartment(department) ? DEFAULT_SCHEDULED_DATE_FIELD_KEY : null)
  );
}

export function getInternalDemandFieldKeys(
  department: DepartmentLike | null | undefined,
): string[] {
  const scheduledDateFieldKey = getDepartmentScheduledDateFieldKey(department);
  return scheduledDateFieldKey ? [scheduledDateFieldKey] : [];
}

export function sanitizeRequesterCustomFields(
  customFields: Record<string, any>,
  department: DepartmentLike | null | undefined,
): Record<string, any> {
  const internalKeys = new Set(getInternalDemandFieldKeys(department));
  if (!internalKeys.size) {
    return customFields;
  }

  const sanitized = { ...customFields };
  for (const key of internalKeys) {
    delete sanitized[key];
  }
  return sanitized;
}

export function findInternalDemandFieldKeysInPayload(
  customFields: Record<string, any> | undefined,
  department: DepartmentLike | null | undefined,
): string[] {
  if (!customFields) {
    return [];
  }
  const internalKeys = new Set(getInternalDemandFieldKeys(department));
  return Object.keys(customFields).filter((key) => internalKeys.has(key));
}
