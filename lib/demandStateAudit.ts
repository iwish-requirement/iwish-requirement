export const DEMAND_STATE_AUDIT_FIELDS = [
  "status",
  "assignee_id",
  "assigned_at",
  "started_at",
  "finished_at",
  "closed_at",
  "delayed_at",
] as const;

export type DemandStateAuditField = (typeof DEMAND_STATE_AUDIT_FIELDS)[number];

export type DemandStateSnapshot = Partial<Record<DemandStateAuditField, unknown>>;

export type AuditFieldChange = {
  before: unknown;
  after: unknown;
};

function normalizeAuditValue(value: unknown): unknown {
  return value === undefined ? null : value;
}

export function buildDemandStateChangedFields(
  before: DemandStateSnapshot,
  after: DemandStateSnapshot,
): Record<string, AuditFieldChange> {
  const changedFields: Record<string, AuditFieldChange> = {};

  for (const field of DEMAND_STATE_AUDIT_FIELDS) {
    const beforeValue = normalizeAuditValue(before[field]);
    const afterValue = normalizeAuditValue(after[field]);
    if (beforeValue !== afterValue) {
      changedFields[field] = { before: beforeValue, after: afterValue };
    }
  }

  return changedFields;
}
