"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Download, Search, Sparkles, Calendar, User } from "lucide-react";
import { DemandStatus, Priority, Department, Demand, FieldDefinition } from "../../../types";
import { getSupabaseClient } from "../../../lib/supabase";
import { authorizedFetch } from "../../../lib/authFetch";
import Badge from "../../../components/ui/Badge";
import Modal from "../../../components/ui/Modal";

export default function DemandsPage() {
  const router = useRouter();

  const [selectedDept, setSelectedDept] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState<"all" | DemandStatus>("all");
  const [onlyMyCreated, setOnlyMyCreated] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");

  const [departments, setDepartments] = useState<Department[]>([]);
  const [demands, setDemands] = useState<Demand[]>([]);
  const [currentUserCode, setCurrentUserCode] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const [deptUsers, setDeptUsers] = useState<{
    id: number;
    name: string | null;
    email: string | null;
  }[]>([]);
  const [deptUsersLoading, setDeptUsersLoading] = useState(false);
  const [creatorUserId, setCreatorUserId] = useState("");
  const [assigneeUserId, setAssigneeUserId] = useState("");

  const [dynamicFilterFields, setDynamicFilterFields] = useState<FieldDefinition[]>([]);
  const [dynamicFilters, setDynamicFilters] = useState<Record<string, string>>({});
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [deleteTargetDemand, setDeleteTargetDemand] = useState<Demand | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importDepartmentId, setImportDepartmentId] = useState<string>("");
  const [importFileName, setImportFileName] = useState<string>("");
  const [importCsvText, setImportCsvText] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<
    | null
    | {
        successCount: number;
        failCount: number;
        results: { rowNumber: number; success: boolean; message?: string }[];
      }
  >(null);

  const resetAllFilters = () => {
    setSelectedDept("all");
    setSelectedStatus("all");
    setOnlyMyCreated(false);
    setSearchQuery("");
    setCreatedFrom("");
    setCreatedTo("");
    setDueFrom("");
    setDueTo("");
    setCreatorUserId("");
    setAssigneeUserId("");
    setDynamicFilters({});
    setPage(1);
  };

  useEffect(() => {
    const loadDepartments = async () => {
      try {
        const res = await fetch("/api/departments");
        if (!res.ok) {
          const text = await res.text();
          console.error("load departments for demands list error", text);
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
        console.error("load departments for demands list error", e);
      }
    };

    loadDepartments();
  }, []);

  useEffect(() => {
    const supabase = getSupabaseClient();
    supabase.auth
      .getUser()
      .then(({ data }) => {
        const email = data?.user?.email || "";
        if (email) {
          const code = email.split("@")[0]?.toUpperCase() || "";
          if (code) {
            setCurrentUserCode(code);
          }
        }
      })
      .catch((e) => {
        console.error("load current user error", e);
      });
  }, []);

  useEffect(() => {
    if (selectedDept === "all") {
      setDeptUsers([]);
      setDynamicFilterFields([]);
      setDynamicFilters({});
      setCreatorUserId("");
      setAssigneeUserId("");
      return;
    }

    const loadDeptMeta = async () => {
      try {
        setDeptUsersLoading(true);
        const [fieldsRes, usersRes] = await Promise.all([
          authorizedFetch(`/api/department-fields?departmentId=${encodeURIComponent(selectedDept)}`),
          authorizedFetch(`/api/users/by-department?departmentId=${encodeURIComponent(selectedDept)}`),
        ]);

        if (fieldsRes.ok) {
          const json = await fieldsRes.json();
          const items = (json.items || []) as FieldDefinition[];
          setDynamicFilterFields(items.filter((f) => f.filterable));
        } else {
          console.error("load department fields for filters error", await fieldsRes.text());
          setDynamicFilterFields([]);
        }

        if (usersRes.ok) {
          const json = await usersRes.json();
          const items = (json.items || []) as {
            id: number;
            name: string | null;
            email: string | null;
          }[];
          setDeptUsers(items);
        } else {
          console.error("load department users for filters error", await usersRes.text());
          setDeptUsers([]);
        }
      } catch (e) {
        console.error("load department meta for filters error", e);
        setDynamicFilterFields([]);
        setDeptUsers([]);
      } finally {
        setDeptUsersLoading(false);
      }
    };

    loadDeptMeta();
  }, [selectedDept]);

  useEffect(() => {
    const controller = new AbortController();

    const fetchDemands = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (searchQuery.trim()) {
          params.set("q", searchQuery.trim());
        }
        if (selectedDept !== "all") {
          params.set("departmentId", selectedDept);
        }
        if (selectedStatus !== "all") {
          params.set("status", selectedStatus);
        }
        if (onlyMyCreated && currentUserCode) {
          params.set("creatorCode", currentUserCode);
        }
        if (creatorUserId) {
          params.set("creatorUserId", creatorUserId);
        }
        if (assigneeUserId) {
          params.set("assigneeUserId", assigneeUserId);
        }
        if (createdFrom) {
          params.set("createdFrom", createdFrom);
        }
        if (createdTo) {
          params.set("createdTo", createdTo);
        }
        if (dueFrom) {
          params.set("dueFrom", dueFrom);
        }
        if (dueTo) {
          params.set("dueTo", dueTo);
        }
        Object.entries(dynamicFilters).forEach(([fieldId, value]) => {
          if (!value) return;
          params.set(`cf_${fieldId}`, value);
        });
        params.set("page", String(page));
        params.set("pageSize", String(pageSize));

        const qs = params.toString();
        const res = await authorizedFetch(`/api/demands${qs ? `?${qs}` : ""}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          const text = await res.text();
          console.error("load demands error", text);
          return;
        }
        const json = await res.json();
        setDemands(json.items || []);
        setTotal(json.total ?? 0);
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        console.error("load demands error", e);
      } finally {
        setLoading(false);
      }
    };

    if (onlyMyCreated && !currentUserCode) {
      return;
    }

    fetchDemands();

    return () => controller.abort();
  }, [
    searchQuery,
    selectedDept,
    selectedStatus,
    onlyMyCreated,
    currentUserCode,
    creatorUserId,
    assigneeUserId,
    dynamicFilters,
    page,
    pageSize,
    createdFrom,
    createdTo,
    dueFrom,
    dueTo,
  ]);

  const getPriorityColor = (priority: Priority) => {
    switch (priority) {
      case Priority.CRITICAL:
        return "text-red-600 bg-red-50 border-red-200";
      case Priority.HIGH:
        return "text-orange-600 bg-orange-50 border-orange-200";
      case Priority.MEDIUM:
        return "text-blue-600 bg-blue-50 border-blue-200";
      default:
        return "text-slate-600 bg-slate-100 border-slate-200";
    }
  };

  const getStatusBadge = (status: DemandStatus) => {
    let variant: any = "default";
    if (status === DemandStatus.DONE) variant = "success";
    if (status === DemandStatus.IN_PROGRESS) variant = "warning";
    if (status === DemandStatus.PENDING) variant = "outline";
    if (status === DemandStatus.DELAYED) variant = "warning";
    if (status === DemandStatus.IGNORED) variant = "outline";
    return <Badge variant={variant}>{status}</Badge>;
  };

  const maxPage = Math.max(1, Math.ceil(total / pageSize));

  const handleConfirmDeleteDemand = async () => {
    if (!deleteTargetDemand || deleteSubmitting) return;
    try {
      setDeleteSubmitting(true);
      setDeleteError(null);
      const res = await authorizedFetch(`/api/demands/${deleteTargetDemand.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const text = await res.text();
        console.error("delete demand from list error", text);
        setDeleteError(text || "删除失败，请稍后重试");
        return;
      }
      setDemands((prev) => prev.filter((d) => d.id !== deleteTargetDemand.id));
      setTotal((prev) => Math.max(0, prev - 1));
      setDeleteTargetDemand(null);
    } catch (e) {
      console.error("delete demand from list error", e);
      setDeleteError("删除失败，请检查网络后重试");
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const handleDownloadImportTemplate = async () => {
    if (!importDepartmentId) {
      setImportError("请先选择要导入的部门，再下载模板");
      return;
    }

    try {
      setImportError(null);
      const url = `/api/demands/import/template?departmentId=${encodeURIComponent(importDepartmentId)}`;
      const res = await authorizedFetch(url, { method: "GET" });
      if (!res.ok) {
        const text = await res.text();
        console.error("download import template error", text);
        setImportError("下载模板失败，请稍后重试");
        return;
      }
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `demands-import-template-${importDepartmentId}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (e) {
      console.error("download import template error", e);
      setImportError("下载模板失败，请检查网络后重试");
    }
  };

  const openImportModal = () => {
    setImportError(null);
    setImportResult(null);
    setImportCsvText(null);
    setImportFileName("");
    setImportDepartmentId(selectedDept === "all" ? "" : selectedDept);
    setImportModalOpen(true);
  };

  const handleImportFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setImportFileName("");
      setImportCsvText(null);
      return;
    }

    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      setImportCsvText(text);
    };
    reader.onerror = () => {
      console.error("read import csv file error");
      setImportError("读取文件失败，请重试");
      setImportCsvText(null);
    };
    reader.readAsText(file, "utf-8");
  };

  const handleSubmitImport = async () => {
    if (!importDepartmentId) {
      setImportError("请选择要导入的部门");
      return;
    }
    if (!importCsvText || !importCsvText.trim()) {
      setImportError("请先选择要导入的 CSV 文件");
      return;
    }

    try {
      setImporting(true);
      setImportError(null);
      const res = await authorizedFetch("/api/demands/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          departmentId: importDepartmentId,
          csv: importCsvText,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        console.error("import demands error", json);
        setImportResult(null);
        setImportError(json.error || "导入失败，请稍后重试");
        return;
      }

      setImportResult({
        successCount: json.successCount ?? 0,
        failCount: json.failCount ?? 0,
        results: Array.isArray(json.results) ? json.results : [],
      });

      if ((json.successCount ?? 0) > 0) {
        setPage(1);
      }
    } catch (e) {
      console.error("import demands error", e);
      setImportError("导入失败，请检查网络后重试");
      setImportResult(null);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="h-full flex flex-col pb-8 overflow-x-hidden">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">需求管理</h1>
          <p className="text-base text-slate-500 mt-2">管理和追踪跨部门的所有项目需求。</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={openImportModal}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white border border-slate-300 text-slate-700 px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" />
            导入
          </button>
          <button
            type="button"
            onClick={async () => {
              try {
                const params = new URLSearchParams();
                if (searchQuery.trim()) {
                  params.set("q", searchQuery.trim());
                }
                if (selectedDept !== "all") {
                  params.set("departmentId", selectedDept);
                }
                if (selectedStatus !== "all") {
                  params.set("status", selectedStatus);
                }
                if (onlyMyCreated && currentUserCode) {
                  params.set("creatorCode", currentUserCode);
                }
                if (creatorUserId) {
                  params.set("creatorUserId", creatorUserId);
                }
                if (assigneeUserId) {
                  params.set("assigneeUserId", assigneeUserId);
                }
                if (createdFrom) {
                  params.set("createdFrom", createdFrom);
                }
                if (createdTo) {
                  params.set("createdTo", createdTo);
                }
                if (dueFrom) {
                  params.set("dueFrom", dueFrom);
                }
                if (dueTo) {
                  params.set("dueTo", dueTo);
                }
                Object.entries(dynamicFilters).forEach(([fieldId, value]) => {
                  if (!value) return;
                  params.set(`cf_${fieldId}`, value);
                });
                const qs = params.toString();
                const url = `/api/demands/export${qs ? `?${qs}` : ""}`;

                const res = await authorizedFetch(url, { method: "GET" });
                if (!res.ok) {
                  const text = await res.text();
                  console.error("export demands error", text);
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
                console.error("trigger demands export error", e);
              }
            }}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white border border-slate-300 text-slate-700 px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" />
            导出
          </button>
          <button
            onClick={() => router.push("/demands/new")}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm hover:shadow-md"
          >
            <Plus className="w-4 h-4" />
            新建需求
          </button>
        </div>
      </div>

      {/* 顶部筛选区域，响应式布局优化 */}
      {/* 移动端：改为抽屉按钮 */}
      <div className="md:hidden mb-4">
        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          className="w-full flex items-center justify-center gap-2 bg-white border border-slate-300 text-slate-700 px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors shadow-sm"
        >
          <Search className="w-4 h-4" />
          打开筛选
        </button>
      </div>
      {/* 桌面端：保留原筛选框 */}
      <div className="hidden md:block bg-white p-5 rounded-2xl border border-slate-200 shadow-sm mb-6">
        <div className="flex flex-col gap-4">
          {/* 上层：搜索 + 部门/状态 + AI 按钮 */}
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="flex flex-col md:flex-row gap-3 flex-1">
              <div className="relative flex-1 md:min-w-[220px] lg:max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="搜索需求 ID 或 标题..."
                  className="w-full pl-10 pr-4 py-2.5 text-base border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-3 flex-1">
                <select
                  className="w-full sm:flex-1 px-4 py-2.5 text-base border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={selectedDept}
                  onChange={(e) => {
                    setSelectedDept(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="all">所有部门</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
                <select
                  className="w-full sm:flex-1 px-4 py-2.5 text-base border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={selectedStatus}
                  onChange={(e) => {
                    setSelectedStatus(e.target.value as DemandStatus | "all");
                    setPage(1);
                  }}
                >
                  <option value="all">所有状态</option>
                  <option value={DemandStatus.PENDING}>{DemandStatus.PENDING}</option>
                  <option value={DemandStatus.IN_PROGRESS}>{DemandStatus.IN_PROGRESS}</option>
                  <option value={DemandStatus.DONE}>{DemandStatus.DONE}</option>
                  <option value={DemandStatus.DELAYED}>{DemandStatus.DELAYED}</option>
                  <option value={DemandStatus.IGNORED}>{DemandStatus.IGNORED}</option>
                </select>
              </div>
            </div>
            <div className="flex-shrink-0">
              <button className="w-full lg:w-auto flex items-center justify-center gap-2 text-purple-700 bg-purple-50 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-purple-100 transition-colors border border-purple-100">
                <Sparkles className="w-4 h-4" />
                AI 智能分析
              </button>
            </div>
          </div>

          {/* 下层：时间范围 + 人员筛选 + 只看我提交的 */}
          <div className="border-t border-slate-100 pt-4 flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-4 flex-1 text-sm text-slate-500">
              {/* 创建时间 */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-1 min-w-0">
                <span className="whitespace-nowrap sm:mr-1">创建时间</span>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-1 min-w-0">
                  <input
                    type="date"
                    value={createdFrom}
                    onChange={(e) => {
                      setCreatedFrom(e.target.value);
                      setPage(1);
                    }}
                    className="w-full sm:w-auto flex-1 min-w-0 px-2 py-1 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-slate-400 text-center sm:text-left">~</span>
                  <input
                    type="date"
                    value={createdTo}
                    onChange={(e) => {
                      setCreatedTo(e.target.value);
                      setPage(1);
                    }}
                    className="w-full sm:w-auto flex-1 min-w-0 px-2 py-1 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              {/* 截止日期 */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-1 min-w-0">
                <span className="whitespace-nowrap sm:mr-1">截止日期</span>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-1 min-w-0">
                  <input
                    type="date"
                    value={dueFrom}
                    onChange={(e) => {
                      setDueFrom(e.target.value);
                      setPage(1);
                    }}
                    className="w-full sm:w-auto flex-1 min-w-0 px-2 py-1 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-slate-400 text-center sm:text-left">~</span>
                  <input
                    type="date"
                    value={dueTo}
                    onChange={(e) => {
                      setDueTo(e.target.value);
                      setPage(1);
                    }}
                    className="w-full sm:w-auto flex-1 min-w-0 px-2 py-1 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* 人员筛选 */}
            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-4 text-sm text-slate-500">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-1 min-w-0">
                <span className="whitespace-nowrap sm:mr-1">提交人</span>
                <select
                  value={creatorUserId}
                  onChange={(e) => {
                    setCreatorUserId(e.target.value);
                    setPage(1);
                  }}
                  disabled={selectedDept === "all" || deptUsersLoading || deptUsers.length === 0}
                  className="w-full sm:w-auto flex-1 min-w-0 px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
                >
                  {selectedDept === "all" ? (
                    <option value="">请先选择部门</option>
                  ) : deptUsersLoading ? (
                    <option value="">正在加载部门成员...</option>
                  ) : deptUsers.length === 0 ? (
                    <option value="">该部门暂无成员</option>
                  ) : (
                    <>
                      <option value="">全部提交人</option>
                      {deptUsers.map((user) => {
                        if (!user.email) return null;
                        const displayName = user.name || user.email.split("@")[0];
                        return (
                          <option key={user.id} value={String(user.id)}>
                            {displayName}（{user.email}）
                          </option>
                        );
                      })}
                    </>
                  )}
                </select>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-1 min-w-0">
                <span className="whitespace-nowrap sm:mr-1">执行人</span>
                <select
                  value={assigneeUserId}
                  onChange={(e) => {
                    setAssigneeUserId(e.target.value);
                    setPage(1);
                  }}
                  disabled={selectedDept === "all" || deptUsersLoading || deptUsers.length === 0}
                  className="w-full sm:w-auto flex-1 min-w-0 px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
                >
                  {selectedDept === "all" ? (
                    <option value="">请先选择部门</option>
                  ) : deptUsersLoading ? (
                    <option value="">正在加载部门成员...</option>
                  ) : deptUsers.length === 0 ? (
                    <option value="">该部门暂无成员</option>
                  ) : (
                    <>
                      <option value="">全部执行人</option>
                      {deptUsers.map((user) => {
                        if (!user.email) return null;
                        const displayName = user.name || user.email.split("@")[0];
                        return (
                          <option key={user.id} value={String(user.id)}>
                            {displayName}（{user.email}）
                          </option>
                        );
                      })}
                    </>
                  )}
                </select>
              </div>
            </div>

            {/* 高级筛选：按部门自定义字段 */}
            {dynamicFilterFields.length > 0 && (
              <div className="flex flex-col gap-2 border-t border-slate-100 pt-4 text-xs text-slate-500">
                <div className="font-semibold text-slate-600">高级筛选（按部门自定义字段）</div>
                <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3">
                  {dynamicFilterFields.map((field) => {
                    const value = dynamicFilters[field.id] || "";
                    const handleChange = (next: string) => {
                      setDynamicFilters((prev) => ({ ...prev, [field.id]: next }));
                      setPage(1);
                    };

                    if (field.type === "select" || field.type === "multi_select") {
                      return (
                        <div
                          key={field.id}
                          className="flex flex-col sm:flex-row sm:items-center gap-2 min-w-[160px] flex-1"
                        >
                          <span className="whitespace-nowrap text-slate-600">{field.label}</span>
                          <select
                            value={value}
                            onChange={(e) => handleChange(e.target.value)}
                            className="w-full sm:w-auto flex-1 min-w-0 px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">全部</option>
                            {(field.options || []).map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    }

                    if (field.type === "date") {
                      return (
                        <div
                          key={field.id}
                          className="flex flex-col sm:flex-row sm:items-center gap-2 min-w-[160px] flex-1"
                        >
                          <span className="whitespace-nowrap text-slate-600">{field.label}</span>
                          <input
                            type="date"
                            value={value}
                            onChange={(e) => handleChange(e.target.value)}
                            className="w-full sm:w-auto flex-1 min-w-0 px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      );
                    }

                    if (field.type === "boolean") {
                      return (
                        <div
                          key={field.id}
                          className="flex flex-col sm:flex-row sm:items-center gap-2 min-w-[160px] flex-1"
                        >
                          <span className="whitespace-nowrap text-slate-600">{field.label}</span>
                          <select
                            value={value}
                            onChange={(e) => handleChange(e.target.value)}
                            className="w-full sm:w-auto flex-1 min-w-0 px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">全部</option>
                            <option value="true">是</option>
                            <option value="false">否</option>
                          </select>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={field.id}
                        className="flex flex-col sm:flex-row sm:items-center gap-2 min-w-[160px] flex-1"
                      >
                        <span className="whitespace-nowrap text-slate-600">{field.label}</span>
                        <input
                          type={field.type === "number" ? "number" : "text"}
                          value={value}
                          onChange={(e) => handleChange(e.target.value)}
                          placeholder={field.placeholder || "请输入筛选条件"}
                          className="w-full sm:w-auto flex-1 min-w-0 px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex md:justify-end">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="px-4 py-2 text-sm font-bold rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                >
                  清除筛选
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOnlyMyCreated((prev) => !prev);
                    setPage(1);
                  }}
                  className={`px-4 py-2 text-sm font-bold rounded-full border transition-colors ${
                    onlyMyCreated
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  只看我提交的
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 桌面表格视图 */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex-1">
        {loading && (
          <div className="w-full text-center py-3 text-xs text-slate-400 border-b border-slate-100">
            正在加载数据...
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="min-w-[960px] w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-5 w-28 whitespace-nowrap">ID</th>
                <th className="px-6 py-5 whitespace-nowrap">需求标题</th>
                <th className="px-6 py-5 w-40 text-center whitespace-nowrap">所属部门</th>
                <th className="px-6 py-5 w-32 text-center whitespace-nowrap">优先级</th>
                <th className="px-6 py-5 w-32 text-center whitespace-nowrap">状态</th>
                <th className="px-6 py-5 w-32 text-center whitespace-nowrap">提交人</th>
                <th className="px-6 py-5 w-32 text-center whitespace-nowrap">执行人</th>
                <th className="px-6 py-5 w-40 text-center whitespace-nowrap">截止日期</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {demands.map((demand) => {
                const deptName =
                  departments.find((d) => d.id === demand.departmentId)?.name || "Unknown";
                const creatorDisplayName = demand.creatorName || demand.creatorId;
                const assigneeDisplayName = demand.assigneeName || demand.assigneeId || "";
                return (
                  <tr
                    key={demand.id}
                    className="hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/demands/${demand.id}`)}
                  >
                    <td className="px-6 py-5 text-slate-500 font-mono text-sm whitespace-nowrap">{demand.id}</td>
                    <td className="px-6 py-5">
                      <div className="font-bold text-base text-slate-900 hover:text-blue-600 mb-1 truncate max-w-[260px]">
                        {demand.title}
                      </div>
                      <div className="text-sm text-slate-500 truncate max-w-[260px]">
                        {demand.description}
                      </div>
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-slate-300" />
                        <span className="text-slate-700 font-medium">{deptName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center whitespace-nowrap">
                      <span
                        className={`px-2.5 py-1 rounded-md border text-xs font-bold ${getPriorityColor(
                          demand.priority,
                        )}`}
                      >
                        {demand.priority}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-center whitespace-nowrap">{getStatusBadge(demand.status)}</td>
                    <td className="px-6 py-5 text-center whitespace-nowrap">
                      <div className="inline-flex items-center gap-2 text-slate-700 text-sm">
                        <User className="w-4 h-4 text-slate-400" />
                        <span className="font-medium">{creatorDisplayName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center whitespace-nowrap">
                      {assigneeDisplayName ? (
                        <div className="inline-flex items-center gap-2 text-slate-700 text-sm">
                          <User className="w-4 h-4 text-slate-400" />
                          <span className="font-medium">{assigneeDisplayName}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">未指定</span>
                      )}
                    </td>
                    <td className="px-6 py-5 text-center whitespace-nowrap text-slate-600 font-medium">{demand.dueDate}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 移动端筛选抽屉 */}
      {filtersOpen && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40">
          <button
            type="button"
            className="absolute inset-0 cursor-pointer"
            onClick={() => setFiltersOpen(false)}
          />
          <div className="relative z-50 w-full bg-white rounded-t-3xl shadow-2xl p-5 max-h-[80vh] overflow-y-auto">
            {/* 将原筛选内容搬到这里（移动端） */}
            <div className="flex flex-col gap-4">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="搜索需求 ID 或 标题..."
                  className="w-full pl-10 pr-4 py-2.5 text-base border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
              <div className="flex flex-col gap-3">
                <select
                  className="w-full px-4 py-2.5 text-base border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={selectedDept}
                  onChange={(e) => {
                    setSelectedDept(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="all">所有部门</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
                <select
                  className="w-full px-4 py-2.5 text-base border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={selectedStatus}
                  onChange={(e) => {
                    setSelectedStatus(e.target.value as DemandStatus | 'all');
                    setPage(1);
                  }}
                >
                  <option value="all">所有状态</option>
                  <option value={DemandStatus.PENDING}>{DemandStatus.PENDING}</option>
                  <option value={DemandStatus.IN_PROGRESS}>{DemandStatus.IN_PROGRESS}</option>
                  <option value={DemandStatus.DONE}>{DemandStatus.DONE}</option>
                  <option value={DemandStatus.DELAYED}>{DemandStatus.DELAYED}</option>
                  <option value={DemandStatus.IGNORED}>{DemandStatus.IGNORED}</option>
                </select>
              </div>

              <div className="border-t border-slate-100 pt-4 flex flex-col gap-4">
                <div className="flex flex-col gap-2 text-sm text-slate-500">
                  <span className="font-semibold text-slate-600">创建时间</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={createdFrom}
                      onChange={(e) => {
                        setCreatedFrom(e.target.value);
                        setPage(1);
                      }}
                      className="flex-1 min-w-0 px-2 py-1 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-slate-400">~</span>
                    <input
                      type="date"
                      value={createdTo}
                      onChange={(e) => {
                        setCreatedTo(e.target.value);
                        setPage(1);
                      }}
                      className="flex-1 min-w-0 px-2 py-1 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2 text-sm text-slate-500">
                  <span className="font-semibold text-slate-600">截止日期</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={dueFrom}
                      onChange={(e) => {
                        setDueFrom(e.target.value);
                        setPage(1);
                      }}
                      className="flex-1 min-w-0 px-2 py-1 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-slate-400">~</span>
                    <input
                      type="date"
                      value={dueTo}
                      onChange={(e) => {
                        setDueTo(e.target.value);
                        setPage(1);
                      }}
                      className="flex-1 min-w-0 px-2 py-1 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2 text-sm text-slate-500">
                  <span className="font-semibold text-slate-600">人员筛选</span>
                  <div className="flex flex-col gap-2">
                    <select
                      value={creatorUserId}
                      onChange={(e) => {
                        setCreatorUserId(e.target.value);
                        setPage(1);
                      }}
                      disabled={selectedDept === 'all' || deptUsersLoading || deptUsers.length === 0}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
                    >
                      {selectedDept === 'all' ? (
                        <option value=''>请先选择部门</option>
                      ) : deptUsersLoading ? (
                        <option value=''>正在加载部门成员...</option>
                      ) : deptUsers.length === 0 ? (
                        <option value=''>该部门暂无成员</option>
                      ) : (
                        <>
                          <option value=''>全部提交人</option>
                          {deptUsers.map((user) => {
                            if (!user.email) return null;
                            const displayName = user.name || user.email.split('@')[0];
                            return (
                              <option key={user.id} value={String(user.id)}>
                                {displayName}（{user.email}）
                              </option>
                            );
                          })}
                        </>
                      )}
                    </select>

                    <select
                      value={assigneeUserId}
                      onChange={(e) => {
                        setAssigneeUserId(e.target.value);
                        setPage(1);
                      }}
                      disabled={selectedDept === 'all' || deptUsersLoading || deptUsers.length === 0}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
                    >
                      {selectedDept === 'all' ? (
                        <option value=''>请先选择部门</option>
                      ) : deptUsersLoading ? (
                        <option value=''>正在加载部门成员...</option>
                      ) : deptUsers.length === 0 ? (
                        <option value=''>该部门暂无成员</option>
                      ) : (
                        <>
                          <option value=''>全部执行人</option>
                          {deptUsers.map((user) => {
                            if (!user.email) return null;
                            const displayName = user.name || user.email.split('@')[0];
                            return (
                              <option key={user.id} value={String(user.id)}>
                                {displayName}（{user.email}）
                              </option>
                            );
                          })}
                        </>
                      )}
                    </select>
                  </div>
                </div>

                {dynamicFilterFields.length > 0 && (
                  <div className="flex flex-col gap-2 border-t border-slate-100 pt-4 text-xs text-slate-500">
                    <div className="font-semibold text-slate-600">高级筛选（按部门自定义字段）</div>
                    <div className="flex flex-col gap-3">
                      {dynamicFilterFields.map((field) => {
                        const value = dynamicFilters[field.id] || '';
                        const handleChange = (next: string) => {
                          setDynamicFilters((prev) => ({ ...prev, [field.id]: next }));
                          setPage(1);
                        };

                        if (field.type === 'select' || field.type === 'multi_select') {
                          return (
                            <div key={field.id} className="flex flex-col gap-2">
                              <span className="whitespace-nowrap text-slate-600">{field.label}</span>
                              <select
                                value={value}
                                onChange={(e) => handleChange(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                <option value=''>全部</option>
                                {(field.options || []).map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </select>
                            </div>
                          );
                        }

                        if (field.type === 'date') {
                          return (
                            <div key={field.id} className="flex flex-col gap-2">
                              <span className="whitespace-nowrap text-slate-600">{field.label}</span>
                              <input
                                type="date"
                                value={value}
                                onChange={(e) => handleChange(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          );
                        }

                        if (field.type === 'boolean') {
                          return (
                            <div key={field.id} className="flex flex-col gap-2">
                              <span className="whitespace-nowrap text-slate-600">{field.label}</span>
                              <select
                                value={value}
                                onChange={(e) => handleChange(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                <option value=''>全部</option>
                                <option value='true'>是</option>
                                <option value='false'>否</option>
                              </select>
                            </div>
                          );
                        }

                        return (
                          <div key={field.id} className="flex flex-col gap-2">
                            <span className="whitespace-nowrap text-slate-600">{field.label}</span>
                            <input
                              type={field.type === 'number' ? 'number' : 'text'}
                              value={value}
                              onChange={(e) => handleChange(e.target.value)}
                              placeholder={field.placeholder || '请输入筛选条件'}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-center mt-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={resetAllFilters}
                      className="px-4 py-2 text-sm font-bold rounded-full border border-slate-200 bg-white text-slate-700"
                    >
                      清除筛选
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setOnlyMyCreated((prev) => !prev);
                        setPage(1);
                      }}
                      className={`px-4 py-2 text-sm font-bold rounded-full border transition-colors ${
                        onlyMyCreated
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      只看我提交的
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFiltersOpen(false)}
                    className="px-4 py-2 text-sm font-bold rounded-full bg-slate-900 text-white"
                  >
                    完成
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 移动端卡片视图 */}
      <div className="md:hidden space-y-4">
        {loading && (
          <div className="w-full text-center py-2 text-xs text-slate-400">正在加载数据...</div>
        )}
        {demands.map((demand) => {
          const deptName =
            departments.find((d) => d.id === demand.departmentId)?.name || "Unknown";
          return (
            <div
              key={demand.id}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm active:scale-[0.98] transition-transform"
              onClick={() => router.push(`/demands/${demand.id}`)}
            >
              <div className="flex justify-between items-start mb-3">
                <div className="font-mono text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded">
                  {demand.id}
                </div>
                <div className="flex gap-2">
                  <span
                    className={`px-2 py-0.5 rounded border text-xs font-bold ${getPriorityColor(
                      demand.priority,
                    )}`}
                  >
                    {demand.priority}
                  </span>
                  {getStatusBadge(demand.status)}
                </div>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">{demand.title}</h3>
              <p className="text-sm text-slate-500 mb-4 line-clamp-2">{demand.description}</p>

              <div className="flex flex-col gap-2 pt-4 border-t border-slate-100 text-sm text-slate-600">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-slate-400" />
                  <span className="text-xs text-slate-400">提交人</span>
                  <span className="font-medium">{demand.creatorName || demand.creatorId}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-400" />
                    <span className="text-xs text-slate-400">执行人</span>
                    <span className="font-medium text-slate-700">
                      {demand.assigneeName || demand.assigneeId || '未指定'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <span className="text-xs text-slate-400">截止</span>
                    <span>{demand.dueDate}</span>
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-3 flex justify-end gap-2">
                <button
                  className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-50 rounded-lg border border-slate-200"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/demands/${demand.id}`);
                  }}
                >
                  详情
                </button>
                <button
                  className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg shadow-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/demands/${demand.id}`);
                  }}
                >
                  编辑
                </button>
                <button
                  className="px-3 py-1.5 text-sm font-medium text-rose-600 bg-rose-50 rounded-lg border border-rose-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteError(null);
                    setDeleteTargetDemand(demand);
                  }}
                >
                  删除
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <Modal
        isOpen={importModalOpen}
        onClose={() => {
          if (importing) return;
          setImportModalOpen(false);
        }}
        title="导入需求（单部门）"
      >
        <div className="space-y-4 text-sm text-slate-700">
          <p className="text-xs text-slate-500">
            说明：一次导入只针对一个部门，请先选择部门，再按模板准备 CSV 文件。列头至少需要包含「标题」「提交人邮箱」「执行人邮箱」，其它列可选。
          </p>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-600">导入部门</label>
            <div className="flex items-center gap-2">
              <select
                value={importDepartmentId}
                onChange={(event) => setImportDepartmentId(event.target.value)}
                disabled={importing}
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
              >
                <option value="">请选择部门</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleDownloadImportTemplate}
                disabled={!importDepartmentId || importing}
                className="px-3 py-2 text-xs font-bold rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
              >
                下载模板
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-600">选择 CSV 文件</label>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleImportFileChange}
              disabled={importing}
              className="block w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {importFileName && (
              <p className="text-xs text-slate-500">已选择文件：{importFileName}</p>
            )}
          </div>

          {importError && (
            <div className="text-xs text-rose-600 bg-rose-50 border border-rose-100 px-3 py-2 rounded-lg">
              {importError}
            </div>
          )}

          {importResult && (
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-700">导入结果：</span>
                <span className="text-emerald-700">成功 {importResult.successCount} 条</span>
                <span className="text-rose-700">失败 {importResult.failCount} 条</span>
              </div>
              {importResult.failCount > 0 && (
                <div className="max-h-40 overflow-y-auto border border-slate-100 rounded-lg bg-slate-50 px-3 py-2 space-y-1">
                  {importResult.results
                    .filter((item) => !item.success)
                    .map((item) => (
                      <div key={item.rowNumber} className="text-[11px] text-slate-600">
                        第 {item.rowNumber} 行：{item.message || "未知错误"}
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          <div className="pt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                if (importing) return;
                setImportModalOpen(false);
              }}
              disabled={importing}
              className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSubmitImport}
              disabled={importing}
              className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {importing ? "导入中..." : "开始导入"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!deleteTargetDemand}
        onClose={() => {
          if (deleteSubmitting) return;
          setDeleteTargetDemand(null);
          setDeleteError(null);
        }}
        title="确认删除需求"
      >
        <div className="space-y-4">
          {deleteError && (
            <div className="text-xs text-rose-600 bg-rose-50 border border-rose-100 px-3 py-2 rounded-lg">
              {deleteError}
            </div>
          )}
          <p className="text-sm text-slate-600">
            确认要删除
            <span className="font-bold mx-1">{deleteTargetDemand?.title}</span>
            吗？删除后将无法在列表中继续查看该需求，相关评分记录和评论不会自动清理，请谨慎操作。
          </p>
          <div className="pt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                if (deleteSubmitting) return;
                setDeleteTargetDemand(null);
                setDeleteError(null);
              }}
              disabled={deleteSubmitting}
              className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleConfirmDeleteDemand}
              disabled={deleteSubmitting}
              className="px-4 py-2 bg-rose-600 text-white font-bold rounded-lg hover:bg-rose-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {deleteSubmitting ? "删除中..." : "确认删除"}
            </button>
          </div>
        </div>
      </Modal>

      {/* 分页信息 */}
      <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
        <div>
          共 {total} 条，当前第 {page} / {maxPage} 页
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={page <= 1 || loading}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium"
          >
            上一页
          </button>
          <button
            type="button"
            onClick={() => setPage((prev) => (prev >= maxPage ? prev : prev + 1))}
            disabled={page >= maxPage || loading}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium"
          >
            下一页
          </button>
        </div>
      </div>
    </div>
  );
}
