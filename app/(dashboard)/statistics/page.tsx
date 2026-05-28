"use client";

import React, { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Download } from "lucide-react";
import { authorizedFetch } from "../../../lib/authFetch";
import { loadClientBusinessUser, type ClientBusinessUser } from "../../../lib/clientBusinessUser";
import DynamicFieldStatisticsSection from "./DynamicFieldStatisticsSection";

const COLORS = ["#2563EB", "#7C3AED", "#DB2777", "#F59E0B"];

interface ScoreUserStat {
  targetUserId: number;
  targetUserName: string;
  targetUserEmail: string | null;
  departmentName: string | null;
  avgScore: number;
  recordsCount: number;
}

interface ScoreDetailItem {
  id: number;
  taskId: number;
  scorerId: number;
  scorerName: string;
  scorerEmail: string | null;
  departmentName: string | null;
  period: string;
  scores: Record<string, number>;
  avgScore: number;
  comment: string;
  createdAt: string | null;
}

interface OverviewMetrics {
  demandsCreated: number;
  demandsCompleted: number;
  demandsInProgress: number;
  demandsDelayed: number;
  avgCycleDays: number;
  avgAssignHours: number;
  avgResponseHours: number;
  avgProcessingHours: number;
  completionRate: number;
  delayRate: number;
  scoreAvg: number;
  scoreCoverageRate: number;
}

interface DepartmentShareItem {
  departmentId: number;
  departmentName: string;
  value: number;
}

interface TrendPoint {
  name: string;
  demands: number;
  completed: number;
}

interface BreakdownItem {
  id: string;
  name: string;
  value: number;
}

interface DepartmentMemberStat {
  userId: number;
  userName: string;
  userEmail: string | null;
  role: string | null;
  demandsAssignee: number;
  demandsCompleted: number;
  materialCount: number;
  imageMaterialCount?: number;
  videoMaterialCount?: number;
  pageCount?: number;
  avgCycleDays: number;
  scoreAvg: number;
  scoreCount: number;
}

interface DepartmentOption {
  id: number;
  name: string;
}

function getPeriodOptions(): { current: string; previous: string } {
  const now = new Date();
  const year = now.getFullYear();
  const monthIndex = now.getMonth();

  const currentDate = new Date(year, monthIndex, 1);
  const previousDate = new Date(year, monthIndex - 1, 1);

  const format = (d: Date) => {
    const y = d.getFullYear();
    const m = `${d.getMonth() + 1}`.padStart(2, "0");
    return `${y}-${m}`;
  };

  return {
    current: format(currentDate),
    previous: format(previousDate),
  };
}

function formatPeriodTitle(period: string | null): string {
  if (!period) {
    return "本月 评分概览";
  }

  const match = /^(\d{4})-(\d{2})$/.exec(period.trim());
  if (!match) {
    return "本月 评分概览";
  }

  const year = match[1];
  const month = match[2].replace(/^0/, "");
  return `${year}年${month}月 评分概览`;
}

export default function StatsPage() {
  const [currentUser, setCurrentUser] = useState<ClientBusinessUser | null>(null);
  const [currentUserLoaded, setCurrentUserLoaded] = useState(false);
  const [scoreStats, setScoreStats] = useState<ScoreUserStat[]>([]);
  const [loadingScores, setLoadingScores] = useState(false);
  const [errorScores, setErrorScores] = useState<string | null>(null);

  const { current: currentPeriod, previous: previousPeriod } = getPeriodOptions();
  const [selectedPeriod, setSelectedPeriod] = useState<string>(previousPeriod);

  const [overviewMetrics, setOverviewMetrics] = useState<OverviewMetrics | null>(null);
  const [departmentShare, setDepartmentShare] = useState<DepartmentShareItem[]>([]);
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [customerRanking, setCustomerRanking] = useState<BreakdownItem[]>([]);
  const [projectRanking, setProjectRanking] = useState<BreakdownItem[]>([]);
  const [demandTypeDistribution, setDemandTypeDistribution] = useState<BreakdownItem[]>([]);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [errorOverview, setErrorOverview] = useState<string | null>(null);

  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string>("all");


  const [memberStats, setMemberStats] = useState<DepartmentMemberStat[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [errorMembers, setErrorMembers] = useState<string | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailRecords, setDetailRecords] = useState<ScoreDetailItem[]>([]);
  const [detailUser, setDetailUser] = useState<{
    name: string;
    email: string | null;
    departmentName: string | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadCurrentUser = async () => {
      const user = await loadClientBusinessUser();
      if (!cancelled) {
        setCurrentUser(user);
        setCurrentUserLoaded(true);
      }
    };

    loadCurrentUser();

    return () => {
      cancelled = true;
    };
  }, []);

  const canViewCompanyStats = currentUser?.role === "admin";
  const ownDepartmentId = currentUser?.departmentId ? String(currentUser.departmentId) : "";
  const availableDepartments = canViewCompanyStats
    ? departments
    : departments.filter((dept) => String(dept.id) === ownDepartmentId);

  useEffect(() => {
    if (!currentUserLoaded || canViewCompanyStats || !ownDepartmentId) {
      return;
    }
    if (selectedDeptId !== ownDepartmentId) {
      setSelectedDeptId(ownDepartmentId);
    }
  }, [canViewCompanyStats, currentUserLoaded, ownDepartmentId, selectedDeptId]);

  useEffect(() => {
    if (!currentUserLoaded) {
      return;
    }

    let cancelled = false;

    const loadScoreStats = async () => {
      try {
        setLoadingScores(true);
        setErrorScores(null);
        const params = new URLSearchParams();
        if (selectedPeriod) {
          params.set("period", selectedPeriod);
        }
        if (selectedDeptId && selectedDeptId !== "all") {
          params.set("departmentId", selectedDeptId);
        }
        const qs = params.toString();
        const res = await authorizedFetch(`/api/scores/statistics${qs ? `?${qs}` : ""}`);
        if (!res.ok) {
          const text = await res.text();
          console.error("load score statistics error", text);
          setErrorScores("加载评分统计失败，请稍后重试");
          return;
        }
        const json = (await res.json()) as { items?: ScoreUserStat[] };
        if (!cancelled) {
          setScoreStats(Array.isArray(json.items) ? json.items : []);
        }
      } catch (e) {
        console.error("load score statistics error", e);
        if (!cancelled) {
          setErrorScores("加载评分统计失败，请检查网络后重试");
        }
      } finally {
        if (!cancelled) {
          setLoadingScores(false);
        }
      }
    };

    const loadDepartments = async () => {
      try {
        const res = await authorizedFetch("/api/departments");
        if (!res.ok) {
          const text = await res.text();
          console.error("load statistics departments error", text);
          return;
        }
        const json = await res.json();
        const items = (json.items || []) as { id: number; name: string }[];
        const mapped: DepartmentOption[] = items.map((item) => ({ id: item.id, name: item.name }));
        if (!cancelled) {
          setDepartments(mapped);
        }
      } catch (e) {
        console.error("load statistics departments error", e);
      }
    };

    loadScoreStats();
    loadDepartments();

    return () => {
      cancelled = true;
    };
  }, [currentUserLoaded, selectedDeptId, selectedPeriod]);

  const titleText = formatPeriodTitle(selectedPeriod);

  useEffect(() => {
    let cancelled = false;

    const loadOverview = async () => {
      if (!currentUserLoaded) {
        return;
      }

      try {
        setLoadingOverview(true);
        setErrorOverview(null);

        const params = new URLSearchParams();
        if (selectedPeriod) {
          params.set("period", selectedPeriod);
        }
        if (selectedDeptId && selectedDeptId !== "all") {
          params.set("departmentId", selectedDeptId);
        }
        const qs = params.toString();
        const url = `/api/demands/stats/overview${qs ? `?${qs}` : ""}`;

        const res = await authorizedFetch(url);
        if (!res.ok) {
          const text = await res.text();
          console.error("load overview statistics error", text);
          if (!cancelled) {
            setErrorOverview("加载需求总览统计失败，请稍后重试");
            setOverviewMetrics(null);
            setDepartmentShare([]);
            setTrendData([]);
            setCustomerRanking([]);
            setProjectRanking([]);
            setDemandTypeDistribution([]);
          }
          return;
        }
        const json = (await res.json()) as {
          metrics: OverviewMetrics;
          departmentShare: DepartmentShareItem[];
          trend: TrendPoint[];
          customerRanking?: BreakdownItem[];
          projectRanking?: BreakdownItem[];
          demandTypeDistribution?: BreakdownItem[];
        };
        if (!cancelled) {
          setOverviewMetrics(json.metrics || null);
          setDepartmentShare(Array.isArray(json.departmentShare) ? json.departmentShare : []);
          setTrendData(Array.isArray(json.trend) ? json.trend : []);
          setCustomerRanking(Array.isArray(json.customerRanking) ? json.customerRanking : []);
          setProjectRanking(Array.isArray(json.projectRanking) ? json.projectRanking : []);
          setDemandTypeDistribution(Array.isArray(json.demandTypeDistribution) ? json.demandTypeDistribution : []);
        }
      } catch (e) {
        console.error("load overview statistics error", e);
        if (!cancelled) {
          setErrorOverview("加载需求总览统计失败，请检查网络后重试");
          setOverviewMetrics(null);
          setDepartmentShare([]);
          setTrendData([]);
          setCustomerRanking([]);
          setProjectRanking([]);
          setDemandTypeDistribution([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingOverview(false);
        }
      }
    };

    loadOverview();

    return () => {
      cancelled = true;
    };
  }, [currentUserLoaded, selectedDeptId, selectedPeriod]);


  useEffect(() => {
    let cancelled = false;

    const loadMemberStats = async () => {
      if (!currentUserLoaded) {
        return;
      }
      if (selectedDeptId === "all") {
        setMemberStats([]);
        return;
      }
      try {
        setLoadingMembers(true);
        setErrorMembers(null);
        const params = new URLSearchParams();
        params.set("departmentId", selectedDeptId);
        if (selectedPeriod) {
          params.set("period", selectedPeriod);
        }
        const qs = params.toString();
        const url = `/api/demands/stats/members?${qs}`;
        const res = await authorizedFetch(url);
        if (!res.ok) {
          const text = await res.text();
          console.error("load member statistics error", text);
          if (!cancelled) {
            setErrorMembers("加载部门成员统计失败，请稍后重试");
            setMemberStats([]);
          }
          return;
        }
        const json = (await res.json()) as { items?: DepartmentMemberStat[] };
        if (!cancelled) {
          setMemberStats(Array.isArray(json.items) ? json.items : []);
        }
      } catch (e) {
        console.error("load member statistics error", e);
        if (!cancelled) {
          setErrorMembers("加载部门成员统计失败，请检查网络后重试");
          setMemberStats([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingMembers(false);
        }
      }
    };

    loadMemberStats();

    return () => {
      cancelled = true;
    };
  }, [currentUserLoaded, selectedDeptId, selectedPeriod]);

  const filteredStats = React.useMemo(
    () => {
      if (selectedDeptId === "all") {
        return scoreStats;
      }
      const targetDept = departments.find((dept) => String(dept.id) === selectedDeptId);
      if (!targetDept) {
        return scoreStats;
      }
      return scoreStats.filter((item) => item.departmentName === targetDept.name);
    },
    [scoreStats, selectedDeptId, departments],
  );

  const handleOpenUserDetail = async (item: ScoreUserStat) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailError(null);
    setDetailRecords([]);
    setDetailUser({
      name: item.targetUserName,
      email: item.targetUserEmail,
      departmentName: item.departmentName,
    });

    try {
      const params = new URLSearchParams();
      params.set("targetUserId", String(item.targetUserId));
      if (selectedPeriod) {
        params.set("period", selectedPeriod);
      }
      if (selectedDeptId && selectedDeptId !== "all") {
        params.set("departmentId", selectedDeptId);
      }
      const res = await authorizedFetch(`/api/scores/user-detail?${params.toString()}`);
      if (!res.ok) {
        const text = await res.text();
        console.error("load score user-detail error", text);
        setDetailError("加载该同事的评分明细失败，请稍后重试");
        setDetailRecords([]);
        return;
      }
      const json = (await res.json()) as { items?: ScoreDetailItem[] };
      setDetailRecords(Array.isArray(json.items) ? json.items : []);
    } catch (e) {
      console.error("load score user-detail error", e);
      setDetailError("加载该同事的评分明细失败，请检查网络后重试");
      setDetailRecords([]);
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">

        <div>
          <h1 className="text-3xl font-bold text-slate-900">数据统计</h1>
          <p className="mt-1 text-sm text-slate-500">{titleText}</p>
        </div>
        <button className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white border border-slate-300 text-slate-700 px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors shadow-sm">
          <Download className="w-4 h-4" />
          导出报表
        </button>
      </div>

      <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="text-slate-500">统计周期：</span>
            <div className="inline-flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedPeriod(previousPeriod)}
                className={`px-3 py-1.5 rounded-full border transition-colors ${
                  selectedPeriod === previousPeriod
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                上个月
              </button>
              <button
                type="button"
                onClick={() => setSelectedPeriod(currentPeriod)}
                className={`px-3 py-1.5 rounded-full border transition-colors ${
                  selectedPeriod === currentPeriod
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                本月
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">统计范围：</span>
            <select
              value={selectedDeptId}
              onChange={(e) => {
                const next = e.target.value;
                setSelectedDeptId(next);
              }}
              className="px-3 py-1.5 text-xs border border-slate-200 rounded-full bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >

              {canViewCompanyStats && <option value="all">全公司</option>}
              {availableDepartments.map((dept) => (
                <option key={dept.id} value={String(dept.id)}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {errorOverview && (
          <div className="mb-3 text-xs text-rose-600 bg-rose-50 border border-rose-100 px-3 py-2 rounded-lg">
            {errorOverview}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <div className="text-xs text-slate-500 mb-1">新增需求数</div>
            <div className="text-2xl font-bold text-slate-900">
              {overviewMetrics ? overviewMetrics.demandsCreated : "--"}
            </div>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <div className="text-xs text-slate-500 mb-1">已完成需求数</div>
            <div className="text-2xl font-bold text-emerald-600">
              {overviewMetrics ? overviewMetrics.demandsCompleted : "--"}
            </div>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <div className="text-xs text-slate-500 mb-1">平均处理周期（天）</div>
            <div className="text-2xl font-bold text-indigo-600">
              {overviewMetrics ? overviewMetrics.avgCycleDays.toFixed(1) : "--"}
            </div>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <div className="text-xs text-slate-500 mb-1">平均评分 / 覆盖率</div>
            <div className="text-sm font-semibold text-slate-900">
              {overviewMetrics
                ? `${overviewMetrics.scoreAvg.toFixed(2)} 分 · ${(overviewMetrics.scoreCoverageRate * 100).toFixed(0)}%`
                : "--"}
            </div>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <div className="text-xs text-slate-500 mb-1">响应时长（小时）</div>
            <div className="text-2xl font-bold text-blue-600">
              {overviewMetrics ? overviewMetrics.avgResponseHours.toFixed(1) : "--"}
            </div>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <div className="text-xs text-slate-500 mb-1">处理时长（小时）</div>
            <div className="text-2xl font-bold text-cyan-700">
              {overviewMetrics ? overviewMetrics.avgProcessingHours.toFixed(1) : "--"}
            </div>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <div className="text-xs text-slate-500 mb-1">完成率</div>
            <div className="text-2xl font-bold text-emerald-600">
              {overviewMetrics ? `${(overviewMetrics.completionRate * 100).toFixed(0)}%` : "--"}
            </div>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <div className="text-xs text-slate-500 mb-1">延期率</div>
            <div className="text-2xl font-bold text-amber-600">
              {overviewMetrics ? `${(overviewMetrics.delayRate * 100).toFixed(0)}%` : "--"}
            </div>
          </div>
        </div>
      </div>

      <DynamicFieldStatisticsSection selectedDeptId={selectedDeptId} selectedPeriod={selectedPeriod} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {[
          { title: "客户需求排行", items: customerRanking },
          { title: "项目需求排行", items: projectRanking },
          { title: "需求类型分布", items: demandTypeDistribution },
        ].map((section) => (
          <div key={section.title} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-4">{section.title}</h3>
            {section.items.length === 0 ? (
              <div className="text-xs text-slate-400">当前周期暂无可统计数据。</div>
            ) : (
              <div className="space-y-3">
                {section.items.map((item, index) => (
                  <div key={item.id} className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex items-center gap-2">
                      <span className="text-xs text-slate-400 w-5">{index + 1}</span>
                      <span className="text-sm font-medium text-slate-700 truncate">{item.name}</span>
                    </div>
                    <span className="text-sm font-bold text-slate-900">{item.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">



        <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-xl font-bold text-slate-900 mb-2">部门需求占比</h3>
          <p className="text-xs text-slate-500 mb-4">
            按部门维度统计在当前周期内创建的需求数量，用于快速判断各团队的需求承载量是否均衡。
          </p>
          <div className="h-80 flex items-center justify-center">
            {departmentShare.length === 0 ? (
              <div className="text-xs text-slate-400">当前筛选条件下暂无需求数据。</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={departmentShare}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={110}
                    paddingAngle={5}
                    dataKey="value"
                    nameKey="departmentName"
                  >
                    {departmentShare.map((entry, index) => (
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
                    itemStyle={{ fontSize: "14px", fontWeight: 500 }}
                    formatter={(value: number, _name: string, item: any) => {
                      const total = departmentShare.reduce((sum, d) => sum + d.value, 0) || 1;
                      const percent = ((value / total) * 100).toFixed(1);
                      return [`${value} 条 (${percent}%)`, item.payload.departmentName as string];
                    }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>




        <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-xl font-bold text-slate-900 mb-2">半年需求趋势</h3>
          <p className="text-xs text-slate-500 mb-4">
            最近六个月内，每月新增需求数与完成数的对比，帮助判断整体交付节奏是否稳定。
          </p>
          <div className="h-80 flex items-center justify-center">
            {trendData.length === 0 ? (
              <div className="text-xs text-slate-400">暂无趋势数据，请稍后再试或调整筛选条件。</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#64748B", fontSize: 12 }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#64748B", fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "12px",
                      border: "none",
                      boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                      padding: "12px",
                    }}
                    itemStyle={{ fontSize: "13px", fontWeight: 500 }}
                  />
                  <Legend wrapperStyle={{ paddingTop: "20px" }} />
                  <Line
                    type="monotone"
                    dataKey="demands"
                    name="新增需求"
                    stroke="#2563EB"
                    strokeWidth={3}
                    dot={{ r: 3, fill: "#2563EB", strokeWidth: 2, stroke: "#fff" }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="completed"
                    name="已完成"
                    stroke="#10B981"
                    strokeWidth={3}
                    dot={{ r: 3, fill: "#10B981", strokeWidth: 2, stroke: "#fff" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm lg:col-span-2">
          <h3 className="text-xl font-bold text-slate-900 mb-2">月度交付产能分析</h3>
          <p className="text-xs text-slate-500 mb-4">
            以每月完成的需求数量作为交付产能的近似指标，帮助识别高峰期与淡季。
          </p>
          <div className="h-80 flex items-center justify-center">
            {trendData.length === 0 ? (
              <div className="text-xs text-slate-400">暂无产能分析数据，请稍后再试或调整筛选条件。</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendData} barGap={8}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#64748B", fontSize: 12 }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#64748B", fontSize: 12 }}
                  />
                  <Tooltip
                    cursor={{ fill: "#F8FAFC" }}
                    contentStyle={{
                      borderRadius: "12px",
                      border: "none",
                      boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                      padding: "12px",
                    }}
                  />
                  <Bar
                    dataKey="completed"
                    name="交付数量"
                    fill="#3B82F6"
                    radius={[6, 6, 0, 0]}
                    barSize={40}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {selectedDeptId !== "all" && (
        <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
            <h3 className="text-xl font-bold text-slate-900">部门成员统计</h3>
          </div>
          {errorMembers && (
            <div className="mb-3 text-xs text-rose-600 bg-rose-50 border border-rose-100 px-3 py-2 rounded-lg">
              {errorMembers}
            </div>
          )}
          {loadingMembers ? (
            <div className="p-4 text-sm text-slate-400">正在加载部门成员统计...</div>
          ) : memberStats.length === 0 ? (
            <div className="p-4 text-sm text-slate-400">当前部门在所选周期内暂无成员统计数据。</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs sm:text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-100">
                    <th className="py-2 pr-4 font-medium whitespace-nowrap">成员</th>
                    {/* 当前版本不展示成员角色列 */}
                    {/* <th className="py-2 px-4 font-medium whitespace-nowrap">角色</th> */}
                    <th className="py-2 px-4 font-medium whitespace-nowrap">负责需求数</th>
                    <th className="py-2 px-4 font-medium whitespace-nowrap">已完成需求数</th>
                    <th className="py-2 px-4 font-medium whitespace-nowrap">素材合计</th>
                    <th className="py-2 px-4 font-medium whitespace-nowrap">平面素材</th>
                    <th className="py-2 px-4 font-medium whitespace-nowrap">视频数量</th>
                    <th className="py-2 px-4 font-medium whitespace-nowrap">页面数量</th>
                    <th className="py-2 px-4 font-medium whitespace-nowrap">平均处理天数</th>
                    <th className="py-2 px-4 font-medium whitespace-nowrap">平均评分</th>
                    <th className="py-2 px-4 font-medium whitespace-nowrap">评分次数</th>
                  </tr>
                </thead>
                <tbody>
                  {memberStats.map((m) => (
                    <tr key={m.userId} className="border-b border-slate-50 last:border-0">
                      <td className="py-2 pr-4">
                        <div className="font-semibold text-slate-900">{m.userName}</div>
                        {m.userEmail && (
                          <div className="text-[11px] text-slate-400">{m.userEmail}</div>
                        )}
                      </td>
                      {/* 当前版本不展示成员角色列 */}
                      {/*
                      <td className="py-2 px-4 text-slate-700">
                        {m.role || <span className="text-slate-400">未设置角色</span>}
                      </td>
                      */}
                      <td className="py-2 px-4 text-slate-700">{m.demandsAssignee}</td>
                      <td className="py-2 px-4 text-slate-700">{m.demandsCompleted}</td>
                      <td className="py-2 px-4 text-slate-700">{m.materialCount ?? 0}</td>
                      <td className="py-2 px-4 text-slate-700">{m.imageMaterialCount ?? 0}</td>
                      <td className="py-2 px-4 text-slate-700">{m.videoMaterialCount ?? 0}</td>
                      <td className="py-2 px-4 text-slate-700">{m.pageCount ?? 0}</td>
                      <td className="py-2 px-4 text-slate-700">
                        {m.demandsCompleted > 0 ? m.avgCycleDays.toFixed(1) : "-"}
                      </td>
                      <td className="py-2 px-4 text-slate-700">
                        {m.scoreCount > 0 ? m.scoreAvg.toFixed(2) : "-"}
                      </td>
                      <td className="py-2 px-4 text-slate-700">{m.scoreCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3">
          <h3 className="text-xl font-bold text-slate-900">评分统计（按被评分人平均分）</h3>
          <p className="text-xs text-slate-500">
            当前评分视图与上方选择的统计周期和范围保持一致，用于从被评分人的视角补充团队整体交付感知。
          </p>
        </div>


        {errorScores && (
          <div className="mb-3 text-xs text-rose-600 bg-rose-50 border border-rose-100 px-3 py-2 rounded-lg">
            {errorScores}
          </div>
        )}

        {loadingScores ? (
          <div className="p-4 text-sm text-slate-400">正在加载评分统计...</div>
        ) : filteredStats.length === 0 ? (
          <div className="p-4 text-sm text-slate-400">暂时没有符合当前筛选条件的评分数据</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm sm:text-sm text-xs" style={{ writingMode: 'horizontal-tb' }}>
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-100">
                  <th className="py-2 pr-4 font-medium whitespace-nowrap min-w-[120px]">被评分人</th>
                  <th className="py-2 px-4 font-medium whitespace-nowrap min-w-[100px]">所属部门</th>
                  <th className="py-2 px-4 font-medium whitespace-nowrap min-w-[80px]">平均分</th>
                  <th className="py-2 px-4 font-medium whitespace-nowrap min-w-[80px]">评分次数</th>
                </tr>
              </thead>
              <tbody>
                {filteredStats.map((item) => (
                  <tr
                    key={item.targetUserId}
                    className="border-b border-slate-50 last:border-0 hover:bg-slate-50 cursor-pointer"
                    onClick={() => handleOpenUserDetail(item)}
                  >
                    <td className="py-2 pr-4">
                      <div className="font-semibold text-slate-900">{item.targetUserName}</div>
                      {item.targetUserEmail && (
                        <div className="text-xs text-slate-400">{item.targetUserEmail}</div>
                      )}
                    </td>
                    <td className="py-2 px-4 text-slate-700">
                      {item.departmentName || <span className="text-slate-400">未分配部门</span>}
                    </td>
                    <td className="py-2 px-4 font-semibold text-indigo-600">
                      {item.avgScore.toFixed(2)}
                    </td>
                    <td className="py-2 px-4 text-slate-700">{item.recordsCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {detailOpen && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/40">
          <button
            type="button"
            className="absolute inset-0 cursor-pointer"
            onClick={() => {
              setDetailOpen(false);
              setDetailError(null);
              setDetailRecords([]);
            }}
          />
          <div className="relative z-50 w-full sm:max-w-3xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 sm:p-8 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-start gap-4 mb-4">
              <div>
                <h4 className="text-lg font-bold text-slate-900">
                  {detailUser?.name || "评分明细"}
                </h4>
                <p className="mt-1 text-xs text-slate-500 flex flex-wrap gap-2">
                  {detailUser?.departmentName && <span>{detailUser.departmentName}</span>}
                  {detailUser?.email && <span className="text-slate-400">· {detailUser.email}</span>}
                  {selectedPeriod && <span className="text-slate-400">· {selectedPeriod} 评分周期</span>}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDetailOpen(false);
                  setDetailError(null);
                  setDetailRecords([]);
                }}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                关闭
              </button>
            </div>

            {detailError && (
              <div className="mb-3 text-xs text-rose-600 bg-rose-50 border border-rose-100 px-3 py-2 rounded-lg">
                {detailError}
              </div>
            )}

            {detailLoading ? (
              <div className="py-6 text-sm text-slate-400">正在加载评分明细...</div>
            ) : detailRecords.length === 0 ? (
              <div className="py-6 text-sm text-slate-400">该同事在当前筛选条件下暂无评分记录。</div>
            ) : (
              <div className="space-y-4">
                {detailRecords.map((record) => (
                  <div
                    key={record.id}
                    className="border border-slate-100 rounded-2xl p-4 bg-slate-50/40"
                  >
                    <div className="flex justify-between items-center mb-2">
                      <div>
                        <div className="text-xs font-semibold text-slate-700">
                          来自：{record.scorerName}
                        </div>
                        {record.scorerEmail && (
                          <div className="text-[11px] text-slate-400">{record.scorerEmail}</div>
                        )}
                      </div>
                      <div className="text-sm font-bold text-indigo-600">
                        平均 {record.avgScore.toFixed(2)} 分
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {Object.entries(record.scores).map(([label, value]) => (
                        <span
                          key={label}
                          className="inline-flex items-center px-2.5 py-1 rounded-full bg-white border border-slate-200 text-[11px] text-slate-700"
                        >
                          <span className="mr-1 text-slate-500">{label}：</span>
                          <span className="font-semibold text-slate-900">{value}</span>
                        </span>
                      ))}
                    </div>
                    {record.comment && (
                      <p className="mt-3 text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                        {record.comment}
                      </p>
                    )}
                    {record.createdAt && (
                      <div className="mt-2 text-[10px] text-slate-400">
                        提交时间：{record.createdAt}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
