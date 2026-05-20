"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Download,
  Search,
  Sparkles,
  Calendar,
  User,
  Copy,
  X,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  FileText,
  PackageCheck,
} from "lucide-react";
import { DemandStatus, Priority, Department, Demand, FieldDefinition, type DemandType, type DepartmentWorkflowConfig } from "../../../types";
import { getSupabaseClient } from "../../../lib/supabase";
import { authorizedFetch } from "../../../lib/authFetch";
import { loadClientBusinessUser } from "../../../lib/clientBusinessUser";
import Badge from "../../../components/ui/Badge";
import Modal from "../../../components/ui/Modal";
import {
  getCreativeDemandTypeCodes,
  resolveCreativeDemandRole,
  type CreativeDemandRole,
} from "../../../lib/creativeDemandAccess";

const normalizePriorityForRealtime = (raw: any): string => {
  const value = (raw ?? "").toString();
  if (value.includes("紧急")) return "紧急";
  if (value.includes("高")) return "高";
  if (value.includes("中")) return "中";
  if (value.includes("低")) return "低";
  return value || "中";
};

const mapRealtimeRowToDemand = (row: any): Demand => {
  const fields = (row.fields || {}) as any;

  const code: string =
    fields.code || `REQ-${String(row.id ?? "").toString().padStart(4, "0")}`;
  const description: string = fields.description || "";
  const priorityFromDb = (row.priority as string | null) || fields.priority || "";
  const priority = normalizePriorityForRealtime(priorityFromDb) as Priority;
  const dueDate: string = fields.dueDate || "";
  const departmentId: string =
    row.department_id !== undefined && row.department_id !== null
      ? String(row.department_id)
      : fields.departmentKey || "d1";
  const creatorId: string = fields.creatorCode || `U${row.creator_id ?? ""}`;
  const assigneeId: string | undefined = fields.assigneeCode;

  const {
    code: _c,
    description: _d,
    priority: _p,
    dueDate: _dd,
    departmentKey: _dk,
    creatorCode: _cc,
    assigneeCode: _ac,
    ...rest
  } = fields;

  const createdAt =
    row.created_at && typeof row.created_at === "string"
      ? new Date(row.created_at).toISOString().slice(0, 10)
      : "";

  const status = ((row.status as string) || "pending") as DemandStatus;

  return {
    id: code,
    title: row.title as string,
    description,
    departmentId,
    creatorId,
    assigneeId,
    creatorUserId: typeof row.creator_id === "number" ? (row.creator_id as number) : undefined,
    assigneeUserId: typeof row.assignee_id === "number" ? (row.assignee_id as number) : undefined,
    status,
    priority,
    createdAt,
    dueDate,
    customFields: Object.keys(rest).length ? rest : undefined,
  };
};

export default function DemandsPage() {

  const router = useRouter();

  const [relationshipView, setRelationshipView] = useState<"all" | "created" | "assigned">("all");
  const [selectedDept, setSelectedDept] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedPriority, setSelectedPriority] = useState<string>("all");
  const [onlyMyCreated, setOnlyMyCreated] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");
  const [selectedDemandTypeId, setSelectedDemandTypeId] = useState("");

  const [departments, setDepartments] = useState<Department[]>([]);
  const [demandTypes, setDemandTypes] = useState<DemandType[]>([]);
  const [demands, setDemands] = useState<Demand[]>([]);
  const [currentUserCode, setCurrentUserCode] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [currentUserDepartmentId, setCurrentUserDepartmentId] = useState<number | null>(null);
  const [currentUserPosition, setCurrentUserPosition] = useState<string | null>(null);
  const [currentUserPermissions, setCurrentUserPermissions] = useState<string[]>([]);
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
  const [previewFieldLabels, setPreviewFieldLabels] = useState<Record<string, string>>({});
  const [dynamicFilters, setDynamicFilters] = useState<Record<string, string>>({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [workflowConfig, setWorkflowConfig] = useState<DepartmentWorkflowConfig | null>(null);


  const [deleteTargetDemand, setDeleteTargetDemand] = useState<Demand | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [previewDemand, setPreviewDemand] = useState<Demand | null>(null);
  const [previewAssigneeEmail, setPreviewAssigneeEmail] = useState("");
  const [previewAssigning, setPreviewAssigning] = useState(false);
  const [previewAssignError, setPreviewAssignError] = useState<string | null>(null);
  const [previewDeptUsers, setPreviewDeptUsers] = useState<{
    id: number;
    name: string | null;
    email: string | null;
  }[]>([]);
  const [previewDeptUsersLoading, setPreviewDeptUsersLoading] = useState(false);
  const [previewWorkflowConfig, setPreviewWorkflowConfig] = useState<DepartmentWorkflowConfig | null>(null);
  const [previewWorkflowLoading, setPreviewWorkflowLoading] = useState(false);
  const [previewStatusValue, setPreviewStatusValue] = useState("");
  const [previewStatusUpdating, setPreviewStatusUpdating] = useState(false);
  const [previewStatusError, setPreviewStatusError] = useState<string | null>(null);

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

  const selectedPreviewIndex = previewDemand
    ? demands.findIndex((demand) => demand.id === previewDemand.id)
    : -1;

  const creativeDepartment = departments.find((department) => department.slug === "design") || null;
  const isCreativeDemand = (demand: Demand | null) =>
    !!demand && !!creativeDepartment && demand.departmentId === creativeDepartment.id;
  const isCurrentUserCreativeMember =
    !!creativeDepartment &&
    !!currentUserDepartmentId &&
    currentUserDepartmentId === Number(creativeDepartment.id);
  const creativeDemandRole: CreativeDemandRole = isCurrentUserCreativeMember
    ? resolveCreativeDemandRole({
        role: currentUserRole,
        position: currentUserPosition,
      })
    : null;
  const creativeAllowedDemandTypeCodes = getCreativeDemandTypeCodes(creativeDemandRole);
  const isCreativeRoleRestricted =
    isCurrentUserCreativeMember && creativeDemandRole !== "all" && creativeAllowedDemandTypeCodes.length > 0;
  const creativeRoleLabel =
    creativeDemandRole === "video"
      ? "视频剪辑需求"
      : creativeDemandRole === "design"
        ? "UI / 美工 / Banner 需求"
        : "";

  const resetAllFilters = () => {
    setSelectedDept("all");
    setSelectedStatus("all");
    setSelectedPriority("all");
    setWorkflowConfig(null);
    setOnlyMyCreated(false);
    setRelationshipView("all");
    setSearchQuery("");
    setCreatedFrom("");
    setCreatedTo("");
    setDueFrom("");
    setDueTo("");
    setSelectedDemandTypeId("");
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
    const loadCurrentUser = async () => {
      try {
        const user = await loadClientBusinessUser();
        const email = user?.email || "";
        if (email) {
          const code = email.split("@")[0]?.toUpperCase() || "";
          if (code) {
            setCurrentUserCode(code);
          }
        }

        if (!user) {
          return;
        }
        if (typeof user.id === "number") {
          setCurrentUserId(user.id);
        }
        setCurrentUserRole(user.role || null);
        setCurrentUserDepartmentId(
          typeof user.departmentId === "number" ? user.departmentId : null,
        );
        setCurrentUserPosition(user.position || null);
        if (Array.isArray(user.permissions)) {
          setCurrentUserPermissions(user.permissions);
        }
      } catch (e) {
        console.error("load current user error", e);
      }
    };

    loadCurrentUser();
  }, []);

  useEffect(() => {
    if (selectedDept === "all") {
      setWorkflowConfig(null);
      return;
    }

    const loadWorkflowConfig = async () => {
      try {
        const res = await authorizedFetch(
          `/api/departments/${encodeURIComponent(selectedDept)}/workflow-config`
        );
        if (!res.ok) {
          console.error("load workflow config for demands list error", await res.text());
          setWorkflowConfig(null);
          return;
        }
        const json = await res.json();
        const cfg = (json.config || null) as DepartmentWorkflowConfig | null;
        if (!cfg || !Array.isArray(cfg.statuses) || !Array.isArray(cfg.priorities)) {
          setWorkflowConfig(null);
          return;
        }
        const sorted: DepartmentWorkflowConfig = {
          priorities: [...cfg.priorities].sort((a, b) => a.order - b.order),
          statuses: [...cfg.statuses].sort((a, b) => a.order - b.order),
        };
        setWorkflowConfig(sorted);

      } catch (e) {
        console.error("load workflow config for demands list error", e);
        setWorkflowConfig(null);
      }
    };

    loadWorkflowConfig();
  }, [selectedDept]);

  useEffect(() => {
    if (selectedDept === "all") {
      setDeptUsers([]);
      setDynamicFilterFields([]);
      setDemandTypes([]);
      setSelectedDemandTypeId("");
      setDynamicFilters({});
      setCreatorUserId("");
      setAssigneeUserId("");
      return;
    }

    const loadDeptMeta = async () => {
      try {
        setDeptUsersLoading(true);
        const [fieldsRes, usersRes, demandTypesRes] = await Promise.all([
          authorizedFetch(`/api/department-fields?departmentId=${encodeURIComponent(selectedDept)}`),
          authorizedFetch(`/api/users/by-department?departmentId=${encodeURIComponent(selectedDept)}`),
          authorizedFetch(`/api/departments/${encodeURIComponent(selectedDept)}/demand-types`),
        ]);

        if (fieldsRes.ok) {
          const json = await fieldsRes.json();
          const items = (json.items || []) as FieldDefinition[];
          setPreviewFieldLabels((prev) => {
            const next = { ...prev };
            for (const field of items) {
              next[`${selectedDept}:${field.id}`] = field.label;
              next[field.id] = field.label;
            }
            return next;
          });
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

        if (demandTypesRes.ok) {
          const json = await demandTypesRes.json();
          setDemandTypes(Array.isArray(json.items) ? json.items : []);
        } else {
          setDemandTypes([]);
        }
      } catch (e) {
        console.error("load department meta for filters error", e);
        setDynamicFilterFields([]);
        setDeptUsers([]);
        setDemandTypes([]);
      } finally {
        setDeptUsersLoading(false);
      }
    };

    loadDeptMeta();
  }, [selectedDept]);

  useEffect(() => {
    if (!creativeDepartment || !isCreativeRoleRestricted) {
      return;
    }
    if (selectedDept !== creativeDepartment.id) {
      setSelectedDept(creativeDepartment.id);
      setSelectedDemandTypeId("");
      setPage(1);
    }
  }, [creativeDepartment, isCreativeRoleRestricted, selectedDept]);

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
        if (selectedPriority !== "all") {
          params.set("priority", selectedPriority);
        }
        const createdByMe = relationshipView === "created";
        const assignedToMe = relationshipView === "assigned";

        if (onlyMyCreated && currentUserCode) {
          params.set("creatorCode", currentUserCode);
        }
        if (createdByMe && currentUserId) {
          params.set("creatorUserId", String(currentUserId));
        }
        if (assignedToMe && currentUserId) {
          params.set("assigneeUserId", String(currentUserId));
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
        if (selectedDemandTypeId) {
          params.set("demandTypeId", selectedDemandTypeId);
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
        const items = (json.items || []) as Demand[];
        setDemands(items);
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
    if ((relationshipView === "created" || relationshipView === "assigned") && !currentUserId) {
      return;
    }

    fetchDemands();

    return () => controller.abort();
  }, [
    searchQuery,
    selectedDept,
    selectedStatus,
    selectedPriority,
    relationshipView,
    onlyMyCreated,
    currentUserCode,
    currentUserId,
    creatorUserId,
    assigneeUserId,
    dynamicFilters,
    page,
    pageSize,
    createdFrom,
    createdTo,
    dueFrom,
    dueTo,
    selectedDemandTypeId,
  ]);

  useEffect(() => {
    const supabase = getSupabaseClient();

    const channel = supabase
      .channel("demands-list-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "demands",
        } as any,
        (payload) => {
          const row = (payload as any).new;
          if (!row) {
            return;
          }
          const mapped = mapRealtimeRowToDemand(row);

          const createdByMe = relationshipView === "created";
          const assignedToMe = relationshipView === "assigned";

          if (onlyMyCreated && currentUserCode) {
            const creatorCode = (mapped.creatorId || "").toString().toUpperCase();
            if (creatorCode !== currentUserCode.toUpperCase()) {
              return;
            }
          }

          if (createdByMe && currentUserId && mapped.creatorUserId !== currentUserId) {
            return;
          }

          if (assignedToMe && currentUserId && mapped.assigneeUserId !== currentUserId) {
            return;
          }

          if (selectedStatus !== "all" && mapped.status !== selectedStatus) {
            return;
          }

          if (selectedPriority !== "all" && mapped.priority !== selectedPriority) {
            return;
          }

          if (creatorUserId) {
            if (mapped.creatorId !== creatorUserId) {
              return;
            }
          }

          if (assigneeUserId) {
            if (mapped.assigneeId !== assigneeUserId) {
              return;
            }
          }

          setDemands((prev) => {
            if (prev.some((item) => item.id === mapped.id)) {
              return prev;
            }
            const next = [mapped, ...prev];
            if (next.length > pageSize) {
              next.pop();
            }
            return next;
          });
          setTotal((prev) => prev + 1);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "demands",
        } as any,
        (payload) => {
          const row = (payload as any).new;
          if (!row) {
            return;
          }

          const mapped = mapRealtimeRowToDemand(row);
          setDemands((prev) =>
            prev.map((item) => (item.id === mapped.id ? { ...item, ...mapped } : item))
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "demands",
        } as any,
        (payload) => {
          const row = (payload as any).old;
          if (!row) {
            return;
          }
          const fields = (row.fields || {}) as any;
          const id: string | null =
            (fields.code as string | undefined) ||
            (typeof row.id !== "undefined" && row.id !== null
              ? `REQ-${String(row.id ?? "").toString().padStart(4, "0")}`
              : null);
          if (!id) {
            return;
          }
          setDemands((prev) => prev.filter((item) => item.id !== id));
          setTotal((prev) => Math.max(0, prev - 1));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [
    selectedDept,
    selectedStatus,
    selectedPriority,
    relationshipView,
    onlyMyCreated,
    currentUserCode,
    currentUserId,
    creatorUserId,
    assigneeUserId,
    searchQuery,
    createdFrom,
    createdTo,
    dueFrom,
    dueTo,
    dynamicFilters,
    pageSize,
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

  const getStatusBadge = (status: string, labelOverride?: string) => {
    const normalized: DemandStatus = (() => {
      // 支持英文数据库值和中文旧值
      switch (status) {
        case "unassigned":
          return "待负责人分配" as DemandStatus;
        case "pending":
          return DemandStatus.PENDING;
        case "in_progress":
          return DemandStatus.IN_PROGRESS;
        case "review":
          return DemandStatus.REVIEW;
        case "done":
          return DemandStatus.DONE;
        case "closed":
          return DemandStatus.CLOSED;
        case "delayed":
          return DemandStatus.DELAYED;
        case "ignored":
          return DemandStatus.IGNORED;
        default: {
          const all = Object.values(DemandStatus) as string[];
          if (all.includes(status)) {
            return status as DemandStatus;
          }
          return DemandStatus.PENDING;
        }
      }
    })();

    let variant: any = "default";
    if (normalized === DemandStatus.DONE || normalized === DemandStatus.CLOSED) variant = "success";
    if (normalized === DemandStatus.IN_PROGRESS) variant = "warning";
    if (normalized === DemandStatus.PENDING || normalized === DemandStatus.REVIEW) variant = "outline";
    if (normalized === DemandStatus.DELAYED) variant = "warning";
    if (normalized === DemandStatus.IGNORED) variant = "outline";

    return <Badge variant={variant}>{labelOverride || normalized}</Badge>;
  };

  const normalizeStatusLabel = (label?: string | null) => {
    const value = (label || "").toString();
    if (value === "unassigned") {
      return "待负责人分配";
    }
    return value;
  };

  const renderStatusBadge = (demand: Demand) => {
    const rawStatus = (demand.status as string) || "";
    const labelFromApi = normalizeStatusLabel(demand.statusLabel || "");
    const colorFromApi = demand.statusColor || "";

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

    if (labelFromApi) {
      return getStatusBadge(rawStatus, labelFromApi);
    }

    return getStatusBadge(rawStatus);
  };

  const renderPriorityBadge = (demand: Demand) => {
    const labelFromApi = demand.priorityLabel || "";
    const colorFromApi = demand.priorityColor || "";

    if (labelFromApi && colorFromApi) {
      return (
        <span
          className="inline-flex items-center px-2.5 py-1 rounded-md border text-xs font-bold"
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

    if (labelFromApi) {
      return (
        <span className="px-2.5 py-1 rounded-md border text-xs font-bold text-slate-700 bg-slate-50 border-slate-200">
          {labelFromApi}
        </span>
      );
    }

    return (
      <span
        className={`px-2.5 py-1 rounded-md border text-xs font-bold ${getPriorityColor(demand.priority as Priority)}`}
      >
        {demand.priority}
      </span>
    );
  };

  const renderRelationshipBadges = (demand: Demand) => {
    let label = "";
    const assignedToMe = currentUserId && demand.assigneeUserId === currentUserId;
    const createdByMe = currentUserId && demand.creatorUserId === currentUserId;

    if (assignedToMe) {
      label = "指派给我";
    } else if (createdByMe) {
      label = "我提交";
    }

    if (!label) {
      return null;
    }

    return (
      <div className="mt-2">
        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
          {label}
        </span>
      </div>
    );
  };


  const allPriorityOptions = React.useMemo(
    () => {
      if (selectedDept !== "all" && workflowConfig && workflowConfig.priorities.length > 0) {
        return workflowConfig.priorities.map((p) => ({
          value: p.value,
          label: p.label,
        }));
      }

      return [
        { value: Priority.CRITICAL, label: Priority.CRITICAL },
        { value: Priority.HIGH, label: Priority.HIGH },
        { value: Priority.MEDIUM, label: Priority.MEDIUM },
        { value: Priority.LOW, label: Priority.LOW },
      ];
    },
    [selectedDept, workflowConfig]
  );

  const allStatusOptions = React.useMemo(
    () => {
      if (selectedDept !== "all" && workflowConfig && workflowConfig.statuses.length > 0) {
        return workflowConfig.statuses.map((s) => ({
          value: s.value,
          label: s.label,
        }));
      }

      return [
        { value: DemandStatus.PENDING, label: DemandStatus.PENDING },
        { value: DemandStatus.IN_PROGRESS, label: DemandStatus.IN_PROGRESS },
        { value: DemandStatus.DONE, label: DemandStatus.DONE },
        { value: DemandStatus.DELAYED, label: DemandStatus.DELAYED },
        { value: DemandStatus.IGNORED, label: DemandStatus.IGNORED },
      ];
    },
    [selectedDept, workflowConfig]
  );

  const canViewAllDemands = currentUserPermissions.includes("demand.view_all");
  const canViewDepartmentDemands = currentUserPermissions.includes("demand.view_department");
  const canViewPersonalDemands =
    currentUserPermissions.includes("demand.view_personal") ||
    currentUserPermissions.includes("demand.create");
  const canDeleteAnyDemand = currentUserPermissions.includes("demand.delete");
  const canDeleteDemand = (demand: Demand) =>
    canDeleteAnyDemand || (!!currentUserId && demand.creatorUserId === currentUserId);
  const canUpdatePreviewStatus = (demand: Demand | null) => {
    if (!demand) return false;
    if (currentUserRole === "admin") return true;
    if (!currentUserDepartmentId || Number(demand.departmentId) !== currentUserDepartmentId) {
      return false;
    }
    return currentUserRole === "manager" || demand.assigneeUserId === currentUserId;
  };
  const canAssignPreviewDemand = (demand: Demand | null) => {
    if (!demand) return false;
    if (currentUserRole === "admin") return true;
    if (!currentUserDepartmentId || Number(demand.departmentId) !== currentUserDepartmentId) {
      return false;
    }
    const department = departments.find((item) => item.id === demand.departmentId);
    if (department?.slug === "design") return true;
    return currentUserRole === "manager";
  };
  const availableRelationshipViews = React.useMemo(() => {
    const views: Array<{ key: "all" | "created" | "assigned"; label: string }> = [];
    if (canViewAllDemands || canViewDepartmentDemands) {
      views.push({ key: "all", label: "全部需求" });
    }
    if (canViewPersonalDemands) {
      views.push({ key: "created", label: "我提交的" });
      views.push({ key: "assigned", label: "指派给我的" });
    }
    return views;
  }, [canViewAllDemands, canViewDepartmentDemands, canViewPersonalDemands]);

  useEffect(() => {
    if (!availableRelationshipViews.length) {
      return;
    }

    const canKeepCurrent = availableRelationshipViews.some((item) => item.key === relationshipView);
    if (canKeepCurrent) {
      return;
    }

    const preferred = availableRelationshipViews.find((item) => item.key === "created");
    setRelationshipView((preferred?.key || availableRelationshipViews[0].key) as "all" | "created" | "assigned");
  }, [availableRelationshipViews, relationshipView]);

  const previewStatusOptions = React.useMemo(() => {
    if (!previewDemand) return [];
    const statuses = previewWorkflowConfig?.statuses || [];
    if (statuses.length === 0) {
      return allStatusOptions.filter((status) => status.value !== "all");
    }

    return statuses.map((status) => ({
      value: status.value,
      label: status.label,
    }));
  }, [allStatusOptions, previewDemand, previewWorkflowConfig]);


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
      setPreviewDemand((prev) => (prev?.id === deleteTargetDemand.id ? null : prev));
      setDeleteTargetDemand(null);
    } catch (e) {
      console.error("delete demand from list error", e);
      setDeleteError("删除失败，请检查网络后重试");
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const handleCopyDemand = async (demand: Demand) => {
    try {
      const res = await authorizedFetch(`/api/demands/${encodeURIComponent(demand.id)}/copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        console.error("copy demand error", await res.text());
        return;
      }
      const json = await res.json();
      const newId = json?.demand?.id as string | undefined;
      if (newId) {
        router.push(`/demands/${newId}`);
      }
    } catch (e) {
      console.error("copy demand error", e);
    }
  };

  const handlePreviewAssignAssignee = async () => {
    if (!previewDemand || !previewAssigneeEmail.trim() || previewAssigning) return;
    try {
      setPreviewAssigning(true);
      setPreviewAssignError(null);
      const res = await authorizedFetch(`/api/demands/${encodeURIComponent(previewDemand.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assigneeEmail: previewAssigneeEmail.trim(),
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("assign demand from preview error", text);
        setPreviewAssignError("分配执行人失败，请稍后重试");
        return;
      }

      const json = await res.json();
      const updatedDemand = json.demand as Demand | undefined;
      if (!updatedDemand) return;

      setDemands((prev) =>
        prev.map((demand) => (demand.id === updatedDemand.id ? updatedDemand : demand)),
      );
      setPreviewDemand(updatedDemand);
      setPreviewAssigneeEmail("");
    } catch (e) {
      console.error("assign demand from preview error", e);
      setPreviewAssignError("分配执行人失败，请检查网络后重试");
    } finally {
      setPreviewAssigning(false);
    }
  };

  const handlePreviewStatusChange = async () => {
    if (!previewDemand || !previewStatusValue || previewStatusValue === previewDemand.status || previewStatusUpdating) {
      return;
    }
    try {
      setPreviewStatusUpdating(true);
      setPreviewStatusError(null);
      const res = await authorizedFetch(`/api/demands/${encodeURIComponent(previewDemand.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: previewStatusValue,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("update demand status from preview error", text);
        setPreviewStatusError("状态更新失败，请稍后重试");
        return;
      }

      const json = await res.json();
      const updatedDemand = json.demand as Demand | undefined;
      if (!updatedDemand) return;

      setDemands((prev) =>
        prev.map((demand) => (demand.id === updatedDemand.id ? updatedDemand : demand)),
      );
      setPreviewDemand(updatedDemand);
      setPreviewStatusValue(updatedDemand.status || "");
    } catch (e) {
      console.error("update demand status from preview error", e);
      setPreviewStatusError("状态更新失败，请检查网络后重试");
    } finally {
      setPreviewStatusUpdating(false);
    }
  };

  const openDemandPreview = (demand: Demand) => {
    setPreviewDemand(demand);
    setPreviewAssigneeEmail("");
    setPreviewAssignError(null);
    setPreviewStatusValue(demand.status || "");
    setPreviewStatusError(null);
  };

  useEffect(() => {
    if (!previewDemand) {
      setPreviewDeptUsers([]);
      setPreviewWorkflowConfig(null);
      return;
    }

    const departmentId = previewDemand.departmentId;
    const loadPreviewDepartmentMeta = async () => {
      try {
        setPreviewDeptUsersLoading(true);
        setPreviewWorkflowLoading(true);
        const [usersRes, workflowRes] = await Promise.all([
          authorizedFetch(
          `/api/users/by-department?departmentId=${encodeURIComponent(departmentId)}`,
          ),
          authorizedFetch(
            `/api/departments/${encodeURIComponent(departmentId)}/workflow-config`,
          ),
        ]);

        if (!usersRes.ok) {
          console.error("load preview department users error", await usersRes.text());
          setPreviewDeptUsers([]);
        } else {
          const json = await usersRes.json();
          const items = (json.items || []) as {
            id: number;
            name: string | null;
            email: string | null;
          }[];
          setPreviewDeptUsers(items);
        }

        if (!workflowRes.ok) {
          console.error("load preview workflow config error", await workflowRes.text());
          setPreviewWorkflowConfig(null);
        } else {
          const json = await workflowRes.json();
          const cfg = (json.config || null) as DepartmentWorkflowConfig | null;
          if (!cfg || !Array.isArray(cfg.statuses) || !Array.isArray(cfg.priorities)) {
            setPreviewWorkflowConfig(null);
          } else {
            setPreviewWorkflowConfig({
              priorities: [...cfg.priorities].sort((a, b) => a.order - b.order),
              statuses: [...cfg.statuses].sort((a, b) => a.order - b.order),
            });
          }
        }
      } catch (e) {
        console.error("load preview department meta error", e);
        setPreviewDeptUsers([]);
        setPreviewWorkflowConfig(null);
      } finally {
        setPreviewDeptUsersLoading(false);
        setPreviewWorkflowLoading(false);
      }
    };

    loadPreviewDepartmentMeta();
  }, [previewDemand?.departmentId]);

  useEffect(() => {
    if (!previewDemand) return;
    const departmentId = previewDemand.departmentId;
    const cacheKey = `${departmentId}:${previewDemand.demandTypeId || "active"}:__loaded`;
    if (previewFieldLabels[cacheKey]) return;

    const loadPreviewFieldLabels = async () => {
      try {
        const params = new URLSearchParams({ departmentId });
        if (previewDemand.demandTypeId) {
          params.set("demandTypeId", String(previewDemand.demandTypeId));
        }
        const res = await authorizedFetch(`/api/department-fields?${params.toString()}`);
        if (!res.ok) {
          console.error("load preview field labels error", await res.text());
          return;
        }
        const json = await res.json();
        const items = (json.items || []) as FieldDefinition[];
        setPreviewFieldLabels((prev) => {
          const next = { ...prev, [cacheKey]: "1" };
          for (const field of items) {
            next[`${departmentId}:${field.id}`] = field.label;
            next[field.id] = field.label;
          }
          return next;
        });
      } catch (e) {
        console.error("load preview field labels error", e);
      }
    };

    loadPreviewFieldLabels();
  }, [previewDemand, previewFieldLabels]);

  const showAdjacentPreviewDemand = (direction: "prev" | "next") => {
    if (selectedPreviewIndex < 0) return;
    const nextIndex = direction === "prev" ? selectedPreviewIndex - 1 : selectedPreviewIndex + 1;
    if (nextIndex < 0 || nextIndex >= demands.length) return;
    setPreviewDemand(demands[nextIndex]);
  };

  const getFieldLabel = (key: string, demand?: Demand | null) => {
    const departmentLabel = demand?.departmentId ? previewFieldLabels[`${demand.departmentId}:${key}`] : "";
    if (departmentLabel) return departmentLabel;
    if (previewFieldLabels[key]) return previewFieldLabels[key];
    const field = dynamicFilterFields.find((item) => item.id === key || item.label === key);
    return field?.label || key;
  };

  const normalizePreviewValue = (value: any): string => {
    if (value === null || value === undefined || value === "") return "";
    if (Array.isArray(value)) {
      return value
        .map((item) => normalizePreviewValue(item))
        .filter(Boolean)
        .join("，");
    }
    if (typeof value === "object") {
      if (typeof value.name === "string") return value.name;
      if (typeof value.url === "string") return value.url;
      if (typeof value.label === "string") return value.label;
      return JSON.stringify(value);
    }
    return String(value);
  };

  const isLikelyAssetField = (label: string, value: string) => {
    const text = `${label} ${value}`.toLowerCase();
    return (
      text.includes("素材") ||
      text.includes("参考图") ||
      text.includes("附件") ||
      text.includes("白底图") ||
      text.includes("psd") ||
      text.includes("图片") ||
      text.includes("链接") ||
      text.includes("url") ||
      text.includes("http")
    );
  };

  const getPreviewFields = (demand: Demand | null) => {
    if (!demand?.customFields) return [];
    const hiddenKeys = new Set([
      "assigneeEmail",
      "assigneeCode",
      "creatorEmail",
      "creatorCode",
      "departmentKey",
      "priority",
      "dueDate",
      "description",
      "code",
    ]);
    return Object.entries(demand.customFields)
      .filter(([key]) => !hiddenKeys.has(key))
      .map(([key, value]) => ({
        key,
        label: getFieldLabel(key, demand),
        value: normalizePreviewValue(value),
      }))
      .filter((item) => item.value.length > 0 && !["customerName", "projectName"].includes(item.key));
  };

  const getImportantPreviewFields = (demand: Demand | null) => {
    const importantKeywords = [
      "文案",
      "尺寸",
      "版式",
      "素材数量",
      "数量",
      "参考图",
      "原素材",
      "产品",
      "品牌",
      "客户",
      "公司",
      "链接",
      "站点",
      "psd",
    ];
    const fields = getPreviewFields(demand);
    const important = fields.filter((field) => {
      const label = field.label.toLowerCase();
      return importantKeywords.some((keyword) => label.includes(keyword.toLowerCase()));
    });
    return (important.length > 0 ? important : fields).slice(0, 8);
  };

  const getAssetPreviewFields = (demand: Demand | null) =>
    getPreviewFields(demand)
      .filter((field) => isLikelyAssetField(field.label, field.value))
      .slice(0, 5);

  const renderPreviewValue = (value: string) => {
    const urlMatch = value.match(/https?:\/\/[^\s，,]+/);
    if (urlMatch) {
      return (
        <a
          href={urlMatch[0]}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-blue-600 hover:text-blue-700 break-all"
        >
          {value}
        </a>
      );
    }
    return <span className="break-words">{value}</span>;
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
                if (selectedPriority !== "all") {
                  params.set("priority", selectedPriority);
                }
                if (relationshipView === "created" && currentUserId) {
                  params.set("creatorUserId", String(currentUserId));
                }
                if (relationshipView === "assigned" && currentUserId) {
                  params.set("assigneeUserId", String(currentUserId));
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

      {availableRelationshipViews.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {availableRelationshipViews.map((view) => (
            <button
              key={view.key}
              type="button"
              onClick={() => {
                setRelationshipView(view.key);
                setPage(1);
              }}
              className={`px-4 py-2 text-sm font-bold rounded-full border transition-colors ${
                relationshipView === view.key
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {view.label}
            </button>
          ))}
        </div>
      )}

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
                    if (isCreativeRoleRestricted) {
                      setSelectedDept(creativeDepartment?.id || e.target.value);
                      setPage(1);
                      return;
                    }
                    setSelectedDept(e.target.value);
                    setPage(1);
                  }}
                  disabled={isCreativeRoleRestricted}
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
                  value={selectedPriority}
                  onChange={(e) => {
                    setSelectedPriority(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="all">所有优先级</option>
                  {allPriorityOptions.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <select
                  className="w-full sm:flex-1 px-4 py-2.5 text-base border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={selectedStatus}
                  onChange={(e) => {
                    setSelectedStatus(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="all">所有状态</option>
                  {allStatusOptions.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {/* 当前版本暂不开放 AI 智能分析功能，按钮暂时隐藏 */}
            {/*
            <div className="flex-shrink-0">
              <button className="w-full lg:w-auto flex items-center justify-center gap-2 text-purple-700 bg-purple-50 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-purple-100 transition-colors border border-purple-100">
                <Sparkles className="w-4 h-4" />
                AI 智能分析
              </button>
            </div>
            */}
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

            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-4 text-sm text-slate-500">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-1 min-w-0">
                <span className="whitespace-nowrap sm:mr-1">需求类型</span>
                <select
                  value={selectedDemandTypeId}
                  onChange={(e) => {
                    setSelectedDemandTypeId(e.target.value);
                    setPage(1);
                  }}
                  disabled={selectedDept === "all" || demandTypes.length === 0}
                  className="w-full sm:w-auto flex-1 min-w-0 px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
                >
                  <option value="">{selectedDept === "all" ? "请先选择部门" : "全部类型"}</option>
                  {demandTypes
                    .filter((item) => {
                      if (!isCreativeRoleRestricted) return true;
                      return !!item.code && creativeAllowedDemandTypeCodes.includes(item.code);
                    })
                    .map((item) => (
                      <option key={item.id} value={String(item.id)}>
                        {item.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {isCreativeRoleRestricted && creativeRoleLabel && (
              <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                当前为创意部岗位视图，仅展示{creativeRoleLabel}。
              </div>
            )}

            {/* 高级筛选：按部门自定义字段 */}
            {selectedDept === "all" ? (
              <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                选择具体部门后，可使用该部门已勾选“可筛选”的自定义字段进行高级筛选，例如客户、品牌、公司名、站点、链接等。
              </div>
            ) : dynamicFilterFields.length > 0 ? (
              <div className="flex flex-col gap-2 border-t border-slate-100 pt-4 text-xs text-slate-500">
                <div className="font-semibold text-slate-600">高级筛选（按部门自定义字段）</div>
                <div className="text-slate-400">
                  客户、品牌、公司名等信息仍按部门字段筛选；如未出现，请在字段模板中勾选“可筛选”。
                </div>
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
            ) : (
              <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                当前部门暂无可用于高级筛选的字段。需要按客户、品牌或公司名筛选时，请先到字段模板中把对应字段设为“可筛选”。
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
                {relationshipView === "all" && <button
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
                </button>}
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
          <table className="min-w-[1040px] w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-5 w-28 whitespace-nowrap">ID</th>
                <th className="px-6 py-5 whitespace-nowrap">需求标题</th>
                <th className="px-6 py-5 w-32 text-center whitespace-nowrap">类型</th>
                <th className="px-6 py-5 w-40 text-center whitespace-nowrap">所属部门</th>
                <th className="px-6 py-5 w-32 text-center whitespace-nowrap">优先级</th>
                <th className="px-6 py-5 w-32 text-center whitespace-nowrap">状态</th>
                <th className="px-6 py-5 w-32 text-center whitespace-nowrap">提交人</th>
                <th className="px-6 py-5 w-32 text-center whitespace-nowrap">执行人</th>
                <th className="px-6 py-5 w-40 text-center whitespace-nowrap">截止日期</th>
                <th className="px-6 py-5 w-28 text-center whitespace-nowrap">操作</th>
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
                    onClick={() => openDemandPreview(demand)}
                  >
                    <td className="px-6 py-5 text-slate-500 font-mono text-sm whitespace-nowrap">{demand.id}</td>
                    <td className="px-6 py-5">
                      <div className="font-bold text-base text-slate-900 hover:text-blue-600 mb-1 truncate max-w-[260px]">
                        {demand.title}
                      </div>
                      <div className="text-sm text-slate-500 truncate max-w-[260px]">
                        {demand.description}
                      </div>
                      {renderRelationshipBadges(demand)}
                    </td>
                    <td className="px-6 py-5 text-center whitespace-nowrap">
                      <span className="text-sm text-slate-700">{demand.demandTypeName || "-"}</span>
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-slate-300" />
                        <span className="text-slate-700 font-medium">{deptName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center whitespace-nowrap">
                      {renderPriorityBadge(demand)}
                    </td>
                    <td className="px-6 py-5 text-center whitespace-nowrap">{renderStatusBadge(demand)}</td>

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
                    <td className="px-6 py-5 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyDemand(demand);
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100"
                      >
                        <Copy className="w-3 h-3" /> 复制
                      </button>
                    </td>
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
                    if (isCreativeRoleRestricted) {
                      setSelectedDept(creativeDepartment?.id || e.target.value);
                      setPage(1);
                      return;
                    }
                    setSelectedDept(e.target.value);
                    setPage(1);
                  }}
                  disabled={isCreativeRoleRestricted}
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
                  value={selectedPriority}
                  onChange={(e) => {
                    setSelectedPriority(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="all">所有优先级</option>
                  {allPriorityOptions.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <select
                  className="w-full px-4 py-2.5 text-base border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={selectedStatus}
                  onChange={(e) => {
                    setSelectedStatus(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="all">所有状态</option>
                  {allStatusOptions.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
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
                    {relationshipView === 'all' && <button
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
                    </button>}
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
              onClick={() => openDemandPreview(demand)}
            >
              <div className="flex justify-between items-start mb-3">
                <div className="font-mono text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded">
                  {demand.id}
                </div>
                  <div className="flex gap-2">
                  {renderPriorityBadge(demand)}
                  {renderStatusBadge(demand)}
                  </div>


              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">{demand.title}</h3>
              {demand.demandTypeName && (
                <div className="mb-2 flex flex-wrap gap-2 text-xs">
                  <span className="px-2 py-1 rounded-full bg-slate-50 text-slate-600 border border-slate-200">
                    {demand.demandTypeName}
                  </span>
                </div>
              )}
              <p className="text-sm text-slate-500 mb-4 line-clamp-2">{demand.description}</p>
              {renderRelationshipBadges(demand)}

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
                  className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-50 rounded-lg border border-slate-200"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopyDemand(demand);
                  }}
                >
                  复制
                </button>
                {canDeleteDemand(demand) && (
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
                )}
              </div>
            </div>
          );
        })}
      </div>

      {previewDemand && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/35">
          <button
            type="button"
            aria-label="关闭需求预览"
            className="absolute inset-0 cursor-default"
            onClick={() => setPreviewDemand(null)}
          />
          <aside className="relative z-10 flex h-full w-full max-w-[620px] flex-col bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded bg-slate-100 px-2 py-1 font-mono text-xs text-slate-500">
                    {previewDemand.id}
                  </span>
                  {renderPriorityBadge(previewDemand)}
                  {renderStatusBadge(previewDemand)}
                </div>
                <h2 className="text-lg font-bold leading-snug text-slate-900">
                  {previewDemand.title}
                </h2>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                  <span>{departments.find((d) => d.id === previewDemand.departmentId)?.name || "未知部门"}</span>
                  {previewDemand.demandTypeName && <span>· {previewDemand.demandTypeName}</span>}
                  {previewDemand.dueDate && <span>· 截止 {previewDemand.dueDate}</span>}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewDemand(null)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                  <div className="text-xs text-slate-400">提交人</div>
                  <div className="mt-1 font-semibold text-slate-800">
                    {previewDemand.creatorName || previewDemand.creatorId}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                  <div className="text-xs text-slate-400">执行人</div>
                  <div className="mt-1 font-semibold text-slate-800">
                    {previewDemand.assigneeName || previewDemand.assigneeId || "未指定"}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                  <div className="text-xs text-slate-400">创建时间</div>
                  <div className="mt-1 font-semibold text-slate-800">
                    {previewDemand.createdAt || "-"}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                  <div className="text-xs text-slate-400">完成时间</div>
                  <div className="mt-1 font-semibold text-slate-800">
                    {previewDemand.finishedAt || previewDemand.closedAt || "-"}
                  </div>
                </div>
              </div>

              <section className="mt-5">
                <div className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-900">
                  <FileText className="h-4 w-4 text-blue-600" />
                  需求核心内容
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700">
                  {previewDemand.description || "暂无描述"}
                </div>
              </section>

              <section className="mt-5">
                <div className="mb-2 text-sm font-bold text-slate-900">执行人分配</div>
                {canAssignPreviewDemand(previewDemand) ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <select
                        value={previewAssigneeEmail}
                        onChange={(e) => {
                          setPreviewAssigneeEmail(e.target.value);
                          setPreviewAssignError(null);
                        }}
                        disabled={previewAssigning || previewDeptUsersLoading}
                        className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
                      >
                        <option value="">
                          {previewDeptUsersLoading ? "正在加载部门成员..." : "选择执行人"}
                        </option>
                        {previewDeptUsers
                          .filter((user) => user.email && user.email !== previewDemand.assigneeEmail)
                          .map((user) => {
                            const displayName = user.name || user.email?.split("@")[0] || user.email;
                            return (
                              <option key={user.id} value={user.email || ""}>
                                {displayName}（{user.email}）
                              </option>
                            );
                          })}
                      </select>
                      <button
                        type="button"
                        onClick={handlePreviewAssignAssignee}
                        disabled={!previewAssigneeEmail || previewAssigning || previewDeptUsersLoading}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {previewAssigning ? "分配中..." : "分配"}
                      </button>
                    </div>
                    {previewAssignError && (
                      <div className="mt-2 text-xs text-rose-600">{previewAssignError}</div>
                    )}
                    {previewDeptUsers.length === 0 && !previewDeptUsersLoading && (
                      <div className="mt-2 text-xs text-slate-400">
                        当前部门暂无可分配成员，请先确认用户已加入该部门。
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-400">
                    当前账号不能在此处直接分配该需求。
                  </div>
                )}
              </section>

              <section className="mt-5">
                <div className="mb-2 text-sm font-bold text-slate-900">流转状态</div>
                {canUpdatePreviewStatus(previewDemand) ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <select
                        value={previewStatusValue || previewDemand.status || ""}
                        onChange={(e) => {
                          setPreviewStatusValue(e.target.value);
                          setPreviewStatusError(null);
                        }}
                        disabled={previewStatusUpdating || previewWorkflowLoading}
                        className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
                      >
                        {previewStatusOptions.length === 0 ? (
                          <option value={previewDemand.status || ""}>
                            {previewWorkflowLoading ? "正在加载流转状态..." : "暂无可用状态"}
                          </option>
                        ) : (
                          previewStatusOptions.map((status) => (
                            <option key={status.value} value={status.value}>
                              {status.label}
                            </option>
                          ))
                        )}
                      </select>
                      <button
                        type="button"
                        onClick={handlePreviewStatusChange}
                        disabled={
                          !previewStatusValue ||
                          previewStatusValue === previewDemand.status ||
                          previewStatusUpdating ||
                          previewWorkflowLoading
                        }
                        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {previewStatusUpdating ? "更新中..." : "更新状态"}
                      </button>
                    </div>
                    {previewStatusError && (
                      <div className="mt-2 text-xs text-rose-600">{previewStatusError}</div>
                    )}
                    <div className="mt-2 text-xs text-slate-400">
                      状态选项来自当前需求所属部门的工作流配置。
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-400">
                    当前账号不能在此处修改该需求状态。
                  </div>
                )}
              </section>

              <section className="mt-5">
                <div className="mb-2 text-sm font-bold text-slate-900">重要字段</div>
                {getImportantPreviewFields(previewDemand).length === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-400">
                    暂无可预览的核心字段
                  </div>
                ) : (
                  <div className="grid gap-2">
                    {getImportantPreviewFields(previewDemand).map((field) => (
                      <div
                        key={`${field.key}-${field.label}`}
                        className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                      >
                        <div className="text-xs font-semibold text-slate-500">{field.label}</div>
                        <div className="mt-1 text-sm leading-6 text-slate-800">
                          {renderPreviewValue(field.value)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="mt-5">
                <div className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-900">
                  <PackageCheck className="h-4 w-4 text-emerald-600" />
                  素材与处理线索
                </div>
                {getAssetPreviewFields(previewDemand).length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-400">
                    当前列表数据里没有识别到素材、参考图或链接字段；完整附件可进入详情页查看。
                  </div>
                ) : (
                  <div className="grid gap-2">
                    {getAssetPreviewFields(previewDemand).map((field) => (
                      <div
                        key={`asset-${field.key}-${field.label}`}
                        className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2"
                      >
                        <div className="text-xs font-semibold text-emerald-700">{field.label}</div>
                        <div className="mt-1 text-sm leading-6 text-slate-800">
                          {renderPreviewValue(field.value)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            <div className="border-t border-slate-200 bg-white px-5 py-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => showAdjacentPreviewDemand("prev")}
                  disabled={selectedPreviewIndex <= 0}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" /> 上一条
                </button>
                <button
                  type="button"
                  onClick={() => showAdjacentPreviewDemand("next")}
                  disabled={selectedPreviewIndex < 0 || selectedPreviewIndex >= demands.length - 1}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  下一条 <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <button
                  type="button"
                  onClick={() => router.push(`/demands/${previewDemand.id}`)}
                  className="inline-flex items-center justify-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white hover:bg-blue-700"
                >
                  <ExternalLink className="h-4 w-4" /> 进入详情
                </button>
                {isCreativeDemand(previewDemand) && (
                  <button
                    type="button"
                    onClick={() => router.push(`/demands/${previewDemand.id}`)}
                    className="inline-flex items-center justify-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-sm font-bold text-white hover:bg-slate-800"
                  >
                    整理为 PSD
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleCopyDemand(previewDemand)}
                  className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  <Copy className="h-4 w-4" /> 复制
                </button>
                {canDeleteDemand(previewDemand) && (
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteError(null);
                      setDeleteTargetDemand(previewDemand);
                    }}
                    className="inline-flex items-center justify-center rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-600 hover:bg-rose-100"
                  >
                    删除
                  </button>
                )}
              </div>
            </div>
          </aside>
        </div>
      )}

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
