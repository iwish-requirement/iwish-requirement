"use client";

import React, { useEffect, useMemo, useState } from "react";
import { History } from "lucide-react";
import { authorizedFetch } from "../../lib/authFetch";

type AuditChange = { before?: unknown; after?: unknown };

type HistoryItem = {
  id: number;
  action: string;
  changedFields: Record<string, AuditChange>;
  createdAt: string;
  actorName: string;
};

type Props = {
  demandIdentifier: string;
  refreshKey: string;
  statusLabels?: Record<string, string>;
};

const FIELD_LABELS: Record<string, string> = {
  status: "状态",
  assignee_id: "执行人",
  assigned_at: "分配时间",
  started_at: "开始时间",
  finished_at: "完成时间",
  closed_at: "关闭时间",
  delayed_at: "延期时间",
  code: "需求 ID",
};

const DEFAULT_STATUS_LABELS: Record<string, string> = {
  unassigned: "待负责人分配",
  pending: "未开始",
  in_progress: "处理中",
  review: "待审核",
  done: "已完成",
  closed: "已关闭",
  delayed: "已延期",
  ignored: "不处理",
};

function formatTimestamp(value: unknown): string {
  if (!value) return "无";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export default function DemandStateHistory({ demandIdentifier, refreshKey, statusLabels }: Props) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [userNameById, setUserNameById] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mergedStatusLabels = useMemo(
    () => ({ ...DEFAULT_STATUS_LABELS, ...(statusLabels || {}) }),
    [statusLabels],
  );

  useEffect(() => {
    let cancelled = false;
    const loadHistory = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await authorizedFetch(
          `/api/demands/${encodeURIComponent(demandIdentifier)}/history`,
        );
        if (!response.ok) throw new Error("状态变更记录加载失败");
        const json = await response.json();
        if (!cancelled) {
          setHistory(Array.isArray(json.history) ? json.history : []);
          setUserNameById(json.userNameById || {});
        }
      } catch (loadError: any) {
        if (!cancelled) setError(loadError?.message || "状态变更记录加载失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadHistory();
    return () => {
      cancelled = true;
    };
  }, [demandIdentifier, refreshKey]);

  const formatValue = (field: string, value: unknown) => {
    if (field === "status") return mergedStatusLabels[String(value || "")] || String(value || "无");
    if (field === "assignee_id") {
      if (!value) return "未指定";
      return userNameById[String(value)] || `用户 ${value}`;
    }
    if (field.endsWith("_at")) return formatTimestamp(value);
    return value === null || value === undefined || value === "" ? "无" : String(value);
  };

  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <div className="flex items-center gap-2 mb-4">
        <History className="w-5 h-5 text-slate-500" />
        <h2 className="text-lg font-bold text-slate-900">状态变更记录</h2>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">加载中...</p>
      ) : error ? (
        <p className="text-sm text-rose-600">{error}</p>
      ) : history.length === 0 ? (
        <p className="text-sm text-slate-500">暂无记录。后续的状态、执行人和完成时间变更会保留在这里。</p>
      ) : (
        <div className="space-y-4">
          {history.map((item) => {
            const changes = Object.entries(item.changedFields || {});
            return (
              <div key={item.id} className="border-l-2 border-blue-200 pl-4">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">{item.actorName}</span>
                  <span>{formatTimestamp(item.createdAt)}</span>
                </div>
                <div className="mt-2 space-y-1.5">
                  {changes.map(([field, change]) => (
                    <div key={field} className="text-sm text-slate-700">
                      <span className="font-medium">{FIELD_LABELS[field] || field}：</span>
                      <span className="text-slate-500">{formatValue(field, change.before)}</span>
                      <span className="mx-2 text-slate-400">→</span>
                      <span>{formatValue(field, change.after)}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
