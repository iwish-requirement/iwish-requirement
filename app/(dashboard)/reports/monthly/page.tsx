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

  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [canSwitchDepartment, setCanSwitchDepartment] = useState<boolean>(false);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);
  const [currentPeriod, setCurrentPeriod] = useState<string | null>(null);

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
      </div>

      {periodLabel && (
        <div className="text-xs text-slate-500">
          当前服务月：<span className="font-semibold text-slate-700">{periodLabel}</span>
        </div>
      )}

      {error && (
        <div className="text-xs text-rose-600 bg-rose-50 border border-rose-100 px-3 py-2 rounded-lg">
          {error}
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


