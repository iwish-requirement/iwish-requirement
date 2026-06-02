import { useEffect, useState } from "react";
import { authorizedFetch } from "../lib/authFetch";
import { loadClientBusinessUser } from "../lib/clientBusinessUser";
import { getSupabaseClient } from "../lib/supabase";
import {
  type Department,
  type Demand,
  type DepartmentWorkflowConfig,
  type FieldDefinition,
} from "../types";
import {
  type AttachmentItem,
  type DemandComment,
  type MentionUser,
} from "../components/demand-detail/types";
import { type PermissionKey } from "../lib/permissions";

export function useDemandDetailBootstrap(id: string) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [templateFields, setTemplateFields] = useState<FieldDefinition[]>([]);
  const [demand, setDemand] = useState<Demand | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workflowConfig, setWorkflowConfig] = useState<DepartmentWorkflowConfig | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [currentUserPermissions, setCurrentUserPermissions] = useState<PermissionKey[] | null>(
    null
  );
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [currentUserDepartmentId, setCurrentUserDepartmentId] = useState<number | null>(null);
  const [mentionUsers, setMentionUsers] = useState<MentionUser[]>([]);

  useEffect(() => {
    const loadDepartments = async () => {
      try {
        const res = await fetch("/api/departments");
        if (!res.ok) {
          const text = await res.text();
          console.error("load departments for demand detail error", text);
          return;
        }
        const json = await res.json();
        const items = (json.items || []) as { id: number; name: string; slug: string | null }[];
        setDepartments(
          items.map((department) => ({
            id: String(department.id),
            name: department.name,
            slug: department.slug || "",
          }))
        );
      } catch (err) {
        console.error("load departments for demand detail error", err);
      }
    };

    loadDepartments();
  }, []);

  useEffect(() => {
    const fetchDemand = async () => {
      if (!id) {
        return;
      }

      try {
        const res = await fetch(`/api/demands/${id}`);
        if (!res.ok) {
          const text = await res.text();
          console.error("load demand error", text);
          setError("加载需求失败");
          setLoading(false);
          return;
        }

        const json = await res.json();
        setDemand(json.demand);
      } catch (err) {
        console.error("load demand error", err);
        setError("加载需求失败");
      } finally {
        setLoading(false);
      }
    };

    fetchDemand();
  }, [id]);

  useEffect(() => {
    const loadDemandTemplate = async () => {
      if (!demand?.departmentId) {
        setTemplateFields([]);
        setWorkflowConfig(null);
        return;
      }

      try {
        const fieldParams = new URLSearchParams({
          departmentId: demand.departmentId,
        });
        if (demand.fieldTemplateId) {
          fieldParams.set("templateId", String(demand.fieldTemplateId));
        } else if (demand.demandTypeId) {
          fieldParams.set("demandTypeId", String(demand.demandTypeId));
        }

        const [fieldsRes, workflowRes] = await Promise.all([
          authorizedFetch(`/api/department-fields?${fieldParams.toString()}`),
          authorizedFetch(
            `/api/departments/${encodeURIComponent(demand.departmentId)}/workflow-config`
          ),
        ]);

        if (fieldsRes.ok) {
          const json = await fieldsRes.json();
          setTemplateFields((json.items || []) as FieldDefinition[]);
        } else {
          console.error("load department fields in detail error", await fieldsRes.text());
          setTemplateFields([]);
        }

        if (workflowRes.ok) {
          const workflowJson = await workflowRes.json();
          const config = (workflowJson.config || null) as DepartmentWorkflowConfig | null;

          if (config && Array.isArray(config.priorities) && Array.isArray(config.statuses)) {
            setWorkflowConfig({
              priorities: [...config.priorities].sort((a, b) => a.order - b.order),
              statuses: [...config.statuses].sort((a, b) => a.order - b.order),
              rules: config.rules,
              stats: config.stats,
            });
          } else {
            setWorkflowConfig(null);
          }
        } else {
          console.error("load workflow config in detail error", await workflowRes.text());
          setWorkflowConfig(null);
        }
      } catch (err) {
        console.error("load department fields/workflow in detail error", err);
        setTemplateFields([]);
        setWorkflowConfig(null);
      }
    };

    loadDemandTemplate();
  }, [demand?.departmentId, demand?.demandTypeId, demand?.fieldTemplateId]);

  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const user = await loadClientBusinessUser();
        if (!user?.email) {
          return;
        }

        if (typeof user.id === "number") {
          setCurrentUserId(user.id);
        }

        setCurrentUserEmail(user.email);

        if (typeof user.role === "string") {
          setCurrentUserRole(user.role);
        }

        if (Array.isArray(user.permissions)) {
          setCurrentUserPermissions(user.permissions as PermissionKey[]);
        }

        if (typeof user.departmentId === "number") {
          setCurrentUserDepartmentId(user.departmentId);
        } else {
          setCurrentUserDepartmentId(null);
        }
      } catch (err) {
        console.error("load current user in demand detail error", err);
      }
    };

    loadCurrentUser();
  }, []);

  useEffect(() => {
    const loadMentionUsers = async () => {
      try {
        const res = await authorizedFetch("/api/users/mention-options");
        if (!res.ok) {
          console.error("load mention users error", await res.text());
          return;
        }

        const json = await res.json();
        setMentionUsers((json.items || []) as MentionUser[]);
      } catch (err) {
        console.error("load mention users error", err);
      }
    };

    loadMentionUsers();
  }, []);

  return {
    departments,
    templateFields,
    setTemplateFields,
    demand,
    setDemand,
    loading,
    setLoading,
    error,
    setError,
    workflowConfig,
    setWorkflowConfig,
    currentUserRole,
    setCurrentUserRole,
    currentUserPermissions,
    setCurrentUserPermissions,
    currentUserId,
    setCurrentUserId,
    currentUserEmail,
    setCurrentUserEmail,
    currentUserDepartmentId,
    setCurrentUserDepartmentId,
    mentionUsers,
    setMentionUsers,
  };
}

export function useDemandThreadData(id: string) {
  const [comments, setComments] = useState<DemandComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      return;
    }

    const controller = new AbortController();

    const fetchComments = async () => {
      setCommentsLoading(true);
      try {
        const res = await fetch(`/api/demands/${id}/comments`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          console.error("load comments error", await res.text());
          return;
        }

        const json = await res.json();
        setComments(json.comments || []);
      } catch (err: any) {
        if (err?.name === "AbortError") {
          return;
        }
        console.error("load comments error", err);
      } finally {
        setCommentsLoading(false);
      }
    };

    const fetchAttachments = async () => {
      setAttachmentsLoading(true);
      setAttachmentError(null);
      try {
        const res = await fetch(`/api/demands/${id}/attachments`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          console.error("load attachments error", await res.text());
          return;
        }

        const json = await res.json();
        setAttachments(json.attachments || []);
      } catch (err: any) {
        if (err?.name === "AbortError") {
          return;
        }
        console.error("load attachments error", err);
      } finally {
        setAttachmentsLoading(false);
      }
    };

    fetchComments();
    fetchAttachments();

    return () => controller.abort();
  }, [id]);

  return {
    comments,
    setComments,
    commentsLoading,
    setCommentsLoading,
    attachments,
    setAttachments,
    attachmentsLoading,
    setAttachmentsLoading,
    attachmentError,
    setAttachmentError,
  };
}
