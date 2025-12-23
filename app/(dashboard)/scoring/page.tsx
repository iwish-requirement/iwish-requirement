"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Star, AlertTriangle, CheckCircle2, ArrowRight, Info } from "lucide-react";
import { authorizedFetch } from "../../../lib/authFetch";

interface ScoreTaskItem {
  id: number;
  period: string;
  status: "pending" | "completed" | "missed" | "reminded";
  departmentId: number | null;
  departmentName: string | null;
  targetUserId: number;
  targetUserName: string;
  targetUserEmail: string | null;
  targetUserRole: string | null;
  templateId: number;
  createdAt: string | null;
  completedAt: string | null;
}

type ScoreWindowPhase = "not_started" | "open" | "closed" | "unknown";

interface ScoringWindowInfo {
  start: string | null;
  end: string | null;
  phase: ScoreWindowPhase;
}

const StatusBadge = ({ status }: { status: string }) => {
  if (status === "pending") {
    return (
      <span className="bg-yellow-50 text-yellow-700 border border-yellow-200 px-4 py-1.5 rounded-full text-sm font-bold flex items-center gap-1.5 shadow-sm">
        <AlertTriangle className="w-4 h-4" /> 待评分
      </span>
    );
  }

  if (status === "completed") {
    return (
      <span className="bg-green-50 text-green-700 border border-green-200 px-4 py-1.5 rounded-full text-sm font-bold flex items-center gap-1.5 shadow-sm">
        <CheckCircle2 className="w-4 h-4" /> 已完成
      </span>
    );
  }

  if (status === "missed") {
    return (
      <span className="bg-slate-50 text-slate-500 border border-slate-200 px-4 py-1.5 rounded-full text-sm font-bold flex items-center gap-1.5 shadow-sm">
        <AlertTriangle className="w-4 h-4" /> 已错过
      </span>
    );
  }

  return null;
};

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
    return "本月 评分";
  }

  const match = /^(\d{4})-(\d{2})$/.exec(period.trim());
  if (!match) {
    return "本月 评分管理";
  }

  const year = match[1];
  const month = match[2].replace(/^0/, "");
  return `${year}年${month}月 评分`;
}

export default function ScoringPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<ScoreTaskItem[]>([]);
  const [period, setPeriod] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [scoringWindow, setScoringWindow] = useState<ScoringWindowInfo | null>(null);
  const [showUpcomingTasks, setShowUpcomingTasks] = useState<boolean>(false);

  const { current: currentPeriod, previous: previousPeriod } = getPeriodOptions();
  const [selectedPeriod, setSelectedPeriod] = useState<string>(previousPeriod);
  const [selectedDeptId, setSelectedDeptId] = useState<string>("all");

  const formatWindowRange = (info: ScoringWindowInfo | null): string | null => {
    if (!info || !info.start || !info.end) {
      return null;
    }
    const startDate = new Date(info.start);
    const endDate = new Date(info.end);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return null;
    }
    const format = (date: Date) => {
      const month = `${date.getMonth() + 1}`.padStart(2, "0");
      const day = `${date.getDate()}`.padStart(2, "0");
      return `${month}月${day}日`;
    };
    const startText = format(startDate);
    const endText = format(endDate);
    return `${startText} ~ ${endText}`;
  };

  useEffect(() => {
    const loadTasks = async () => {
      try {
        setLoading(true);
        setError(null);
        const query = selectedPeriod ? `?period=${encodeURIComponent(selectedPeriod)}` : "";
        const res = await authorizedFetch(`/api/scores/my-tasks${query}`);
        if (!res.ok) {
          const text = await res.text();
          console.error("load score tasks error", text);
          if (res.status === 401) {
            setError("登录已失效，请重新登录后再试");
          } else if (res.status === 403) {
            setError("您没有权限查看评分任务，如需访问请联系系统管理员。");
          } else {
            setError("加载评分任务失败，请稍后重试");
          }
          setTasks([]);
          setScoringWindow(null);
          return;
        }
        const json = await res.json();
        const items = (json.items || []) as ScoreTaskItem[];
        setTasks(items);
        setPeriod(typeof json.period === "string" ? json.period : null);
        setScoringWindow(
          json.scoringWindow && typeof json.scoringWindow === "object"
            ? {
                start: json.scoringWindow.start ?? null,
                end: json.scoringWindow.end ?? null,
                phase: (json.scoringWindow.phase as ScoreWindowPhase) ?? "unknown",
              }
            : null,
        );
      } catch (e) {
        console.error("load score tasks error", e);
        setError("加载评分任务失败，请检查网络后重试");
        setTasks([]);
        setScoringWindow(null);
      } finally {
        setLoading(false);
      }
    };

    loadTasks();
  }, [selectedPeriod]);

  const departmentOptions = React.useMemo(() => {
    const map = new Map<number, { id: number; name: string }>();
    tasks.forEach((task) => {
      if (task.departmentId && task.departmentName) {
        map.set(task.departmentId, {
          id: task.departmentId,
          name: task.departmentName,
        });
      }
    });
    return Array.from(map.values());
  }, [tasks]);

  const filteredTasks = tasks.filter((task) => {
    if (selectedDeptId === "all") return true;
    if (!task.departmentId) return false;
    return String(task.departmentId) === selectedDeptId;
  });

  const pendingTasks = filteredTasks.filter((t) => t.status === "pending");
  const completedTasks = filteredTasks.filter((t) => t.status === "completed");

  const phase: ScoreWindowPhase = scoringWindow?.phase ?? "unknown";
  const isWindowOpen = phase === "open";
  const isWindowNotStarted = phase === "not_started";
  const isWindowClosed = phase === "closed";
  const windowRangeText = formatWindowRange(scoringWindow);
  const canInteract = isWindowOpen;

  const titleText = formatPeriodTitle(period);

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-10">
      <div className="bg-indigo-900 text-white rounded-3xl p-8 md:p-10 shadow-xl relative overflow-hidden">
        <div className="relative z-10">
          <h1 className="text-3xl md:text-4xl font-bold mb-3">{titleText}</h1>
          <p className="text-indigo-200 max-w-2xl text-lg leading-relaxed">
            请根据本周期的实际协作情况，客观的进行评分。
          </p>
        </div>
        <Star className="absolute -top-6 -right-6 text-white opacity-10 w-48 h-48 rotate-12" />
        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
      </div>

      {error && (
        <div className="text-xs text-rose-600 bg-rose-50 border border-rose-100 px-3 py-2 rounded-lg">
          {error}
        </div>
      )}

      {scoringWindow && (
        <div className="bg-white/80 backdrop-blur-sm border border-sky-100 rounded-2xl p-4 flex gap-3 items-start shadow-sm">
          <div className="mt-0.5">
            <Info
              className={`w-4 h-4 ${
                isWindowOpen
                  ? "text-emerald-500"
                  : isWindowNotStarted
                  ? "text-sky-500"
                  : isWindowClosed
                  ? "text-slate-400"
                  : "text-slate-300"
              }`}
            />
          </div>
          <div className="flex-1 text-sm">
            {isWindowOpen && (
              <>
                <div className="font-bold text-slate-800">
                  当前评分窗口已开启
                  {windowRangeText ? `（${windowRangeText}）` : ""}。
                </div>
                <div className="text-slate-500 mt-1">
                  请在窗口内尽快完成本周期的评分。
                </div>
              </>
            )}
            {isWindowNotStarted && (
              <>
                <div className="font-bold text-slate-800">
                  当前评分窗口尚未开启
                  {windowRangeText ? `，计划窗口：${windowRangeText}` : ""}。
                </div>
                <div className="text-slate-500 mt-1">
                  默认情况下，评分窗口为服务月最后一天至次月 5 号。
                </div>
              </>
            )}
            {isWindowClosed && (
              <>
                <div className="font-bold text-slate-800">
                  当前评分窗口已结束
                  {windowRangeText ? `（${windowRangeText}）` : ""}。
                </div>
                <div className="text-slate-500 mt-1">
                  如需补录或调整，请联系管理员协助处理。
                </div>
              </>
            )}
            {!isWindowOpen && !isWindowNotStarted && !isWindowClosed && (
              <div className="font-bold text-slate-800">当前暂无有效评分窗口配置。</div>
            )}
          </div>
        </div>
      )}

      <div className="space-y-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
              待评分任务
              <span className="bg-red-100 text-red-600 text-sm px-3 py-1 rounded-full font-extrabold">
                {pendingTasks.length}
              </span>
            </h2>
            {departmentOptions.length > 0 && (
              <select
                value={selectedDeptId}
                onChange={(e) => setSelectedDeptId(e.target.value)}
                className="px-3 py-1.5 text-xs border border-slate-200 rounded-full bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">全部部门</option>
                {departmentOptions.map((dept) => (
                  <option key={dept.id} value={String(dept.id)}>
                    {dept.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs">
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

        {loading && tasks.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-400">
            正在加载评分任务...
          </div>
        )}

        {!loading && pendingTasks.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-400">
            {isWindowOpen
              ? "当前没有需要完成的评分任务。"
              : isWindowNotStarted
              ? "当前评分窗口尚未开启，评分窗口开启后将自动出现需要完成的评分任务。"
              : isWindowClosed
              ? "当前评分窗口已结束，如需补录或调整，请联系管理员。"
              : "当前没有需要完成的评分任务。"}
          </div>
        )}

        {!loading && pendingTasks.length > 0 && !isWindowOpen && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="text-sm text-slate-600">
              当前评分窗口尚未开启
              {windowRangeText ? `，计划窗口时间：${windowRangeText}` : ""}。
              评分窗口开启后将自动开放本周期的评分任务。
            </div>
            <button
              type="button"
              onClick={() => setShowUpcomingTasks((prev) => !prev)}
              className="inline-flex items-center gap-1 px-4 py-2 rounded-full text-xs font-bold bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-100"
            >
              {showUpcomingTasks ? "收起即将开启的评分任务" : "查看即将开启的评分任务"}
            </button>
          </div>
        )}

        {(isWindowOpen || showUpcomingTasks) &&
          pendingTasks.map((task) => (
          <div
            key={task.id}
            className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm hover:shadow-md transition-all"
          >
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6">
              <div className="flex gap-5">
                <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center font-bold text-2xl shadow-inner">
                  {task.targetUserName.trim().charAt(0) || "U"}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{task.targetUserName}</h3>
                  <p className="text-base text-slate-500 mt-1">
                    {task.departmentName || "未分配部门"}
                    {task.targetUserRole ? ` · ${task.targetUserRole}` : ""}
                  </p>
                </div>
              </div>
              <StatusBadge status={task.status} />
            </div>

            <div
              className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6 bg-slate-50 p-5 rounded-xl border border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors"
              onClick={() => {
                if (!canInteract) return;
                router.push(`/scoring/${task.id}`);
              }}
            >
              <div className="pointer-events-none">
                <div className="flex flex-col mb-2">
                  <span className="text-base font-bold text-slate-800">本周期协作评价</span>
                  <span className="text-sm text-slate-400 mt-1">点击进入详情进行评分</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-4">
              <button
                className="px-6 py-3 text-base font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors border border-transparent hover:border-slate-200 disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={!canInteract}
              >
                暂存进度
              </button>
              <button
                onClick={() => {
                  if (!canInteract) return;
                  router.push(`/scoring/${task.id}`);
                }}
                disabled={!canInteract}
                className={`px-8 py-3 text-base rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                  canInteract
                    ? "bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg"
                    : "bg-slate-200 text-slate-500 cursor-not-allowed"
                }`}
              >
                {canInteract ? "开始评分" : "待窗口开启"} <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="pt-10 border-t border-slate-200">
        <h2 className="text-xl font-bold text-slate-900 mb-6 opacity-80">已完成记录</h2>
        {completedTasks.length === 0 ? (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center text-slate-400">
            当前周期暂无已完成的评分记录。
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {completedTasks.map((task) => (
              <div
                key={task.id}
                className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex justify-between items-center opacity-80 hover:opacity-100 transition-opacity cursor-pointer group"
                onClick={() => router.push(`/scoring/${task.id}`)}
              >
                <div className="flex gap-4 items-center">
                  <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center text-sm text-slate-600 font-bold group-hover:bg-white group-hover:text-blue-600 transition-colors">
                    {task.targetUserName.trim().charAt(0) || "U"}
                  </div>
                  <div>
                    <div className="text-base font-bold text-slate-700">{task.targetUserName}</div>
                    <div className="text-sm text-slate-400">
                      {task.period || "本周期"} 评分周期
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-green-600 text-sm font-bold bg-green-50 px-3 py-1 rounded-full">
                  <CheckCircle2 className="w-4 h-4" />
                  已完成
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
