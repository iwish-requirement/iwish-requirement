"use client";

import React, { useEffect, useState } from "react";
import {
  Users,
  Plus,
  Trash2,
  Edit,
  Check,
  X as XIcon,
  UserCheck,
} from "lucide-react";
import Modal from "../../../components/ui/Modal";
import Badge from "../../../components/ui/Badge";
import { authorizedFetch } from "../../../lib/authFetch";

interface AdminUser {
  id: number;
  email: string;
  name: string | null;
  departmentId: number | null;
  departmentName: string | null;
  position: string | null;
  status: string;
  role: string;
  lastLoginAt: string | null;
  dbRoleNames?: string[];
}


interface DepartmentOption {
  id: number;
  name: string;
}

interface RoleOption {
  id: number;
  name: string;
  description: string | null;
}

interface UserPositionOption {
  id: number;
  departmentId: number | null;
  code: string;
  name: string;
  description: string | null;
  demandTypeCodes: string[];
  accessScope: "all" | "demand_types";
  isActive: boolean;
  orderIndex: number | null;
}

type UserTab = "active" | "pending" | "disabled";

const DEFAULT_POSITION_OPTIONS = [
  { value: "", label: "未设置", hint: "不启用岗位分流" },
  { value: "design", label: "设计 / UI / 美工 / Banner", hint: "仅查看 UI、美工、Banner 类需求" },
  { value: "video", label: "视频剪辑", hint: "仅查看视频剪辑类需求" },
  { value: "all", label: "全部创意需求", hint: "查看创意部全部需求" },
];

function getRoleLabel(role: string): string {
  const value = (role || "").toLowerCase();
  if (value === "admin") return "管理员";
  if (value === "manager") return "部门管理员";
  if (value === "viewer") return "只读用户";
  return "普通用户";
}

function getPositionLabel(
  position: string | null | undefined,
  options?: UserPositionOption[],
): string {
  const value = (position || "").toLowerCase();
  const configured = (options || []).find((item) => item.code.toLowerCase() === value);
  if (configured) return configured.name;
  const option = DEFAULT_POSITION_OPTIONS.find((item) => item.value === value);
  if (option) return option.label;
  return value || "未设置";
}

function getDbRoleNames(user: AdminUser | null | undefined): string[] {
  if (!user || !Array.isArray(user.dbRoleNames)) {
    return [];
  }
  return user.dbRoleNames.filter(
    (name) => typeof name === "string" && name.trim().length > 0,
  );
}


function getStatusLabel(status: string): string {
  const value = (status || "").toLowerCase();
  if (value === "active") return "启用";
  if (value === "disabled") return "已禁用";
  return "待审核";
}

function normalizeRoleForSelect(role: string): string {
  const value = (role || "").toLowerCase();
  if (value === "admin") return "admin";
  if (value === "manager") return "manager";
  if (value === "viewer") return "viewer";
  return "user";
}

function normalizePositionCodeInput(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50);
}

export default function UserManagementSettings() {
  const [activeTab, setActiveTab] = useState<UserTab>("active");
  const [activeUsers, setActiveUsers] = useState<AdminUser[]>([]);
  const [pendingUsers, setPendingUsers] = useState<AdminUser[]>([]);
  const [disabledUsers, setDisabledUsers] = useState<AdminUser[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [roleOptions, setRoleOptions] = useState<RoleOption[]>([]);
  const [positionOptions, setPositionOptions] = useState<UserPositionOption[]>([]);
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [savingUserId, setSavingUserId] = useState<number | null>(null);
  const [loadingPositions, setLoadingPositions] = useState(false);
  const [savingPosition, setSavingPosition] = useState(false);
  const [positionDepartmentId, setPositionDepartmentId] = useState<string>("");
  const [newPositionName, setNewPositionName] = useState("");
  const [newPositionCode, setNewPositionCode] = useState("");
  const [newPositionAccessScope, setNewPositionAccessScope] = useState<"all" | "demand_types">("demand_types");
  const [newPositionDemandTypeCodes, setNewPositionDemandTypeCodes] = useState("");
  const [editingPositionId, setEditingPositionId] = useState<number | null>(null);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [savingNewUser, setSavingNewUser] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserDepartmentId, setNewUserDepartmentId] = useState<string>("");
  const [newUserRole, setNewUserRole] = useState<string>("user");

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editDepartmentId, setEditDepartmentId] = useState<string>("");
  const [editRole, setEditRole] = useState<string>("user");
  const [editPosition, setEditPosition] = useState<string>("");
  const [editRoleIds, setEditRoleIds] = useState<number[]>([]);
  const [loadingUserRoles, setLoadingUserRoles] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [pendingDisableUser, setPendingDisableUser] = useState<AdminUser | null>(null);


  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await authorizedFetch("/api/admin/users");

      if (!res.ok) {
        const text = await res.text();
        console.error("load admin users error", text);
        if (res.status === 401) {
          setError("登录已失效，请重新登录后再试");
        } else if (res.status === 403) {
          setError("您没有权限管理用户，如需操作请联系系统超级管理员。");
        } else {
          setError("加载用户列表失败，请稍后重试");
        }
        setActiveUsers([]);
        setPendingUsers([]);
        setDisabledUsers([]);
        return;
      } else {
        const json = (await res.json()) as { items?: AdminUser[] };
        const items = Array.isArray(json.items) ? json.items : [];
        setActiveUsers(items.filter((user) => (user.status || "").toLowerCase() === "active"));
        setPendingUsers(items.filter((user) => (user.status || "").toLowerCase() === "pending"));
        setDisabledUsers(items.filter((user) => (user.status || "").toLowerCase() === "disabled"));
      }
    } catch (e) {
      console.error("load admin users error", e);
      setError("加载用户列表失败，请检查网络后重试");
      setActiveUsers([]);
      setPendingUsers([]);
      setDisabledUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const loadDepartments = async () => {
    try {
      const res = await fetch("/api/departments");
      if (!res.ok) {
        console.error("load departments for user management error", await res.text());
        return;
      }
      const json = await res.json();
      const items = (json.items || []) as { id: number; name: string }[];
      setDepartments(items.map((d) => ({ id: d.id, name: d.name })));
    } catch (e) {
      console.error("load departments for user management error", e);
    }
  };

  const loadPositions = async () => {
    try {
      setLoadingPositions(true);
      const res = await authorizedFetch("/api/admin/positions?includeInactive=1");
      if (!res.ok) {
        console.error("load user positions error", await res.text());
        return;
      }
      const json = await res.json();
      const items = Array.isArray(json.items) ? json.items : [];
      setPositionOptions(
        items.map((item: any) => ({
          id: Number(item.id),
          departmentId: item.departmentId == null ? null : Number(item.departmentId),
          code: (item.code || "").toString(),
          name: (item.name || "").toString(),
          description: item.description == null ? null : String(item.description),
          demandTypeCodes: Array.isArray(item.demandTypeCodes) ? item.demandTypeCodes : [],
          accessScope: item.accessScope === "all" ? "all" : "demand_types",
          isActive: item.isActive !== false,
          orderIndex: item.orderIndex == null ? null : Number(item.orderIndex),
        })),
      );
    } catch (e) {
      console.error("load user positions error", e);
    } finally {
      setLoadingPositions(false);
    }
  };

  const loadUserRoles = async (userId: number) => {
    try {
      setLoadingUserRoles(true);
      const res = await authorizedFetch(
        `/api/admin/user-roles?userId=${encodeURIComponent(String(userId))}`,
      );
      if (!res.ok) {
        console.error("load user roles error", await res.text());
        return;
      }
      const json = await res.json();
      const roles = Array.isArray(json.roles) ? json.roles : [];
      const assigned = Array.isArray(json.assignedRoleIds)
        ? json.assignedRoleIds
        : [];

      const mappedRoles: RoleOption[] = roles.map((role: any) => ({
        id: Number(role.id),
        name: (role.name ?? "").toString(),
        description:
          role.description === null || role.description === undefined
            ? null
            : role.description.toString(),
      }));
      setRoleOptions(mappedRoles);

      const ids: number[] = Array.from(
        new Set(
          assigned
            .map((value: any) =>
              typeof value === "number" ? value : Number(value),
            )
            .filter((value: any) => Number.isFinite(value) && value > 0),
        ),
      );
      setEditRoleIds(ids);
    } catch (e) {
      console.error("load user roles error", e);
    } finally {
      setLoadingUserRoles(false);
    }
  };

  useEffect(() => {
    loadUsers();
    loadDepartments();
    loadPositions();
  }, []);


  const openDisableConfirm = (user: AdminUser) => {
    setPendingDisableUser(user);
    setError(null);
  };

  const handleDisableUser = async (user: AdminUser) => {
    try {
      setSavingUserId(user.id);
      setError(null);
      const res = await authorizedFetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id, status: "disabled" }),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error("disable user error", text);
        setError("禁用用户失败，请稍后重试");
        return;
      }
      const json = (await res.json()) as { user?: AdminUser };
      const disabledUser = json.user;
      setActiveUsers((prev) => prev.filter((u) => u.id !== user.id));
      if (disabledUser) {
        setDisabledUsers((prev) => [...prev, disabledUser]);
      }
      setPendingDisableUser(null);
    } catch (e) {
      console.error("disable user error", e);
      setError("禁用用户失败，请检查网络后重试");
    } finally {
      setSavingUserId(null);
    }
  };

  const handleEnableUser = async (user: AdminUser) => {
    try {
      setSavingUserId(user.id);
      setError(null);
      const res = await authorizedFetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id, status: "active" }),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error("enable disabled user error", text);
        setError("启用用户失败，请稍后重试");
        return;
      }
      const json = (await res.json()) as { user?: AdminUser };
      if (json.user) {
        setDisabledUsers((prev) => prev.filter((u) => u.id !== user.id));
        setActiveUsers((prev) => [...prev, json.user!]);
      }
    } catch (e) {
      console.error("enable disabled user error", e);
      setError("启用用户失败，请检查网络后重试");
    } finally {
      setSavingUserId(null);
    }
  };

  const handleApprovePending = async (user: AdminUser) => {
    try {
      setSavingUserId(user.id);
      setError(null);
      const res = await authorizedFetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id, status: "active" }),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error("approve pending user error", text);
        setError("批准用户失败，请稍后重试");
        return;
      }
      const json = (await res.json()) as { user?: AdminUser };
      if (json.user) {
        setPendingUsers((prev) => prev.filter((u) => u.id !== user.id));
        setActiveUsers((prev) => [...prev, json.user!]);
      }
    } catch (e) {
      console.error("approve pending user error", e);
      setError("批准用户失败，请检查网络后重试");
    } finally {
      setSavingUserId(null);
    }
  };

  const handleRejectPending = async (user: AdminUser) => {
    if (!window.confirm("确定要拒绝该用户的申请吗？")) {
      return;
    }
    try {
      setSavingUserId(user.id);
      setError(null);
      const res = await authorizedFetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id, mode: "reject_pending" }),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error("reject pending user error", text);
        setError("拒绝用户失败，请稍后重试");
        return;
      }
      await res.json().catch(() => null);
      setPendingUsers((prev) => prev.filter((u) => u.id !== user.id));
    } catch (e) {
      console.error("reject pending user error", e);
      setError("拒绝用户失败，请检查网络后重试");
    } finally {
      setSavingUserId(null);
    }
  };

  const handleCreateUser = async () => {
    if (!newUserEmail.trim()) {
      setError("请填写用户邮箱");
      return;
    }
    try {
      setSavingNewUser(true);
      setError(null);
      const res = await authorizedFetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newUserEmail.trim(),
          name: newUserName.trim() || undefined,
          role: newUserRole,
          status: "active",
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error("create user error", text);
        if (res.status === 400) {
          setError("创建用户失败，请检查邮箱是否正确或已存在");
        } else {
          setError("创建用户失败，请稍后重试");
        }
        return;
      }
      const json = (await res.json()) as { user?: AdminUser };
      let created = json.user;

      // 如果选择了部门，再补打一枪更新 departmentId
      if (created && newUserDepartmentId) {
        try {
          const patchRes = await authorizedFetch("/api/admin/users", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: created.id,
              departmentId: Number(newUserDepartmentId),
            }),
          });
          if (patchRes.ok) {
            const patchJson = (await patchRes.json()) as { user?: AdminUser };
            if (patchJson.user) {
              created = patchJson.user;
            }
          } else {
            console.error("update user department after create error", await patchRes.text());
          }
        } catch (e) {
          console.error("update user department after create error", e);
        }
      }

      if (created) {
        setActiveUsers((prev) => [...prev, created!]);
      }

      setIsAddModalOpen(false);
      setNewUserName("");
      setNewUserEmail("");
      setNewUserDepartmentId("");
      setNewUserRole("user");
    } catch (e) {
      console.error("create user error", e);
      setError("创建用户失败，请检查网络后重试");
    } finally {
      setSavingNewUser(false);
    }
  };

  const openEditModal = (user: AdminUser) => {
    setEditingUser(user);
    setEditDepartmentId(user.departmentId != null ? String(user.departmentId) : "");
    setEditRole(normalizeRoleForSelect(user.role));
    setEditPosition((user.position || "").toLowerCase());
    setEditRoleIds([]);
    setIsEditModalOpen(true);
    void loadUserRoles(user.id);
  };


  const handleSaveEdit = async () => {
    if (!editingUser) return;
    try {
      setSavingEdit(true);
      setError(null);
      const payload: Record<string, any> = {
        id: editingUser.id,
        role: editRole,
        position: editPosition,
      };
      if (editDepartmentId === "") {
        payload.departmentId = null;
      } else {
        payload.departmentId = Number(editDepartmentId);
      }

      const res = await authorizedFetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error("update user (edit) error", text);
        setError("更新用户信息失败，请稍后重试");
        return;
      }
      const json = (await res.json()) as { user?: AdminUser };
      if (!json.user) {
        return;
      }
      const updated = json.user;

      const updateList = (list: AdminUser[]): AdminUser[] =>
        list.map((u) => (u.id === updated.id ? updated : u));

      setActiveUsers((prev) => updateList(prev));
      setPendingUsers((prev) => updateList(prev));
      setDisabledUsers((prev) => updateList(prev));

      try {
        await authorizedFetch("/api/admin/user-roles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: editingUser.id, roleIds: editRoleIds }),
        });
      } catch (e) {
        console.error("update user roles error", e);
      }

      setIsEditModalOpen(false);
      setEditingUser(null);
    } catch (e) {
      console.error("update user (edit) error", e);
      setError("更新用户信息失败，请检查网络后重试");
    } finally {
      setSavingEdit(false);
    }
  };

  const resetPositionForm = () => {
    setEditingPositionId(null);
    setNewPositionName("");
    setNewPositionCode("");
    setNewPositionAccessScope("demand_types");
    setNewPositionDemandTypeCodes("");
  };

  const startEditPosition = (position: UserPositionOption) => {
    setEditingPositionId(position.id);
    setPositionDepartmentId(position.departmentId != null ? String(position.departmentId) : "");
    setNewPositionName(position.name);
    setNewPositionCode(position.code);
    setNewPositionAccessScope(position.accessScope);
    setNewPositionDemandTypeCodes(position.demandTypeCodes.join(", "));
  };

  const handleSavePosition = async () => {
    const effectivePositionDepartmentId =
      positionDepartmentId || (departmentFilter !== "all" && departmentFilter !== "none" ? departmentFilter : "");
    const departmentId = Number(effectivePositionDepartmentId);
    const name = newPositionName.trim();
    const code = normalizePositionCodeInput(newPositionCode || name);
    if (!departmentId || Number.isNaN(departmentId)) {
      setError("请先选择岗位所属部门");
      return;
    }
    if (!name) {
      setError("请填写岗位名称");
      return;
    }
    if (!code) {
      setError("请填写岗位编码，建议使用英文或拼音");
      return;
    }

    try {
      setSavingPosition(true);
      setError(null);
      const res = await authorizedFetch("/api/admin/positions", {
        method: editingPositionId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingPositionId || undefined,
          departmentId,
          name,
          code,
          accessScope: newPositionAccessScope,
          demandTypeCodes: newPositionDemandTypeCodes,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error("create user position error", text);
        setError("创建岗位失败，请检查岗位编码是否重复");
        return;
      }

      resetPositionForm();
      await loadPositions();
    } catch (e) {
      console.error("create user position error", e);
      setError("创建岗位失败，请检查网络后重试");
    } finally {
      setSavingPosition(false);
    }
  };

  const handleTogglePosition = async (position: UserPositionOption) => {
    try {
      setSavingPosition(true);
      setError(null);
      const res = await authorizedFetch("/api/admin/positions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: position.id,
          isActive: !position.isActive,
        }),
      });
      if (!res.ok) {
        console.error("toggle user position error", await res.text());
        setError("更新岗位状态失败，请稍后重试");
        return;
      }
      await loadPositions();
    } catch (e) {
      console.error("toggle user position error", e);
      setError("更新岗位状态失败，请检查网络后重试");
    } finally {
      setSavingPosition(false);
    }
  };


  const filteredActiveUsers = activeUsers.filter((user) => {
    if (departmentFilter === "all") return true;
    if (departmentFilter === "none") return user.departmentId == null;
    return String(user.departmentId || "") === departmentFilter;
  });
  const filteredPendingUsers = pendingUsers.filter((user) => {
    if (departmentFilter === "all") return true;
    if (departmentFilter === "none") return user.departmentId == null;
    return String(user.departmentId || "") === departmentFilter;
  });
  const filteredDisabledUsers = disabledUsers.filter((user) => {
    if (departmentFilter === "all") return true;
    if (departmentFilter === "none") return user.departmentId == null;
    return String(user.departmentId || "") === departmentFilter;
  });
  const totalActive = activeUsers.length;
  const totalPending = pendingUsers.length;
  const totalDisabled = disabledUsers.length;
  const currentTabUsers =
    activeTab === "active"
      ? filteredActiveUsers
      : activeTab === "pending"
        ? filteredPendingUsers
        : filteredDisabledUsers;
  const positionDepartmentFilter =
    positionDepartmentId || (departmentFilter !== "all" && departmentFilter !== "none" ? departmentFilter : "");
  const visiblePositionOptions = positionOptions.filter((position) => {
    if (positionDepartmentFilter) {
      return String(position.departmentId || "") === positionDepartmentFilter;
    }
    return true;
  });
  const editPositionDepartmentId = editDepartmentId ? Number(editDepartmentId) : editingUser?.departmentId || null;
  const editPositionOptions = positionOptions
    .filter((position) => position.isActive)
    .filter((position) => {
      if (!editPositionDepartmentId) return true;
      return position.departmentId == null || position.departmentId === editPositionDepartmentId;
    });
  const selectedEditPositionExists =
    !editPosition || editPositionOptions.some((position) => position.code === editPosition);

  return (
    <div className="animate-fadeIn">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 min-w-0">
        <div className="flex items-center gap-3">
          <Users className="w-5 h-5 text-slate-500 flex-shrink-0" />
          <div className="flex-1 min-w-0 overflow-x-auto">
            <div className="flex gap-4 min-w-max">
              <button
                type="button"
                onClick={() => setActiveTab("active")}
                className={`flex-shrink-0 font-bold text-base md:text-lg border-b-2 px-1 pb-2 transition-colors whitespace-nowrap ${
                  activeTab === "active"
                    ? "text-blue-600 border-blue-600"
                    : "text-slate-400 border-transparent hover:text-slate-600"
                }`}
              >
                已激活用户 ({totalActive})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("pending")}
                className={`flex-shrink-0 font-bold text-base md:text-lg border-b-2 px-1 pb-2 transition-colors whitespace-nowrap ${
                  activeTab === "pending"
                    ? "text-blue-600 border-blue-600"
                    : "text-slate-400 border-transparent hover:text-slate-600"
                }`}
              >
                待审核 ({totalPending})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("disabled")}
                className={`flex-shrink-0 font-bold text-base md:text-lg border-b-2 px-1 pb-2 transition-colors whitespace-nowrap ${
                  activeTab === "disabled"
                    ? "text-blue-600 border-blue-600"
                    : "text-slate-400 border-transparent hover:text-slate-600"
                }`}
              >
                已禁用 ({totalDisabled})
              </button>
            </div>
          </div>
        </div>

        {activeTab === "active" && (
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="self-start md:self-auto flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-blue-700 shadow-sm"
          >
            <Plus className="w-4 h-4" /> 添加用户
          </button>
        )}
      </div>

      {error && (
        <div className="mb-3 text-xs text-rose-600 bg-rose-50 border border-rose-100 px-3 py-2 rounded-lg">
          {error}
        </div>
      )}

      <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3 md:p-4">
        <div className="flex flex-col md:flex-row md:items-end gap-3">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-bold text-slate-600 mb-1">按部门筛选用户</label>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="all">全部部门</option>
              <option value="none">未分配部门</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </div>
          <div className="text-xs text-slate-500">
            当前筛选结果：{currentTabUsers.length} 人
          </div>
        </div>
      </div>

      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-3 md:p-4">
        <div className="flex flex-col lg:flex-row lg:items-end gap-3">
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-bold text-slate-600 mb-1">岗位所属部门</label>
            <select
              value={positionDepartmentId}
              onChange={(e) => setPositionDepartmentId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">跟随上方部门筛选</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs font-bold text-slate-600 mb-1">岗位名称</label>
            <input
              value={newPositionName}
              onChange={(e) => setNewPositionName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="例如：设计师"
            />
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs font-bold text-slate-600 mb-1">岗位编码</label>
            <input
              value={newPositionCode}
              onChange={(e) => setNewPositionCode(normalizePositionCodeInput(e.target.value))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="designer"
            />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-bold text-slate-600 mb-1">可见范围</label>
            <select
              value={newPositionAccessScope}
              onChange={(e) => setNewPositionAccessScope(e.target.value === "all" ? "all" : "demand_types")}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="demand_types">按需求类型编码</option>
              <option value="all">全部需求类型</option>
            </select>
          </div>
          <div className="flex-[1.4] min-w-[180px]">
            <label className="block text-xs font-bold text-slate-600 mb-1">需求类型编码</label>
            <input
              value={newPositionDemandTypeCodes}
              onChange={(e) => setNewPositionDemandTypeCodes(e.target.value)}
              disabled={newPositionAccessScope === "all"}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-50 disabled:text-slate-400"
              placeholder="ui_design, graphic"
            />
          </div>
          <button
            type="button"
            onClick={handleSavePosition}
            disabled={savingPosition}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold hover:bg-slate-800 disabled:opacity-60"
          >
            {editingPositionId ? "保存岗位" : "新增岗位"}
          </button>
          {editingPositionId && (
            <button
              type="button"
              onClick={resetPositionForm}
              disabled={savingPosition}
              className="px-4 py-2 bg-white text-slate-600 border border-slate-200 rounded-lg text-sm font-bold hover:bg-slate-50 disabled:opacity-60"
            >
              取消编辑
            </button>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {loadingPositions ? (
            <span className="text-xs text-slate-400">正在加载岗位...</span>
          ) : visiblePositionOptions.length === 0 ? (
            <span className="text-xs text-slate-400">当前部门暂无岗位配置</span>
          ) : (
            visiblePositionOptions.map((position) => (
              <div key={position.id} className="inline-flex rounded-full overflow-hidden border border-slate-200">
                <button
                  type="button"
                  onClick={() => startEditPosition(position)}
                  disabled={savingPosition}
                  className={`px-2.5 py-1 text-xs font-bold ${
                    position.isActive
                      ? "bg-blue-50 text-blue-700"
                      : "bg-slate-50 text-slate-400"
                  }`}
                  title={
                    position.accessScope === "all"
                      ? "可查看全部需求类型"
                      : `可查看：${position.demandTypeCodes.join(", ") || "未配置"}`
                  }
                >
                  {position.name}
                </button>
                <button
                  type="button"
                  onClick={() => handleTogglePosition(position)}
                  disabled={savingPosition}
                  className="px-2 py-1 text-xs font-bold bg-white text-slate-500 border-l border-slate-200 hover:bg-slate-50"
                >
                  {position.isActive ? "停用" : "启用"}
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-6 text-center text-slate-400 text-sm">
            正在加载用户列表...
          </div>
        ) : activeTab === "active" ? (
          filteredActiveUsers.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              当前筛选下暂无已激活用户
            </div>
          ) : (
            <>
              {/* 移动端：卡片列表 */}
              <div className="space-y-3 md:hidden">
                {filteredActiveUsers.map((user) => {
                  const isSaving = savingUserId === user.id;
                  const roleLabel = getRoleLabel(user.role);
                  const dbRoleNames = getDbRoleNames(user);

                  return (

                    <div
                      key={user.id}
                      className="p-4 border border-slate-200 rounded-xl bg-white shadow-sm flex flex-col gap-2"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                          {user.name?.[0] || user.email[0] || "U"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-bold text-slate-900 truncate">
                              {user.name || user.email}
                            </div>
                            <Badge variant="outline" className="flex-shrink-0">
                              {roleLabel}
                            </Badge>
                          </div>
                          <div className="mt-1 text-[11px] text-slate-500 break-all">
                            {user.email}
                          </div>
                          <div className="mt-1 text-[11px] text-slate-500 break-all">
                            {dbRoleNames.length > 0 ? (
                              <>
                                数据库角色：
                                {dbRoleNames.join("，")}
                              </>
                            ) : (
                              <span className="text-slate-400">
                                暂未分配数据库角色，将基于基础角色标签计算权限
                              </span>
                            )}
                          </div>

                        </div>
                      </div>
                      <div className="text-xs text-slate-500 flex items-center justify-between gap-2">
                        <span>
                          部门：{user.departmentName || "未分配部门"}
                        </span>
                        <span>
                          岗位：{getPositionLabel(user.position, positionOptions)}
                        </span>
                      </div>
                      <div className="pt-2 flex justify-end gap-2">
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => openEditModal(user)}
                          className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                        >
                          <Edit className="w-3 h-3" /> 编辑
                        </button>
                        <button
                          type="button"
                          onClick={() => openDisableConfirm(user)}
                          disabled={isSaving}
                          className="px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" /> 禁用
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 桌面端：表格 */}
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-[720px] w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="px-4 md:px-6 py-3 font-bold">姓名</th>
                      <th className="px-4 md:px-6 py-3 font-bold">邮箱</th>
                      <th className="px-4 md:px-6 py-3 font-bold">部门</th>
                      <th className="px-4 md:px-6 py-3 font-bold">岗位</th>
                      <th className="px-4 md:px-6 py-3 font-bold">角色</th>
                      <th className="px-4 md:px-6 py-3 font-bold text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredActiveUsers.map((user) => {
                      const isSaving = savingUserId === user.id;
                      const roleLabel = getRoleLabel(user.role);
                      const dbRoleNames = getDbRoleNames(user);

                      return (

                        <tr key={user.id} className="hover:bg-slate-50">
                          <td className="px-4 md:px-6 py-3 font-medium text-slate-900 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                              {user.name?.[0] || user.email[0] || "U"}
                            </div>
                            {user.name || user.email}
                          </td>
                          <td className="px-4 md:px-6 py-3 text-slate-500 text-xs md:text-sm break-all">
                            {user.email}
                          </td>
                          <td className="px-4 md:px-6 py-3 text-slate-500 text-xs md:text-sm">
                            {user.departmentName || "未分配部门"}
                          </td>
                          <td className="px-4 md:px-6 py-3 text-slate-500 text-xs md:text-sm">
                            {getPositionLabel(user.position, positionOptions)}
                          </td>
                          <td className="px-4 md:px-6 py-3 text-xs md:text-sm">
                            {dbRoleNames.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {dbRoleNames.map((name) => (
                                  <Badge key={name} variant="outline">
                                    {name}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <Badge variant="outline">{roleLabel}</Badge>
                            )}
                            <div className="mt-1 text-[11px] text-slate-400">
                              基础角色标签：{roleLabel}
                            </div>
                          </td>

                          <td className="px-4 md:px-6 py-3 text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                disabled={isSaving}
                                onClick={() => openEditModal(user)}
                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => openDisableConfirm(user)}
                                disabled={isSaving}
                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )
        ) : activeTab === "pending" ? (
          filteredPendingUsers.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">当前筛选下暂无待审核申请</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredPendingUsers.map((user) => {
                const isSaving = savingUserId === user.id;
                return (
                  <div
                    key={user.id}
                    className="p-4 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center">
                        <UserCheck className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-900">
                          {user.name || user.email}
                        </div>
                        <div className="text-sm text-slate-500 mt-0.5">
                          {user.email}
                          {user.departmentName
                            ? ` · 申请加入 ${user.departmentName}`
                            : ""}
                        </div>
                        <div className="mt-1 text-[11px] text-slate-400">
                          当前状态：{getStatusLabel(user.status)}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => handleRejectPending(user)}
                        disabled={isSaving}
                        className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                      >
                        <XIcon className="w-4 h-4" />
                        拒绝
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApprovePending(user)}
                        disabled={isSaving}
                        className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        <Check className="w-4 h-4" />
                        批准加入
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : filteredDisabledUsers.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">当前筛选下暂无已禁用用户</div>
        ) : (
          <>
            {/* 移动端：卡片列表 */}
            <div className="space-y-3 md:hidden">
              {filteredDisabledUsers.map((user) => {
                const isSaving = savingUserId === user.id;
                const roleLabel = getRoleLabel(user.role);
                const dbRoleNames = getDbRoleNames(user);
                return (

                  <div
                    key={user.id}
                    className="p-4 border border-slate-200 rounded-xl bg-white shadow-sm flex flex-col gap-2"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                        {user.name?.[0] || user.email[0] || "U"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-bold text-slate-900 truncate">
                            {user.name || user.email}
                          </div>
                          <Badge variant="outline" className="flex-shrink-0">
                            {roleLabel}
                          </Badge>
                        </div>
                        <div className="mt-1 text-[11px] text-slate-500 break-all">
                          {user.email}
                        </div>
                        <div className="mt-1 text-[11px] text-slate-500 break-all">
                          {dbRoleNames.length > 0 ? (
                            <>
                              数据库角色：
                              {dbRoleNames.join("，")}
                            </>
                          ) : (
                            <span className="text-slate-400">
                              暂未分配数据库角色，将基于基础角色标签计算权限
                            </span>
                          )}
                        </div>

                      </div>
                    </div>
                    <div className="text-xs text-slate-500 flex items-center justify-between gap-2">
                      <span>
                        部门：{user.departmentName || "未分配部门"}
                      </span>
                      <span>
                        岗位：{getPositionLabel(user.position, positionOptions)}
                      </span>
                    </div>
                    <div className="pt-2 flex justify-end gap-2">
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => openEditModal(user)}
                        className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                      >
                        <Edit className="w-3 h-3" /> 编辑
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEnableUser(user)}
                        disabled={isSaving}
                        className="px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                      >
                        启用
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 桌面端：表格 */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-[720px] w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="px-4 md:px-6 py-3 font-bold">姓名</th>
                    <th className="px-4 md:px-6 py-3 font-bold">邮箱</th>
                    <th className="px-4 md:px-6 py-3 font-bold">部门</th>
                    <th className="px-4 md:px-6 py-3 font-bold">岗位</th>
                    <th className="px-4 md:px-6 py-3 font-bold">角色</th>
                    <th className="px-4 md:px-6 py-3 font-bold text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDisabledUsers.map((user) => {
                const isSaving = savingUserId === user.id;
                const roleLabel = getRoleLabel(user.role);
                const dbRoleNames = getDbRoleNames(user);
                return (

                      <tr key={user.id} className="hover:bg-slate-50">
                        <td className="px-4 md:px-6 py-3 font-medium text-slate-900 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                            {user.name?.[0] || user.email[0] || "U"}
                          </div>
                          {user.name || user.email}
                        </td>
                        <td className="px-4 md:px-6 py-3 text-slate-500 text-xs md:text-sm break-all">
                          {user.email}
                        </td>
                        <td className="px-4 md:px-6 py-3 text-slate-500 text-xs md:text-sm">
                          {user.departmentName || "未分配部门"}
                        </td>
                        <td className="px-4 md:px-6 py-3 text-slate-500 text-xs md:text-sm">
                          {getPositionLabel(user.position, positionOptions)}
                        </td>
                        <td className="px-4 md:px-6 py-3 text-xs md:text-sm">
                          {dbRoleNames.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {dbRoleNames.map((name) => (
                                <Badge key={name} variant="outline">
                                  {name}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <Badge variant="outline">{roleLabel}</Badge>
                          )}
                          <div className="mt-1 text-[11px] text-slate-400">
                            基础角色标签：{roleLabel}
                          </div>
                        </td>

                        <td className="px-4 md:px-6 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() => openEditModal(user)}
                              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEnableUser(user)}
                              disabled={isSaving}
                              className="px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              启用
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* 添加用户弹窗 */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => {
          if (savingNewUser) return;
          setIsAddModalOpen(false);
        }}
        title="添加新用户"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">姓名</label>
            <input
              type="text"
              value={newUserName}
              onChange={(e) => setNewUserName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="例如：张三"
              disabled={savingNewUser}
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">邮箱</label>
            <input
              type="email"
              value={newUserEmail}
              onChange={(e) => setNewUserEmail(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="例如：zhangsan@example.com"
              disabled={savingNewUser}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">部门</label>
              <select
                value={newUserDepartmentId}
                onChange={(e) => setNewUserDepartmentId(e.target.value)}
                disabled={savingNewUser}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              >
                <option value="">未分配部门</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">基础角色标签</label>

              <select
                value={newUserRole}
                onChange={(e) => setNewUserRole(e.target.value)}
                disabled={savingNewUser}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              >
                <option value="user">普通用户</option>
                <option value="manager">部门管理员</option>
                <option value="admin">管理员</option>
                <option value="viewer">只读用户</option>
              </select>
            </div>
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                if (savingNewUser) return;
                setIsAddModalOpen(false);
              }}
              className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={savingNewUser}
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleCreateUser}
              disabled={savingNewUser}
              className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {savingNewUser ? "创建中..." : "确认添加"}
            </button>
          </div>
        </div>
      </Modal>

      {/* 编辑用户弹窗 */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          if (savingEdit) return;
          setIsEditModalOpen(false);
          setEditingUser(null);
        }}
        title="编辑用户信息"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">姓名</label>
            <input
              type="text"
              value={editingUser?.name ?? editingUser?.email ?? ""}
              disabled
              className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">邮箱</label>
            <input
              type="email"
              value={editingUser?.email ?? ""}
              disabled
              className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-500 text-sm"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">部门</label>
              <select
                value={editDepartmentId}
                onChange={(e) => setEditDepartmentId(e.target.value)}
                disabled={savingEdit}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              >
                <option value="">未分配部门</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">基础角色标签</label>
              <select
                value={editRole}
                onChange={(e) => setEditRole(e.target.value)}
                disabled={savingEdit}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              >
                <option value="user">普通用户</option>
                <option value="manager">部门管理员</option>
                <option value="admin">管理员</option>
                <option value="viewer">只读用户</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">
              岗位视图
            </label>
            <select
              value={editPosition}
              onChange={(e) => setEditPosition(e.target.value)}
              disabled={savingEdit}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            >
              <option value="">未设置</option>
              {!selectedEditPositionExists && editPosition && (
                <option value={editPosition}>{editPosition}（当前已停用或未配置）</option>
              )}
              {editPositionOptions.map((option) => (
                <option key={option.id} value={option.code}>
                  {option.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-slate-400">
              岗位选项来自上方岗位配置；用于按部门和需求类型控制默认可见范围。管理员、部门负责人仍可查看全部。
            </p>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">
              数据库角色（多选）
            </label>
            <p className="text-[11px] text-slate-400 mb-2">
              通过下方勾选为用户分配一个或多个数据库角色，系统会根据这些角色上的权限点来计算实际权限。
            </p>
            <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg bg-slate-50">
              {loadingUserRoles ? (
                <div className="px-3 py-2 text-xs text-slate-400">正在加载角色...</div>
              ) : roleOptions.length === 0 ? (
                <div className="px-3 py-2 text-xs text-slate-400">
                  暂无可分配的角色，请先在“权限说明”页面创建角色。
                </div>
              ) : (
                roleOptions.map((role) => {
                  const checked = editRoleIds.includes(role.id);
                  return (
                    <label
                      key={role.id}
                      className="flex items-start gap-2 px-3 py-2 border-b border-slate-100 last:border-b-0 cursor-pointer hover:bg-white"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setEditRoleIds((prev) =>
                            checked
                              ? prev.filter((id) => id !== role.id)
                              : [...prev, role.id],
                          );
                        }}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <div className="text-xs font-bold text-slate-800">{role.name}</div>
                        {role.description && (
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {role.description}
                          </div>
                        )}
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </div>
          <div className="pt-4 flex justify-end gap-3">

            <button
              type="button"
              onClick={() => {
                if (savingEdit) return;
                setIsEditModalOpen(false);
                setEditingUser(null);
              }}
              className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={savingEdit}
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSaveEdit}
              disabled={savingEdit}
              className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {savingEdit ? "保存中..." : "保存修改"}
            </button>
          </div>
        </div>
      </Modal>

      {/* 禁用用户确认弹窗 */}
      <Modal
        isOpen={!!pendingDisableUser}
        onClose={() => {
          if (savingUserId && pendingDisableUser && savingUserId === pendingDisableUser.id) {
            return;
          }
          setPendingDisableUser(null);
        }}
        title="确认禁用用户"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            确认要禁用
            <span className="font-bold mx-1">
              {pendingDisableUser?.name || pendingDisableUser?.email || "该用户"}
            </span>
            吗？禁用后该用户将无法登录系统，但历史数据不会被删除。
          </p>
          <div className="pt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                if (savingUserId && pendingDisableUser && savingUserId === pendingDisableUser.id) {
                  return;
                }
                setPendingDisableUser(null);
              }}
              className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!!(savingUserId && pendingDisableUser && savingUserId === pendingDisableUser.id)}
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => {
                if (!pendingDisableUser) return;
                void handleDisableUser(pendingDisableUser);
              }}
              disabled={!!(savingUserId && pendingDisableUser && savingUserId === pendingDisableUser.id)}
              className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {savingUserId && pendingDisableUser && savingUserId === pendingDisableUser.id
                ? "禁用中..."
                : "确认禁用"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
