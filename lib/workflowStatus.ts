import type { DepartmentWorkflowConfig, StatusConfig } from "../types";

function normalizeStatusToken(value: unknown): string {
  return (value ?? "").toString().trim().toLowerCase();
}

export function isSameWorkflowStatus(status: StatusConfig, value: unknown): boolean {
  const token = normalizeStatusToken(value);
  if (!token) return false;
  return normalizeStatusToken(status.value) === token || normalizeStatusToken(status.label) === token;
}

function transitionMatchesStatus(transition: unknown, status: StatusConfig): boolean {
  return isSameWorkflowStatus(status, transition);
}

export function getAllowedForwardWorkflowStatuses(
  workflowConfig: DepartmentWorkflowConfig | null | undefined,
  currentStatus: unknown,
): StatusConfig[] | null {
  const statuses = workflowConfig?.statuses || [];
  if (statuses.length === 0) {
    return null;
  }

  const currentConfig = statuses.find((status) => isSameWorkflowStatus(status, currentStatus));
  if (!currentConfig) {
    return statuses.filter((status) => !isSameWorkflowStatus(status, currentStatus));
  }

  const currentOrder = Number(currentConfig.order || 0);

  if (Array.isArray(currentConfig.transitions) && currentConfig.transitions.length > 0) {
    const transitionStatuses = statuses.filter(
      (status) =>
        !isSameWorkflowStatus(status, currentConfig.value) &&
        Number(status.order || 0) > currentOrder &&
        currentConfig.transitions!.some((transition) => transitionMatchesStatus(transition, status)),
    );

    if (transitionStatuses.length > 0) {
      return transitionStatuses;
    }
  }

  return statuses.filter((status) => Number(status.order || 0) > currentOrder);
}
