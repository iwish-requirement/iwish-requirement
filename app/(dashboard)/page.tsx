"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, CheckCircle, Clock, TrendingUp, ArrowRight, AlertCircle, Plus } from 'lucide-react';
import { DemandStatus, Priority } from '../../types';
import { getSupabaseClient } from '../../lib/supabase';
import { hasPermission } from '../../lib/permissions';
import { authorizedFetch } from '../../lib/authFetch';
import { getDepartments } from '../../utils/storage';
import Badge from '../../components/ui/Badge';


const StatCard = ({ title, value, trend, icon: Icon, color }: any) => (
  <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
    <div className="flex justify-between items-start">
      <div>
        <p className="text-base font-medium text-slate-500 mb-2">{title}</p>
        <h3 className="text-3xl font-bold text-slate-900 tracking-tight">{value}</h3>
      </div>
      <div className={`p-3 rounded-xl ${color} bg-opacity-10`}>
        <Icon className={`w-6 h-6 ${color.replace('bg-', 'text-')}`} />
      </div>
    </div>
    {trend && (
      <div className="mt-4 flex items-center text-sm font-medium text-green-600">
        <TrendingUp className="w-4 h-4 mr-1.5" />
        <span>{trend}</span>
      </div>
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

export default function Dashboard() {
  const router = useRouter();

  const [userInfo, setUserInfo] = useState<DashboardUserInfo | null>(null);
  const [scope, setScope] = useState<DashboardScope>('personal');

  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [inProgressCount, setInProgressCount] = useState<number | null>(null);
  const [doneCount, setDoneCount] = useState<number | null>(null);
  const [recentDemands, setRecentDemands] = useState<any[]>([]);
  const [demandsLoading, setDemandsLoading] = useState(false);
  const [demandsError, setDemandsError] = useState<string | null>(null);

  const [pendingScoreCount, setPendingScoreCount] = useState<number>(0);
  const [scoreWindowPhase, setScoreWindowPhase] = useState<string | null>(null);
  const [scoreWindowRangeText, setScoreWindowRangeText] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadUserInfo = async () => {
      try {
        const supabase = getSupabaseClient();
        const { data } = await supabase.auth.getUser();
        const authUser = data?.user;
        if (!authUser?.email || !authUser.id) {
          return;
        }
        const meta = (authUser.user_metadata || {}) as Record<string, any>;
        const metaName =
          (typeof meta.full_name === 'string' && meta.full_name) ||
          (typeof meta.name === 'string' && meta.name) ||
          null;

        const res = await fetch('/api/auth/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            authUserId: authUser.id,
            email: authUser.email,
            fullName: metaName,
          }),
        });

        if (!res.ok) {
          console.error('dashboard auth sync error', await res.text());
          return;
        }

        const json = await res.json();
        const u = (json.user || {}) as {
          id?: number;
          role?: string | null;
          departmentId?: number | null;
          departmentName?: string | null;
          permissions?: PermissionKey[] | null;
        };

        if (cancelled) {
          return;
        }

        const rawRole = u.role ?? 'user';
        const rawPermissions = Array.isArray(u.permissions)
          ? (u.permissions as PermissionKey[])
          : undefined;

        const next: DashboardUserInfo = {
          id: typeof u.id === 'number' ? u.id : null,
          role: rawRole,
          departmentId: (u.departmentId as number | null) ?? null,
          departmentName: u.departmentName ?? null,
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

        const buildParams = (status?: string | null, pageSize?: number) => {
          const params = new URLSearchParams();
          if (status) {
            params.set('status', status);
          }
          if (scope === 'personal' && userInfo.id) {
            params.set('assigneeUserId', String(userInfo.id));
          } else if (scope === 'department' && userInfo.departmentId) {
            params.set('departmentId', String(userInfo.departmentId));
          }
          params.set('page', '1');
          params.set('pageSize', String(pageSize ?? 1));
          return params;
        };

        const [pendingRes, inProgressRes, doneRes, listRes] = await Promise.all([
          authorizedFetch(`/api/demands?${buildParams('pending').toString()}`),
          authorizedFetch(`/api/demands?${buildParams('in_progress').toString()}`),
          authorizedFetch(`/api/demands?${buildParams('done').toString()}`),
          authorizedFetch(`/api/demands?${buildParams(null, 4).toString()}`),
        ]);

        const parseCount = async (res: Response): Promise<number | null> => {
          if (!res.ok) {
            console.error('dashboard load demands count error', await res.text());
            return null;
          }
          const json = await res.json();
          const totalValue = json.total as number | undefined;
          if (typeof totalValue === 'number' && Number.isFinite(totalValue)) {
            return totalValue;
          }
          const items = Array.isArray(json.items) ? json.items : [];
          return items.length;
        };

        if (!cancelled) {
          setPendingCount(await parseCount(pendingRes));
        }
        if (!cancelled) {
          setInProgressCount(await parseCount(inProgressRes));
        }
        if (!cancelled) {
          setDoneCount(await parseCount(doneRes));
        }

        if (!cancelled) {
          if (!listRes.ok) {
            console.error('dashboard load recent demands error', await listRes.text());
            setRecentDemands([]);
          } else {
            const json = await listRes.json();
            const items = Array.isArray(json.items) ? json.items : [];
            setRecentDemands(items);
          }
        }
      } catch (error) {
        console.error('dashboard load demands summary error', error);
        if (!cancelled) {
          setDemandsError('加载需求概览失败，请稍后重试');
          setPendingCount(null);
          setInProgressCount(null);
          setDoneCount(null);
          setRecentDemands([]);
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
  const hasDepartment = !!userInfo?.departmentId;

  const allowDepartmentScope = canViewDept && hasDepartment;
  const allowCompanyScope = canViewAll;

  const scopeLabel =
    scope === 'company'
      ? '全公司视图'
      : scope === 'department'
      ? '本部门视图'
      : '仅看我负责的需求';

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
        />
        <StatCard
          title="进行中需求"
          value={formatNumber(inProgressCount)}
          trend={scope === 'personal' ? undefined : '按当前视图统计'}
          icon={Clock}
          color="bg-yellow-500 text-yellow-600"
        />
        <StatCard
          title="已完成需求"
          value={formatNumber(doneCount)}
          trend={scope === 'personal' ? undefined : '按当前视图统计'}
          icon={CheckCircle}
          color="bg-green-500 text-green-600"
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
        />
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
              <div className="p-5 text-sm text-slate-400">正在加载当前视图下的需求...</div>
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
                  <Badge
                    variant={
                      demand.status === DemandStatus.DONE
                        ? 'success'
                        : demand.status === DemandStatus.IN_PROGRESS
                        ? 'warning'
                        : 'default'
                    }
                  >
                    {demand.status}
                  </Badge>
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

          <DepartmentProgress onDeptClick={() => router.push('/demands')} />

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
