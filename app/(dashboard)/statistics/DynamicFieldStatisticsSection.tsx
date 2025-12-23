"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Download } from "lucide-react";
import { DynamicFieldStat, DepartmentDynamicFieldStats } from "../../../types";
import { authorizedFetch } from "../../../lib/authFetch";

const COLORS = ["#2563EB", "#7C3AED", "#DB2777", "#F59E0B", "#0EA5E9", "#10B981"];

function formatTickLabel(value: string | number): string {
  const text = String(value || "").trim();
  if (text.length <= 10) {
    return text;
  }
  const prefix = text.slice(0, 6);
  const suffix = text.slice(-3);
  return `${prefix}…${suffix}`;
}


interface DynamicFieldStatisticsSectionProps {
  selectedDeptId: string;
  selectedPeriod: string | null;
}

export default function DynamicFieldStatisticsSection({
  selectedDeptId,
  selectedPeriod,
}: DynamicFieldStatisticsSectionProps) {
  const [createdFrom, setCreatedFrom] = useState<string>("");
  const [createdTo, setCreatedTo] = useState<string>("");
  const [stats, setStats] = useState<DepartmentDynamicFieldStats | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFieldId, setSelectedFieldId] = useState<string>("");


  useEffect(() => {
    if (!selectedPeriod) {
      setCreatedFrom("");
      setCreatedTo("");
      return;
    }

    const parts = selectedPeriod.split("-");
    if (parts.length !== 2) {
      return;
    }

    const year = Number(parts[0]);
    const month = Number(parts[1]);
    if (!year || !month) {
      return;
    }

    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const formatDate = (date: Date) => date.toISOString().slice(0, 10);

    setCreatedFrom(formatDate(firstDay));
    setCreatedTo(formatDate(lastDay));
  }, [selectedPeriod]);

  useEffect(() => {
    const controller = new AbortController();

    const loadStats = async () => {
      if (!selectedDeptId || selectedDeptId === "all") {
        setStats(null);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams();
        params.set("departmentId", selectedDeptId);
        if (createdFrom) {
          params.set("createdFrom", createdFrom);
        }
        if (createdTo) {
          params.set("createdTo", createdTo);
        }
        const qs = params.toString();
        const url = `/api/demands/stats/dynamic${qs ? `?${qs}` : ""}`;
        const res = await authorizedFetch(url, { signal: controller.signal });
        if (!res.ok) {
          const text = await res.text();
          console.error("load dynamic field stats error", text);
          setError("加载部门字段统计失败，请稍后重试");
          setStats(null);
          return;
        }
        const json = (await res.json()) as DepartmentDynamicFieldStats;
        setStats(json);
        if (json.fields && json.fields.length > 0) {
          setSelectedFieldId((prev) => prev || json.fields[0]?.fieldId || "");
        } else {
          setSelectedFieldId("");
        }
      } catch (e) {
        console.error("load dynamic field stats error", e);
        setError("加载部门字段统计失败，请检查网络后重试");
        setStats(null);
      } finally {
        setLoading(false);
      }
    };

    loadStats();

    return () => controller.abort();
  }, [selectedDeptId, createdFrom, createdTo]);

  const currentFieldStat: DynamicFieldStat | null = useMemo(() => {
    if (!stats || !stats.fields || stats.fields.length === 0) {
      return null;
    }
    if (!selectedFieldId) {
      return stats.fields[0];
    }
    return stats.fields.find((field) => field.fieldId === selectedFieldId) || stats.fields[0];
  }, [stats, selectedFieldId]);

  const chartData = useMemo(() => {
    if (!currentFieldStat) {
      return [];
    }
    return currentFieldStat.values.map((item) => ({
      name: item.value,
      count: item.count,
    }));
  }, [currentFieldStat]);

  const handleExportDemands = async () => {
    if (!selectedDeptId || selectedDeptId === "all") {
      setError("请在上方选择具体部门后，再导出报表");
      return;
    }

    try {
      setError(null);
      const params = new URLSearchParams();
      params.set("departmentId", selectedDeptId);
      if (createdFrom) {
        params.set("createdFrom", createdFrom);
      }
      if (createdTo) {
        params.set("createdTo", createdTo);
      }
      const qs = params.toString();
      const url = `/api/demands/export${qs ? `?${qs}` : ""}`;
      const res = await authorizedFetch(url, { method: "GET" });
      if (!res.ok) {
        const text = await res.text();
        console.error("export demands from dynamic stats error", text);
        setError("导出需求明细失败，请稍后重试");
        return;
      }
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = "demands-export.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (e) {
      console.error("export demands from dynamic stats error", e);
      setError("导出需求明细失败，请检查网络后重试");
    }
  };

  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 md:p-6 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-900">部门动态字段统计</h2>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            基于部门自定义字段，分析需求在客户、项目、网站等维度下的结构与分布。
          </p>
          {(!selectedDeptId || selectedDeptId === "all") && (
            <p className="mt-2 text-[11px] md:text-xs text-slate-500">
              当前视图依赖具体部门的数据，请在上方“统计范围”中选择某个部门后再查看字段结构分布。
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={handleExportDemands}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white border border-slate-300 text-slate-700 px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold hover:bg-slate-50 transition-colors shadow-sm"
        >
          <Download className="w-4 h-4" />
          导出当前筛选的需求明细
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex flex-col md:flex-row gap-3 flex-1">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-semibold text-slate-500 mb-1">统计字段</label>
            <select
              className="w-full px-3 py-2.5 text-xs md:text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedFieldId}
              onChange={(event) => setSelectedFieldId(event.target.value)}
              disabled={!stats || !stats.fields || stats.fields.length === 0}
            >
              {!stats || !stats.fields || stats.fields.length === 0 ? (
                <option value="">当前部门暂无可统计的字段</option>
              ) : (
                stats.fields.map((field) => (
                  <option key={field.fieldId} value={field.fieldId}>
                    {field.fieldLabel}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs font-semibold text-slate-500 mb-1">创建时间自</label>
            <input
              type="date"
              value={createdFrom}
              onChange={(event) => setCreatedFrom(event.target.value)}
              className="w-full px-3 py-2 text-xs md:text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs font-semibold text-slate-500 mb-1">创建时间至</label>
            <input
              type="date"
              value={createdTo}
              onChange={(event) => setCreatedTo(event.target.value)}
              className="w-full px-3 py-2 text-xs md:text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="text-xs text-rose-600 bg-rose-50 border border-rose-100 px-3 py-2 rounded-lg">
          {error}
        </div>
      )}

      {stats && (
        <div className="flex flex-wrap items-center gap-3 text-[11px] md:text-xs text-slate-500">
          <span>
            部门：
            <span className="font-medium text-slate-800">{stats.departmentName || "未命名部门"}</span>
          </span>
          <span>
            统计区间：
            <span className="font-medium text-slate-800">
              {createdFrom || "最早"} ~ {createdTo || "当前"}
            </span>
          </span>
          <span>
            覆盖需求数：
            <span className="font-medium text-slate-800">{stats.totalDemands}</span>
          </span>
        </div>
      )}

      {loading && (
        <div className="text-xs text-slate-400">正在加载部门字段统计...</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
        <div className="bg-slate-50 rounded-xl border border-slate-100 p-4 md:p-5">
          <h3 className="text-sm md:text-base font-bold text-slate-900 mb-2">按取值分布（饼图）</h3>
          <p className="text-[11px] md:text-xs text-slate-500 mb-4">
            直观展示当前字段在不同取值下的占比结构，适合快速识别主流客户、核心项目或重点渠道。
          </p>
          <div className="h-64 md:h-72 flex items-center justify-center">
            {!currentFieldStat || chartData.length === 0 ? (
              <div className="text-xs text-slate-400">暂无可用数据，请调整筛选条件或确认该部门已有需求。</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={4}
                    dataKey="count"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: "12px",
                      border: "none",
                      boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                      padding: "12px",
                    }}
                    formatter={(value: number, _name: string, item: any) => {
                      const total = currentFieldStat.total || 1;
                      const percent = ((value / total) * 100).toFixed(1);
                      return [`${value} 条 (${percent}%)`, item.payload.name as string];
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-slate-50 rounded-xl border border-slate-100 p-4 md:p-5">
          <h3 className="text-sm md:text-base font-bold text-slate-900 mb-2">按取值分布（柱状图）</h3>
          <p className="text-[11px] md:text-xs text-slate-500 mb-4">
            以横轴分类、纵轴数量的方式对比不同取值的需求数量，帮助识别集中度与长尾结构。
          </p>
          <div className="h-64 md:h-72 flex items-center justify-center">
            {!currentFieldStat || chartData.length === 0 ? (
              <div className="text-xs text-slate-400">暂无可用数据，请调整筛选条件或确认该部门已有需求。</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barGap={8}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#64748B", fontSize: 11 }}
                    dy={10}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                    tickFormatter={(value) => formatTickLabel(value)}
                  />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 11 }} />
                  <Tooltip
                    cursor={{ fill: "#F8FAFC" }}
                    contentStyle={{
                      borderRadius: "12px",
                      border: "none",
                      boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                      padding: "12px",
                    }}
                  />
                  <Bar dataKey="count" name="需求数量" fill="#3B82F6" radius={[6, 6, 0, 0]} barSize={28} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
