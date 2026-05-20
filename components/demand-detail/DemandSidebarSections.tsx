"use client";

import React, { type Dispatch, type SetStateAction } from "react";
import { Calendar, Clock } from "lucide-react";
import Badge from "../ui/Badge";
import {
  DemandStatus,
  Priority,
  type Demand,
  type DepartmentWorkflowConfig,
} from "../../types";

interface DemandSidebarSectionsProps {
  demand: Demand;
  isEditing: boolean;
  saveError: string | null;
  statusUpdateError: string | null;
  draftDueDate: string;
  setDraftDueDate: Dispatch<SetStateAction<string>>;
  draftPriority: string;
  setDraftPriority: Dispatch<SetStateAction<string>>;
  draftStatus: string;
  setDraftStatus: Dispatch<SetStateAction<string>>;
  workflowConfig: DepartmentWorkflowConfig | null;
  quickStatusOptions: DemandStatus[];
  statusUpdating: boolean;
  handleQuickStatusChange: (nextStatus: string) => void;
  getAllowedNextStatuses: DepartmentWorkflowConfig["statuses"] | null;
  currentStatusIndex: number;
  normalizedStatusForFlow: DemandStatus | null;
  statusFlowOrder: DemandStatus[];
  canAssignDemand: boolean;
  assigneeOptions: { id: number; name: string | null; email: string | null }[];
  assigneeOptionsLoading: boolean;
  assigningAssignee: boolean;
  assignError: string | null;
  handleAssignAssignee: (nextAssigneeEmail: string) => void;
  getAvatarInitial: (label?: string, email?: string | null) => string;
}

function getFallbackPriorityLabel(priority?: string | null) {
  const raw = (priority || "").toString().toLowerCase();
  if (raw.includes("critical") || raw === "p0") return Priority.CRITICAL;
  if (raw.includes("high") || raw === "p1") return Priority.HIGH;
  if (raw.includes("medium") || raw === "p2") return Priority.MEDIUM;
  if (raw.includes("low") || raw === "p3") return Priority.LOW;
  return priority || "";
}

function getFallbackStatusLabel(status?: string | null) {
  const raw = (status || "").toString();
  switch (raw) {
    case "unassigned":
      return "待负责人分配";
    case "pending":
      return DemandStatus.PENDING;
    case "in_progress":
      return DemandStatus.IN_PROGRESS;
    case "review":
      return DemandStatus.REVIEW;
    case "done":
      return DemandStatus.DONE;
    case "closed":
      return DemandStatus.CLOSED;
    case "delayed":
      return DemandStatus.DELAYED;
    case "ignored":
      return DemandStatus.IGNORED;
    default: {
      const all = Object.values(DemandStatus) as string[];
      return all.includes(raw) ? raw : raw || DemandStatus.PENDING;
    }
  }
}

const DemandSidebarSections = React.memo(function DemandSidebarSections({
  demand,
  isEditing,
  saveError,
  statusUpdateError,
  draftDueDate,
  setDraftDueDate,
  draftPriority,
  setDraftPriority,
  draftStatus,
  setDraftStatus,
  workflowConfig,
  quickStatusOptions,
  statusUpdating,
  handleQuickStatusChange,
  getAllowedNextStatuses,
  currentStatusIndex,
  normalizedStatusForFlow,
  statusFlowOrder,
  canAssignDemand,
  assigneeOptions,
  assigneeOptionsLoading,
  assigningAssignee,
  assignError,
  handleAssignAssignee,
  getAvatarInitial,
}: DemandSidebarSectionsProps) {
  const priorityLabel =
    workflowConfig?.priorities.find((p) => p.value === demand.priority)?.label ||
    getFallbackPriorityLabel(demand.priority);

  const currentStatusLabel =
    workflowConfig?.statuses.find((s) => s.value === demand.status)?.label ||
    getFallbackStatusLabel(demand.status);

  const quickStatusSelectOptions = React.useMemo(() => {
    if (workflowConfig && workflowConfig.statuses.length > 0) {
      return workflowConfig.statuses.map((status) => ({
        value: status.value,
        label: status.label,
      }));
    }

    if (getAllowedNextStatuses !== null && getAllowedNextStatuses.length > 0) {
      return [
        { value: demand.status, label: currentStatusLabel },
        ...getAllowedNextStatuses.map((status) => ({
          value: status.value,
          label: status.label,
        })),
      ];
    }

    if (normalizedStatusForFlow == null) {
      return [
        { value: demand.status, label: currentStatusLabel },
        ...quickStatusOptions
          .filter((status) => status !== demand.status)
          .map((status) => ({ value: status, label: status })),
      ];
    }

    const currentIndex = statusFlowOrder.indexOf(normalizedStatusForFlow);
    const forwardMain =
      currentIndex >= 0 ? statusFlowOrder.slice(currentIndex + 1) : statusFlowOrder;
    const specialStatuses = [DemandStatus.DELAYED, DemandStatus.IGNORED].filter(
      (status) => status !== demand.status && !forwardMain.includes(status)
    );

    const defaultOptions = Array.from(new Set([...forwardMain, ...specialStatuses])).map(
      (status) => ({
        value: status,
        label: status,
      })
    );

    return [{ value: demand.status, label: currentStatusLabel }, ...defaultOptions];
  }, [
    currentStatusIndex,
    currentStatusLabel,
    demand.status,
    getAllowedNextStatuses,
    normalizedStatusForFlow,
    quickStatusOptions,
    statusFlowOrder,
    workflowConfig,
  ]);

  const flowStatuses = React.useMemo(
    () =>
      workflowConfig && workflowConfig.statuses.length > 0
        ? workflowConfig.statuses.map((status) => ({
            value: status.value,
            label: status.label,
          }))
        : statusFlowOrder.map((status) => ({
            value: status,
            label: status,
          })),
    [statusFlowOrder, workflowConfig]
  );

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-base font-bold text-slate-900 mb-4 uppercase tracking-wide text-opacity-80">
          基本信息
        </h3>
        {saveError && (
          <div className="mb-3 text-xs text-rose-600 bg-rose-50 border border-rose-100 px-3 py-2 rounded-lg">
            {saveError}
          </div>
        )}
        {statusUpdateError && (
          <div className="mb-3 text-xs text-rose-600 bg-rose-50 border border-rose-100 px-3 py-2 rounded-lg">
            {statusUpdateError}
          </div>
        )}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 flex items-center gap-2">
              <Calendar className="w-4 h-4" /> 截止日期
            </span>
            {isEditing ? (
              <input
                type="date"
                value={draftDueDate}
                onChange={(e) => setDraftDueDate(e.target.value)}
                className="px-2 py-1 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <span className="font-medium text-slate-900">{demand.dueDate}</span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500 flex items-center gap-2">
              <Clock className="w-4 h-4" /> 创建时间
            </span>
            <span className="font-medium text-slate-900">{demand.createdAt}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">优先级</span>
            {isEditing ? (
              <select
                value={draftPriority || demand.priority}
                onChange={(e) => setDraftPriority(e.target.value)}
                className="px-2 py-1 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {workflowConfig && workflowConfig.priorities.length > 0 ? (
                  <>
                    {workflowConfig.priorities.map((priority) => (
                      <option key={priority.value} value={priority.value}>
                        {priority.label}
                      </option>
                    ))}
                  </>
                ) : (
                  <>
                    <option value={Priority.MEDIUM}>{Priority.MEDIUM}</option>
                    <option value={Priority.LOW}>{Priority.LOW}</option>
                    <option value={Priority.HIGH}>{Priority.HIGH}</option>
                    <option value={Priority.CRITICAL}>{Priority.CRITICAL}</option>
                  </>
                )}
              </select>
            ) : (
              <span className="font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded">
                {priorityLabel}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">当前状态</span>
            {isEditing ? (
              <select
                value={draftStatus || demand.status}
                onChange={(e) => setDraftStatus(e.target.value)}
                className="px-2 py-1 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {workflowConfig && workflowConfig.statuses.length > 0 ? (
                  <>
                    {workflowConfig.statuses.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </>
                ) : (
                  <>
                    {quickStatusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </>
                )}
              </select>
            ) : (
              <div className="flex items-center gap-2">
                <Badge variant="warning">{currentStatusLabel}</Badge>
                <select
                  value={demand.status}
                  onChange={(e) => handleQuickStatusChange(e.target.value)}
                  disabled={statusUpdating}
                  className="px-2 py-1 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                >
                  {quickStatusSelectOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {statusUpdating && (
                  <span className="text-[11px] text-slate-400">更新中...</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-base font-bold text-slate-900 mb-4 uppercase tracking-wide text-opacity-80">
          状态流转
        </h3>
        <div className="mt-2 space-y-3">
          <p className="text-xs text-slate-500">
            {workflowConfig && workflowConfig.statuses.length > 0
              ? "以下为当前部门配置的标准状态流转顺序，当前所处阶段会高亮展示。"
              : '默认流程为：待处理 → 进行中 → 已完成，"已延期"和"不处理"为特殊状态。当前状态会高亮，便于快速判断进度。'}
          </p>
          <div className="flex flex-col gap-3">
            {flowStatuses.map((status, index) => {
              const isPastOrCurrent = currentStatusIndex >= 0 && index <= currentStatusIndex;
              const isCurrent = currentStatusIndex === index;
              const isFuture = currentStatusIndex >= 0 && index > currentStatusIndex;
              const isLast = index === flowStatuses.length - 1;
              const circleStyle = isPastOrCurrent
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-slate-400 border-slate-300";
              const barStyle = isPastOrCurrent ? "bg-blue-500" : "bg-slate-200";

              return (
                <div key={status.value} className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs font-bold ${circleStyle}`}
                    >
                      {index + 1}
                    </div>
                    {!isLast && <div className={`h-0.5 w-6 rounded ${barStyle}`} />}
                  </div>
                  <div className="flex flex-col">
                    <span
                      className={`text-xs font-bold ${
                        isCurrent
                          ? "text-blue-700"
                          : isPastOrCurrent
                            ? "text-slate-800"
                            : "text-slate-500"
                      }`}
                    >
                      {status.label}
                      {isCurrent && (
                        <span className="ml-1 text-[10px] text-blue-500">(当前)</span>
                      )}
                    </span>
                    {isFuture && index === currentStatusIndex + 1 && (
                      <span className="text-[10px] text-slate-400">
                        建议下一步将状态推进到此阶段
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {(demand.status === DemandStatus.DELAYED ||
            demand.status === DemandStatus.IGNORED) && (
            <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] text-amber-700">
              {demand.status === DemandStatus.DELAYED
                ? '当前需求处于"已延期"状态，这是在"进行中"基础上的特殊标记，用于提醒存在进度风险。'
                : '当前需求处于"不处理"状态，表示本次不再推进，后续需要重新拉起时建议新建需求。'}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-base font-bold text-slate-900 mb-4 uppercase tracking-wide text-opacity-80">
          人员信息
        </h3>
        <div className="space-y-4">
          <div>
            <div className="text-xs text-slate-400 mb-1">创建人</div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs">
                {getAvatarInitial(demand.creatorName || demand.creatorId, demand.creatorEmail)}
              </div>
              <div className="flex flex-col">
                <span className="font-medium text-slate-700">
                  {demand.creatorName || demand.creatorId}
                </span>
                {demand.creatorEmail && (
                  <span className="text-xs text-slate-400">{demand.creatorEmail}</span>
                )}
              </div>
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400 mb-1">执行人</div>
            {demand.assigneeName || demand.assigneeId || demand.assigneeEmail ? (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-pink-100 text-pink-600 flex items-center justify-center font-bold text-xs">
                  {getAvatarInitial(
                    demand.assigneeName || demand.assigneeId,
                    demand.assigneeEmail
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="font-medium text-slate-700">
                    {demand.assigneeName || demand.assigneeId}
                  </span>
                  {demand.assigneeEmail && (
                    <span className="text-xs text-slate-400">{demand.assigneeEmail}</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-400">暂未指定执行人</div>
            )}
          </div>
        </div>
      </div>

      {canAssignDemand && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-base font-bold text-slate-900 mb-4 uppercase tracking-wide text-opacity-80">
            分配执行人
          </h3>
          {assignError && (
            <div className="mb-3 text-xs text-rose-600 bg-rose-50 border border-rose-100 px-3 py-2 rounded-lg">
              {assignError}
            </div>
          )}
          <select
            value=""
            onChange={(e) => {
              const value = e.target.value;
              if (value) {
                handleAssignAssignee(value);
                e.target.value = "";
              }
            }}
            disabled={assigningAssignee || assigneeOptionsLoading}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
          >
            <option value="">
              {assigneeOptionsLoading ? "正在加载可分配成员..." : "选择新的执行人"}
            </option>
            {assigneeOptions
              .filter((user) => user.email && user.email !== demand.assigneeEmail)
              .map((user) => (
                <option key={user.id} value={user.email || ""}>
                  {user.name || user.email}
                  {user.email ? ` (${user.email})` : ""}
                </option>
              ))}
          </select>
          <p className="mt-2 text-[11px] text-slate-400">
            仅部门负责人和管理员可以调整执行人。
          </p>
        </div>
      )}
    </div>
  );
});

export default DemandSidebarSections;
