"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, CheckCircle, Clock, TrendingUp, ArrowRight, AlertCircle, Plus, Image, Images, Video, LayoutTemplate } from 'lucide-react';
import { DemandStatus, Priority } from '../../types';
import { hasPermission } from '../../lib/permissions';
import { authorizedFetch } from '../../lib/authFetch';
import Badge from '../../components/ui/Badge';
import { loadClientBusinessUser } from '../../lib/clientBusinessUser';



const StatCard = ({ title, value, trend, icon: Icon, color, loading }: any) => (
  <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
    <div className="flex justify-between items-start">
      <div>
        <p className="text-base font-medium text-slate-500 mb-2">{title}</p>
        {loading ? (
          <div className="h-8 w-20 bg-slate-200 rounded-md animate-pulse" />
        ) : (
          <h3 className="text-3xl font-bold text-slate-900 tracking-tight">{value}</h3>
        )}
      </div>
      <div className={`p-3 rounded-xl ${color} bg-opacity-10`}>
        <Icon className={`w-6 h-6 ${color.replace('bg-', 'text-')}`} />
      </div>
    </div>
    {loading ? (
      <div className="mt-4 h-4 w-28 bg-slate-200 rounded-md animate-pulse" />
    ) : (
      trend && (
        <div className="mt-4 flex items-center text-sm font-medium text-green-600">
          <TrendingUp className="w-4 h-4 mr-1.5" />
          <span>{trend}</span>
        </div>
      )
    )}
  </div>
);


const DepartmentProgress = ({ onDeptClick }: { onDeptClick: (name: string) => void }) => {
  const [deptStats, setDeptStats] = useState<{ name: string; value: number; percent: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadDepartmentOverview = async () => {
      try {
        setLoading(true);
        setError(null);

        const now = new Date();
        const year = now.getFullYear();
        const month = `${now.getMonth() + 1}`.padStart(2, '0');
        const period = `${year}-${month}`;

        const res = await authorizedFetch(`/api/demands/stats/overview?period=${encodeURIComponent(period)}`);
        if (!res.ok) {
          console.error('dashboard load department overview error', await res.text());
          if (!cancelled) {
            setError('加载部门概览失败，请稍后重试');
            setDeptStats([]);
          }
          return;
        }

        const json = await res.json();
        const share = (json.departmentShare || []) as { departmentId: number; departmentName: string; value: number }[];
        if (cancelled) {
          return;
        }
        if (!Array.isArray(share) || share.length === 0) {
          setDeptStats([]);
          return;
        }

        const maxValue = share.reduce((max, item) => (item.value > max ? item.value : max), 0) || 0;
        const mapped = share.map((item) => ({
          name: item.departmentName || '未命名部门',
          value: item.value,
          percent: maxValue > 0 ? Math.round((item.value / maxValue) * 100) : 0,
        }));

        setDeptStats(mapped);
      } catch (error) {
        console.error('dashboard load department overview error', error);
        if (!cancelled) {
          setError('加载部门概览失败，请检查网络后重试');
          setDeptStats([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadDepartmentOverview();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <h3 className="text-xl font-bold text-slate-900 mb-6 tracking-tight">部门概览</h3>
      {error && (
        <div className="mb-3 text-xs text-rose-600 bg-rose-50 border border-rose-100 px-3 py-2 rounded-lg">
          {error}
        </div>
      )}
      {loading && deptStats.length === 0 ? (
        <div className="text-sm text-slate-400">正在加载各部门的需求概览...</div>
      ) : deptStats.length === 0 ? (
        <div className="text-sm text-slate-400">当前周期内暂无部门维度的需求数据。</div>
      ) : (
        <div className="space-y-6">
          {deptStats.map((dept) => (
            <div
              key={dept.name}
              className="group cursor-pointer"
              onClick={() => onDeptClick(dept.name)}
            >
              <div className="flex justify-between items-end mb-2">
                <span className="text-base font-bold text-slate-700 group-hover:text-blue-700 transition-colors">{dept.name}</span>
                <span className="text-sm font-medium text-slate-500">
                  <span className="text-slate-900 font-bold">{dept.value}</span>
                  <span className="text-slate-400 text-xs ml-1">本月需求数</span>
                </span>
              </div>
              <div className="relative w-full bg-slate-100 rounded-full h-2.5 mb-1.5 overflow-hidden">
                <div
                  className="absolute top-0 left-0 h-full rounded-full bg-blue-600 transition-all duration-1000 ease-out group-hover:bg-blue-700"
                  style={{ width: `${dept.percent}%` }}
                ></div>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-400 font-medium">相对最高部门负载的 {dept.percent}%</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

type DashboardScope = 'personal' | 'department' | 'company';

import type { PermissionKey } from '../../lib/permissions';

interface DashboardUserInfo {
  id: number | null;
  role: string | null;
  departmentId: number | null;
  departmentName: string | null;
  permissions?: PermissionKey[];
}

interface DeliverySummary {
  period: string;
  created: number;
  completed: number;
  materialCount: number;
  imageMaterialCount: number;
  videoMaterialCount: number;
  pageCount: number;
  avgCycleDays: number;
}

function formatScoreWindowRange(start: string | null | undefined, end: string | null | undefined): string | null {
  if (!start || !end) {
    return null;
  }
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return null;
  }
  const format = (date: Date) => {
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${month}月${day}日`;
  };
  return `${format(startDate)} ~ ${format(endDate)}`;
}

const normalizeDemandStatus = (status: string): DemandStatus => {
  const value = (status || '').toString();
  switch (value) {
    case 'pending':
      return DemandStatus.PENDING;
    case 'in_progress':
      return DemandStatus.IN_PROGRESS;
    case 'review':
      return DemandStatus.REVIEW;
    case 'done':
      return DemandStatus.DONE;
    case 'closed':
      return DemandStatus.CLOSED;
    case 'delayed':
      return DemandStatus.DELAYED;
    case 'ignored':
      return DemandStatus.IGNORED;
    default: {
      const all = Object.values(DemandStatus) as string[];
      if (all.includes(value)) {
        return value as DemandStatus;
      }
      return DemandStatus.PENDING;
    }
  }
};

export default function Dashboard() {
  const router = useRouter();

  const [userInfo, setUserInfo] = useState<DashboardUserInfo | null>(null);
  const [scope, setScope] = useState<DashboardScope>('personal');

  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [inProgressCount, setInProgressCount] = useState<number | null>(null);
  const [doneCount, setDoneCount] = useState<number | null>(null);
  const [recentDemands, setRecentDemands] = useState<any[]>([]);
  const [deliverySummary, setDeliverySummary] = useState<DeliverySummary | null>(null);
  const [demandsLoading, setDemandsLoading] = useState(false);

  const [demandsError, setDemandsError] = useState<string | null>(null);

  const [pendingScoreCount, setPendingScoreCount] = useState<number>(0);
  const [scoreWindowPhase, setScoreWindowPhase] = useState<string | null>(null);
  const [scoreWindowRangeText, setScoreWindowRangeText] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadUserInfo = async () => {
      try {
        const user = await loadClientBusinessUser();
        if (!user) {
          return;
        }

        if (cancelled) {
          return;
        }

        const rawRole = user.role ?? 'user';
        const rawPermissions = Array.isArray(user.permissions)
          ? (user.permissions as PermissionKey[])
          : undefined;

        const next: DashboardUserInfo = {
          id: typeof user.id === 'number' ? user.id : null,
          role: rawRole,
          departmentId: (user.departmentId as number | null) ?? null,
          departmentName: user.departmentName ?? null,
          permissions: rawPermissions,
        };

        setUserInfo(next);

        const canViewDept = hasPermission(rawRole, 'demand.view_department', rawPermissions);
        if (canViewDept && next.departmentId != null) {
          setScope('department');
        } else {
          setScope('personal');
        }
      } catch (error) {
        console.error('dashboard load user error', error);
      }
    };

    loadUserInfo();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadDemandsSummary = async () => {
      if (!userInfo) {
        return;
      }

      try {
        setDemandsLoading(true);
        setDemandsError(null);

        const params = new URLSearchParams();
        params.set('summary', '1');
        params.set('recentSize', '5');

        if (scope === 'personal' && userInfo.id) {
          params.set('scope', 'personal');
        } else if (scope === 'department' && userInfo.departmentId) {
          params.set('departmentId', String(userInfo.departmentId));
        }

        const res = await authorizedFetch(`/api/demands?${params.toString()}`);

        if (!res.ok) {
          console.error('dashboard load demands summary error', await res.text());
          if (!cancelled) {
            setDemandsError('加载需求概览失败，请稍后重试');
            setPendingCount(null);
            setInProgressCount(null);
            setDoneCount(null);
            setRecentDemands([]);
            setDeliverySummary(null);
          }
          return;
        }

        const json = await res.json();
        if (cancelled) {
          return;
        }

        const counts = (json.counts || {}) as Record<string, number | null | undefined>;
        const safeNumber = (value: any) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

        setPendingCount(safeNumber(counts.pending));
        setInProgressCount(safeNumber(counts.in_progress));
        setDoneCount(safeNumber(counts.done));

        const items = Array.isArray(json.items) ? json.items : [];
        setRecentDemands(items);

        const rawDelivery = json.deliverySummary as Partial<DeliverySummary> | undefined;
        setDeliverySummary(rawDelivery ? {
          period: typeof rawDelivery.period === 'string' ? rawDelivery.period : '',
          created: safeNumber(rawDelivery.created) ?? 0,
          completed: safeNumber(rawDelivery.completed) ?? 0,
          materialCount: safeNumber(rawDelivery.materialCount) ?? 0,
          imageMaterialCount: safeNumber(rawDelivery.imageMaterialCount) ?? 0,
          videoMaterialCount: safeNumber(rawDelivery.videoMaterialCount) ?? 0,
          pageCount: safeNumber(rawDelivery.pageCount) ?? 0,
          avgCycleDays: safeNumber(rawDelivery.avgCycleDays) ?? 0,
        } : null);
      } catch (error) {
        console.error('dashboard load demands summary error', error);
        if (!cancelled) {
          setDemandsError('加载需求概览失败，请稍后重试');
          setPendingCount(null);
          setInProgressCount(null);
          setDoneCount(null);
          setRecentDemands([]);
          setDeliverySummary(null);
        }
      } finally {
        if (!cancelled) {
          setDemandsLoading(false);
        }
      }
    };

    loadDemandsSummary();

    return () => {
      cancelled = true;
    };
  }, [userInfo, scope]);


  useEffect(() => {
    let cancelled = false;

    const loadScoreSummary = async () => {
      try {
        const res = await authorizedFetch('/api/scores/my-tasks');
        if (!res.ok) {
          console.error('dashboard load score tasks error', await res.text());
          return;
        }
        const json = await res.json();
        if (cancelled) {
          return;
        }
        const items = (json.items || []) as { status?: string }[];
        const pending = items.filter((item) => (item.status || '').toLowerCase() === 'pending');
        setPendingScoreCount(pending.length);

        const scoringWindow = json.scoringWindow as {
          start?: string | null;
          end?: string | null;
          phase?: string | null;
        } | undefined;

        if (scoringWindow) {
          setScoreWindowPhase(scoringWindow.phase ?? null);
          setScoreWindowRangeText(formatScoreWindowRange(scoringWindow.start ?? null, scoringWindow.end ?? null));
        } else {
          setScoreWindowPhase(null);
          setScoreWindowRangeText(null);
        }
      } catch (error) {
        console.error('dashboard load score tasks error', error);
      }
    };

    loadScoreSummary();

    return () => {
      cancelled = true;
    };
  }, []);

  const departmentLabel = userInfo?.departmentName || '部门未配置';

  const rawRole = userInfo?.role || null;
  const rawPermissions = userInfo?.permissions;
  const canViewDept = hasPermission(rawRole, 'demand.view_department', rawPermissions);
  const canViewAll = hasPermission(rawRole, 'demand.view_all', rawPermissions);
  const canViewStats = hasPermission(rawRole, 'stats.view', rawPermissions);
  const canViewOverviewStats = hasPermission(rawRole, 'stats.overview', rawPermissions);
  const hasDepartment = !!userInfo?.departmentId;

  const allowDepartmentScope = canViewDept && hasDepartment;
  const allowCompanyScope = canViewAll;

  const scopeLabel =
    scope === 'company'
      ? '全公司视图'
      : scope === 'department'
      ? '本部门视图'
      : '仅看我负责的需求';

  const statsLoading = demandsLoading && pendingCount === null && inProgressCount === null && doneCount === null;
  const deliveryLoading = demandsLoading && deliverySummary === null;

  const formatNumber = (value: number | null) => {

    if (value === null || value === undefined) return '--';
    if (!Number.isFinite(value)) return '--';
    return value;
  };

  const scoreWindowPhaseLabel =
    scoreWindowPhase === 'open'
      ? '评分窗口进行中'
      : scoreWindowPhase === 'not_started'
      ? '评分窗口尚未开启'
      : scoreWindowPhase === 'closed'
      ? '评分窗口已结束'
      : null;

  const renderRecentStatusBadge = (demand: any) => {
    const statusValue = (demand?.status ?? '') as string;
    const labelFromApi = (demand?.statusLabel as string | undefined) || null;
    const colorFromApi = (demand?.statusColor as string | undefined) || null;

    if (labelFromApi && colorFromApi) {
      return (
        <span
          className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border"
          style={{
            color: colorFromApi,
            borderColor: colorFromApi,
            backgroundColor: `${colorFromApi}1A`,
          }}
        >
          {labelFromApi}
        </span>
      );
    }

    const normalized = normalizeDemandStatus(statusValue);
    const label = labelFromApi || normalized;

    let variant: any = 'default';
    if (normalized === DemandStatus.DONE || normalized === DemandStatus.CLOSED) {
      variant = 'success';
    } else if (normalized === DemandStatus.IN_PROGRESS) {
      variant = 'warning';
    } else if (normalized === DemandStatus.PENDING || normalized === DemandStatus.REVIEW) {
      variant = 'outline';
    } else if (normalized === DemandStatus.DELAYED) {
      variant = 'warning';
    } else if (normalized === DemandStatus.IGNORED) {
      variant = 'outline';
    }

    return <Badge variant={variant}>{label}</Badge>;
  };


  return (
    <div className="space-y-6 md:space-y-8 pb-8">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">工作台</h1>
          <p className="text-sm text-slate-500 mt-1">
            {departmentLabel} · {scopeLabel}
          </p>
        </div>
        <div className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-full px-1 py-1 text-xs text-slate-600">
          <span className="px-2 text-slate-400">视图</span>
          <button
            type="button"
            onClick={() => setScope('personal')}
            className={`px-3 py-1 rounded-full font-medium ${
              scope === 'personal' ? 'bg-slate-900 text-white' : 'hover:bg-slate-100'
            }`}
          >
            仅自己
          </button>
          {allowDepartmentScope && (
            <button
              type="button"
              onClick={() => setScope('department')}
              className={`px-3 py-1 rounded-full font-medium ${
                scope === 'department' ? 'bg-slate-900 text-white' : 'hover:bg-slate-100'
              }`}
            >
              本部门
            </button>
          )}
          {allowCompanyScope && (
            <button
              type="button"
              onClick={() => setScope('company')}
              className={`px-3 py-1 rounded-full font-medium ${
                scope === 'company' ? 'bg-slate-900 text-white' : 'hover:bg-slate-100'
              }`}
            >
              全公司
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatCard
          title="待处理需求"
          value={formatNumber(pendingCount)}
          trend={scope === 'personal' ? '按我负责的需求统计' : '按当前视图统计'}
          icon={FileText}
          color="bg-blue-500 text-blue-600"
          loading={statsLoading}
        />
        <StatCard
          title="进行中需求"
          value={formatNumber(inProgressCount)}
          trend={scope === 'personal' ? undefined : '按当前视图统计'}
          icon={Clock}
          color="bg-yellow-500 text-yellow-600"
          loading={statsLoading}
        />
        <StatCard
          title="已完成需求"
          value={formatNumber(doneCount)}
          trend={scope === 'personal' ? undefined : '按当前视图统计'}
          icon={CheckCircle}
          color="bg-green-500 text-green-600"
          loading={statsLoading}
        />
        <StatCard
          title="待评分任务"
          value={pendingScoreCount}
          trend={
            scoreWindowPhaseLabel && scoreWindowRangeText
              ? `${scoreWindowPhaseLabel}（${scoreWindowRangeText}）`
              : scoreWindowPhaseLabel || undefined
          }
          icon={AlertCircle}
          color="bg-purple-500 text-purple-600"
          loading={false}
        />

      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">本月关键交付</h2>
            <p className="text-sm text-slate-500 mt-1">{scopeLabel} · 工作台直接展示常用产出指标</p>
          </div>
          {deliverySummary?.period && (
            <span className="text-xs font-medium text-slate-500 bg-slate-50 border border-slate-200 rounded-full px-3 py-1">
              {deliverySummary.period}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 md:gap-4">
          {[
            { label: '本月新增', value: deliverySummary?.created ?? null, icon: FileText, tone: 'text-blue-600 bg-blue-50' },
            { label: '本月完成', value: deliverySummary?.completed ?? null, icon: CheckCircle, tone: 'text-emerald-600 bg-emerald-50' },
            { label: '素材合计', value: deliverySummary?.materialCount ?? null, icon: Images, tone: 'text-fuchsia-600 bg-fuchsia-50' },
            { label: '平面素材', value: deliverySummary?.imageMaterialCount ?? null, icon: Image, tone: 'text-violet-600 bg-violet-50' },
            { label: '视频数量', value: deliverySummary?.videoMaterialCount ?? null, icon: Video, tone: 'text-orange-600 bg-orange-50' },
            { label: '页面数量', value: deliverySummary?.pageCount ?? null, icon: LayoutTemplate, tone: 'text-cyan-700 bg-cyan-50' },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 min-h-[104px]">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-slate-500">{item.label}</span>
                  <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${item.tone}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                </div>
                {deliveryLoading ? (
                  <div className="mt-4 h-7 w-16 bg-slate-200 rounded-md animate-pulse" />
                ) : (
                  <div className="mt-3 text-2xl font-bold text-slate-900">{formatNumber(item.value)}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-fit">
          <div className="p-5 md:p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h2 className="text-xl font-bold text-slate-900">最近需求动态</h2>
            <button
              onClick={() => router.push('/demands')}
              className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline flex items-center"
            >
              查看全部 <ArrowRight className="w-4 h-4 ml-1" />
            </button>
          </div>
          {demandsError && (
            <div className="px-5 py-3 text-xs text-rose-600 bg-rose-50 border-t border-rose-100">
              {demandsError}
            </div>
          )}
          <div className="divide-y divide-slate-100">
            {demandsLoading && !demandsError && recentDemands.length === 0 && (
              <>
                {Array.from({ length: 3 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-pulse"
                  >
                    <div className="flex gap-4 items-start w-full">
                      <div className="w-12 h-12 rounded-full bg-slate-200 flex-shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-slate-200 rounded w-2/3" />
                        <div className="h-3 bg-slate-100 rounded w-5/6" />
                        <div className="flex gap-2">
                          <div className="h-3 bg-slate-100 rounded w-24" />
                          <div className="h-3 bg-slate-100 rounded w-16" />
                        </div>
                      </div>
                    </div>
                    <div className="w-20 h-6 bg-slate-200 rounded" />
                  </div>
                ))}
              </>
            )}
            {!demandsLoading && !demandsError && recentDemands.length === 0 && (
              <div className="p-5 text-sm text-slate-400">当前视图下暂无需求记录。</div>
            )}
            {recentDemands.map((demand) => (
              <div
                key={demand.id}
                onClick={() => router.push(`/demands/${demand.id}`)}
                className="p-5 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between group gap-4 cursor-pointer"
              >
                <div className="flex gap-4 items-start">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-sm flex-shrink-0 shadow-sm border border-slate-200">
                    {String(demand.creatorId || '').toUpperCase().slice(0, 2) || 'U'}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-base md:text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors mb-1">
                      {demand.title}
                    </h4>
                    <p className="text-sm text-slate-500 line-clamp-1 mb-2">{demand.description}</p>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                        {demand.createdAt || '日期待定'}
                      </span>
                      {demand.priority === Priority.CRITICAL && (
                        <span className="text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded font-bold">紧急</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex sm:flex-col items-start sm:items-end justify-between sm:justify-center gap-3 sm:gap-1 pl-16 sm:pl-0">
                  {renderRecentStatusBadge(demand)}
                </div>
              </div>
            ))}
          </div>

        </div>

        <div className="space-y-6">
          <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-2xl p-6 md:p-8 text-white shadow-lg relative overflow-hidden">
            <div className="relative z-10">
              <h3 className="text-xl font-bold mb-3">评分概览</h3>
              <p className="text-blue-100 text-base mb-6 leading-relaxed">
                您当前有 {pendingScoreCount} 位同事等待评分。
                {scoreWindowPhaseLabel && scoreWindowRangeText && (
                  <span className="block mt-1">
                    {scoreWindowPhaseLabel}：{scoreWindowRangeText}
                  </span>
                )}
              </p>
              <button
                onClick={() => router.push('/scoring')}
                className="w-full bg-white text-blue-700 px-5 py-3 rounded-xl text-sm font-bold hover:bg-blue-50 transition-colors shadow-md flex items-center justify-center gap-2"
              >
                前往评分任务 <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <div className="absolute top-0 right-0 -mt-6 -mr-6 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl"></div>
            <div className="absolute bottom-0 left-0 -mb-6 -ml-6 w-24 h-24 bg-blue-400 opacity-20 rounded-full blur-xl"></div>
          </div>

          {canViewOverviewStats && <DepartmentProgress onDeptClick={() => router.push('/demands')} />}

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-base font-bold text-slate-900 mb-5 uppercase tracking-wide text-opacity-80">快捷入口</h3>
            <div className="space-y-4">
              <button
                onClick={() => router.push('/demands/new')}
                className="w-full text-left px-5 py-4 rounded-xl bg-slate-50 hover:bg-blue-50 hover:text-blue-700 text-slate-700 text-base font-medium transition-all flex items-center justify-between group border border-transparent hover:border-blue-100"
              >
                <span>提交新需求</span>
                <div className="bg-white p-1.5 rounded-lg shadow-sm group-hover:bg-blue-500 group-hover:text-white text-slate-400 transition-all">
                  <Plus className="w-4 h-4" />
                </div>
              </button>
              <button
                onClick={() => router.push('/demands')}
                className="w-full text-left px-5 py-4 rounded-xl bg-slate-50 hover:bg-blue-50 hover:text-blue-700 text-slate-700 text-base font-medium transition-all flex items-center justify-between group border border-transparent hover:border-blue-100"
              >
                <span>查看部门需求</span>
                <div className="bg-white p-1.5 rounded-lg shadow-sm group-hover:bg-blue-500 group-hover:text-white text-slate-400 transition-all">
                  <FileText className="w-4 h-4" />
                </div>
              </button>
              <button
                onClick={() => router.push('/scoring')}
                className="w-full text-left px-5 py-4 rounded-xl bg-slate-50 hover:bg-blue-50 hover:text-blue-700 text-slate-700 text-base font-medium transition-all flex items-center justify-between group border border-transparent hover:border-blue-100"
              >
                <span>我的评分任务</span>
                <div className="bg-white p-1.5 rounded-lg shadow-sm group-hover:bg-blue-500 group-hover:text-white text-slate-400 transition-all">
                  <AlertCircle className="w-4 h-4" />
                </div>
              </button>
              {canViewStats && (
                <button
                  onClick={() => router.push('/statistics')}
                  className="w-full text-left px-5 py-4 rounded-xl bg-slate-50 hover:bg-blue-50 hover:text-blue-700 text-slate-700 text-base font-medium transition-all flex items-center justify-between group border border-transparent hover:border-blue-100"
                >
                  <span>统计与报表大盘</span>
                  <div className="bg-white p-1.5 rounded-lg shadow-sm group-hover:bg-blue-500 group-hover:text-white text-slate-400 transition-all">
                    <FileText className="w-4 h-4" />
                  </div>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
