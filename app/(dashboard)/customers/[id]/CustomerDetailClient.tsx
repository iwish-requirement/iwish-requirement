"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Building2, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import { authorizedFetch } from "../../../../lib/authFetch";

type Summary = {
  customer: { id: number; name: string; level?: string | null; status?: string | null; remark?: string | null };
  projects: { id: number; name: string; type?: string | null; url?: string | null; status?: string | null }[];
  metrics: {
    totalDemands: number;
    completedDemands: number;
    pendingDemands: number;
    delayRate: number;
    avgResponseHours: number;
    avgProcessingHours: number;
    avgDeliveryHours: number;
    involvedDepartments: { id: number; name: string }[];
  };
  demands: { id: string; title: string; status: string; departmentName: string; createdAt: string | null }[];
};

export default function CustomerDetailClient() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSummary = async () => {
      if (!id) return;
      try {
        setLoading(true);
        setError(null);
        const res = await authorizedFetch(`/api/customers/${encodeURIComponent(id)}/summary`);
        if (!res.ok) {
          console.error("load customer summary error", await res.text());
          setError("加载客户视图失败");
          return;
        }
        const json = await res.json();
        setSummary(json as Summary);
      } catch (e) {
        console.error("load customer summary error", e);
        setError("加载客户视图失败，请检查网络后重试");
      } finally {
        setLoading(false);
      }
    };
    loadSummary();
  }, [id]);

  if (loading) {
    return <div className="p-8 text-sm text-slate-400">正在加载客户视图...</div>;
  }

  if (error || !summary) {
    return (
      <div className="space-y-4">
        <button onClick={() => router.back()} className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-800">
          <ArrowLeft className="w-4 h-4" /> 返回
        </button>
        <div className="rounded-2xl border border-rose-100 bg-rose-50 p-6 text-rose-700">{error || "客户不存在"}</div>
      </div>
    );
  }

  const involvedDepartments = summary.metrics.involvedDepartments.map((item) => item.name).join("、") || "暂无";
  const cards = [
    { label: "需求总量", value: summary.metrics.totalDemands, icon: Building2 },
    { label: "已完成", value: summary.metrics.completedDemands, icon: CheckCircle2 },
    { label: "平均响应", value: `${summary.metrics.avgResponseHours.toFixed(1)}h`, icon: Clock },
    { label: "延期率", value: `${(summary.metrics.delayRate * 100).toFixed(0)}%`, icon: AlertTriangle },
  ];

  return (
    <div className="space-y-6 pb-10">
      <button onClick={() => router.back()} className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-800">
        <ArrowLeft className="w-4 h-4" /> 返回
      </button>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{summary.customer.name}</h1>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {summary.customer.level && <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700 border border-blue-100">{summary.customer.level}</span>}
              {summary.customer.status && <span className="rounded-full bg-slate-50 px-3 py-1 text-slate-600 border border-slate-200">{summary.customer.status}</span>}
            </div>
            {summary.customer.remark && <p className="mt-3 text-sm text-slate-500">{summary.customer.remark}</p>}
          </div>
          <div className="text-xs text-slate-500">
            涉及部门：{involvedDepartments}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">{card.label}</span>
              <card.icon className="w-4 h-4 text-slate-400" />
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{card.value}</div>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-4">关联项目</h2>
          {summary.projects.length === 0 ? (
            <div className="text-sm text-slate-400">暂无项目。</div>
          ) : (
            <div className="space-y-3">
              {summary.projects.map((project) => (
                <div key={project.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <div className="font-semibold text-slate-800">{project.name}</div>
                  <div className="mt-1 text-xs text-slate-500">{project.type || project.status || "项目"}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-4">最近需求记录</h2>
          {summary.demands.length === 0 ? (
            <div className="text-sm text-slate-400">暂无需求。</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {summary.demands.map((demand) => (
                <button
                  key={demand.id}
                  onClick={() => router.push(`/demands/${demand.id}`)}
                  className="w-full py-3 text-left hover:bg-slate-50"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 truncate">{demand.title}</div>
                      <div className="text-xs text-slate-500">{demand.departmentName} · {demand.id}</div>
                    </div>
                    <span className="text-xs text-slate-500">{demand.status}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
