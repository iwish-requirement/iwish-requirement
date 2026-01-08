"use client";

import React, { useEffect, useState } from "react";
import { Plus, Edit, Trash2, Shield, Search, ChevronDown } from "lucide-react";

import { PERMISSIONS, type PermissionKey } from "../../../lib/permissions";
import { authorizedFetch } from "../../../lib/authFetch";
import Modal from "../../../components/ui/Modal";

type EditableRole = {
  id: number | null;
  code: string | null;
  name: string;
  description: string;
  permissions: PermissionKey[];
  isBuiltin: boolean;
};

const PERMISSION_GROUPS: {
  id: string;
  label: string;
  children: { id: string; label: string; keys: PermissionKey[] }[];
}[] = [
  {
    id: "navigation",
    label: "导航与入口",
    children: [
      {
        id: "navigation-shell",
        label: "系统壳与统计入口",
        keys: ["settings.access_shell", "stats.view"],
      },
    ],
  },
  {
    id: "demands",
    label: "需求管理",
    children: [
      {
        id: "demands-view",
        label: "查看需求范围",
        keys: ["demand.view_all", "demand.view_department", "demand.view_personal"],
      },
      {
        id: "demands-operate",
        label: "需求操作",
        keys: ["demand.create", "demand.edit", "demand.delete"],
      },
    ],
  },
  {
    id: "statistics",
    label: "数据统计",
    children: [
      {
        id: "statistics-core",
        label: "统计视图",
        keys: [
          "stats.overview",
          "stats.department_members",
          "stats.dynamic_fields",
          "stats.scores",
        ],
      },
    ],
  },
  {
    id: "settings",
    label: "系统设置模块",
    children: [
      {
        id: "settings-global",
        label: "全局配置",
        keys: ["settings.global.view", "settings.global.manage"],
      },
      {
        id: "settings-departments",
        label: "部门管理",
        keys: ["settings.departments.view", "settings.departments.manage"],
      },
      {
        id: "settings-fields",
        label: "字段模板",
        keys: [
          "settings.fields.view",
          "settings.fields.manage",
          "department.fields_manage",
        ],
      },
      {
        id: "settings-workflow",
        label: "工作流配置",
        keys: ["settings.workflow.view", "settings.workflow.manage"],
      },
      {
        id: "settings-scoring",
        label: "评分模板",
        keys: ["settings.scoring.view", "settings.scoring.manage"],
      },
      {
        id: "settings-score-periods",
        label: "评分周期",
        keys: ["settings.score_periods.view", "settings.score_periods.manage"],
      },

      {
        id: "settings-roles",
        label: "角色与权限配置",
        keys: ["settings.roles.view", "settings.roles.manage"],
      },
      {
        id: "settings-users",
        label: "用户与角色管理",
        keys: ["admin.user_manage"],
      },
    ],
  },
];

export default function RolePermissionOverview() {

  const [roles, setRoles] = useState<EditableRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<number | null>(null);
  const [modalName, setModalName] = useState("");
  const [modalDescription, setModalDescription] = useState("");
  const [modalPermissions, setModalPermissions] = useState<PermissionKey[]>([]);
  const [modalSaving, setModalSaving] = useState(false);

  const [pendingDeleteRole, setPendingDeleteRole] = useState<EditableRole | null>(null);
  const [deletingRoleId, setDeletingRoleId] = useState<number | null>(null);

  const [permissionSearch, setPermissionSearch] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<string[]>(() =>
    PERMISSION_GROUPS.map((g) => g.id),
  );

  const allPermissionKeys: PermissionKey[] = PERMISSION_GROUPS.flatMap((group) =>
    group.children.flatMap((child) =>
      child.keys.filter((key) =>
        Object.prototype.hasOwnProperty.call(PERMISSIONS, key),
      ),
    ),
  );


  useEffect(() => {
    setLoading(true);
    setError(null);

    authorizedFetch("/api/admin/roles")
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text();
          console.error("load roles error", text);
          if (res.status === 401) {
            setError("登录已失效，请重新登录后再试");
          } else if (res.status === 403) {
            setError("您没有权限查看或配置角色权限，如需操作请联系系统管理员。");
          } else {
            setError("加载角色配置失败，请稍后重试");
          }
          setRoles([]);
          return;
        }

        const json = await res.json();
        const items = Array.isArray(json.items) ? json.items : [];
        const next: EditableRole[] = items.map((item: any) => {
          const name = (item?.name ?? "").toString().trim() || "未命名角色";
          const description = (item?.description ?? "").toString();
          const rawPermissions = Array.isArray(item?.permissions) ? item.permissions : [];
          const normalized: PermissionKey[] = rawPermissions.filter((key: any) => {
            if (typeof key !== "string") {
              return false;
            }
            return Object.prototype.hasOwnProperty.call(PERMISSIONS, key);
          });

          const isBuiltin = Boolean(item?.isBuiltin ?? item?.is_builtin ?? false);
          const code = (item?.code ?? null) as string | null;

          return {
            id: typeof item?.id === "number" ? item.id : null,
            code,
            name,
            description,
            permissions: Array.from(new Set(normalized)),
            isBuiltin,
          };
        });

        setRoles(next);
      })
      .catch((e) => {
        console.error("load roles error", e);
        setError("加载角色配置失败，请检查网络后重试");
        setRoles([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const openCreateModal = () => {
    setEditingRoleId(null);
    setModalName("");
    setModalDescription("");
    setModalPermissions([]);
    setError(null);
    setSuccess(null);
    setIsModalOpen(true);
  };

  const openEditModal = (role: EditableRole) => {
    setEditingRoleId(role.id);
    setModalName(role.name);
    setModalDescription(role.description);
    setModalPermissions(role.permissions);
    setError(null);
    setSuccess(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (modalSaving) return;
    setIsModalOpen(false);
  };

  const handleToggleModalPermission = (permission: PermissionKey) => {
    setModalPermissions((prev) => {
      if (prev.includes(permission)) {
        return prev.filter((key) => key !== permission);
      }
      return [...prev, permission];
    });
  };

  const handleSaveRole = () => {
    const trimmedName = modalName.trim();
    const trimmedDescription = modalDescription.trim();

    if (!trimmedName) {
      setError("角色名称不能为空");
      return;
    }

    const payload = {
      id: editingRoleId,
      name: trimmedName,
      description: trimmedDescription || null,
      permissions: Array.from(
        new Set(
          modalPermissions.filter((key) =>
            Object.prototype.hasOwnProperty.call(PERMISSIONS, key),
          ),
        ),
      ),
    };

    setModalSaving(true);
    setError(null);
    setSuccess(null);

    authorizedFetch("/api/admin/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text();
          console.error("save role error", text);
          if (res.status === 401) {
            setError("登录已失效，请重新登录后再试");
          } else if (res.status === 403) {
            setError("您没有权限编辑角色，如需操作请联系系统管理员。");
          } else {
            setError("保存角色失败，请稍后重试");
          }
          return;
        }

        const json = await res.json();
        const role = json?.role;
        if (!role) {
          setError("保存角色失败，请稍后重试");
          return;
        }

        const name = (role.name ?? "").toString().trim() || "未命名角色";
        const description = (role.description ?? "").toString();
        const rawPermissions = Array.isArray(role.permissions) ? role.permissions : [];
        const normalized: PermissionKey[] = rawPermissions.filter((key: any) => {
          if (typeof key !== "string") {
            return false;
          }
          return Object.prototype.hasOwnProperty.call(PERMISSIONS, key);
        });

        const isBuiltin = Boolean(role?.isBuiltin ?? role?.is_builtin ?? false);
        const code = (role?.code ?? null) as string | null;

        const mapped: EditableRole = {
          id: typeof role.id === "number" ? role.id : null,
          code,
          name,
          description,
          permissions: Array.from(new Set(normalized)),
          isBuiltin,
        };

        setRoles((prev) => {
          const others = prev.filter((item) => item.id !== mapped.id);
          const next = [...others, mapped];
          next.sort((a, b) => {
            if (a.isBuiltin && !b.isBuiltin) return -1;
            if (!a.isBuiltin && b.isBuiltin) return 1;
            const aId = a.id ?? 0;
            const bId = b.id ?? 0;
            if (aId && bId && aId !== bId) return aId - bId;
            return a.name.localeCompare(b.name);
          });
          return next;
        });

        setSuccess(editingRoleId ? "角色已更新" : "角色已创建");
        setIsModalOpen(false);
      })
      .catch((e) => {
        console.error("save role error", e);
        setError("保存角色失败，请检查网络后重试");
      })
      .finally(() => {
        setModalSaving(false);
      });
  };

  const askDeleteRole = (role: EditableRole) => {
    if (!role.id) {
      return;
    }
    if (role.isBuiltin) {
      setError("系统内置角色不支持删除，如需调整请编辑权限配置即可。");
      setSuccess(null);
      return;
    }
    setPendingDeleteRole(role);
    setError(null);
    setSuccess(null);
  };

  const handleDeleteRole = () => {
    if (!pendingDeleteRole || !pendingDeleteRole.id) {
      return;
    }

    const id = pendingDeleteRole.id;
    setDeletingRoleId(id);
    setError(null);
    setSuccess(null);

    authorizedFetch("/api/admin/roles", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text();
          console.error("delete role error", text);

          if (res.status === 401) {
            setError("登录已失效，请重新登录后再试");
          } else if (res.status === 403) {
            setError("您没有权限删除角色，如需操作请联系系统管理员。");
          } else {
            try {
              const json = JSON.parse(text);
              if (json?.error === "role_in_use" && json?.detail) {
                setError(json.detail as string);
              } else {
                setError("删除角色失败，请稍后重试");
              }
            } catch {
              setError("删除角色失败，请稍后重试");
            }
          }
          return;
        }

        setRoles((prev) => prev.filter((item) => item.id !== id));
        setSuccess("角色已删除");
      })
      .catch((e) => {
        console.error("delete role error", e);
        setError("删除角色失败，请检查网络后重试");
      })
      .finally(() => {
        setDeletingRoleId(null);
        setPendingDeleteRole(null);
      });
  };

  const sortedRoles = [...roles].sort((a, b) => {

    if (a.isBuiltin && !b.isBuiltin) return -1;
    if (!a.isBuiltin && b.isBuiltin) return 1;
    const aId = a.id ?? 0;
    const bId = b.id ?? 0;
    if (aId && bId && aId !== bId) return aId - bId;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="animate-fadeIn max-w-5xl">
      <section className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-4">

          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-1 flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-500" /> 权限管理
            </h2>

            <p className="text-xs md:text-sm text-slate-500">
              所有角色（包括管理员、部门管理员等）都存储在数据库中，你可以在这里统一查看和维护。
              为用户分配一个或多个角色后，系统会根据角色上勾选的权限点来计算该用户的实际能力边界。
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="mt-2 md:mt-1 self-start md:self-auto inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-100 bg-blue-50 text-xs md:text-sm font-bold text-blue-600 hover:bg-blue-100 whitespace-nowrap w-full md:w-auto disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={loading}
          >


            <Plus className="w-3 h-3" /> 添加角色
          </button>
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
          <div className="px-4 py-6 text-center text-xs md:text-sm text-slate-400">
            正在加载角色与权限配置...
          </div>
        )}

        {!loading && sortedRoles.length === 0 && (
          <div className="px-4 py-6 text-center text-xs md:text-sm text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50">
            当前系统还没有任何角色配置，可以通过右上角“添加角色”按钮，基于权限点创建一条新角色。
          </div>
        )}

        {!loading && sortedRoles.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {sortedRoles.map((role) => {
              const metas = role.permissions
                .map((key) => PERMISSIONS[key])
                .filter((meta): meta is (typeof PERMISSIONS)[PermissionKey] => Boolean(meta));

              const badgeLabel = role.isBuiltin ? "系统内置" : "自定义角色";
              const badgeClass = role.isBuiltin
                ? "bg-slate-100 text-slate-600 border-slate-200"
                : "bg-blue-50 text-blue-600 border-blue-100";

              return (
                <div
                  key={role.id ?? role.name}
                  className="p-4 md:p-5 border border-slate-200 rounded-xl bg-white shadow-sm flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-base md:text-lg font-bold text-slate-900 break-words">
                            {role.name}
                          </h3>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] border ${badgeClass}`}
                          >
                            {badgeLabel}
                          </span>
                        </div>
                        {role.description && (
                          <p className="text-xs md:text-sm text-slate-500 mt-1 whitespace-pre-line break-words">
                            {role.description}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 text-[11px] md:text-xs text-slate-400">
                        {role.code && <span className="font-mono">code: {role.code}</span>}
                        {role.id && (
                          <span className="font-mono bg-slate-50 px-2 py-0.5 rounded">
                            ID: {role.id}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 min-h-[40px]">
                      {metas.length ? (
                        <div className="flex flex-wrap gap-1.5">
                          {metas.map((meta) => (
                            <span
                              key={meta.key}
                              className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-50 text-[11px] md:text-xs text-slate-700 border border-slate-200"
                              title={meta.description}
                            >
                              {meta.label}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[11px] md:text-xs text-slate-400">
                          暂未勾选任何权限点，该角色当前不会赋予额外能力，请点击下方“编辑”进行配置。
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => openEditModal(role)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs md:text-sm font-bold text-slate-700 hover:bg-slate-100"
                    >
                      <Edit className="w-3 h-3" /> 编辑
                    </button>
                    <button
                      type="button"
                      onClick={() => askDeleteRole(role)}
                      disabled={deletingRoleId === role.id || role.isBuiltin}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-100 bg-rose-50 text-xs md:text-sm font-bold text-rose-600 hover:bg-rose-100 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-3 h-3" />
                      {role.isBuiltin
                        ? "内置角色不可删除"
                        : deletingRoleId === role.id
                        ? "删除中..."
                        : "删除"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Modal
          isOpen={isModalOpen}
          onClose={closeModal}
          title={editingRoleId ? "编辑角色" : "添加角色"}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">角色名称</label>
              <input
                type="text"
                value={modalName}
                onChange={(e) => setModalName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="例如：需求评审人"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">角色描述（可选）</label>
              <textarea
                rows={2}
                value={modalDescription}
                onChange={(e) => setModalDescription(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                placeholder="例如：负责对接某部门需求评审，并给出优先级建议"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-bold text-slate-700">权限点勾选</label>
                <span className="text-[11px] text-slate-400">
                  可多选；用户最终权限 = 所有分配角色上的权限点合集
                </span>
              </div>
              <div className="flex items-center gap-3 mb-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input
                    type="text"
                    value={permissionSearch}
                    onChange={(e) => setPermissionSearch(e.target.value)}
                    placeholder="搜索模块或权限点，例如：部门、统计、评分"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const current = new Set(modalPermissions);
                    const hasAll = allPermissionKeys.every((key) => current.has(key));
                    if (hasAll) {
                      setModalPermissions((prev) =>
                        prev.filter((key) => !allPermissionKeys.includes(key)),
                      );
                    } else {
                      setModalPermissions((prev) =>
                        Array.from(new Set([...prev, ...allPermissionKeys])),
                      );
                    }
                  }}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 whitespace-nowrap"
                >
                  选择所有权限
                </button>
              </div>
              <div className="max-h-80 overflow-y-auto border border-slate-200 rounded-lg bg-slate-50">
                {PERMISSION_GROUPS.map((group) => {
                  const groupChildren = group.children.map((child) => {
                    const visibleKeys = child.keys.filter((key) => {
                      if (!Object.prototype.hasOwnProperty.call(PERMISSIONS, key)) {
                        return false;
                      }
                      if (!permissionSearch.trim()) return true;
                      const meta = PERMISSIONS[key];
                      const text = `${meta.label}${meta.description}${meta.key}`.toLowerCase();
                      return text.includes(permissionSearch.trim().toLowerCase());
                    });
                    if (!visibleKeys.length) return null;
                    return { ...child, visibleKeys };
                  }).filter(Boolean) as { id: string; label: string; visibleKeys: PermissionKey[] }[];

                  if (!groupChildren.length) return null;

                  const groupAllKeys = groupChildren.flatMap((child) => child.visibleKeys);
                  const groupCheckedCount = groupAllKeys.filter((key) =>
                    modalPermissions.includes(key),
                  ).length;
                  const groupTotalCount = groupAllKeys.length;

                  const expanded = expandedGroups.includes(group.id);

                  return (
                    <div key={group.id} className="border-b border-slate-100 last:border-b-0 bg-white">
                      <button
                        type="button"
                        onClick={() => {
                          setExpandedGroups((prev) =>
                            prev.includes(group.id)
                              ? prev.filter((id) => id !== group.id)
                              : [...prev, group.id],
                          );
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-slate-50"
                      >
                        <div className="flex items-center gap-2">
                          <ChevronDown
                            className={`w-4 h-4 text-slate-400 transition-transform ${
                              expanded ? "rotate-180" : ""
                            }`}
                          />
                          <span className="text-xs md:text-sm font-bold text-slate-800">
                            {group.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-slate-400">
                          <span>
                            {groupCheckedCount}/{groupTotalCount}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const validKeys = groupAllKeys;
                              const current = new Set(modalPermissions);
                              const hasAll = validKeys.every((key) => current.has(key));
                              if (hasAll) {
                                setModalPermissions((prev) =>
                                  prev.filter((key) => !validKeys.includes(key)),
                                );
                              } else {
                                setModalPermissions((prev) =>
                                  Array.from(new Set([...prev, ...validKeys])),
                                );
                              }
                            }}
                            className="px-2 py-0.5 rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100"
                          >
                            {groupCheckedCount === groupTotalCount && groupTotalCount > 0
                              ? "清空"
                              : "全选"}
                          </button>
                        </div>
                      </button>
                      {expanded && (
                        <div className="border-t border-slate-100 bg-slate-50">
                          {groupChildren.map((child) => (
                            <div key={child.id} className="border-b border-slate-100 last:border-b-0">
                              <div className="flex items-center justify-between px-3 py-2 bg-slate-50">
                                <span className="text-[11px] md:text-xs font-bold text-slate-700">
                                  {child.label}
                                </span>
                                <span className="text-[11px] text-slate-400">
                                  {
                                    child.visibleKeys.filter((key) =>
                                      modalPermissions.includes(key),
                                    ).length
                                  }
                                  /{child.visibleKeys.length}
                                </span>
                              </div>
                              {child.visibleKeys.map((key) => {
                                const meta = PERMISSIONS[key];
                                const checked = modalPermissions.includes(key);
                                return (
                                  <label
                                    key={meta.key}
                                    className="flex items-start gap-3 px-4 py-2 border-t border-slate-100 cursor-pointer hover:bg-white"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => handleToggleModalPermission(meta.key)}
                                      className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <div>
                                      <div className="text-xs md:text-sm font-bold text-slate-800">
                                        {meta.label}
                                      </div>
                                      <div className="text-[11px] md:text-xs text-slate-500 mt-0.5">
                                        {meta.description}
                                      </div>
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeModal}
                disabled={modalSaving}
                className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSaveRole}
                disabled={modalSaving}
                className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {modalSaving ? "保存中..." : "保存角色"}
              </button>
            </div>
          </div>
        </Modal>

        <Modal
          isOpen={!!pendingDeleteRole}
          onClose={() => {
            if (deletingRoleId) return;
            setPendingDeleteRole(null);
          }}
          title="确认删除角色"
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              确认删除角色
              <span className="font-bold mx-1">{pendingDeleteRole?.name}</span>
              吗？删除后该角色将无法继续在用户管理中分配，但已分配到用户身上的权限不会自动回收，需要你在用户管理中调整其角色配置。
            </p>
            <div className="pt-4 flex justify-end gap-3">
              <button
                type="button"
                disabled={!!deletingRoleId}
                onClick={() => {
                  if (deletingRoleId) return;
                  setPendingDeleteRole(null);
                }}
                className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed"
              >
                取消
              </button>
              <button
                type="button"
                disabled={!!deletingRoleId}
                onClick={handleDeleteRole}
                className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {deletingRoleId ? "删除中..." : "确认删除"}
              </button>
            </div>
          </div>
        </Modal>
      </section>
    </div>
  );
}
