"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Star, Save, Send, Info } from "lucide-react";
import { authorizedFetch } from "../../../../lib/authFetch";

interface ScoreTaskDetail {
  id: number;
  period: string;
  status: "pending" | "completed" | "missed" | "reminded";
  departmentId: number | null;
  departmentName: string | null;
  targetUserId: number;
  targetUserName: string;
  targetUserEmail: string | null;
  targetUserRole: string | null;
}

type ScoreWindowPhase = "not_started" | "open" | "closed" | "unknown";

interface ScoringWindowInfo {
  start: string | null;
  end: string | null;
  phase: ScoreWindowPhase;
}

interface ScoreOption {
  value: number;
  label: string;
}

interface TemplateItem {
  label: string;
  max: number;
  required: boolean;
  options?: ScoreOption[];
}

interface ScoreTemplateResponse {
  template: {
    id: number;
    departmentId: number;
    name: string;
    items: TemplateItem[];
  };
}

const RatingSection = ({
  title,
  desc,
  value,
  max,
  options,
  disabled,
  onChange,
}: {
  title: string;
  desc: string;
  value: number;
  max: number;
  options?: ScoreOption[];
  disabled?: boolean;
  onChange: (val: number) => void;
}) => {
  const hasOptions = Array.isArray(options) && options.length > 0;
  const scale = Number.isFinite(max) && max > 0 ? Math.min(Math.max(max, 1), 10) : 5;
  const stars = Array.from({ length: scale }, (_, index) => index + 1);
  const selectedOption = hasOptions && options
    ? options.find((opt) => opt.value === value) || null
    : null;

  return (
    <div className="p-5 border border-slate-100 rounded-2xl bg-slate-50/50 hover:bg-white hover:shadow-sm transition-all">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-800">{title}</h3>
          <p className="text-sm text-slate-500 mt-1">{desc}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {hasOptions
            ? options!.map((opt) => (
                <button
                  key={`${opt.value}-${opt.label}`}
                  type="button"
                  onClick={() => {
                    if (disabled) return;
                    onChange(opt.value);
                  }}
                  className={`px-3 py-1.5 rounded-full border text-xs font-bold transition-all ${
                    disabled
                      ? value === opt.value
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-sm cursor-not-allowed opacity-80"
                        : "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                      : value === opt.value
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                          : "bg-white text-slate-700 border-slate-200 hover:border-indigo-300 hover:text-indigo-600"
                  }`}
                  disabled={disabled}
                >
                  {opt.label}（{opt.value} 分）
                </button>
              ))
            : stars.map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => {
                    if (disabled) return;
                    onChange(star);
                  }}
                  className={`transition-transform focus:outline-none ${
                    disabled
                      ? star <= value
                        ? "text-yellow-400 cursor-not-allowed"
                        : "text-slate-200 cursor-not-allowed"
                      : star <= value
                          ? "text-yellow-400 hover:scale-110"
                          : "text-slate-200 hover:text-yellow-200 hover:scale-110"
                  }`}
                  disabled={disabled}
                >
                  <Star className="w-7 h-7 fill-current" />
                </button>
              ))}
        </div>
      </div>
      {value > 0 && (
        <div className="mt-3 text-right text-sm font-bold text-indigo-600">
          {selectedOption
            ? `当前评分：${selectedOption.label}（${selectedOption.value} 分）`
            : `当前评分：${value} / ${max}`}
        </div>
      )}
    </div>
  );
};

export default function RatingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const idParam = params?.id as string;

  const [task, setTask] = useState<ScoreTaskDetail | null>(null);
  const [template, setTemplate] = useState<ScoreTemplateResponse["template"] | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [comment, setComment] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [scoringWindow, setScoringWindow] = useState<ScoringWindowInfo | null>(null);

  useEffect(() => {
    const loadData = async () => {
      if (!idParam) {
        setError("评分任务不存在");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        setSuccess(null);

        const taskRes = await authorizedFetch(`/api/scores/my-tasks?taskId=${encodeURIComponent(idParam)}`);
        if (!taskRes.ok) {
          const text = await taskRes.text();
          console.error("load score task detail error", text);
          if (taskRes.status === 401) {
            setError("登录已失效，请重新登录后再试");
          } else if (taskRes.status === 403) {
            setError("您没有权限查看该评分任务");
          } else if (taskRes.status === 404) {
            setError("评分任务不存在或已被删除");
          } else {
            setError("加载评分任务失败，请稍后重试");
          }
          setLoading(false);
          return;
        }

        const taskJson = await taskRes.json();
        const items = (taskJson.items || []) as any[];
        if (!items.length) {
          setError("评分任务不存在或已被删除");
          setLoading(false);
          return;
        }

        if (taskJson.scoringWindow && typeof taskJson.scoringWindow === "object") {
          setScoringWindow({
            start: taskJson.scoringWindow.start ?? null,
            end: taskJson.scoringWindow.end ?? null,
            phase: (taskJson.scoringWindow.phase as ScoreWindowPhase) ?? "unknown",
          });
        } else {
          setScoringWindow(null);
        }

        const rawTask = items[0];
        const detail: ScoreTaskDetail = {
          id: rawTask.id,
          period: rawTask.period,
          status: rawTask.status,
          departmentId: rawTask.departmentId ?? null,
          departmentName: rawTask.departmentName ?? null,
          targetUserId: rawTask.targetUserId,
          targetUserName: rawTask.targetUserName,
          targetUserEmail: rawTask.targetUserEmail ?? null,
          targetUserRole: rawTask.targetUserRole ?? null,
        };

        setTask(detail);

        if (!detail.departmentId) {
          setError("该评分任务未绑定部门，无法加载评分模板");
          setLoading(false);
          return;
        }

        const tplRes = await authorizedFetch(
          `/api/scores/templates?departmentId=${encodeURIComponent(String(detail.departmentId))}`,
        );
        if (!tplRes.ok) {
          const text = await tplRes.text();
          console.error("load score template error", text);
          if (tplRes.status === 401) {
            setError("登录已失效，请重新登录后再试");
          } else if (tplRes.status === 403) {
            setError("您没有权限查看评分模板，请联系管理员");
          } else if (tplRes.status === 404) {
            setError("当前部门暂无启用的评分模板，请联系管理员配置");
          } else {
            setError("加载评分模板失败，请稍后重试");
          }
          setLoading(false);
          return;
        }

        const tplJson = (await tplRes.json()) as ScoreTemplateResponse;
        const tpl = tplJson.template;
        setTemplate(tpl);

        const initialScores: Record<string, number> = {};
        (tpl.items || []).forEach((item) => {
          initialScores[item.label] = 0;
        });
        setScores(initialScores);

        // 如果任务已完成，则尝试加载历史评分记录，以便在详情页展示已选中的档位
        if (detail.status === "completed") {
          try {
            const recordRes = await authorizedFetch(
              `/api/scores/record?taskId=${encodeURIComponent(String(detail.id))}`,
            );
            if (recordRes.ok) {
              const recordJson = (await recordRes.json()) as {
                record?: { scores?: Record<string, number>; comment?: string };
              };
              if (recordJson.record?.scores) {
                setScores((prev) => ({
                  ...prev,
                  ...recordJson.record!.scores,
                }));
              }
              if (typeof recordJson.record?.comment === "string") {
                setComment(recordJson.record.comment);
              }
            }
          } catch (e) {
            console.error("load score record error", e);
          }
        }
      } catch (e) {
        console.error("load score detail error", e);
        setError("加载评分任务失败，请检查网络后重试");
        setScoringWindow(null);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [idParam]);

  const handleRate = (label: string, value: number) => {
    const windowPhase: ScoreWindowPhase | null = scoringWindow?.phase ?? null;
    const isWindowOpen = windowPhase === "open";
    const isReadOnly = task?.status === "completed" || (windowPhase !== null && !isWindowOpen);
    if (isReadOnly) {
      return;
    }
    setScores((prev) => ({ ...prev, [label]: value }));
  };

  const handleSubmit = async () => {
    if (!task || !template) {
      return;
    }

    const windowPhase: ScoreWindowPhase | null = scoringWindow?.phase ?? null;
    const isWindowOpen = windowPhase === "open";
    const isReadOnly = task.status === "completed" || (windowPhase !== null && !isWindowOpen);

    if (task.status === "completed") {
      setError("该评分任务已完成，不能重复提交");
      return;
    }

    if (!isWindowOpen && windowPhase !== null) {
      if (windowPhase === "not_started") {
        setError("当前评分窗口尚未开启，请在评分窗口内再提交。");
      } else if (windowPhase === "closed") {
        setError("当前评分窗口已结束，如需补录或调整，请联系管理员。");
      } else {
        setError("当前暂无有效评分窗口配置，暂不支持提交评分。");
      }
      return;
    }

    const missingRequired = template.items.find((item) => item.required && (!scores[item.label] || scores[item.label] <= 0));
    if (missingRequired) {
      setError(`请先完成“${missingRequired.label}”的评分`);
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setSuccess(null);

      const res = await authorizedFetch("/api/scores/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: task.id,
          scores,
          comment,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("submit score error", text);
        if (res.status === 401) {
          setError("登录已失效，请重新登录后再试");
        } else if (res.status === 403) {
          setError("您没有权限提交该评分任务");
        } else if (res.status === 404) {
          setError("评分任务不存在或已被删除");
        } else {
          try {
            const json = JSON.parse(text);
            if (json?.detail) {
              setError(typeof json.detail === "string" ? json.detail : "提交评分失败，请稍后重试");
            } else {
              setError("提交评分失败，请稍后重试");
            }
          } catch {
            setError("提交评分失败，请稍后重试");
          }
        }
        return;
      }

      setSuccess("评分已提交！");
      setTimeout(() => {
        router.push("/scoring");
      }, 800);
    } catch (e) {
      console.error("submit score error", e);
      setError("提交评分失败，请检查网络后重试");
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    router.push("/scoring");
  };

  const headerName = task?.targetUserName || "";
  const headerDept = task?.departmentName || "";
  const headerRole = task?.targetUserRole || "";

  return (
    <div className="max-w-3xl mx-auto pb-10">
      <button
        type="button"
        onClick={handleBack}
        className="flex items-center text-slate-500 hover:text-slate-800 mb-6 font-medium transition-colors"
      >
        <ArrowLeft className="w-5 h-5 mr-2" />
        返回评分列表
      </button>

      <div className="bg-white rounded-3xl shadow-lg border border-slate-200 overflow-hidden">
        <div className="bg-indigo-600 p-8 text-white">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center text-3xl font-bold shadow-inner">
              {(headerName || "").trim().charAt(0) || "U"}
            </div>
            <div>
              <h1 className="text-2xl font-bold mb-1">{headerName || "绩效评估"}</h1>
              <p className="text-indigo-100 opacity-90 flex flex-wrap items-center gap-2">
                {headerDept && <span>{headerDept}</span>}
                {headerRole && <span>· {headerRole}</span>}
                {task?.period && <span>· {task.period} 评分周期</span>}
              </p>
            </div>
          </div>
        </div>

        <div className="p-8 space-y-6">
          {error && (
            <div className="text-xs text-rose-600 bg-rose-50 border border-rose-100 px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          {success && (
            <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-2 rounded-lg">
              {success}
            </div>
          )}

          <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4 flex gap-3">
            <Info className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-800 leading-relaxed">
              请根据该员工的实际表现进行客观打分。评分一经提交不可修改，如需调整请联系管理员协助处理。
            </p>
          </div>

          {loading && (
            <div className="p-8 text-center text-slate-400">正在加载评分任务...</div>
          )}

          {!loading && template && (
            <div className="space-y-6">
              {template.items.map((item) => {
                const windowPhase: ScoreWindowPhase | null = scoringWindow?.phase ?? null;
                const isWindowOpen = windowPhase === "open";
                const isReadOnlyForItem =
                  task?.status === "completed" || (windowPhase !== null && !isWindowOpen);

                return (
                  <RatingSection
                    key={item.label}
                    title={item.label}
                    desc={
                      (Array.isArray(item.options) && item.options.length > 0
                        ? `可选档位：${item.options
                            .map((opt) => `${opt.label}(${opt.value}分)`)
                            .join(" / ")}`
                        : `满分 ${item.max} 分`) + (item.required ? "（必填）" : "")
                    }
                    value={scores[item.label] || 0}
                    max={item.max}
                    options={item.options}
                    disabled={isReadOnlyForItem}
                    onChange={(val) => handleRate(item.label, val)}
                  />
                );
              })}
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-slate-100">
            <label className="block text-base font-bold text-slate-800 mb-2">如有其他建议，请反馈</label>
            <textarea
              rows={4}
              placeholder="请输入具体的优点或改进建议..."
              className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none disabled:bg-slate-50 disabled:text-slate-400"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              disabled={
                task?.status === "completed" ||
                (scoringWindow?.phase && scoringWindow.phase !== "open")
              }
            />
          </div>

          <div className="mt-6 flex justify-end gap-4">
            <button
              type="button"
              onClick={handleBack}
              className="px-6 py-3 text-slate-600 font-bold hover:bg-slate-50 rounded-xl border border-transparent hover:border-slate-200 transition-all flex items-center gap-2"
              disabled={submitting}
            >
              <Save className="w-4 h-4" /> 暂存
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={
                submitting ||
                loading ||
                !template ||
                task?.status === "completed" ||
                (scoringWindow?.phase && scoringWindow.phase !== "open")
              }
              className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-md hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {task?.status === "completed"
                ? "已完成"
                : submitting
                ? "提交中..."
                : scoringWindow?.phase && scoringWindow.phase !== "open"
                ? "窗口外不可提交"
                : "提交评估"} <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
