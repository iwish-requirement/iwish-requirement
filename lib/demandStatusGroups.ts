export interface DemandStatusConfigItem {
  value?: string | null;
  label?: string | null;
  transitions?: unknown;
  order?: number | string | null;
}

export interface DemandStatusConfigSource {
  status_config?: unknown;
}

export interface DemandStatusGroups {
  pending: string[];
  active: string[];
  completed: string[];
  delayed: string[];
}

const COMPLETED_LABELS = ["\u5b8c\u6210", "\u5df2\u5b8c\u6210", "\u5173\u95ed", "\u5df2\u5173\u95ed", "\u7ed3\u675f", "\u5df2\u7ed3\u675f"];
const PENDING_LABELS = ["\u5f85", "\u672a\u5f00\u59cb", "\u5f85\u5206\u914d", "\u5f85\u6392\u671f"];
const DELAYED_LABELS = ["\u5ef6\u671f", "\u903e\u671f"];

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map(normalize).filter(Boolean)));
}

function readStatuses(departments: DemandStatusConfigSource[]) {
  const result: { value: string; label: string; transitions: unknown[]; order: number }[] = [];

  for (const department of departments) {
    const statuses = Array.isArray(department.status_config) ? department.status_config : [];
    for (const item of statuses as DemandStatusConfigItem[]) {
      const value = normalize((item.value || "").toString());
      if (!value) continue;
      result.push({
        value,
        label: (item.label || "").toString().trim(),
        transitions: Array.isArray(item.transitions) ? item.transitions : [],
        order: Number(item.order || 0),
      });
    }
  }

  return result;
}

export function buildDemandStatusGroups(departments: DemandStatusConfigSource[]): DemandStatusGroups {
  const statuses = readStatuses(departments);

  const completed = unique([
    "done",
    "closed",
    ...statuses
      .filter((status) => {
        const text = `${status.value} ${status.label}`.toLowerCase();
        return (
          text.includes("done") ||
          text.includes("closed") ||
          COMPLETED_LABELS.some((label) => status.label.includes(label))
        );
      })
      .map((status) => status.value),
  ]);

  const delayed = unique([
    "delayed",
    ...statuses
      .filter((status) => {
        const text = `${status.value} ${status.label}`.toLowerCase();
        return text.includes("delayed") || DELAYED_LABELS.some((label) => status.label.includes(label));
      })
      .map((status) => status.value),
  ]);

  const pending = unique([
    "pending",
    "unassigned",
    ...statuses
      .filter((status) => {
        const text = `${status.value} ${status.label}`.toLowerCase();
        return (
          text.includes("pending") ||
          text.includes("unassigned") ||
          PENDING_LABELS.some((label) => status.label.includes(label)) ||
          status.order === 1
        );
      })
      .map((status) => status.value),
  ]);

  const terminal = new Set([...completed, ...delayed]);
  const active = unique([
    "pending",
    "in_progress",
    "review",
    "unassigned",
    ...statuses.filter((status) => !terminal.has(status.value)).map((status) => status.value),
  ]);

  return { pending, active, completed, delayed };
}
