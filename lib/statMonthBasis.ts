export type StatsMonthBasis = "created" | "scheduled" | "finished";

export interface DepartmentStatsMonthConfig {
  defaultMemberMonthBasis: StatsMonthBasis;
  scheduledDateFieldKey: string | null;
  scheduledEnabled: boolean;
}

export interface DemandMonthBasisRow {
  created_at?: string | null;
  finished_at?: string | null;
  fields?: unknown;
}

const SCHEDULED_DATE_FIELD_KEYS = [
  "scheduled_start_date",
  "scheduled_date",
  "schedule_date",
  "planned_start_date",
  "planned_date",
  "work_start_date",
  "work_date",
  "execution_date",
  "execution_month",
  "work_month",
];

function pickString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed || null;
}

export function normalizeStatsMonthBasis(value: unknown): StatsMonthBasis | null {
  const text = pickString(value)?.toLowerCase();
  if (text === "created" || text === "scheduled" || text === "finished") {
    return text;
  }
  return null;
}

export function findScheduledDateFieldKey(fieldKeys: Iterable<string>, preferredKey?: string | null): string | null {
  const normalizedFieldKeys = new Map<string, string>();
  for (const key of fieldKeys) {
    const trimmed = key.trim();
    if (trimmed) {
      normalizedFieldKeys.set(trimmed.toLowerCase(), trimmed);
    }
  }

  const preferred = pickString(preferredKey);
  if (preferred) {
    const matchedPreferred = normalizedFieldKeys.get(preferred.toLowerCase());
    if (matchedPreferred) {
      return matchedPreferred;
    }
  }

  for (const candidate of SCHEDULED_DATE_FIELD_KEYS) {
    const matched = normalizedFieldKeys.get(candidate);
    if (matched) {
      return matched;
    }
  }

  return null;
}

export function resolveDepartmentStatsMonthConfig(
  department: { slug?: string | null; name?: string | null; config?: unknown } | null,
  fieldKeys: Iterable<string>,
): DepartmentStatsMonthConfig {
  const configRoot =
    department?.config && typeof department.config === "object"
      ? (department.config as Record<string, unknown>)
      : {};
  const statsConfig =
    configRoot.stats && typeof configRoot.stats === "object"
      ? (configRoot.stats as Record<string, unknown>)
      : configRoot.statsConfig && typeof configRoot.statsConfig === "object"
        ? (configRoot.statsConfig as Record<string, unknown>)
        : {};

  const configuredBasis =
    normalizeStatsMonthBasis(statsConfig.defaultMemberMonthBasis) ||
    normalizeStatsMonthBasis(statsConfig.memberMonthBasis) ||
    normalizeStatsMonthBasis(configRoot.defaultMemberMonthBasis) ||
    normalizeStatsMonthBasis(configRoot.memberMonthBasis);
  const configuredScheduledFieldKey =
    pickString(statsConfig.scheduledDateFieldKey) ||
    pickString(statsConfig.scheduledFieldKey) ||
    pickString(configRoot.scheduledDateFieldKey) ||
    pickString(configRoot.scheduledFieldKey);

  const scheduledDateFieldKey = findScheduledDateFieldKey(fieldKeys, configuredScheduledFieldKey);
  const departmentIdentity = `${department?.slug || ""} ${department?.name || ""}`.toLowerCase();
  const prefersScheduledByDefault =
    departmentIdentity.includes("design") ||
    departmentIdentity.includes("creative") ||
    departmentIdentity.includes("创意");

  const defaultMemberMonthBasis =
    configuredBasis === "scheduled" && !scheduledDateFieldKey
      ? "created"
      : configuredBasis || (prefersScheduledByDefault && scheduledDateFieldKey ? "scheduled" : "created");

  return {
    defaultMemberMonthBasis,
    scheduledDateFieldKey,
    scheduledEnabled: Boolean(scheduledDateFieldKey),
  };
}

function getFieldValue(fields: unknown, key: string | null): unknown {
  if (!key || !fields || typeof fields !== "object") {
    return null;
  }
  return (fields as Record<string, unknown>)[key];
}

export function parseDemandMonthValue(value: unknown): Date | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value;
  }

  const text = pickString(value);
  if (!text) {
    return null;
  }

  const monthMatch = /^(\d{4})-(\d{2})$/.exec(text);
  if (monthMatch) {
    const year = Number.parseInt(monthMatch[1], 10);
    const monthIndex = Number.parseInt(monthMatch[2], 10) - 1;
    return new Date(Date.UTC(year, monthIndex, 1));
  }

  const parsed = new Date(text);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

export function getDemandMonthBasisDate(
  demand: DemandMonthBasisRow,
  basis: StatsMonthBasis,
  scheduledDateFieldKey: string | null,
): Date | null {
  if (basis === "finished") {
    return parseDemandMonthValue(demand.finished_at ?? null);
  }
  if (basis === "scheduled") {
    return parseDemandMonthValue(getFieldValue(demand.fields, scheduledDateFieldKey));
  }
  return parseDemandMonthValue(demand.created_at ?? null);
}

export function isDemandInMonthRange(
  demand: DemandMonthBasisRow,
  basis: StatsMonthBasis,
  scheduledDateFieldKey: string | null,
  start: string,
  end: string,
): boolean {
  const date = getDemandMonthBasisDate(demand, basis, scheduledDateFieldKey);
  if (!date) {
    return false;
  }
  const time = date.getTime();
  return time >= new Date(start).getTime() && time < new Date(end).getTime();
}

export function getStatsMonthBasisLabel(basis: StatsMonthBasis): string {
  if (basis === "scheduled") {
    return "排期月份";
  }
  if (basis === "finished") {
    return "完成月份";
  }
  return "提交月份";
}
