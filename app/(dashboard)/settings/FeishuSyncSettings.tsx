"use client";

import React, { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileSpreadsheet,
  RefreshCcw,
} from "lucide-react";
import { authorizedFetch } from "../../../lib/authFetch";

interface Props {
  canManage: boolean;
}

interface SyncResult {
  skipped?: boolean;
  reason?: string;
  rowCount?: number;
  spreadsheetToken?: string;
  sheetId?: string;
  spreadsheetUrl?: string | null;
  createdSpreadsheet?: boolean;
  error?: string;
  detail?: string;
}

const copyText = async (text: string) => {
  if (!text) return;
  await navigator.clipboard.writeText(text);
};

const ResultRow = ({ label, value }: { label: string; value?: string | number | null }) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const text = String(value);
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="text-xs font-medium text-slate-500">{label}</div>
        <div className="mt-1 break-all font-mono text-sm text-slate-900">{text}</div>
      </div>
      <button
        type="button"
        onClick={() => copyText(text)}
        className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900"
        title="复制"
      >
        <Copy className="h-4 w-4" />
      </button>
    </div>
  );
};

const FeishuSyncSettings: React.FC<Props> = ({ canManage }) => {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSync = async () => {
    if (!canManage || syncing) return;

    try {
      setSyncing(true);
      setMessage(null);
      setResult(null);

      const res = await authorizedFetch("/api/integrations/feishu/creative-demands/sync", {
        method: "POST",
      });
      const json = (await res.json().catch(() => ({}))) as SyncResult;
      setResult(json);

      if (!res.ok) {
        setMessage(json.detail || json.reason || json.error || "同步失败，请稍后重试。");
        return;
      }

      setMessage(json.createdSpreadsheet ? "已创建并同步飞书表格。" : "已同步飞书表格。");
    } catch (error: any) {
      setMessage(error?.message ? String(error.message) : "同步失败，请检查网络后重试。");
    } finally {
      setSyncing(false);
    }
  };

  const envSnippet =
    result?.spreadsheetToken && result?.sheetId
      ? `FEISHU_CREATIVE_SPREADSHEET_TOKEN=${result.spreadsheetToken}\nFEISHU_CREATIVE_SHEET_ID=${result.sheetId}`
      : "";

  return (
    <div className="space-y-6">
      {!canManage && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          当前账号没有飞书同步管理权限，无法手动触发同步。
        </div>
      )}

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <FileSpreadsheet className="h-5 w-5 text-blue-500" />
            飞书同步
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            将创意部全部需求全量刷新到飞书普通电子表格。
          </p>
        </div>
        <button
          type="button"
          onClick={handleSync}
          disabled={!canManage || syncing}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCcw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "同步中" : "手动同步"}
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg bg-white p-3">
            <div className="text-xs font-medium text-slate-500">同步范围</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">创意部全部需求</div>
          </div>
          <div className="rounded-lg bg-white p-3">
            <div className="text-xs font-medium text-slate-500">同步方式</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">全量刷新普通 Sheets</div>
          </div>
          <div className="rounded-lg bg-white p-3">
            <div className="text-xs font-medium text-slate-500">首次建表位置</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">飞书云文档根目录</div>
          </div>
        </div>
      </div>

      {message && (
        <div
          className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${
            result && !result.error && !result.skipped
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {result && !result.error && !result.skipped ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          )}
          <span>{message}</span>
        </div>
      )}

      {result && !result.error && !result.skipped && (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">同步结果</h3>
              <p className="mt-1 text-xs text-slate-500">
                首次创建后，把 token 和 sheet id 补到 Cloudflare 变量里，后续会持续更新同一张表。
              </p>
            </div>
            {result.spreadsheetUrl && (
              <a
                href={result.spreadsheetUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                打开表格
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </div>

          <ResultRow label="同步需求数" value={result.rowCount} />
          <ResultRow label="FEISHU_CREATIVE_SPREADSHEET_TOKEN" value={result.spreadsheetToken} />
          <ResultRow label="FEISHU_CREATIVE_SHEET_ID" value={result.sheetId} />

          {envSnippet && (
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="text-xs font-bold text-blue-900">Cloudflare 回填变量</div>
                <button
                  type="button"
                  onClick={() => copyText(envSnippet)}
                  className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                >
                  <Copy className="h-3.5 w-3.5" />
                  复制
                </button>
              </div>
              <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs text-blue-950">
                {envSnippet}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FeishuSyncSettings;
