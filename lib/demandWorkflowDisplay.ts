import type { DepartmentWorkflowConfig } from "../types";

type WorkflowDisplayDemand = {
  status?: unknown;
  statusLabel?: string;
  statusColor?: string;
  priority?: unknown;
  priorityLabel?: string;
  priorityColor?: string;
};

const DEFAULT_STATUS_LABELS: Record<string, string> = {
  unassigned: "待负责人分配",
  pending: "待处理",
  in_progress: "进行中",
  review: "待确认",
  done: "已完成",
  closed: "已关闭",
  delayed: "已延期",
  ignored: "不处理",
};

const DEFAULT_PRIORITY_LABELS: Record<string, string> = {
  critical: "紧急",
  p0: "紧急",
  high: "高",
  p1: "高",
  medium: "中",
  p2: "中",
  low: "低",
  p3: "低",
};

function findDisplayConfig<T extends { value: string; label: string; color: string }>(
  items: T[] | undefined,
  rawValue: unknown,
): T | null {
  const value = (rawValue ?? "").toString();
  if (!value) return null;
  return (
    items?.find((item) => item.value === value) ||
    items?.find((item) => item.label === value) ||
    null
  );
}

export function applyDemandWorkflowDisplayFields<T extends WorkflowDisplayDemand>(
  demand: T,
  workflowConfig: Pick<DepartmentWorkflowConfig, "priorities" | "statuses"> | null,
): T {
  const next = { ...demand };
  const rawStatus = (demand.status ?? "").toString();
  const rawPriority = (demand.priority ?? "").toString();
  const statusConfig = findDisplayConfig(workflowConfig?.statuses, rawStatus);
  const priorityConfig = findDisplayConfig(workflowConfig?.priorities, rawPriority);

  if (rawStatus) {
    next.statusLabel =
      statusConfig?.label ||
      DEFAULT_STATUS_LABELS[rawStatus.toLowerCase()] ||
      rawStatus;
  } else {
    delete next.statusLabel;
  }
  if (statusConfig?.color) {
    next.statusColor = statusConfig.color;
  } else {
    delete next.statusColor;
  }

  if (rawPriority) {
    const normalizedPriority = rawPriority.toLowerCase();
    next.priorityLabel =
      priorityConfig?.label ||
      DEFAULT_PRIORITY_LABELS[normalizedPriority] ||
      (rawPriority.includes("紧急")
        ? "紧急"
        : rawPriority.includes("高")
          ? "高"
          : rawPriority.includes("中")
            ? "中"
            : rawPriority.includes("低")
              ? "低"
              : rawPriority);
  } else {
    delete next.priorityLabel;
  }
  if (priorityConfig?.color) {
    next.priorityColor = priorityConfig.color;
  } else {
    delete next.priorityColor;
  }

  return next;
}
