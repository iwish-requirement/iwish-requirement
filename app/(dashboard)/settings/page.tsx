"use client";

import React, { useState, useEffect } from "react";
import {
  Settings as SettingsIcon,
  Database,
  Plus,
  Trash2,
  Edit,
  Building2,
  GripVertical,
  Star,
  Users,
  Shield,
  Activity,
  GitBranch,
} from "lucide-react";
import { Department, FieldDefinition, FieldType } from "../../../types";
import Modal from "../../../components/ui/Modal";
import { authorizedFetch } from "../../../lib/authFetch";
import { hasPermission, type PermissionKey } from "../../../lib/permissions";
import { loadClientBusinessUser } from "../../../lib/clientBusinessUser";
import UserManagementSettings from "./UserManagementSettings";
import RolePermissionOverview from "./RolePermissionOverview";
import WebhookSettings from "./WebhookSettings";

// -------------------- 类型与 Tab 定义 --------------------

type AdminTab =
  | "global"
  | "departments"
  | "users"
  | "roles"
  | "fields"
  | "workflow"
  | "scoring"
  | "scorePeriods"
  | "webhooks";

// -------------------- 顶层设置页面 --------------------

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>("global");
  const [effectivePermissions, setEffectivePermissions] = useState<PermissionKey[] | null>(null);
  const [loadingPermissions, setLoadingPermissions] = useState(true);

  useEffect(() => {
    const loadPermissions = async () => {
      try {
        setLoadingPermissions(true);
        const user = await loadClientBusinessUser();
        if (!user) {
          setEffectivePermissions([]);
          return;
        }

        const perms = user.permissions as unknown;
        setEffectivePermissions(Array.isArray(perms) ? (perms as PermissionKey[]) : []);
      } catch (e) {
        console.error("load settings permissions error", e);
        setEffectivePermissions([]);
      } finally {
        setLoadingPermissions(false);
      }
    };

    loadPermissions();
  }, []);

  const can = (permission: PermissionKey) =>
    hasPermission(null, permission, Array.isArray(effectivePermissions) ? effectivePermissions : []);

  const canViewTab = (tab: AdminTab): boolean => {
    const hasShell = can("settings.access_shell");

    if (tab === "global")
      return hasShell || can("settings.global.view") || can("settings.global.manage");
    if (tab === "departments")
      return hasShell || can("settings.departments.view") || can("settings.departments.manage");
    if (tab === "fields")
      return (
        hasShell ||
        can("settings.fields.view") ||
        can("settings.fields.manage") ||
        can("department.fields_manage")
      );
    if (tab === "workflow")
      return (
        hasShell ||
        can("settings.workflow.view") ||
        can("settings.workflow.manage") ||
        can("settings.departments.manage") ||
        can("settings.global.manage")
      );

    if (tab === "scoring")
      return hasShell || can("settings.scoring.view") || can("settings.scoring.manage") || can("admin.user_manage");
    if (tab === "scorePeriods")
      return (
        hasShell ||
        can("settings.score_periods.view") ||
        can("settings.score_periods.manage") ||
        can("admin.user_manage")
      );
    if (tab === "roles")
      return hasShell || can("settings.roles.view") || can("settings.roles.manage") || can("admin.user_manage");
    if (tab === "webhooks")
      return hasShell || can("settings.webhooks.view") || can("settings.webhooks.manage") || can("admin.user_manage");
    if (tab === "users") return hasShell || can("admin.user_manage");
    return false;
  };

  const canManageTab = (tab: AdminTab): boolean => {
    if (tab === "global") return can("settings.global.manage");
    if (tab === "departments") return can("settings.departments.manage");
    if (tab === "fields") return can("settings.fields.manage") || can("department.fields_manage");
    if (tab === "workflow")
      return (
        can("settings.workflow.manage") ||
        can("settings.departments.manage") ||
        can("settings.global.manage")
      );

    if (tab === "scoring") return can("settings.scoring.manage") || can("admin.user_manage");
    if (tab === "scorePeriods") return can("settings.score_periods.manage") || can("admin.user_manage");
    if (tab === "roles") return can("settings.roles.manage") || can("admin.user_manage");
    if (tab === "webhooks") return can("settings.webhooks.manage") || can("admin.user_manage");
    if (tab === "users") return can("admin.user_manage");
    return false;
  };

  const canReadTab = (tab: AdminTab): boolean => {
    if (tab === "global")
      return can("settings.global.view") || can("settings.global.manage");
    if (tab === "departments")
      return can("settings.departments.view") || can("settings.departments.manage");
    if (tab === "fields")
      return (
        can("settings.fields.view") ||
        can("settings.fields.manage") ||
        can("department.fields_manage")
      );
    if (tab === "workflow")
      return (
        can("settings.workflow.view") ||
        can("settings.workflow.manage") ||
        can("settings.departments.manage") ||
        can("settings.global.manage")
      );

    if (tab === "scoring")
      return (
        can("settings.scoring.view") ||
        can("settings.scoring.manage") ||
        can("admin.user_manage")
      );
    if (tab === "scorePeriods")
      return (
        can("settings.score_periods.view") ||
        can("settings.score_periods.manage") ||
        can("admin.user_manage")
      );
    if (tab === "roles")
      return (
        can("settings.roles.view") ||
        can("settings.roles.manage") ||
        can("admin.user_manage")
      );
    if (tab === "webhooks")
      return (
        can("settings.webhooks.view") ||
        can("settings.webhooks.manage") ||
        can("admin.user_manage")
      );
    if (tab === "users") return can("admin.user_manage");
    return false;
  };

  const renderNoPermission = (label: string) => (
    <div className="text-sm text-slate-600">
      您当前账号没有被授予「{label}」模块的查看权限，如需开通请联系管理员。
    </div>
  );

  const tabs: { id: AdminTab; label: string; icon: React.ComponentType<any> }[] = [
    { id: "global", label: "全局配置", icon: SettingsIcon },
    { id: "departments", label: "部门管理", icon: Building2 },
    { id: "users", label: "用户管理", icon: Users },
    { id: "roles", label: "权限管理", icon: Shield },
    { id: "fields", label: "字段模板", icon: Database },
    { id: "workflow", label: "工作流配置", icon: GitBranch },
    { id: "scoring", label: "评分模板", icon: Star },
    { id: "scorePeriods", label: "评分周期", icon: Star },
    { id: "webhooks", label: "Webhook 集成", icon: Activity },
  ];

  const visibleTabs = loadingPermissions ? [] : tabs.filter((tab) => canViewTab(tab.id));

  useEffect(() => {
    if (loadingPermissions) return;
    if (visibleTabs.length === 0) return;
    if (!canViewTab(activeTab)) {
      setActiveTab(visibleTabs[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingPermissions, activeTab, visibleTabs.length]);

  return (
    <div className="space-y-6 md:space-y-8 pb-10">
      <h1 className="text-3xl font-bold text-slate-900">系统设置</h1>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[600px] flex flex-col md:flex-row">
        {/* 左侧 Tab 导航 */}
        <div className="w-full md:w-64 md:flex-shrink-0 border-b md:border-b-0 md:border-r border-slate-200 bg-slate-50 p-4">
          <nav className="flex md:flex-col space-x-2 md:space-x-0 md:space-y-2 overflow-x-auto">
            {visibleTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-shrink-0 w-auto md:w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold text-sm md:text-base ${
                  activeTab === tab.id
                    ? "bg-white text-blue-600 shadow-sm border border-slate-200"
                    : "text-slate-600 hover:bg-white/50 hover:text-slate-900"
                }`}
              >
                <tab.icon
                  className={`w-5 h-5 ${
                    activeTab === tab.id ? "text-blue-500" : "text-slate-400"
                  }`}
                />
                <span className="whitespace-nowrap">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* 右侧内容区域 */}
        <div className="flex-1 min-w-0 p-4 sm:p-6 md:p-10 bg-white overflow-x-hidden">
          {loadingPermissions && (
            <div className="text-sm text-slate-400">正在加载权限信息...</div>
          )}

          {!loadingPermissions && visibleTabs.length === 0 && (
            <div className="text-sm text-slate-600">
              您当前账号没有被授予任何系统设置查看权限，如需开通请联系管理员。
            </div>
          )}

          {!loadingPermissions && visibleTabs.length > 0 && (
            <>
              {activeTab === "global" &&
                (canReadTab("global") ? (
                  <GlobalSettings canManage={canManageTab("global")} />
                ) : (
                  renderNoPermission("全局配置")
                ))}
              {activeTab === "departments" &&
                (canReadTab("departments") ? (
                  <DepartmentManagement canManage={canManageTab("departments")} />
                ) : (
                  renderNoPermission("部门管理")
                ))}
              {activeTab === "users" &&
                (canReadTab("users") ? (
                  <div className="space-y-3">
                    {!canManageTab("users") && (
                      <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg">
                        当前为只读权限，无法进行新增、审批、编辑或分配角色等操作。
                      </div>
                    )}
                    <div className={canManageTab("users") ? "" : "pointer-events-none opacity-75"}>
                      <UserManagementSettings />
                    </div>
                  </div>
                ) : (
                  renderNoPermission("用户管理")
                ))}
              {activeTab === "roles" &&
                (canReadTab("roles") ? (
                  <div className="space-y-3">
                    {!canManageTab("roles") && (
                      <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg">
                        当前为只读权限，无法新增、编辑或删除角色，也无法调整权限点。
                      </div>
                    )}
                    <div className={canManageTab("roles") ? "" : "pointer-events-none opacity-75"}>
                      <RolePermissionOverview />
                    </div>
                  </div>
                ) : (
                  renderNoPermission("权限管理")
                ))}
              {activeTab === "fields" &&
                (canReadTab("fields") ? (
                  <FieldTemplates canManage={canManageTab("fields")} />
                ) : (
                  renderNoPermission("字段模板")
                ))}
              {activeTab === "workflow" &&
                (canReadTab("workflow") ? (
                  <div className="space-y-3">
                    {!canManageTab("workflow") && (
                      <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg">
                        当前为只读权限，可查看工作流配置，但无法新增、编辑或删除。
                      </div>
                    )}
                    <WorkflowConfigSettings canManage={canManageTab("workflow")} />
                  </div>
                ) : (
                  renderNoPermission("工作流配置")
                ))}
              {activeTab === "scoring" &&
                (canReadTab("scoring") ? (
                  <div className="space-y-3">
                    {!canManageTab("scoring") && (
                      <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg">
                        当前为只读权限，可查看评分模板配置，但无法保存修改。
                      </div>
                    )}
                    <ScoringTemplates canManage={canManageTab("scoring")} />
                  </div>
                ) : (
                  renderNoPermission("评分模板")
                ))}
              {activeTab === "scorePeriods" &&
                (canReadTab("scorePeriods") ? (
                  <div className="space-y-3">
                    {!canManageTab("scorePeriods") && (
                      <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg">
                        当前为只读权限，可查看评分周期配置，但无法新增、保存或删除。
                      </div>
                    )}
                    <ScorePeriodsSettings canManage={canManageTab("scorePeriods")} />
                  </div>
                ) : (
                  renderNoPermission("评分周期")
                ))}
              {activeTab === "webhooks" &&
                (canReadTab("webhooks") ? (
                  <WebhookSettings canManage={canManageTab("webhooks")} />
                ) : (
                  renderNoPermission("Webhook 集成")
                ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// -------------------- 全局配置 --------------------

const GlobalSettings = ({ canManage }: { canManage: boolean }) => {
  const [systemName, setSystemName] = useState("");
  const [registrationEnabled, setRegistrationEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await authorizedFetch("/api/settings/global");
        if (!res.ok) {
          console.error("load global settings error", await res.text());
          setError("加载全局配置失败，请稍后重试");
          return;
        }
        const json = await res.json();
        if (typeof json.systemName === "string" && json.systemName.trim()) {
          setSystemName(json.systemName.trim());
        }
        setRegistrationEnabled(!!json.registrationEnabled);
      } catch (e) {
        console.error("load global settings error", e);
        setError("加载全局配置失败，请检查网络后重试");
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  const toggleRegistration = async () => {
    if (!canManage) {
      setError("您只有查看权限，无法修改开放注册配置。");
      return;
    }

    const next = !registrationEnabled;
    setRegistrationEnabled(next);
    setError(null);
    setSuccess(null);
    try {
      const res = await authorizedFetch("/api/settings/global", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationEnabled: next }),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error("update registrationEnabled error", text);
        if (res.status === 401) {
          setError("登录已失效，请重新登录后再试");
        } else if (res.status === 403) {
          setError("您没有权限修改开放注册配置，如需操作请联系系统管理员。");
        } else {
          setError("更新开放注册配置失败，请稍后重试");
        }
        setRegistrationEnabled(!next);
        return;
      }
      const json = await res.json();
      setRegistrationEnabled(!!json.registrationEnabled);
      setSuccess("已更新开放注册配置");
    } catch (e) {
      console.error("update registrationEnabled error", e);
      setError("更新开放注册配置失败，请检查网络后重试");
      setRegistrationEnabled(!next);
    }
  };

  const handleSaveSystemName = async () => {
    if (!canManage) {
      setError("您只有查看权限，无法修改系统名称。");
      return;
    }

    if (!systemName.trim()) {
      setError("系统名称不能为空");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await authorizedFetch("/api/settings/global", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemName }),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error("update systemName error", text);
        if (res.status === 401) {
          setError("登录已失效，请重新登录后再试");
        } else if (res.status === 403) {
          setError("您没有权限修改系统名称，如需操作请联系系统管理员。");
        } else {
          setError("保存系统名称失败，请稍后重试");
        }
        return;
      }
      const json = await res.json();
      if (typeof json.systemName === "string" && json.systemName.trim()) {
        setSystemName(json.systemName.trim());
      }
      setSuccess("系统名称已保存");
    } catch (e) {
      console.error("update systemName error", e);
      setError("保存系统名称失败，请检查网络后重试");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      {!canManage && (
        <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg">
          当前为只读权限，可查看全局配置，但无法保存修改。
        </div>
      )}
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

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1">系统名称</label>
          <input
            type="text"
            value={systemName}
            onChange={(e) => setSystemName(e.target.value)}
            disabled={loading || !canManage}
            className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="请输入系统名称"
          />
        </div>

        <div className="flex items-center justify-between mt-2">
          <div className="flex flex-col">
            <span className="text-sm font-bold text-slate-700">开放注册</span>
            <span className="text-xs text-slate-500 mt-0.5">
              关闭时，只有管理员邀请的账号才能登录系统。
            </span>
          </div>
          <button
            type="button"
            onClick={toggleRegistration}
            disabled={loading || !canManage}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              registrationEnabled ? "bg-blue-600" : "bg-slate-200"
            } disabled:opacity-60 disabled:cursor-not-allowed`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-200 ${
                registrationEnabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </div>

      <div className="pt-4 flex justify-end">
        <button
          type="button"
          onClick={handleSaveSystemName}
          disabled={saving || loading || !canManage}
          className="px-6 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? "保存中..." : "保存配置"}
        </button>
      </div>
    </div>
  );
};

// -------------------- 工作流配置（优先级与状态） --------------------

const WorkflowConfigSettingsLegacy1 = ({ canManage }: { canManage: boolean }) => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string>("");
  const [config, setConfig] = useState<{
    priorities: Array<{ value: string; label: string; color: string; order: number }>;
    statuses: Array<{ value: string; label: string; color: string; order: number; transitions?: string[] }>;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const loadDepartments = async () => {
      try {
        const res = await fetch("/api/departments");
        if (!res.ok) {
          console.error("load workflow departments error", await res.text());
          return;
        }
        const json = await res.json();
        const items = (json.items || []) as { id: number; name: string; slug: string | null }[];
        const mapped: Department[] = items.map((d) => ({
          id: String(d.id),
          name: d.name,
          slug: d.slug || "",
        }));
        setDepartments(mapped);
        if (mapped.length > 0) {
          setSelectedDeptId(mapped[0].id);
        }
      } catch (e) {
        console.error("load workflow departments error", e);
      }
    };

    loadDepartments();
  }, []);

  useEffect(() => {
    if (!selectedDeptId) {
      setConfig(null);
      return;
    }
    const loadConfig = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await authorizedFetch(`/api/departments/${selectedDeptId}/workflow-config`);
        if (!res.ok) {
          const text = await res.text();
          console.error("load workflow config error", text);
          if (res.status === 401) {
            setError("登录已失效，请重新登录后再试");
          } else if (res.status === 403) {
            setError("您没有权限查看工作流配置，如需操作请联系系统管理员。");
          } else {
            setError("加载工作流配置失败，请稍后重试");
          }
          setConfig(null);
          return;
        }
        const json = await res.json();
        if (json.config) {
          setConfig(json.config);
        } else {
          setConfig({ priorities: [], statuses: [] });
        }
      } catch (e) {
        console.error("load workflow config error", e);
        setError("加载工作流配置失败，请检查网络后重试");
        setConfig(null);
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, [selectedDeptId]);

  const handleSave = async () => {
    if (!selectedDeptId || !config) return;
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      const res = await authorizedFetch(`/api/departments/${selectedDeptId}/workflow-config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error("save workflow config error", text);
        if (res.status === 401) {
          setError("登录已失效，请重新登录后再试");
        } else if (res.status === 403) {
          setError("您没有权限编辑工作流配置，如需操作请联系系统管理员。");
        } else {
          setError("保存工作流配置失败，请稍后重试");
        }
        return;
      }
      const json = await res.json();
      if (json.config) {
        setConfig(json.config);
      }
      setSuccess("工作流配置已保存");
    } catch (e) {
      console.error("save workflow config error", e);
      setError("保存工作流配置失败，请检查网络后重试");
    } finally {
      setSaving(false);
    }
  };

  const addPriority = () => {
    if (!config) return;
    const newPriority = {
      value: `priority_${Date.now()}`,
      label: "新优先级",
      color: "#6b7280",
      order: config.priorities.length + 1,
    };
    setConfig({ ...config, priorities: [...config.priorities, newPriority] });
  };

  const updatePriority = (index: number, field: string, value: any) => {
    if (!config) return;
    const updated = [...config.priorities];
    updated[index] = { ...updated[index], [field]: value };
    setConfig({ ...config, priorities: updated });
  };

  const deletePriority = (index: number) => {
    if (!config) return;
    const updated = config.priorities.filter((_, i) => i !== index);
    setConfig({ ...config, priorities: updated });
  };

  const addStatus = () => {
    if (!config) return;
    const newStatus = {
      value: `status_${Date.now()}`,
      label: "新状态",
      color: "#6b7280",
      order: config.statuses.length + 1,
      transitions: [],
    };
    setConfig({ ...config, statuses: [...config.statuses, newStatus] });
  };

  const updateStatus = (index: number, field: string, value: any) => {
    if (!config) return;
    const updated = [...config.statuses];
    updated[index] = { ...updated[index], [field]: value };
    setConfig({ ...config, statuses: updated });
  };

  const deleteStatus = (index: number) => {
    if (!config) return;
    const updated = config.statuses.filter((_, i) => i !== index);
    setConfig({ ...config, statuses: updated });
  };

  return (
    <div className="animate-fadeIn">
      {!canManage && (
        <div className="mb-4 text-xs text-slate-600 bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg">
          当前为只读权限，可查看工作流配置，但无法新增、编辑或删除。
        </div>
      )}

      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6">
        <h2 className="text-xl font-bold text-slate-900">工作流配置</h2>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">选择部门</span>
          <select
            value={selectedDeptId}
            onChange={(e) => setSelectedDeptId(e.target.value)}
            className="w-full sm:w-auto sm:min-w-[200px] max-w-full px-4 py-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-600 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
          >
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-3 text-xs text-rose-600 bg-rose-50 border border-rose-100 px-3 py-2 rounded-lg">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-3 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-2 rounded-lg">
          {success}
        </div>
      )}

      {loading && (
        <div className="p-6 text-center text-slate-400 text-sm">正在加载工作流配置...</div>
      )}

      {!loading && config && (
        <div className="space-y-6">
          {/* 优先级配置 */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800">优先级配置</h3>
              <button
                onClick={addPriority}
                disabled={!canManage}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Plus className="w-3 h-3" /> 添加优先级
              </button>
            </div>
            <div className="space-y-3">
              {config.priorities.length === 0 && (
                <div className="p-6 text-center text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-xl">
                  该部门暂无优先级配置，请点击"添加优先级"按钮进行配置。
                </div>
              )}
              {config.priorities.map((p, index) => (
                <div
                  key={index}
                  className="flex flex-col md:flex-row md:items-center gap-3 p-4 border border-slate-200 rounded-lg bg-slate-50"
                >
                  <div className="flex-1">
                    <label className="block text-xs text-slate-500 mb-1">值（英文）</label>
                    <input
                      type="text"
                      value={p.value}
                      onChange={(e) => updatePriority(index, "value", e.target.value)}
                      disabled={!canManage}
                      placeholder="例如：urgent"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm disabled:opacity-60"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-slate-500 mb-1">显示名称</label>
                    <input
                      type="text"
                      value={p.label}
                      onChange={(e) => updatePriority(index, "label", e.target.value)}
                      disabled={!canManage}
                      placeholder="例如：紧急"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">颜色</label>
                    <input
                      type="color"
                      value={p.color}
                      onChange={(e) => updatePriority(index, "color", e.target.value)}
                      disabled={!canManage}
                      className="w-20 h-10 border border-slate-300 rounded-lg cursor-pointer disabled:opacity-60"
                    />
                  </div>
                  <div className="w-20">
                    <label className="block text-xs text-slate-500 mb-1">排序</label>
                    <input
                      type="number"
                      value={p.order}
                      onChange={(e) => updatePriority(index, "order", Number(e.target.value))}
                      disabled={!canManage}
                      className="w-full px-2 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm disabled:opacity-60"
                    />
                  </div>
                  <button
                    onClick={() => deletePriority(index)}
                    disabled={!canManage}
                    className="mt-5 p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 状态配置 */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800">状态配置</h3>
              <button
                onClick={addStatus}
                disabled={!canManage}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Plus className="w-3 h-3" /> 添加状态
              </button>
            </div>
            <div className="space-y-3">
              {config.statuses.length === 0 && (
                <div className="p-6 text-center text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-xl">
                  该部门暂无状态配置，请点击"添加状态"按钮进行配置。
                </div>
              )}
              {config.statuses.map((s, index) => (
                <div
                  key={index}
                  className="flex flex-col gap-3 p-4 border border-slate-200 rounded-lg bg-slate-50"
                >
                  <div className="flex flex-col md:flex-row md:items-center gap-3">
                    <div className="flex-1">
                      <label className="block text-xs text-slate-500 mb-1">值（英文）</label>
                      <input
                        type="text"
                        value={s.value}
                        onChange={(e) => updateStatus(index, "value", e.target.value)}
                        disabled={!canManage}
                        placeholder="例如：in_progress"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm disabled:opacity-60"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs text-slate-500 mb-1">显示名称</label>
                      <input
                        type="text"
                        value={s.label}
                        onChange={(e) => updateStatus(index, "label", e.target.value)}
                        disabled={!canManage}
                        placeholder="例如：进行中"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm disabled:opacity-60"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">颜色</label>
                      <input
                        type="color"
                        value={s.color}
                        onChange={(e) => updateStatus(index, "color", e.target.value)}
                        disabled={!canManage}
                        className="w-20 h-10 border border-slate-300 rounded-lg cursor-pointer disabled:opacity-60"
                      />
                    </div>
                    <div className="w-20">
                      <label className="block text-xs text-slate-500 mb-1">排序</label>
                      <input
                        type="number"
                        value={s.order}
                        onChange={(e) => updateStatus(index, "order", Number(e.target.value))}
                        disabled={!canManage}
                        className="w-full px-2 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm disabled:opacity-60"
                      />
                    </div>
                    <button
                      onClick={() => deleteStatus(index)}
                      disabled={!canManage}
                      className="mt-5 p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">
                      可流转到（多选，用逗号分隔状态值）
                    </label>
                    <input
                      type="text"
                      value={s.transitions?.join(",") || ""}
                      onChange={(e) =>
                        updateStatus(
                          index,
                          "transitions",
                          e.target.value ? e.target.value.split(",").map((v) => v.trim()) : []
                        )
                      }
                      disabled={!canManage}
                      placeholder="例如：in_progress,done"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm disabled:opacity-60"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 保存按钮 */}
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving || !canManage}
              className="px-6 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? "保存中..." : "保存配置"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// -------------------- 部门管理（数据库驱动） --------------------

const DepartmentManagement = ({ canManage }: { canManage: boolean }) => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newDept, setNewDept] = useState<{ name: string; slug: string }>({ name: "", slug: "" });

  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [editDeptForm, setEditDeptForm] = useState<{ name: string; slug: string }>({
    name: "",
    slug: "",
  });

  const [pendingDeleteDept, setPendingDeleteDept] = useState<Department | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadDepartments = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/departments");
      if (!res.ok) {
        const text = await res.text();
        console.error("load departments in settings error", text);
        setError("加载部门列表失败，请稍后重试");
        return;
      }
      const json = await res.json();
      const items = (json.items || []) as { id: number; name: string; slug: string | null }[];
      const mapped: Department[] = items.map((d) => ({
        id: String(d.id),
        name: d.name,
        slug: d.slug || "",
      }));
      setDepartments(mapped);
    } catch (e) {
      console.error("load departments in settings error", e);
      setError("加载部门列表失败，请检查网络后重试");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDepartments();
  }, []);

  const handleAddDept = async () => {
    if (!canManage) {
      setError("您只有查看权限，无法新增部门。");
      return;
    }

    const name = newDept.name.trim();
    const slug = newDept.slug.trim();
    if (!name) {
      setError("部门名称不能为空");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const res = await authorizedFetch("/api/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug }),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error("create department error", text);
        if (res.status === 401) {
          setError("登录已失效，请重新登录后再试");
        } else if (res.status === 403) {
          setError("您没有权限新增部门，如需操作请联系系统管理员。");
        } else {
          setError("新增部门失败，请稍后重试");
        }
        return;
      }
      await loadDepartments();
      setIsAddModalOpen(false);
      setNewDept({ name: "", slug: "" });
    } catch (e) {
      console.error("create department error", e);
      setError("新增部门失败，请检查网络后重试");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDept = async (dept: Department) => {
    if (!canManage) {
      setError("您只有查看权限，无法删除部门。");
      return;
    }

    try {
      setDeletingId(dept.id);
      setError(null);
      const res = await authorizedFetch(`/api/departments/${encodeURIComponent(dept.id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const text = await res.text();
        console.error("delete department error", text);
        if (res.status === 401) {
          setError("登录已失效，请重新登录后再试");
        } else if (res.status === 403) {
          setError("您没有权限删除部门，如需操作请联系系统管理员。");
        } else {
          setError("删除部门失败，请稍后重试");
        }
        return;
      }
      setDepartments((prev) => prev.filter((d) => d.id !== dept.id));
    } catch (e) {
      console.error("delete department error", e);
      setError("删除部门失败，请检查网络后重试");
    } finally {
      setDeletingId(null);
      setPendingDeleteDept(null);
    }
  };

  const openEditDept = (dept: Department) => {
    setEditingDept(dept);
    setEditDeptForm({ name: dept.name, slug: dept.slug || "" });
  };

  const handleUpdateDept = async () => {
    if (!canManage) {
      setError("您只有查看权限，无法编辑部门。");
      return;
    }

    if (!editingDept) return;
    const name = editDeptForm.name.trim();
    const slug = editDeptForm.slug.trim();
    if (!name && !slug) {
      setError("请至少填写部门名称或 Slug");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const res = await authorizedFetch(
        `/api/departments/${encodeURIComponent(editingDept.id)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, slug }),
        },
      );
      if (!res.ok) {
        const text = await res.text();
        console.error("update department error", text);
        if (res.status === 401) {
          setError("登录已失效，请重新登录后再试");
        } else if (res.status === 403) {
          setError("您没有权限编辑部门，如需操作请联系系统管理员。");
        } else {
          setError("编辑部门失败，请稍后重试");
        }
        return;
      }
      await loadDepartments();
      setEditingDept(null);
      setEditDeptForm({ name: "", slug: "" });
    } catch (e) {
      console.error("update department error", e);
      setError("编辑部门失败，请检查网络后重试");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="animate-fadeIn">
      {!canManage && (
        <div className="mb-4 text-xs text-slate-600 bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg">
          当前为只读权限，可查看部门列表，但无法新增、编辑或删除部门。
        </div>
      )}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-slate-900">部门管理</h2>
        <button
          onClick={() => {
            if (!canManage) return;
            setIsAddModalOpen(true);
          }}
          disabled={!canManage}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-blue-700 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" /> 新增部门
        </button>
      </div>

      {error && (
        <div className="mb-3 text-xs text-rose-600 bg-rose-50 border border-rose-100 px-3 py-2 rounded-lg">
          {error}
        </div>
      )}

      {loading && (
        <div className="mb-3 text-sm text-slate-400">正在加载部门列表...</div>
      )}

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {departments.map((dept) => (
          <div
            key={dept.id}
            className="p-5 border border-slate-200 rounded-xl flex justify-between items-center hover:shadow-md transition-all bg-white group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <div className="font-bold text-slate-900">{dept.name}</div>
                <div className="text-xs text-slate-400 font-mono">ID: {dept.id}</div>
                {dept.slug && (
                  <div className="text-xs text-slate-400 font-mono">slug: {dept.slug}</div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => openEditDept(dept)}
                disabled={!canManage}
                className="p-2 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Edit className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPendingDeleteDept(dept)}
                disabled={!canManage}
                className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <Modal
        isOpen={isAddModalOpen}
        onClose={() => {
          if (saving) return;
          setIsAddModalOpen(false);
        }}
        title="新增部门"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">部门名称</label>
            <input
              type="text"
              value={newDept.name}
              onChange={(e) => setNewDept({ ...newDept, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="例如：技术部"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">部门代号 (Slug)</label>
            <input
              type="text"
              value={newDept.slug}
              onChange={(e) => setNewDept({ ...newDept, slug: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="例如：tech，不填会自动生成"
            />
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <button
              onClick={() => {
                if (saving) return;
                setIsAddModalOpen(false);
              }}
              className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={saving}
            >
              取消
            </button>
            <button
              onClick={handleAddDept}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? "保存中..." : "确认添加"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!pendingDeleteDept}
        onClose={() => {
          if (deletingId) return;
          setPendingDeleteDept(null);
        }}
        title="确认删除部门"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            确认删除部门
            <span className="font-bold mx-1">{pendingDeleteDept?.name}</span>
            吗？删除后将无法通过该部门进行配置，新建需求时也无法再选择该部门，但已有数据不会被自动清除。
          </p>
          <div className="pt-4 flex justify-end gap-3">
            <button
              type="button"
              disabled={!!deletingId}
              onClick={() => {
                if (deletingId) return;
                setPendingDeleteDept(null);
              }}
              className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed"
            >
              取消
            </button>
            <button
              type="button"
              disabled={!!deletingId || !pendingDeleteDept}
              onClick={() => {
                if (!pendingDeleteDept) return;
                handleDeleteDept(pendingDeleteDept);
              }}
              className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {deletingId ? "删除中..." : "确认删除"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!editingDept}
        onClose={() => {
          if (saving) return;
          setEditingDept(null);
          setEditDeptForm({ name: "", slug: "" });
        }}
        title="编辑部门"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">部门名称</label>
            <input
              type="text"
              value={editDeptForm.name}
              onChange={(e) => setEditDeptForm({ ...editDeptForm, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="例如：技术部"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">部门代号 (Slug)</label>
            <input
              type="text"
              value={editDeptForm.slug}
              onChange={(e) => setEditDeptForm({ ...editDeptForm, slug: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="例如：tech，不填会自动生成"
            />
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <button
              onClick={() => {
                if (saving) return;
                setEditingDept(null);
                setEditDeptForm({ name: "", slug: "" });
              }}
              className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={saving}
            >
              取消
            </button>
            <button
              onClick={handleUpdateDept}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? "保存中..." : "保存修改"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

// -------------------- 工作流配置（优先级与状态） --------------------

const WorkflowConfigSettingsLegacy2 = ({ canManage }: { canManage: boolean }) => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string>("");
  const [config, setConfig] = useState<{
    priorities: Array<{ value: string; label: string; color: string; order: number }>;
    statuses: Array<{ value: string; label: string; color: string; order: number; transitions?: string[] }>;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const loadDepartments = async () => {
      try {
        const res = await fetch("/api/departments");
        if (!res.ok) {
          console.error("load workflow departments error", await res.text());
          return;
        }
        const json = await res.json();
        const items = (json.items || []) as { id: number; name: string; slug: string | null }[];
        const mapped: Department[] = items.map((d) => ({
          id: String(d.id),
          name: d.name,
          slug: d.slug || "",
        }));
        setDepartments(mapped);
        if (mapped.length > 0) {
          setSelectedDeptId(mapped[0].id);
        }
      } catch (e) {
        console.error("load workflow departments error", e);
      }
    };

    loadDepartments();
  }, []);

  useEffect(() => {
    if (!selectedDeptId) {
      setConfig(null);
      return;
    }
    const loadConfig = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await authorizedFetch(`/api/departments/${selectedDeptId}/workflow-config`);
        if (!res.ok) {
          const text = await res.text();
          console.error("load workflow config error", text);
          if (res.status === 401) {
            setError("登录已失效，请重新登录后再试");
          } else if (res.status === 403) {
            setError("您没有权限查看工作流配置，如需操作请联系系统管理员。");
          } else {
            setError("加载工作流配置失败，请稍后重试");
          }
          setConfig(null);
          return;
        }
        const json = await res.json();
        if (json.config) {
          setConfig(json.config);
        } else {
          setConfig({ priorities: [], statuses: [] });
        }
      } catch (e) {
        console.error("load workflow config error", e);
        setError("加载工作流配置失败，请检查网络后重试");
        setConfig(null);
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, [selectedDeptId]);

  const handleSave = async () => {
    if (!selectedDeptId || !config) return;
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      const res = await authorizedFetch(`/api/departments/${selectedDeptId}/workflow-config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error("save workflow config error", text);
        if (res.status === 401) {
          setError("登录已失效，请重新登录后再试");
        } else if (res.status === 403) {
          setError("您没有权限编辑工作流配置，如需操作请联系系统管理员。");
        } else {
          setError("保存工作流配置失败，请稍后重试");
        }
        return;
      }
      const json = await res.json();
      if (json.config) {
        setConfig(json.config);
      }
      setSuccess("工作流配置已保存");
    } catch (e) {
      console.error("save workflow config error", e);
      setError("保存工作流配置失败，请检查网络后重试");
    } finally {
      setSaving(false);
    }
  };

  const addPriority = () => {
    if (!config) return;
    const newPriority = {
      value: `priority_${Date.now()}`,
      label: "新优先级",
      color: "#6b7280",
      order: config.priorities.length + 1,
    };
    setConfig({ ...config, priorities: [...config.priorities, newPriority] });
  };

  const updatePriority = (index: number, field: string, value: any) => {
    if (!config) return;
    const updated = [...config.priorities];
    updated[index] = { ...updated[index], [field]: value };
    setConfig({ ...config, priorities: updated });
  };

  const deletePriority = (index: number) => {
    if (!config) return;
    const updated = config.priorities.filter((_, i) => i !== index);
    setConfig({ ...config, priorities: updated });
  };

  const addStatus = () => {
    if (!config) return;
    const newStatus = {
      value: `status_${Date.now()}`,
      label: "新状态",
      color: "#6b7280",
      order: config.statuses.length + 1,
      transitions: [],
    };
    setConfig({ ...config, statuses: [...config.statuses, newStatus] });
  };

  const updateStatus = (index: number, field: string, value: any) => {
    if (!config) return;
    const updated = [...config.statuses];
    updated[index] = { ...updated[index], [field]: value };
    setConfig({ ...config, statuses: updated });
  };

  const deleteStatus = (index: number) => {
    if (!config) return;
    const updated = config.statuses.filter((_, i) => i !== index);
    setConfig({ ...config, statuses: updated });
  };

  return (
    <div className="animate-fadeIn">
      {!canManage && (
        <div className="mb-4 text-xs text-slate-600 bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg">
          当前为只读权限，可查看工作流配置，但无法新增、编辑或删除。
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <h2 className="text-xl font-bold text-slate-900">工作流配置</h2>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">选择部门</span>
          <select
            value={selectedDeptId}
            onChange={(e) => setSelectedDeptId(e.target.value)}
            className="w-full sm:w-auto sm:min-w-[200px] max-w-full px-4 py-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-600 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
          >
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-3 text-xs text-rose-600 bg-rose-50 border border-rose-100 px-3 py-2 rounded-lg">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-3 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-2 rounded-lg">
          {success}
        </div>
      )}

      {loading && (
        <div className="p-6 text-center text-slate-400 text-sm">正在加载工作流配置...</div>
      )}

      {!loading && config && (
        <div className="space-y-6">
          {/* 优先级配置 */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800">优先级配置</h3>
              <button
                onClick={addPriority}
                disabled={!canManage}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Plus className="w-3 h-3" /> 添加优先级
              </button>
            </div>
            <div className="space-y-3">
              {config.priorities.length === 0 && (
                <div className="p-6 text-center text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-xl">
                  该部门暂无优先级配置，请点击"添加优先级"按钮进行配置。
                </div>
              )}
              {config.priorities.map((p, index) => (
                <div
                  key={index}
                  className="flex flex-col md:flex-row md:items-center gap-3 p-4 border border-slate-200 rounded-lg bg-slate-50"
                >
                  <div className="flex-1">
                    <label className="block text-xs text-slate-500 mb-1">值（英文）</label>
                    <input
                      type="text"
                      value={p.value}
                      onChange={(e) => updatePriority(index, "value", e.target.value)}
                      disabled={!canManage}
                      placeholder="例如：urgent"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm disabled:opacity-60"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-slate-500 mb-1">显示名称</label>
                    <input
                      type="text"
                      value={p.label}
                      onChange={(e) => updatePriority(index, "label", e.target.value)}
                      disabled={!canManage}
                      placeholder="例如：紧急"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">颜色</label>
                    <input
                      type="color"
                      value={p.color}
                      onChange={(e) => updatePriority(index, "color", e.target.value)}
                      disabled={!canManage}
                      className="w-20 h-10 border border-slate-300 rounded-lg cursor-pointer disabled:opacity-60"
                    />
                  </div>
                  <div className="w-20">
                    <label className="block text-xs text-slate-500 mb-1">排序</label>
                    <input
                      type="number"
                      value={p.order}
                      onChange={(e) => updatePriority(index, "order", Number(e.target.value))}
                      disabled={!canManage}
                      className="w-full px-2 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm disabled:opacity-60"
                    />
                  </div>
                  <button
                    onClick={() => deletePriority(index)}
                    disabled={!canManage}
                    className="mt-5 p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 状态配置 */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800">状态配置</h3>
              <button
                onClick={addStatus}
                disabled={!canManage}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Plus className="w-3 h-3" /> 添加状态
              </button>
            </div>
            <div className="space-y-3">
              {config.statuses.length === 0 && (
                <div className="p-6 text-center text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-xl">
                  该部门暂无状态配置，请点击"添加状态"按钮进行配置。
                </div>
              )}
              {config.statuses.map((s, index) => (
                <div
                  key={index}
                  className="flex flex-col gap-3 p-4 border border-slate-200 rounded-lg bg-slate-50"
                >
                  <div className="flex flex-col md:flex-row md:items-center gap-3">
                    <div className="flex-1">
                      <label className="block text-xs text-slate-500 mb-1">值（英文）</label>
                      <input
                        type="text"
                        value={s.value}
                        onChange={(e) => updateStatus(index, "value", e.target.value)}
                        disabled={!canManage}
                        placeholder="例如：in_progress"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm disabled:opacity-60"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs text-slate-500 mb-1">显示名称</label>
                      <input
                        type="text"
                        value={s.label}
                        onChange={(e) => updateStatus(index, "label", e.target.value)}
                        disabled={!canManage}
                        placeholder="例如：进行中"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm disabled:opacity-60"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">颜色</label>
                      <input
                        type="color"
                        value={s.color}
                        onChange={(e) => updateStatus(index, "color", e.target.value)}
                        disabled={!canManage}
                        className="w-20 h-10 border border-slate-300 rounded-lg cursor-pointer disabled:opacity-60"
                      />
                    </div>
                    <div className="w-20">
                      <label className="block text-xs text-slate-500 mb-1">排序</label>
                      <input
                        type="number"
                        value={s.order}
                        onChange={(e) => updateStatus(index, "order", Number(e.target.value))}
                        disabled={!canManage}
                        className="w-full px-2 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm disabled:opacity-60"
                      />
                    </div>
                    <button
                      onClick={() => deleteStatus(index)}
                      disabled={!canManage}
                      className="mt-5 p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">
                      可流转到（多选，用逗号分隔状态值）
                    </label>
                    <input
                      type="text"
                      value={s.transitions?.join(",") || ""}
                      onChange={(e) =>
                        updateStatus(
                          index,
                          "transitions",
                          e.target.value ? e.target.value.split(",").map((v) => v.trim()) : []
                        )
                      }
                      disabled={!canManage}
                      placeholder="例如：in_progress,done"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm disabled:opacity-60"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 保存按钮 */}
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving || !canManage}
              className="px-6 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? "保存中..." : "保存配置"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// -------------------- 字段模板（按部门配置需求自定义字段） --------------------

interface FieldTemplateEditingState extends Partial<FieldDefinition> {
  id?: string;
}

const FieldTemplates = ({ canManage }: { canManage: boolean }) => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>("");
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const [isFieldModalOpen, setIsFieldModalOpen] = useState(false);
  const [savingField, setSavingField] = useState(false);
  const [editingField, setEditingField] = useState<FieldTemplateEditingState>({
    label: "",
    type: "text",
    required: false,
    placeholder: "",
    options: [],
    filterable: false,
    exportable: true,
  });

  const [pendingDeleteField, setPendingDeleteField] = useState<FieldDefinition | null>(null);
  const [deletingFieldId, setDeletingFieldId] = useState<string | null>(null);

  useEffect(() => {
    const loadDepartments = async () => {
      try {
        const res = await fetch("/api/departments");
        if (!res.ok) {
          console.error("load admin departments error", await res.text());
          return;
        }
        const json = await res.json();
        const items = (json.items || []) as { id: number; name: string; slug: string | null }[];
        const mapped: Department[] = items.map((d) => ({
          id: String(d.id),
          name: d.name,
          slug: d.slug || "",
        }));
        setDepartments(mapped);
        if (mapped.length > 0) {
          setSelectedDept(mapped[0].id);
        }
      } catch (e) {
        console.error("load admin departments error", e);
      }
    };

    loadDepartments();
  }, []);

  const loadFields = async (deptId: string) => {
    if (!deptId) {
      setFields([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await authorizedFetch(
        `/api/department-fields?departmentId=${encodeURIComponent(deptId)}`,
      );
      if (!res.ok) {
        const text = await res.text();
        console.error("load department fields in settings error", text);
        if (res.status === 401) {
          setError("登录已失效，请重新登录后再试");
        } else if (res.status === 403) {
          setError("您没有权限查看或编辑字段模板，如需操作请联系系统管理员。");
        } else {
          setError("加载字段模板失败，请稍后重试");
        }
        setFields([]);
        return;
      }
      const json = await res.json();
      const items = (json.items || []) as FieldDefinition[];
      setFields(items);
    } catch (e) {
      console.error("load department fields in settings error", e);
      setFields([]);
      setError("加载字段模板失败，请检查网络后重试");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedDept) return;
    loadFields(selectedDept);
  }, [selectedDept]);

  const saveOrder = async (nextFields: FieldDefinition[]) => {
    if (!canManage) {
      setError("您只有查看权限，无法调整字段排序。");
      return;
    }

    if (!selectedDept || !nextFields.length) return;

    try {
      setSavingOrder(true);
      setError(null);
      const orderedKeys = nextFields.map((f) => f.id);
      const res = await authorizedFetch("/api/department-fields", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ departmentId: Number(selectedDept), orderedKeys }),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error("save department field order error", text);
        if (res.status === 401) {
          setError("登录已失效，请重新登录后再试");
        } else if (res.status === 403) {
          setError("您没有权限调整字段排序，如需操作请联系系统管理员。");
        } else {
          setError("保存字段排序失败，请稍后重试");
        }
      }
    } catch (e) {
      console.error("save department field order error", e);
      setError("保存字段排序失败，请检查网络后重试");
    } finally {
      setSavingOrder(false);
    }
  };

  const openEditModal = (field?: FieldDefinition) => {
    if (!canManage) {
      setError("您只有查看权限，无法新增或编辑字段模板。");
      return;
    }

    if (field) {
      setEditingField({
        ...field,
        filterable: !!field.filterable,
        exportable:
          field.exportable === undefined || field.exportable === null
            ? true
            : !!field.exportable,
      });
    } else {
      setEditingField({
        label: "",
        type: "text",
        required: false,
        placeholder: "",
        options: [],
        filterable: false,
        exportable: true,
      });
    }
    setIsFieldModalOpen(true);
  };

  const handleSaveField = async () => {
    if (!canManage) {
      setError("您只有查看权限，无法保存字段模板。");
      return;
    }

    if (!editingField.label || !selectedDept) return;

    const fieldId = (editingField.id || `f${Date.now()}`).toString();

    const optionsArray = Array.isArray(editingField.options)
      ? editingField.options
      : editingField.options
      ? String(editingField.options)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    const payload = {
      departmentId: Number(selectedDept),
      field: {
        id: fieldId,
        label: editingField.label,
        type: editingField.type as FieldType,
        required: !!editingField.required,
        placeholder: editingField.placeholder || "",
        options: optionsArray,
        filterable: !!editingField.filterable,
        exportable:
          editingField.exportable === undefined || editingField.exportable === null
            ? true
            : !!editingField.exportable,
      },
    };

    try {
      setSavingField(true);
      setError(null);
      const res = await authorizedFetch("/api/department-fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error("save department field error", text);
        if (res.status === 401) {
          setError("登录已失效，请重新登录后再试");
        } else if (res.status === 403) {
          setError("您没有权限新增或编辑字段，如需操作请联系系统管理员。");
        } else {
          setError("保存字段失败，请稍后重试");
        }
        return;
      }

      await loadFields(selectedDept);
      setIsFieldModalOpen(false);
      setEditingField({
        label: "",
        type: "text",
        required: false,
        placeholder: "",
        options: [],
      });
    } catch (e) {
      console.error("save department field error", e);
      setError("保存字段失败，请检查网络后重试");
    } finally {
      setSavingField(false);
    }
  };

  const handleDeleteField = async (id: string) => {
    if (!canManage) {
      setError("您只有查看权限，无法删除字段模板。");
      return;
    }

    if (!selectedDept) return;

    setError(null);
    setDeletingFieldId(id);
    setFields((prev) => prev.filter((field) => String(field.id) !== String(id)));

    try {
      const res = await authorizedFetch("/api/department-fields", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ departmentId: Number(selectedDept), fieldKey: id }),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error("delete department field error", text);
        if (res.status === 401) {
          setError("登录已失效，请重新登录后再试");
        } else if (res.status === 403) {
          setError("您没有权限删除字段，如需操作请联系系统管理员。");
        } else {
          setError("删除字段失败，请稍后重试");
        }
        await loadFields(selectedDept);
      }
    } catch (e) {
      console.error("delete department field error", e);
      setError("删除字段失败，请检查网络后重试");
      await loadFields(selectedDept);
    } finally {
      setDeletingFieldId(null);
      setPendingDeleteField(null);
    }
  };

  const currentFields = fields;

  return (
    <div className="animate-fadeIn">
      {!canManage && (
        <div className="mb-4 text-xs text-slate-600 bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg">
          当前为只读权限，可查看字段模板，但无法新增、编辑、删除或排序。
        </div>
      )}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <h2 className="text-xl font-bold text-slate-900">动态字段模板</h2>
        <div className="flex gap-2 items-center">
          <span className="text-xs text-slate-500">选择部门</span>
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="w-full sm:w-auto sm:min-w-[200px] max-w-full px-4 py-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-600 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
          >
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} 模板
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-2 text-xs text-rose-600 bg-rose-50 border border-rose-100 px-3 py-2 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {loading && (
          <div className="p-8 text-center text-slate-400 border border-slate-200 rounded-xl bg-slate-50">
            正在加载字段模板...
          </div>
        )}

        {!loading && currentFields.length === 0 && (
          <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl text-slate-400 bg-white">
            该部门暂无自定义字段，请点击下方按钮添加。
          </div>
        )}

        {!loading &&
          currentFields.map((field) => (
            <div
              key={field.id}
              draggable={canManage && !savingOrder}
              onDragStart={(e) => {
                if ((e.target as HTMLElement).closest("button")) {
                  e.preventDefault();
                  return;
                }
                setDraggingId(field.id as string);
              }}
              onDragEnd={() => setDraggingId(null)}
              onDragOver={(e) => {
                e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (!draggingId || draggingId === field.id) {
                  setDraggingId(null);
                  return;
                }
                const sourceId = draggingId;
                const targetId = field.id as string;
                const next = [...currentFields];
                const sourceIndex = next.findIndex((f) => f.id === sourceId);
                const targetIndex = next.findIndex((f) => f.id === targetId);
                if (sourceIndex === -1 || targetIndex === -1) {
                  setDraggingId(null);
                  return;
                }
                const [moved] = next.splice(sourceIndex, 1);
                next.splice(targetIndex, 0, moved);
                setFields(next);
                saveOrder(next);
                setDraggingId(null);
              }}
              className={`p-4 border border-slate-200 rounded-xl flex items-center justify-between bg-white shadow-sm group hover:border-blue-200 transition-all ${
                draggingId === field.id ? "opacity-70 ring-2 ring-blue-100" : ""
              }`}
            >
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-grab active:cursor-grabbing"
                >
                  <GripVertical className="w-4 h-4" />
                </button>
                <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-slate-900 mb-1 break-words">{field.label}</div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                    <span className="inline-flex items-center text-xs font-normal text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                      {field.id}
                    </span>
                    <span>{(field.type || "text").toUpperCase()}</span>
                    {field.required && <span className="text-red-500">必填</span>}
                    {field.options && field.options.length > 0 && (
                      <span className="text-slate-400">[{field.options.length} 选项]</span>
                    )}
                    {field.filterable && (
                      <span className="inline-flex items-center text-xs font-normal text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                        可筛选
                      </span>
                    )}
                    {field.exportable === false ? (
                      <span className="inline-flex items-center text-xs font-normal text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                        不导出
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-xs font-normal text-slate-500 bg-slate-50 px-2 py-0.5 rounded">
                        可导出
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => openEditModal(field)}
                  className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPendingDeleteField(field)}
                  disabled={deletingFieldId === field.id}
                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

        <button
          onClick={() => openEditModal()}
          disabled={!canManage}
          className="p-4 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 transition-all gap-2 font-bold bg-white disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Plus className="w-5 h-5" /> 添加新字段
        </button>
      </div>

      {/* 字段编辑弹窗 */}
      <Modal
        isOpen={isFieldModalOpen}
        onClose={() => setIsFieldModalOpen(false)}
        title={editingField.id ? "编辑字段" : "添加新字段"}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">字段名称 (Label)</label>
            <input
              type="text"
              value={editingField.label || ""}
              onChange={(e) => setEditingField({ ...editingField, label: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="例如：预算金额"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">字段类型</label>
              <select
                value={editingField.type || "text"}
                onChange={(e) =>
                  setEditingField({ ...editingField, type: e.target.value as FieldType })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="text">单行文本 (Text)</option>
                <option value="multiline">多行文本 (Textarea)</option>
                <option value="number">数值 (Number)</option>
                <option value="date">日期 (Date)</option>
                <option value="select">下拉单选 (Select)</option>
                <option value="multi_select">多选 (Multi Select)</option>
                <option value="boolean">布尔开关 (Yes / No)</option>
                <option value="url">URL 链接 (URL)</option>
                <option value="email">邮箱 (Email)</option>
                <option value="phone">手机号 (Phone)</option>
              </select>
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!editingField.required}
                  onChange={(e) =>
                    setEditingField({ ...editingField, required: e.target.checked })
                  }
                  className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                />
                <span className="text-sm font-bold text-slate-700">设为必填项</span>
              </label>
            </div>
          </div>

          {(editingField.type === "select" || editingField.type === "multi_select") && (
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                选项列表 (用英文逗号分隔)
              </label>
              <input
                type="text"
                value={
                  Array.isArray(editingField.options)
                    ? editingField.options.join(",")
                    : (editingField.options as string | undefined) || ""
                }
                onChange={(e) =>
                  setEditingField({
                    ...editingField,
                    options: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Option A,Option B,Option C"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">
              占位提示 (Placeholder)
            </label>
            <input
              type="text"
              value={editingField.placeholder || ""}
              onChange={(e) =>
                setEditingField({ ...editingField, placeholder: e.target.value })
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="请输入占位提示"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="inline-flex items-center gap-2 cursor-pointer text-sm text-slate-700">
              <input
                type="checkbox"
                checked={!!editingField.filterable}
                onChange={(e) =>
                  setEditingField({ ...editingField, filterable: e.target.checked })
                }
                className="w-4 h-4 text-blue-600 rounded border-gray-300"
              />
              <span>允许用于列表高级筛选</span>
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer text-sm text-slate-700">
              <input
                type="checkbox"
                checked={
                  editingField.exportable === undefined || editingField.exportable === null
                    ? true
                    : !!editingField.exportable
                }
                onChange={(e) =>
                  setEditingField({ ...editingField, exportable: e.target.checked })
                }
                className="w-4 h-4 text-blue-600 rounded border-gray-300"
              />
              <span>默认包含在导出文件中</span>
            </label>
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button
              onClick={() => setIsFieldModalOpen(false)}
              className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-lg"
            >
              取消
            </button>
            <button
              onClick={handleSaveField}
              disabled={savingField}
              className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {savingField ? "保存中..." : "保存字段"}
            </button>
          </div>
        </div>
      </Modal>

      {/* 删除字段确认弹窗 */}
      <Modal
        isOpen={!!pendingDeleteField}
        onClose={() => {
          if (deletingFieldId) return;
          setPendingDeleteField(null);
        }}
        title="确认删除字段"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            确认删除字段
            <span className="font-bold mx-1">{pendingDeleteField?.label}</span>
            吗？删除后新建需求将不再显示该字段，已有需求中已保存的数据不会被自动清除。
          </p>
          <div className="pt-4 flex justify-end gap-3">
            <button
              type="button"
              disabled={!!deletingFieldId}
              onClick={() => {
                if (deletingFieldId) return;
                setPendingDeleteField(null);
              }}
              className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed"
            >
              取消
            </button>
            <button
              type="button"
              disabled={!!deletingFieldId || !pendingDeleteField}
              onClick={() => {
                if (!pendingDeleteField) return;
                handleDeleteField(pendingDeleteField.id as string);
              }}
              className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {deletingFieldId ? "删除中..." : "确认删除"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

// -------------------- 工作流配置（优先级与状态） --------------------

const WorkflowConfigSettingsLegacy3 = ({ canManage }: { canManage: boolean }) => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string>("");
  const [config, setConfig] = useState<{
    priorities: Array<{ value: string; label: string; color: string; order: number }>;
    statuses: Array<{ value: string; label: string; color: string; order: number; transitions?: string[] }>;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const loadDepartments = async () => {
      try {
        const res = await fetch("/api/departments");
        if (!res.ok) {
          console.error("load workflow departments error", await res.text());
          return;
        }
        const json = await res.json();
        const items = (json.items || []) as { id: number; name: string; slug: string | null }[];
        const mapped: Department[] = items.map((d) => ({
          id: String(d.id),
          name: d.name,
          slug: d.slug || "",
        }));
        setDepartments(mapped);
        if (mapped.length > 0) {
          setSelectedDeptId(mapped[0].id);
        }
      } catch (e) {
        console.error("load workflow departments error", e);
      }
    };

    loadDepartments();
  }, []);

  useEffect(() => {
    if (!selectedDeptId) {
      setConfig(null);
      return;
    }
    const loadConfig = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await authorizedFetch(`/api/departments/${selectedDeptId}/workflow-config`);
        if (!res.ok) {
          const text = await res.text();
          console.error("load workflow config error", text);
          if (res.status === 401) {
            setError("登录已失效，请重新登录后再试");
          } else if (res.status === 403) {
            setError("您没有权限查看工作流配置，如需操作请联系系统管理员。");
          } else {
            setError("加载工作流配置失败，请稍后重试");
          }
          setConfig(null);
          return;
        }
        const json = await res.json();
        if (json.config) {
          setConfig(json.config);
        } else {
          setConfig({ priorities: [], statuses: [] });
        }
      } catch (e) {
        console.error("load workflow config error", e);
        setError("加载工作流配置失败，请检查网络后重试");
        setConfig(null);
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, [selectedDeptId]);

  const handleSave = async () => {
    if (!selectedDeptId || !config) return;
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      const res = await authorizedFetch(`/api/departments/${selectedDeptId}/workflow-config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error("save workflow config error", text);
        if (res.status === 401) {
          setError("登录已失效，请重新登录后再试");
        } else if (res.status === 403) {
          setError("您没有权限编辑工作流配置，如需操作请联系系统管理员。");
        } else {
          setError("保存工作流配置失败，请稍后重试");
        }
        return;
      }
      const json = await res.json();
      if (json.config) {
        setConfig(json.config);
      }
      setSuccess("工作流配置已保存");
    } catch (e) {
      console.error("save workflow config error", e);
      setError("保存工作流配置失败，请检查网络后重试");
    } finally {
      setSaving(false);
    }
  };

  const addPriority = () => {
    if (!config) return;
    const newPriority = {
      value: `priority_${Date.now()}`,
      label: "新优先级",
      color: "#6b7280",
      order: config.priorities.length + 1,
    };
    setConfig({ ...config, priorities: [...config.priorities, newPriority] });
  };

  const updatePriority = (index: number, field: string, value: any) => {
    if (!config) return;
    const updated = [...config.priorities];
    updated[index] = { ...updated[index], [field]: value };
    setConfig({ ...config, priorities: updated });
  };

  const deletePriority = (index: number) => {
    if (!config) return;
    const updated = config.priorities.filter((_, i) => i !== index);
    setConfig({ ...config, priorities: updated });
  };

  const addStatus = () => {
    if (!config) return;
    const newStatus = {
      value: `status_${Date.now()}`,
      label: "新状态",
      color: "#6b7280",
      order: config.statuses.length + 1,
      transitions: [],
    };
    setConfig({ ...config, statuses: [...config.statuses, newStatus] });
  };

  const updateStatus = (index: number, field: string, value: any) => {
    if (!config) return;
    const updated = [...config.statuses];
    updated[index] = { ...updated[index], [field]: value };
    setConfig({ ...config, statuses: updated });
  };

  const deleteStatus = (index: number) => {
    if (!config) return;
    const updated = config.statuses.filter((_, i) => i !== index);
    setConfig({ ...config, statuses: updated });
  };

  return (
    <div className="animate-fadeIn">
      {!canManage && (
        <div className="mb-4 text-xs text-slate-600 bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg">
          当前为只读权限，可查看工作流配置，但无法新增、编辑或删除。
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <h2 className="text-xl font-bold text-slate-900">工作流配置</h2>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">选择部门</span>
          <select
            value={selectedDeptId}
            onChange={(e) => setSelectedDeptId(e.target.value)}
            className="w-full sm:w-auto sm:min-w-[200px] max-w-full px-4 py-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-600 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
          >
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-3 text-xs text-rose-600 bg-rose-50 border border-rose-100 px-3 py-2 rounded-lg">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-3 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-2 rounded-lg">
          {success}
        </div>
      )}

      {loading && (
        <div className="p-6 text-center text-slate-400 text-sm">正在加载工作流配置...</div>
      )}

      {!loading && config && (
        <div className="space-y-6">
          {/* 优先级配置 */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800">优先级配置</h3>
              <button
                onClick={addPriority}
                disabled={!canManage}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Plus className="w-3 h-3" /> 添加优先级
              </button>
            </div>
            <div className="space-y-3">
              {config.priorities.length === 0 && (
                <div className="p-6 text-center text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-xl">
                  该部门暂无优先级配置，请点击"添加优先级"按钮进行配置。
                </div>
              )}
              {config.priorities.map((p, index) => (
                <div
                  key={index}
                  className="flex flex-col md:flex-row md:items-center gap-3 p-4 border border-slate-200 rounded-lg bg-slate-50"
                >
                  <div className="flex-1">
                    <label className="block text-xs text-slate-500 mb-1">值（英文）</label>
                    <input
                      type="text"
                      value={p.value}
                      onChange={(e) => updatePriority(index, "value", e.target.value)}
                      disabled={!canManage}
                      placeholder="例如：urgent"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm disabled:opacity-60"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-slate-500 mb-1">显示名称</label>
                    <input
                      type="text"
                      value={p.label}
                      onChange={(e) => updatePriority(index, "label", e.target.value)}
                      disabled={!canManage}
                      placeholder="例如：紧急"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">颜色</label>
                    <input
                      type="color"
                      value={p.color}
                      onChange={(e) => updatePriority(index, "color", e.target.value)}
                      disabled={!canManage}
                      className="w-20 h-10 border border-slate-300 rounded-lg cursor-pointer disabled:opacity-60"
                    />
                  </div>
                  <div className="w-20">
                    <label className="block text-xs text-slate-500 mb-1">排序</label>
                    <input
                      type="number"
                      value={p.order}
                      onChange={(e) => updatePriority(index, "order", Number(e.target.value))}
                      disabled={!canManage}
                      className="w-full px-2 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm disabled:opacity-60"
                    />
                  </div>
                  <button
                    onClick={() => deletePriority(index)}
                    disabled={!canManage}
                    className="mt-5 p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 状态配置 */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800">状态配置</h3>
              <button
                onClick={addStatus}
                disabled={!canManage}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Plus className="w-3 h-3" /> 添加状态
              </button>
            </div>
            <div className="space-y-3">
              {config.statuses.length === 0 && (
                <div className="p-6 text-center text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-xl">
                  该部门暂无状态配置，请点击"添加状态"按钮进行配置。
                </div>
              )}
              {config.statuses.map((s, index) => (
                <div
                  key={index}
                  className="flex flex-col gap-3 p-4 border border-slate-200 rounded-lg bg-slate-50"
                >
                  <div className="flex flex-col md:flex-row md:items-center gap-3">
                    <div className="flex-1">
                      <label className="block text-xs text-slate-500 mb-1">值（英文）</label>
                      <input
                        type="text"
                        value={s.value}
                        onChange={(e) => updateStatus(index, "value", e.target.value)}
                        disabled={!canManage}
                        placeholder="例如：in_progress"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm disabled:opacity-60"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs text-slate-500 mb-1">显示名称</label>
                      <input
                        type="text"
                        value={s.label}
                        onChange={(e) => updateStatus(index, "label", e.target.value)}
                        disabled={!canManage}
                        placeholder="例如：进行中"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm disabled:opacity-60"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">颜色</label>
                      <input
                        type="color"
                        value={s.color}
                        onChange={(e) => updateStatus(index, "color", e.target.value)}
                        disabled={!canManage}
                        className="w-20 h-10 border border-slate-300 rounded-lg cursor-pointer disabled:opacity-60"
                      />
                    </div>
                    <div className="w-20">
                      <label className="block text-xs text-slate-500 mb-1">排序</label>
                      <input
                        type="number"
                        value={s.order}
                        onChange={(e) => updateStatus(index, "order", Number(e.target.value))}
                        disabled={!canManage}
                        className="w-full px-2 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm disabled:opacity-60"
                      />
                    </div>
                    <button
                      onClick={() => deleteStatus(index)}
                      disabled={!canManage}
                      className="mt-5 p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">
                      可流转到（多选，用逗号分隔状态值）
                    </label>
                    <input
                      type="text"
                      value={s.transitions?.join(",") || ""}
                      onChange={(e) =>
                        updateStatus(
                          index,
                          "transitions",
                          e.target.value ? e.target.value.split(",").map((v) => v.trim()) : []
                        )
                      }
                      disabled={!canManage}
                      placeholder="例如：in_progress,done"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm disabled:opacity-60"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 保存按钮 */}
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving || !canManage}
              className="px-6 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? "保存中..." : "保存配置"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// -------------------- 评分周期配置（按服务月配置评分窗口） --------------------

interface ScorePeriodItem {
  id: number;
  period: string;
  scoreWindowStart: string | null;
  scoreWindowEnd: string | null;
  status: string;
  createdAt: string | null;
  updatedAt: string | null;
}

const ScorePeriodsSettings = ({ canManage }: { canManage: boolean }) => {
  const [items, setItems] = useState<ScorePeriodItem[]>([]);
  const [year, setYear] = useState<string>(new Date().getFullYear().toString());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pendingDeletePeriod, setPendingDeletePeriod] = useState<ScorePeriodItem | null>(null);

  const loadPeriods = async () => {
    try {
      setLoading(true);
      setError(null);
      const query = year.trim() ? `?year=${encodeURIComponent(year.trim())}` : "";
      const res = await authorizedFetch(`/api/admin/score-periods${query}`);
      if (!res.ok) {
        const text = await res.text();
        console.error("load score periods error", text);
        if (res.status === 401) {
          setError("登录已失效，请重新登录后再试");
        } else if (res.status === 403) {
          setError("您没有权限查看评分周期配置，如需操作请联系系统管理员。");
        } else {
          setError("加载评分周期配置失败，请稍后重试");
        }
        setItems([]);
        return;
      }
      const json = await res.json();
      const list = (json.items || []) as ScorePeriodItem[];
      const normalizeDateTime = (value: string | null): string => {
        if (!value) return "";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
          return value;
        }
        const yearNum = date.getFullYear();
        const monthNum = date.getMonth() + 1;
        const dayNum = date.getDate();
        const hourNum = date.getHours();
        const minuteNum = date.getMinutes();
        const yearStr = `${yearNum}`;
        const monthStr = `${monthNum}`.padStart(2, "0");
        const dayStr = `${dayNum}`.padStart(2, "0");
        const hourStr = `${hourNum}`.padStart(2, "0");
        const minuteStr = `${minuteNum}`.padStart(2, "0");
        return `${yearStr}-${monthStr}-${dayStr}T${hourStr}:${minuteStr}`;
      };
      const mapped = list.map((item) => ({
        ...item,
        scoreWindowStart: normalizeDateTime(item.scoreWindowStart),
        scoreWindowEnd: normalizeDateTime(item.scoreWindowEnd),
      }));
      setItems(mapped);
    } catch (e) {
      console.error("load score periods error", e);
      setError("加载评分周期配置失败，请检查网络后重试");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPeriods();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const upsertPeriod = async (item: ScorePeriodItem) => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      const res = await authorizedFetch("/api/admin/score-periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period: item.period,
          scoreWindowStart: item.scoreWindowStart,
          scoreWindowEnd: item.scoreWindowEnd,
          status: item.status,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error("save score period error", text);
        if (res.status === 401) {
          setError("登录已失效，请重新登录后再试");
        } else if (res.status === 403) {
          setError("您没有权限编辑评分周期配置，如需操作请联系系统管理员。");
        } else {
          try {
            const json = JSON.parse(text);
            if (json?.detail) {
              setError(
                typeof json.detail === "string"
                  ? json.detail
                  : "保存评分周期配置失败，请稍后重试",
              );
            } else {
              setError("保存评分周期配置失败，请稍后重试");
            }
          } catch {
            setError("保存评分周期配置失败，请稍后重试");
          }
        }
        return;
      }
      const json = await res.json();
      const updatedRaw = json.period as ScorePeriodItem;
      const normalizeDateTime = (value: string | null): string => {
        if (!value) return "";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
          return value;
        }
        const yearNum = date.getFullYear();
        const monthNum = date.getMonth() + 1;
        const dayNum = date.getDate();
        const hourNum = date.getHours();
        const minuteNum = date.getMinutes();
        const yearStr = `${yearNum}`;
        const monthStr = `${monthNum}`.padStart(2, "0");
        const dayStr = `${dayNum}`.padStart(2, "0");
        const hourStr = `${hourNum}`.padStart(2, "0");
        const minuteStr = `${minuteNum}`.padStart(2, "0");
        return `${yearStr}-${monthStr}-${dayStr}T${hourStr}:${minuteStr}`;
      };
      const updated: ScorePeriodItem = {
        ...updatedRaw,
        scoreWindowStart: normalizeDateTime(updatedRaw.scoreWindowStart),
        scoreWindowEnd: normalizeDateTime(updatedRaw.scoreWindowEnd),
      };
      setItems((prev) => {
        const others = prev.filter((p) => p.period !== updated.period);
        return [...others, updated].sort((a, b) => (a.period < b.period ? 1 : -1));
      });
      setSuccess("评分周期配置已保存");
    } catch (e) {
      console.error("save score period error", e);
      setError("保存评分周期配置失败，请检查网络后重试");
    } finally {
      setSaving(false);
    }
  };

  const deletePeriod = async (period: string) => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      const res = await authorizedFetch("/api/admin/score-periods", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period }),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error("delete score period error", text);
        if (res.status === 401) {
          setError("登录已失效，请重新登录后再试");
        } else if (res.status === 403) {
          setError("您没有权限删除评分周期配置，如需操作请联系系统管理员。");
        } else {
          try {
            const json = JSON.parse(text);
            if (json?.detail) {
              setError(
                typeof json.detail === "string"
                  ? json.detail
                  : "删除评分周期配置失败，请稍后重试",
              );
            } else {
              setError("删除评分周期配置失败，请稍后重试");
            }
          } catch {
            setError("删除评分周期配置失败，请稍后重试");
          }
        }
        return;
      }
      setItems((prev) => prev.filter((item) => item.period !== period));
      setSuccess("评分周期配置已删除");
    } catch (e) {
      console.error("delete score period error", e);
      setError("删除评分周期配置失败，请检查网络后重试");
    } finally {
      setSaving(false);
    }
  };

  const handleAddCurrentPeriod = () => {
    const now = new Date();
    const yearStr = now.getFullYear().toString();
    const monthStr = `${now.getMonth() + 1}`.padStart(2, "0");
    const period = `${yearStr}-${monthStr}`;
    if (items.some((it) => it.period === period)) {
      setError("当前月份的评分周期已存在，可直接编辑评分窗口");
      return;
    }
    setItems((prev) => [
      {
        id: 0,
        period,
        scoreWindowStart: "",
        scoreWindowEnd: "",
        status: "planned",
        createdAt: null,
        updatedAt: null,
      },
      ...prev,
    ]);
  };

  const handleFieldChange = (index: number, key: keyof ScorePeriodItem, value: string) => {
    setItems((prev) => {
      const next = [...prev];
      const item = { ...next[index] };
      if (key === "scoreWindowStart" || key === "scoreWindowEnd") {
        item[key] = value || "";
      } else if (key === "status") {
        item.status = value;
      }
      next[index] = item;
      return next;
    });
  };

  return (
    <div className={`animate-fadeIn max-w-4xl ${canManage ? "" : "pointer-events-none opacity-75"}`}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Star className="w-5 h-5 text-blue-500" /> 评分周期配置
        </h2>
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">筛选年份</span>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-24 px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <button
            type="button"
            onClick={loadPeriods}
            disabled={loading || !canManage}
            className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            重新加载
          </button>
          <button
            type="button"
            onClick={handleAddCurrentPeriod}
            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          >
            添加当前月份
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-3 text-xs text-rose-600 bg-rose-50 border border-rose-100 px-3 py-2 rounded-lg">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-3 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-2 rounded-lg">
          {success}
        </div>
      )}

      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2 text-xs font-bold text-slate-500 bg-slate-50 border-b border-slate-200">
          <div className="col-span-2">服务月 (period)</div>
          <div className="col-span-4">评分窗口开始时间</div>
          <div className="col-span-4">评分窗口结束时间</div>
          <div className="col-span-2">状态</div>
        </div>
        {loading && (
          <div className="p-6 text-center text-slate-400 text-sm">正在加载评分周期配置...</div>
        )}
        {!loading && items.length === 0 && (
          <div className="p-6 text-center text-slate-400 text-sm bg-white">
            当前年份暂无评分周期配置，可点击右上角“添加当前月份”进行配置。
          </div>
        )}
        {!loading && items.length > 0 && (
          <div className="divide-y divide-slate-100 bg-white">
            {items
              .slice()
              .sort((a, b) => (a.period < b.period ? 1 : -1))
              .map((item, index) => (
                <div
                  key={`${item.id}-${item.period}-${index}`}
                  className="grid grid-cols-1 md:grid-cols-12 gap-3 px-4 py-3 items-start text-xs"
                >
                  <div className="col-span-2 font-mono text-slate-800">{item.period}</div>
                  <div className="col-span-4">
                    <input
                      type="datetime-local"
                      value={item.scoreWindowStart ? item.scoreWindowStart : ""}
                      onChange={(e) => handleFieldChange(index, "scoreWindowStart", e.target.value)}
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-xs"
                    />
                  </div>
                  <div className="col-span-4">
                    <input
                      type="datetime-local"
                      value={item.scoreWindowEnd ? item.scoreWindowEnd : ""}
                      onChange={(e) => handleFieldChange(index, "scoreWindowEnd", e.target.value)}
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-xs"
                    />
                  </div>
                  <div className="col-span-2 flex flex-wrap items-center gap-2">
                    <select
                      value={item.status}
                      onChange={(e) => handleFieldChange(index, "status", e.target.value)}
                      className="flex-1 px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="planned">未开始</option>
                      <option value="open">评分中</option>
                      <option value="closed">已结束</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => upsertPeriod(items[index])}
                      disabled={saving}
                      className="px-2 py-1 text-[11px] font-bold rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      保存
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDeletePeriod(item)}
                      disabled={saving}
                      className="px-2 py-1 text-[11px] font-bold rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      <Modal
        isOpen={!!pendingDeletePeriod}
        onClose={() => {
          if (saving) return;
          setPendingDeletePeriod(null);
        }}
        title="确认删除评分周期"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            确认删除评分周期
            <span className="font-bold mx-1">{pendingDeletePeriod?.period}</span>
            吗？删除后该服务月的评分窗口配置将被清除，但已生成的评分任务和评分记录不会自动删除。
          </p>
          <div className="pt-4 flex justify-end gap-3">
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                if (saving) return;
                setPendingDeletePeriod(null);
              }}
              className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed"
            >
              取消
            </button>
            <button
              type="button"
              disabled={saving || !pendingDeletePeriod}
              onClick={() => {
                if (!pendingDeletePeriod) return;
                deletePeriod(pendingDeletePeriod.period);
                setPendingDeletePeriod(null);
              }}
              className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? "删除中..." : "确认删除"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

// -------------------- 工作流配置（优先级与状态） --------------------

const WorkflowConfigSettingsLegacy4 = ({ canManage }: { canManage: boolean }) => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string>("");
  const [config, setConfig] = useState<{
    priorities: Array<{ value: string; label: string; color: string; order: number }>;
    statuses: Array<{ value: string; label: string; color: string; order: number; transitions?: string[] }>;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const loadDepartments = async () => {
      try {
        const res = await fetch("/api/departments");
        if (!res.ok) {
          console.error("load workflow departments error", await res.text());
          return;
        }
        const json = await res.json();
        const items = (json.items || []) as { id: number; name: string; slug: string | null }[];
        const mapped: Department[] = items.map((d) => ({
          id: String(d.id),
          name: d.name,
          slug: d.slug || "",
        }));
        setDepartments(mapped);
        if (mapped.length > 0) {
          setSelectedDeptId(mapped[0].id);
        }
      } catch (e) {
        console.error("load workflow departments error", e);
      }
    };

    loadDepartments();
  }, []);

  useEffect(() => {
    if (!selectedDeptId) {
      setConfig(null);
      return;
    }
    const loadConfig = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await authorizedFetch(`/api/departments/${selectedDeptId}/workflow-config`);
        if (!res.ok) {
          const text = await res.text();
          console.error("load workflow config error", text);
          if (res.status === 401) {
            setError("登录已失效，请重新登录后再试");
          } else if (res.status === 403) {
            setError("您没有权限查看工作流配置，如需操作请联系系统管理员。");
          } else {
            setError("加载工作流配置失败，请稍后重试");
          }
          setConfig(null);
          return;
        }
        const json = await res.json();
        if (json.config) {
          setConfig(json.config);
        } else {
          setConfig({ priorities: [], statuses: [] });
        }
      } catch (e) {
        console.error("load workflow config error", e);
        setError("加载工作流配置失败，请检查网络后重试");
        setConfig(null);
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, [selectedDeptId]);

  const handleSave = async () => {
    if (!selectedDeptId || !config) return;
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      const res = await authorizedFetch(`/api/departments/${selectedDeptId}/workflow-config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error("save workflow config error", text);
        if (res.status === 401) {
          setError("登录已失效，请重新登录后再试");
        } else if (res.status === 403) {
          setError("您没有权限编辑工作流配置，如需操作请联系系统管理员。");
        } else {
          setError("保存工作流配置失败，请稍后重试");
        }
        return;
      }
      const json = await res.json();
      if (json.config) {
        setConfig(json.config);
      }
      setSuccess("工作流配置已保存");
    } catch (e) {
      console.error("save workflow config error", e);
      setError("保存工作流配置失败，请检查网络后重试");
    } finally {
      setSaving(false);
    }
  };

  const addPriority = () => {
    if (!config) return;
    const newPriority = {
      value: `priority_${Date.now()}`,
      label: "新优先级",
      color: "#6b7280",
      order: config.priorities.length + 1,
    };
    setConfig({ ...config, priorities: [...config.priorities, newPriority] });
  };

  const updatePriority = (index: number, field: string, value: any) => {
    if (!config) return;
    const updated = [...config.priorities];
    updated[index] = { ...updated[index], [field]: value };
    setConfig({ ...config, priorities: updated });
  };

  const deletePriority = (index: number) => {
    if (!config) return;
    const updated = config.priorities.filter((_, i) => i !== index);
    setConfig({ ...config, priorities: updated });
  };

  const addStatus = () => {
    if (!config) return;
    const newStatus = {
      value: `status_${Date.now()}`,
      label: "新状态",
      color: "#6b7280",
      order: config.statuses.length + 1,
      transitions: [],
    };
    setConfig({ ...config, statuses: [...config.statuses, newStatus] });
  };

  const updateStatus = (index: number, field: string, value: any) => {
    if (!config) return;
    const updated = [...config.statuses];
    updated[index] = { ...updated[index], [field]: value };
    setConfig({ ...config, statuses: updated });
  };

  const deleteStatus = (index: number) => {
    if (!config) return;
    const updated = config.statuses.filter((_, i) => i !== index);
    setConfig({ ...config, statuses: updated });
  };

  return (
    <div className="animate-fadeIn">
      {!canManage && (
        <div className="mb-4 text-xs text-slate-600 bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg">
          当前为只读权限，可查看工作流配置，但无法新增、编辑或删除。
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <h2 className="text-xl font-bold text-slate-900">工作流配置</h2>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">选择部门</span>
          <select
            value={selectedDeptId}
            onChange={(e) => setSelectedDeptId(e.target.value)}
            className="w-full sm:w-auto sm:min-w-[200px] max-w-full px-4 py-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-600 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
          >
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-3 text-xs text-rose-600 bg-rose-50 border border-rose-100 px-3 py-2 rounded-lg">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-3 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-2 rounded-lg">
          {success}
        </div>
      )}

      {loading && (
        <div className="p-6 text-center text-slate-400 text-sm">正在加载工作流配置...</div>
      )}

      {!loading && config && (
        <div className="space-y-6">
          {/* 优先级配置 */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800">优先级配置</h3>
              <button
                onClick={addPriority}
                disabled={!canManage}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Plus className="w-3 h-3" /> 添加优先级
              </button>
            </div>
            <div className="space-y-3">
              {config.priorities.length === 0 && (
                <div className="p-6 text-center text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-xl">
                  该部门暂无优先级配置，请点击"添加优先级"按钮进行配置。
                </div>
              )}
              {config.priorities.map((p, index) => (
                <div
                  key={index}
                  className="flex flex-col md:flex-row md:items-center gap-3 p-4 border border-slate-200 rounded-lg bg-slate-50"
                >
                  <div className="flex-1">
                    <label className="block text-xs text-slate-500 mb-1">值（英文）</label>
                    <input
                      type="text"
                      value={p.value}
                      onChange={(e) => updatePriority(index, "value", e.target.value)}
                      disabled={!canManage}
                      placeholder="例如：urgent"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm disabled:opacity-60"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-slate-500 mb-1">显示名称</label>
                    <input
                      type="text"
                      value={p.label}
                      onChange={(e) => updatePriority(index, "label", e.target.value)}
                      disabled={!canManage}
                      placeholder="例如：紧急"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">颜色</label>
                    <input
                      type="color"
                      value={p.color}
                      onChange={(e) => updatePriority(index, "color", e.target.value)}
                      disabled={!canManage}
                      className="w-20 h-10 border border-slate-300 rounded-lg cursor-pointer disabled:opacity-60"
                    />
                  </div>
                  <div className="w-20">
                    <label className="block text-xs text-slate-500 mb-1">排序</label>
                    <input
                      type="number"
                      value={p.order}
                      onChange={(e) => updatePriority(index, "order", Number(e.target.value))}
                      disabled={!canManage}
                      className="w-full px-2 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm disabled:opacity-60"
                    />
                  </div>
                  <button
                    onClick={() => deletePriority(index)}
                    disabled={!canManage}
                    className="mt-5 p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 状态配置 */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800">状态配置</h3>
              <button
                onClick={addStatus}
                disabled={!canManage}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Plus className="w-3 h-3" /> 添加状态
              </button>
            </div>
            <div className="space-y-3">
              {config.statuses.length === 0 && (
                <div className="p-6 text-center text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-xl">
                  该部门暂无状态配置，请点击"添加状态"按钮进行配置。
                </div>
              )}
              {config.statuses.map((s, index) => (
                <div
                  key={index}
                  className="flex flex-col gap-3 p-4 border border-slate-200 rounded-lg bg-slate-50"
                >
                  <div className="flex flex-col md:flex-row md:items-center gap-3">
                    <div className="flex-1">
                      <label className="block text-xs text-slate-500 mb-1">值（英文）</label>
                      <input
                        type="text"
                        value={s.value}
                        onChange={(e) => updateStatus(index, "value", e.target.value)}
                        disabled={!canManage}
                        placeholder="例如：in_progress"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm disabled:opacity-60"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs text-slate-500 mb-1">显示名称</label>
                      <input
                        type="text"
                        value={s.label}
                        onChange={(e) => updateStatus(index, "label", e.target.value)}
                        disabled={!canManage}
                        placeholder="例如：进行中"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm disabled:opacity-60"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">颜色</label>
                      <input
                        type="color"
                        value={s.color}
                        onChange={(e) => updateStatus(index, "color", e.target.value)}
                        disabled={!canManage}
                        className="w-20 h-10 border border-slate-300 rounded-lg cursor-pointer disabled:opacity-60"
                      />
                    </div>
                    <div className="w-20">
                      <label className="block text-xs text-slate-500 mb-1">排序</label>
                      <input
                        type="number"
                        value={s.order}
                        onChange={(e) => updateStatus(index, "order", Number(e.target.value))}
                        disabled={!canManage}
                        className="w-full px-2 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm disabled:opacity-60"
                      />
                    </div>
                    <button
                      onClick={() => deleteStatus(index)}
                      disabled={!canManage}
                      className="mt-5 p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">
                      可流转到（多选，用逗号分隔状态值）
                    </label>
                    <input
                      type="text"
                      value={s.transitions?.join(",") || ""}
                      onChange={(e) =>
                        updateStatus(
                          index,
                          "transitions",
                          e.target.value ? e.target.value.split(",").map((v) => v.trim()) : []
                        )
                      }
                      disabled={!canManage}
                      placeholder="例如：in_progress,done"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm disabled:opacity-60"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 保存按钮 */}
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving || !canManage}
              className="px-6 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? "保存中..." : "保存配置"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// -------------------- 评分模板（按部门配置评分表单） --------------------

interface ScoringScaleOption {
  value: number;
  label: string;
}

interface ScoringTemplateItem {
  label: string;
  max: number;
  required: boolean;
  options?: ScoringScaleOption[];
  // 编辑时使用的原始分档表达式，例如："2:差,4:一般,6:良好,8:优秀,10:卓越"
  scaleExpression?: string;
}

interface ScoringTemplateDto {
  id: number;
  departmentId: number;
  name: string;
  isActive: boolean;
  items: ScoringTemplateItem[];
}

const ScoringTemplates = ({ canManage }: { canManage: boolean }) => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string>("");
  const [templateName, setTemplateName] = useState<string>("默认评分模板");
  const [isActive, setIsActive] = useState<boolean>(true);
  const [items, setItems] = useState<ScoringTemplateItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pendingDeletePeriod, setPendingDeletePeriod] = useState<ScorePeriodItem | null>(null);

  useEffect(() => {
    const loadDepartments = async () => {
      try {
        const res = await fetch("/api/departments");
        if (!res.ok) {
          console.error("load scoring departments error", await res.text());
          return;
        }
        const json = await res.json();
        const items = (json.items || []) as { id: number; name: string; slug: string | null }[];
        const mapped: Department[] = items.map((d) => ({
          id: String(d.id),
          name: d.name,
          slug: d.slug || "",
        }));
        setDepartments(mapped);
        if (mapped.length > 0) {
          setSelectedDeptId(mapped[0].id);
        }
      } catch (e) {
        console.error("load scoring departments error", e);
      }
    };

    loadDepartments();
  }, []);

  useEffect(() => {
    const loadTemplate = async () => {
      if (!selectedDeptId) {
        setItems([]);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        setSuccess(null);
        const res = await authorizedFetch(
          `/api/admin/score-templates?departmentId=${encodeURIComponent(selectedDeptId)}`,
        );
        if (!res.ok) {
          const text = await res.text();
          console.error("load scoring template error", text);
          if (res.status === 401) {
            setError("登录已失效，请重新登录后再试");
          } else if (res.status === 403) {
            setError("您没有权限查看评分模板，如需操作请联系系统管理员。");
          } else {
            setError("加载评分模板失败，请稍后重试");
          }
          setItems([]);
          return;
        }
        const json = await res.json();
        const list = (json.items || []) as ScoringTemplateDto[];
        if (!list.length) {
          setTemplateName("默认评分模板");
          setIsActive(false);
          setItems([]);
          return;
        }
        const tpl = list[0];
        setTemplateName(tpl.name || "默认评分模板");
        setIsActive(!!tpl.isActive);
        setItems((tpl.items || []).map((it) => {
          let options: ScoringScaleOption[] | undefined;
          let scaleExpression: string | undefined;
          const rawOptions = (it as any).options;

          if (Array.isArray(rawOptions)) {
            const parsed: ScoringScaleOption[] = [];
            for (const opt of rawOptions) {
              const valueRaw = (opt as any)?.value;
              const valueNum =
                typeof valueRaw === "number" && Number.isFinite(valueRaw)
                  ? valueRaw
                  : Number(valueRaw);
              const label = ((opt as any)?.label ?? "").toString();
              if (!Number.isFinite(valueNum) || !label.trim()) {
                continue;
              }
              parsed.push({ value: valueNum, label });
            }
            if (parsed.length > 0) {
              options = parsed;
              scaleExpression = parsed
                .map((opt) => `${opt.value}:${opt.label}`)
                .join(",");
            }
          }

          return {
            label: it.label,
            max: it.max,
            required: it.required,
            options,
            scaleExpression,
          };
        }));
      } catch (e) {
        console.error("load scoring template error", e);
        setError("加载评分模板失败，请检查网络后重试");
        setItems([]);
      } finally {
        setLoading(false);
      }
    };

    if (selectedDeptId) {
      loadTemplate();
    }
  }, [selectedDeptId]);

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        label: "",
        max: 10,
        required: true,
        options: [
          { value: 2, label: "差" },
          { value: 4, label: "一般" },
          { value: 6, label: "良好" },
          { value: 8, label: "优秀" },
          { value: 10, label: "卓越" },
        ],
        scaleExpression: "2:差,4:一般,6:良好,8:优秀,10:卓越",
      },
    ]);
  };

  const handleSave = async () => {
    if (!selectedDeptId) return;

    const cleanedItems = items
      .map((it) => {
        const label = it.label.trim();
        if (!label) {
          return null;
        }

        let max = !it.max || it.max <= 0 ? 10 : it.max;
        let options: ScoringScaleOption[] | undefined;

        const rawExpr = (it.scaleExpression || "").trim();
        if (rawExpr) {
          // 支持英文/中文逗号、分号作为分隔符："," ";" "，" "；"
          const parts = rawExpr.split(/[，,;；]/).filter(Boolean);
          const parsed: ScoringScaleOption[] = [];
          for (const part of parts) {
            const [valueStr, labelPart] = part.split(":");
            const num = Number((valueStr ?? "").trim());
            const optionLabel = (labelPart ?? "").trim();
            if (!Number.isFinite(num) || !optionLabel) {
              continue;
            }
            parsed.push({ value: num, label: optionLabel });
          }
          if (parsed.length > 0) {
            options = parsed;
            max = Math.max(...parsed.map((opt) => opt.value));
          }
        }

        return {
          label,
          max,
          required: !!it.required,
          options: options && options.length > 0 ? options : undefined,
        };
      })
      .filter((it) => Boolean(it && it.label)) as {
        label: string;
        max: number;
        required: boolean;
        options?: ScoringScaleOption[];
      }[];

    if (!cleanedItems.length) {
      setError("请至少配置一个评分项");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      const res = await authorizedFetch("/api/admin/score-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          departmentId: Number(selectedDeptId),
          name: templateName.trim() || "默认评分模板",
          isActive,
          items: cleanedItems,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error("save scoring template error", text);
        if (res.status === 401) {
          setError("登录已失效，请重新登录后再试");
        } else if (res.status === 403) {
          setError("您没有权限编辑评分模板，如需操作请联系系统管理员。");
        } else {
          try {
            const json = JSON.parse(text);
            if (json?.detail) {
              setError(
                typeof json.detail === "string"
                  ? json.detail
                  : "保存评分模板失败，请稍后重试",
              );
            } else {
              setError("保存评分模板失败，请稍后重试");
            }
          } catch {
            setError("保存评分模板失败，请稍后重试");
          }
        }
        return;
      }
      setSuccess("评分模板已保存");
    } catch (e) {
      console.error("save scoring template error", e);
      setError("保存评分模板失败，请检查网络后重试");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`animate-fadeIn max-w-3xl ${canManage ? "" : "pointer-events-none opacity-75"}`}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Star className="w-5 h-5 text-yellow-500" /> 部门评分模板
        </h2>
        <div className="flex gap-2 items-center">
          <span className="text-xs text-slate-500">选择部门</span>
          <select
            value={selectedDeptId}
            onChange={(e) => {
              setSelectedDeptId(e.target.value);
              setError(null);
              setSuccess(null);
            }}
            className="w-full sm:w-auto sm:min-w-[200px] max-w-full px-4 py-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-600 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
          >
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-3 text-xs text-rose-600 bg-rose-50 border border-rose-100 px-3 py-2 rounded-lg">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-3 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-2 rounded-lg">
          {success}
        </div>
      )}

      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1">
            <label className="block text-sm font-bold text-slate-700 mb-1">模板名称</label>
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="例如：技术部月度评分模板"
              disabled={loading || !canManage}
            />
          </div>
          <div className="flex items-center gap-2 mt-2 md:mt-6">
            <label className="text-sm font-bold text-slate-700">启用评分</label>
            <button
              type="button"
              onClick={() => setIsActive((prev) => !prev)}
              disabled={loading || !canManage}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                isActive ? "bg-blue-600" : "bg-slate-200"
              } disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-200 ${
                  isActive ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>

        <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-bold text-slate-700">评分项配置</span>
            <button
              type="button"
              onClick={handleAddItem}
              disabled={loading || !canManage}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 border border-blue-100 rounded-full hover:bg-blue-100 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Plus className="w-3 h-3" /> 新增评分项
            </button>
          </div>

          {loading && (
            <div className="p-6 text-center text-slate-400 text-sm">正在加载评分模板...</div>
          )}

          {!loading && items.length === 0 && (
            <div className="p-6 text-center text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-xl bg-white">
              当前部门暂无评分项，请点击“新增评分项”进行配置。
            </div>
          )}

          {!loading && items.length > 0 && (
            <div className="space-y-3">
              {items.map((item, index) => (
                <div
                  key={index}
                  className="flex flex-col md:flex-row md:items-center gap-3 p-3 rounded-lg bg-white border border-slate-200"
                >
                  <div className="flex-1 flex flex-col gap-2">
                    <input
                      type="text"
                      value={item.label}
                      onChange={(e) => {
                        const next = [...items];
                        next[index] = { ...next[index], label: e.target.value };
                        setItems(next);
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                      placeholder="评分项名称，例如：沟通效率"
                    />
                    <textarea
                      rows={2}
                      value={item.scaleExpression ?? ""}
                      onChange={(e) => {
                        const next = [...items];
                        next[index] = {
                          ...next[index],
                          scaleExpression: e.target.value,
                        };
                        setItems(next);
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-xs text-slate-700"
                      placeholder="例如：10:优秀;8:良好;6:一般;4:不合格;2:差（支持逗号/分号分隔，留空则使用 1~满分 星级打分）"
                    />
                    <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                      <input
                        type="checkbox"
                        checked={item.required}
                        onChange={(e) => {
                          const next = [...items];
                          next[index] = { ...next[index], required: e.target.checked };
                          setItems(next);
                        }}
                        className="w-4 h-4 text-blue-600 rounded border-gray-300"
                      />
                      必填
                    </label>
                  </div>
                  <div className="flex items-center gap-2 md:w-40">
                    <span className="text-xs text-slate-500 whitespace-nowrap">满分</span>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={item.max}
                      onChange={(e) => {
                        const value = Number(e.target.value) || 5;
                        const next = [...items];
                        next[index] = { ...next[index], max: value };
                        setItems(next);
                      }}
                      className="w-20 px-2 py-1 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setItems((prev) => prev.filter((_, i) => i !== index));
                      }}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pt-4 flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading || !canManage}
            className="px-6 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? "保存中..." : "保存模板"}
          </button>
        </div>
      </div>
    </div>
  );
};

// -------------------- 工作流配置（优先级与状态） --------------------

const WorkflowConfigSettings = ({ canManage }: { canManage: boolean }) => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string>("");
  const [config, setConfig] = useState<{
    priorities: Array<{ value: string; label: string; color: string; order: number }>;
    statuses: Array<{ value: string; label: string; color: string; order: number; transitions?: string[] }>;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const loadDepartments = async () => {
      try {
        const res = await fetch("/api/departments");
        if (!res.ok) {
          console.error("load workflow departments error", await res.text());
          return;
        }
        const json = await res.json();
        const items = (json.items || []) as { id: number; name: string; slug: string | null }[];
        const mapped: Department[] = items.map((d) => ({
          id: String(d.id),
          name: d.name,
          slug: d.slug || "",
        }));
        setDepartments(mapped);
        if (mapped.length > 0) {
          setSelectedDeptId(mapped[0].id);
        }
      } catch (e) {
        console.error("load workflow departments error", e);
      }
    };

    loadDepartments();
  }, []);

  useEffect(() => {
    if (!selectedDeptId) {
      setConfig(null);
      return;
    }
    const loadConfig = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await authorizedFetch(`/api/departments/${selectedDeptId}/workflow-config`);
        if (!res.ok) {
          const text = await res.text();
          console.error("load workflow config error", text);
          if (res.status === 401) {
            setError("登录已失效，请重新登录后再试");
          } else if (res.status === 403) {
            setError("您没有权限查看工作流配置，如需操作请联系系统管理员。");
          } else {
            setError("加载工作流配置失败，请稍后重试");
          }
          setConfig(null);
          return;
        }
        const json = await res.json();
        if (json.config) {
          setConfig(json.config);
        } else {
          setConfig({ priorities: [], statuses: [] });
        }
      } catch (e) {
        console.error("load workflow config error", e);
        setError("加载工作流配置失败，请检查网络后重试");
        setConfig(null);
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, [selectedDeptId]);

  const handleSave = async () => {
    if (!selectedDeptId || !config) return;
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      const res = await authorizedFetch(`/api/departments/${selectedDeptId}/workflow-config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error("save workflow config error", text);
        if (res.status === 401) {
          setError("登录已失效，请重新登录后再试");
        } else if (res.status === 403) {
          setError("您没有权限编辑工作流配置，如需操作请联系系统管理员。");
        } else {
          setError("保存工作流配置失败，请稍后重试");
        }
        return;
      }
      const json = await res.json();
      if (json.config) {
        setConfig(json.config);
      }
      setSuccess("工作流配置已保存");
    } catch (e) {
      console.error("save workflow config error", e);
      setError("保存工作流配置失败，请检查网络后重试");
    } finally {
      setSaving(false);
    }
  };

  const addPriority = () => {
    if (!config) return;
    const newPriority = {
      value: `priority_${Date.now()}`,
      label: "新优先级",
      color: "#6b7280",
      order: config.priorities.length + 1,
    };
    setConfig({ ...config, priorities: [...config.priorities, newPriority] });
  };

  const updatePriority = (index: number, field: string, value: any) => {
    if (!config) return;
    const updated = [...config.priorities];
    updated[index] = { ...updated[index], [field]: value };
    setConfig({ ...config, priorities: updated });
  };

  const deletePriority = (index: number) => {
    if (!config) return;
    const updated = config.priorities.filter((_, i) => i !== index);
    setConfig({ ...config, priorities: updated });
  };

  const addStatus = () => {
    if (!config) return;
    const newStatus = {
      value: `status_${Date.now()}`,
      label: "新状态",
      color: "#6b7280",
      order: config.statuses.length + 1,
      transitions: [],
    };
    setConfig({ ...config, statuses: [...config.statuses, newStatus] });
  };

  const updateStatus = (index: number, field: string, value: any) => {
    if (!config) return;
    const updated = [...config.statuses];
    updated[index] = { ...updated[index], [field]: value };
    setConfig({ ...config, statuses: updated });
  };

  const deleteStatus = (index: number) => {
    if (!config) return;
    const updated = config.statuses.filter((_, i) => i !== index);
    setConfig({ ...config, statuses: updated });
  };

  return (
    <div className="animate-fadeIn">
      {!canManage && (
        <div className="mb-4 text-xs text-slate-600 bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg">
          当前为只读权限，可查看工作流配置，但无法新增、编辑或删除。
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <h2 className="text-xl font-bold text-slate-900">工作流配置</h2>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">选择部门</span>
          <select
            value={selectedDeptId}
            onChange={(e) => setSelectedDeptId(e.target.value)}
            className="w-full sm:w-auto sm:min-w-[200px] max-w-full px-4 py-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-600 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
          >
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-3 text-xs text-rose-600 bg-rose-50 border border-rose-100 px-3 py-2 rounded-lg">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-3 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-2 rounded-lg">
          {success}
        </div>
      )}

      {loading && (
        <div className="p-6 text-center text-slate-400 text-sm">正在加载工作流配置...</div>
      )}

      {!loading && config && (
        <div className="space-y-6">
          {/* 优先级配置 */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800">优先级配置</h3>
              <button
                onClick={addPriority}
                disabled={!canManage}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Plus className="w-3 h-3" /> 添加优先级
              </button>
            </div>
            <div className="space-y-3">
              {config.priorities.length === 0 && (
                <div className="p-6 text-center text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-xl">
                  该部门暂无优先级配置，请点击"添加优先级"按钮进行配置。
                </div>
              )}
              {config.priorities.map((p, index) => (
                <div
                  key={index}
                  className="flex flex-col md:flex-row md:items-center gap-3 p-4 border border-slate-200 rounded-lg bg-slate-50"
                >
                  <div className="flex-1">
                    <label className="block text-xs text-slate-500 mb-1">值（英文）</label>
                    <input
                      type="text"
                      value={p.value}
                      onChange={(e) => updatePriority(index, "value", e.target.value)}
                      disabled={!canManage}
                      placeholder="例如：urgent"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm disabled:opacity-60"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-slate-500 mb-1">显示名称</label>
                    <input
                      type="text"
                      value={p.label}
                      onChange={(e) => updatePriority(index, "label", e.target.value)}
                      disabled={!canManage}
                      placeholder="例如：紧急"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">颜色</label>
                    <input
                      type="color"
                      value={p.color}
                      onChange={(e) => updatePriority(index, "color", e.target.value)}
                      disabled={!canManage}
                      className="w-20 h-10 border border-slate-300 rounded-lg cursor-pointer disabled:opacity-60"
                    />
                  </div>
                  <div className="w-20">
                    <label className="block text-xs text-slate-500 mb-1">排序</label>
                    <input
                      type="number"
                      value={p.order}
                      onChange={(e) => updatePriority(index, "order", Number(e.target.value))}
                      disabled={!canManage}
                      className="w-full px-2 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm disabled:opacity-60"
                    />
                  </div>
                  <button
                    onClick={() => deletePriority(index)}
                    disabled={!canManage}
                    className="mt-5 p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 状态配置 */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800">状态配置</h3>
              <button
                onClick={addStatus}
                disabled={!canManage}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Plus className="w-3 h-3" /> 添加状态
              </button>
            </div>
            <div className="space-y-3">
              {config.statuses.length === 0 && (
                <div className="p-6 text-center text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-xl">
                  该部门暂无状态配置，请点击"添加状态"按钮进行配置。
                </div>
              )}
              {config.statuses.map((s, index) => (
                <div
                  key={index}
                  className="flex flex-col gap-3 p-4 border border-slate-200 rounded-lg bg-slate-50"
                >
                  <div className="flex flex-col md:flex-row md:items-center gap-3">
                    <div className="flex-1">
                      <label className="block text-xs text-slate-500 mb-1">值（英文）</label>
                      <input
                        type="text"
                        value={s.value}
                        onChange={(e) => updateStatus(index, "value", e.target.value)}
                        disabled={!canManage}
                        placeholder="例如：in_progress"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm disabled:opacity-60"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs text-slate-500 mb-1">显示名称</label>
                      <input
                        type="text"
                        value={s.label}
                        onChange={(e) => updateStatus(index, "label", e.target.value)}
                        disabled={!canManage}
                        placeholder="例如：进行中"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm disabled:opacity-60"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">颜色</label>
                      <input
                        type="color"
                        value={s.color}
                        onChange={(e) => updateStatus(index, "color", e.target.value)}
                        disabled={!canManage}
                        className="w-20 h-10 border border-slate-300 rounded-lg cursor-pointer disabled:opacity-60"
                      />
                    </div>
                    <div className="w-20">
                      <label className="block text-xs text-slate-500 mb-1">排序</label>
                      <input
                        type="number"
                        value={s.order}
                        onChange={(e) => updateStatus(index, "order", Number(e.target.value))}
                        disabled={!canManage}
                        className="w-full px-2 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm disabled:opacity-60"
                      />
                    </div>
                    <button
                      onClick={() => deleteStatus(index)}
                      disabled={!canManage}
                      className="mt-5 p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">
                      可流转到（多选，用逗号分隔状态值）
                    </label>
                    <input
                      type="text"
                      value={s.transitions?.join(",") || ""}
                      onChange={(e) =>
                        updateStatus(
                          index,
                          "transitions",
                          e.target.value ? e.target.value.split(",").map((v) => v.trim()) : []
                        )
                      }
                      disabled={!canManage}
                      placeholder="例如：in_progress,done"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm disabled:opacity-60"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 保存按钮 */}
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving || !canManage}
              className="px-6 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? "保存中..." : "保存配置"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
