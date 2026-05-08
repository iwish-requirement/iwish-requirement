"use client";

import React, { useEffect, useState } from 'react';
import AiMonthlyReportView from '../../../../components/AiMonthlyReportView';
import { AiMonthlyReport } from '../../../../types';
import { authorizedFetch } from '../../../../lib/authFetch';

interface DepartmentOption {
  id: number;
  name: string;
}

interface AiMonthlyReportResponse {
  report?: AiMonthlyReport | null;
  meta?: {
    period?: string | null;
    departmentId?: number | null;
    canSwitchDepartment?: boolean;
    departments?: DepartmentOption[];
  };
}

export default function MonthlyReportsPage() {
  const [report, setReport] = useState<AiMonthlyReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [canSwitchDepartment, setCanSwitchDepartment] = useState<boolean>(false);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);
  const [currentPeriod, setCurrentPeriod] = useState<string | null>(null);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [reportTone, setReportTone] = useState<'neutral' | 'direct' | 'encouraging'>('neutral');
  const [reportLength, setReportLength] = useState<'short' | 'standard' | 'detailed'>('standard');
  const [allowSensitiveFields, setAllowSensitiveFields] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadReport = async () => {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        if (selectedDepartmentId) {
          params.set('departmentId', selectedDepartmentId);
        }

        const query = params.toString();
        const url = query ? `/api/ai-reports/monthly?${query}` : '/api/ai-reports/monthly';

        const res = await authorizedFetch(url);
        if (!res.ok) {
          const text = await res.text();
          console.error('load ai monthly report error', text);
          if (!cancelled) {
            if (res.status === 401) {
              setError('登录已失效，请重新登录后再试');
            } else if (res.status === 403) {
              setError('您没有权限查看该部门的月度报告，如需访问请联系系统管理员。');
            } else {
              setError('加载月度报告失败，请稍后重试');
            }

            setReport(null);
          }
          return;
        }

        const json = (await res.json()) as AiMonthlyReportResponse;
        if (cancelled) {
          return;
        }

        if (json && json.report) {
          setReport(json.report as AiMonthlyReport);
        } else {
          setReport(null);
        }

        const meta = json.meta;
        if (meta) {
          setCanSwitchDepartment(Boolean(meta.canSwitchDepartment));
          if (Array.isArray(meta.departments)) {
            setDepartments(meta.departments);
          }
          if (typeof meta.period === 'string') {
            setCurrentPeriod(meta.period);
          } else {
            setCurrentPeriod(null);
          }
        }
      } catch (e) {
        console.error('load ai monthly report error', e);
        if (!cancelled) {
          setError('加载月度报告失败，请检查网络后重试');
          setReport(null);
        }

      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadReport();

    return () => {
      cancelled = true;
    };
  }, [selectedDepartmentId]);

  const handleDepartmentChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const next = event.target.value;
    if (!next) {
      setSelectedDepartmentId(null);
      return;
    }
    setSelectedDepartmentId(next);
  };

  const handleGenerateAiReport = async () => {
    try {
      setGenerating(true);
      setError(null);
      const res = await authorizedFetch('/api/ai-reports/monthly/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          departmentId: selectedDepartmentId ? Number(selectedDepartmentId) : undefined,
          period: currentPeriod || undefined,
          mode: aiEnabled ? 'llm' : 'rule',
          config: {
            aiEnabled,
            tone: reportTone,
            length: reportLength,
            allowSensitiveFields,
          },
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error('generate ai monthly report error', text);
        setError('生成 AI 月报失败，请稍后重试');
        return;
      }
      const json = await res.json();
      if (json.report) {
        setReport(json.report as AiMonthlyReport);
      }
    } catch (e) {
      console.error('generate ai monthly report error', e);
      setError('生成 AI 月报失败，请检查网络后重试');
    } finally {
      setGenerating(false);
    }
  };

  const handleExportMarkdown = () => {
    if (!report) return;
    const lines: string[] = [];
    lines.push(`# ${report.departmentName || '部门'} ${report.period} 月度报告`);
    lines.push("");
    lines.push(`生成方式：${report.mode === 'llm' ? 'AI 分析' : '规则生成'}`);
    lines.push(`生成时间：${report.generatedAt}`);
    lines.push("");
    for (const chapter of report.chapters) {
      lines.push(`## ${chapter.title}`);
      for (const paragraph of chapter.paragraphs) {
        lines.push(paragraph.text);
        lines.push("");
      }
    }
    const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${report.departmentName || 'department'}-${report.period}-monthly-report.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSendWecom = async () => {
    if (!report) return;
    try {
      setError(null);
      const res = await authorizedFetch('/api/ai-reports/monthly/send-wecom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          departmentId: report.departmentId ? Number(report.departmentId) : selectedDepartmentId ? Number(selectedDepartmentId) : undefined,
          period: report.period,
        }),
      });
      if (!res.ok) {
        console.error('send ai monthly report error', await res.text());
        setError('发送企业微信失败，请确认部门成员已绑定企业微信。');
        return;
      }
    } catch (e) {
      console.error('send ai monthly report error', e);
      setError('发送企业微信失败，请检查网络后重试');
    }
  };

  const periodLabel = React.useMemo(() => {
    if (!currentPeriod) {
      return '';
    }
    const match = /^(\d{4})-(\d{2})$/.exec(currentPeriod.trim());
    if (!match) {
      return currentPeriod;
    }
    const year = match[1];
    const month = match[2].replace(/^0/, '');
    return `${year}年${month}月`;
  }, [currentPeriod]);

  return (
    <div className="space-y-6 md:space-y-8 pb-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
            部门月度报告
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            当前页面展示的是基于业务数据规则生成的部门月度报告，后续可以平滑切换为自动生成的智能总结。
          </p>

          {report && (
            <p className="mt-1 text-xs text-slate-400">
              当前报告基于 {report.departmentName || '所属部门'} · {report.period} 服务月的业务与评分数据自动生成。
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canSwitchDepartment && departments.length > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500">查看部门：</span>
              <select
                value={selectedDepartmentId ?? ''}
                onChange={handleDepartmentChange}
                className="px-3 py-1.5 text-xs border border-slate-200 rounded-full bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">当前所属部门</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={String(dept.id)}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button
            type="button"
            onClick={handleGenerateAiReport}
            disabled={generating}
            className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 disabled:opacity-60"
          >
            {generating ? '生成中...' : '生成 AI 分析'}
          </button>
          <button
            type="button"
            onClick={handleExportMarkdown}
            disabled={!report}
            className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 disabled:opacity-60"
          >
            导出 Markdown
          </button>
          <button
            type="button"
            onClick={handleSendWecom}
            disabled={!report}
            className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 disabled:opacity-60"
          >
            发送企微
          </button>
        </div>
      </div>

      {periodLabel && (
        <div className="text-xs text-slate-500">
          当前服务月：<span className="font-semibold text-slate-700">{periodLabel}</span>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-3 text-sm font-bold text-slate-900">AI 月报配置</div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <label className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={aiEnabled}
              onChange={(e) => setAiEnabled(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded border-slate-300"
            />
            启用 AI 分析
          </label>
          <label className="text-xs font-bold text-slate-600">
            语气
            <select
              value={reportTone}
              onChange={(e) => setReportTone(e.target.value as typeof reportTone)}
              className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-normal"
            >
              <option value="neutral">客观中性</option>
              <option value="direct">直接指出问题</option>
              <option value="encouraging">鼓励改进</option>
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600">
            长度
            <select
              value={reportLength}
              onChange={(e) => setReportLength(e.target.value as typeof reportLength)}
              className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-normal"
            >
              <option value="short">简短</option>
              <option value="standard">标准</option>
              <option value="detailed">详细</option>
            </select>
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={allowSensitiveFields}
              onChange={(e) => setAllowSensitiveFields(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded border-slate-300"
            />
            允许敏感字段进入摘要
          </label>
        </div>
      </div>

      {error && (
        <div className="text-xs text-rose-600 bg-rose-50 border border-rose-100 px-3 py-2 rounded-lg">
          {error}
        </div>
      )}

      {report?.status === 'fallback' && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 px-3 py-2 rounded-lg">
          AI 分析生成失败，已使用规则报告。{report.error ? `原因：${report.error}` : ''}
        </div>
      )}

      {loading && !report && !error && (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-400">
          正在加载月度报告...
        </div>
      )}

      {!loading && !error && !report && (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-400">
          当前周期暂无可用的月度报告。
        </div>
      )}


      {!loading && report && <AiMonthlyReportView report={report} />}
    </div>
  );
}


