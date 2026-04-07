import { type DepartmentDemandRules, type StatusConfig } from "../types";

const DEFAULT_UNASSIGNED_STATUS = "unassigned";
const DEFAULT_ASSIGNED_STATUS = "pending";

function pickString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function resolveDepartmentDemandRules(
  config: unknown,
  departmentSlug?: string | null,
): DepartmentDemandRules {
  const root =
    config && typeof config === "object" ? (config as Record<string, unknown>) : {};
  const nested =
    root.demandRules && typeof root.demandRules === "object"
      ? (root.demandRules as Record<string, unknown>)
      : root;

  const slugRequiresLeaderAssignment = (departmentSlug || "").toLowerCase() === "design";
  const requireLeaderAssignment =
    nested.requireLeaderAssignment === true ||
    nested.allowRequesterAssign === false ||
    slugRequiresLeaderAssignment;
  const allowRequesterAssign =
    nested.allowRequesterAssign === false ? false : !requireLeaderAssignment;

  return {
    requireLeaderAssignment,
    allowRequesterAssign,
    unassignedStatus: pickString(nested.unassignedStatus) || DEFAULT_UNASSIGNED_STATUS,
    assignedDefaultStatus: pickString(nested.assignedDefaultStatus) || DEFAULT_ASSIGNED_STATUS,
  };
}

export function resolveAssignedStatusValue(
  rules: DepartmentDemandRules | null | undefined,
  statuses?: StatusConfig[] | null,
): string {
  const preferred = pickString(rules?.assignedDefaultStatus) || DEFAULT_ASSIGNED_STATUS;
  if (!statuses || statuses.length === 0) {
    return preferred;
  }

  const byPreferred = statuses.find((status) => status.value === preferred);
  if (byPreferred) {
    return byPreferred.value;
  }

  const firstOperational = statuses.find(
    (status) => status.value !== (rules?.unassignedStatus || DEFAULT_UNASSIGNED_STATUS),
  );

  return firstOperational?.value || preferred;
}
