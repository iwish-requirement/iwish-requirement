"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Upload, Sparkles, ClipboardList, Clock3 } from 'lucide-react';
import { Department, FieldDefinition, Priority, type Customer, type DemandType, type DepartmentWorkflowConfig, type Project } from '../../../../types';
import { getSupabaseClient } from '../../../../lib/supabase';
import { authorizedFetch } from '../../../../lib/authFetch';

type QuickTemplate = {
  id: number;
  name: string;
  departmentId: number;
  demandTypeId?: number | null;
  payload: Record<string, any>;
};

type DraftItem = {
  id: number;
  title?: string | null;
  departmentId?: number | null;
  demandTypeId?: number | null;
  customerId?: number | null;
  projectId?: number | null;
  payload: Record<string, any>;
  status: string;
};

type RecentInput = {
  id: number;
  input_type: string;
  value: string;
  metadata?: Record<string, any> | null;
};

function buildDraftEdit(draft: DraftItem) {
  const payload = draft.payload || {};
  const customFields = payload.customFields && typeof payload.customFields === 'object' ? payload.customFields : {};
  return {
    title: payload.title || draft.title || '',
    description: payload.description || payload.rawText || '',
    customerName: payload.customerName || customFields['客户'] || customFields['客户名称'] || customFields['品牌'] || customFields['公司'] || '',
    projectName: payload.projectName || customFields['项目'] || customFields['项目名称'] || customFields['站点'] || customFields['链接'] || '',
    dueDate: payload.dueDate || '',
    departmentId: draft.departmentId ? String(draft.departmentId) : payload.departmentId ? String(payload.departmentId) : '',
    demandTypeId: draft.demandTypeId ? String(draft.demandTypeId) : payload.demandTypeId ? String(payload.demandTypeId) : '',
    customFields: { ...customFields },
    rawText: payload.rawText || '',
    priority: payload.priority || '',
  };
}

function normalizeDraftCustomFields(edit: Record<string, any>) {
  const customFields = {
    ...(edit.customFields && typeof edit.customFields === 'object' ? edit.customFields : {}),
  };
  if (edit.customerName?.trim()) customFields['客户'] = edit.customerName.trim();
  if (edit.projectName?.trim()) customFields['项目'] = edit.projectName.trim();
  return customFields;
}

export default function NewDemandPage() {
  const router = useRouter();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [demandTypes, setDemandTypes] = useState<DemandType[]>([]);
  const [selectedDemandTypeId, setSelectedDemandTypeId] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [dynamicFields, setDynamicFields] = useState<FieldDefinition[]>([]);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<string>('');
  const [dueDate, setDueDate] = useState('');
  const [creatorEmail, setCreatorEmail] = useState('');
  const [assigneeEmail, setAssigneeEmail] = useState('');
  const [deptUsers, setDeptUsers] = useState<{ id: number; name: string | null; email: string | null }[]>([]);
  const [deptUsersLoading, setDeptUsersLoading] = useState(false);
  const [workflowConfig, setWorkflowConfig] = useState<DepartmentWorkflowConfig | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [pasteText, setPasteText] = useState('');
  const [pasteResult, setPasteResult] = useState<string | null>(null);
  const [quickTemplates, setQuickTemplates] = useState<QuickTemplate[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [templateMessage, setTemplateMessage] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<DraftItem[]>([]);
  const [draftEdits, setDraftEdits] = useState<Record<number, Record<string, any>>>({});
  const [expandedDraftIds, setExpandedDraftIds] = useState<Record<number, boolean>>({});
  const [demandTypesByDept, setDemandTypesByDept] = useState<Record<string, DemandType[]>>({});
  const [draftMessage, setDraftMessage] = useState<string | null>(null);
  const [recentInputs, setRecentInputs] = useState<RecentInput[]>([]);
  const requiresLeaderAssignment = workflowConfig?.rules?.requireLeaderAssignment === true;

  useEffect(() => {
    const loadDepartments = async () => {
      try {
        const res = await fetch('/api/departments');
        if (!res.ok) {
          const text = await res.text();
          console.error('load departments for new demand error', text);
          return;
        }
        const json = await res.json();
        const items = (json.items || []) as { id: number; name: string; slug: string | null }[];
        const mapped: Department[] = items.map((d) => ({
          id: String(d.id),
          name: d.name,
          slug: d.slug || '',
        }));
        setDepartments(mapped);
        if (mapped.length > 0) {
          setSelectedDeptId(mapped[0].id);
        }
      } catch (e) {
        console.error('load departments for new demand error', e);
      }
    };

    loadDepartments();
  }, []);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const supabase = getSupabaseClient();
        const { data } = await supabase.auth.getUser();
        if (data?.user?.email) {
          setCreatorEmail(data.user.email);
        }
      } catch (e) {
        console.error('load user error', e);
      }
    };

    loadUser();
  }, []);

  useEffect(() => {
    const loadCustomers = async () => {
      try {
        const res = await authorizedFetch('/api/customers');
        if (!res.ok) {
          console.error('load customers error', await res.text());
          return;
        }
        const json = await res.json();
        setCustomers(Array.isArray(json.items) ? json.items : []);
      } catch (e) {
        console.error('load customers error', e);
      }
    };

    loadCustomers();
  }, []);

  useEffect(() => {
    const loadProjects = async () => {
      if (!selectedCustomerId) {
        setProjects([]);
        setSelectedProjectId('');
        return;
      }

      try {
        const res = await authorizedFetch(`/api/projects?customerId=${encodeURIComponent(selectedCustomerId)}`);
        if (!res.ok) {
          console.error('load projects error', await res.text());
          setProjects([]);
          return;
        }
        const json = await res.json();
        setProjects(Array.isArray(json.items) ? json.items : []);
      } catch (e) {
        console.error('load projects error', e);
        setProjects([]);
      }
    };

    loadProjects();
  }, [selectedCustomerId]);

  const loadDrafts = async () => {
    try {
      const res = await authorizedFetch('/api/demands/drafts');
      if (!res.ok) {
        console.error('load demand drafts error', await res.text());
        return;
      }
      const json = await res.json();
      const items = Array.isArray(json.items) ? json.items : [];
      setDrafts(items);
      setDraftEdits((prev) => {
        const next = { ...prev };
        for (const draft of items) {
          if (!next[draft.id]) {
            next[draft.id] = buildDraftEdit(draft);
          }
        }
        return next;
      });
    } catch (e) {
      console.error('load demand drafts error', e);
    }
  };

  useEffect(() => {
    loadDrafts();
  }, []);

  useEffect(() => {
    const loadRecentInputs = async () => {
      try {
        const res = await authorizedFetch('/api/user-recent-inputs');
        if (!res.ok) {
          console.error('load recent inputs error', await res.text());
          return;
        }
        const json = await res.json();
        setRecentInputs(Array.isArray(json.items) ? json.items : []);
      } catch (e) {
        console.error('load recent inputs error', e);
      }
    };

    loadRecentInputs();
  }, []);

  useEffect(() => {
    const loadQuickTemplates = async () => {
      if (!selectedDeptId) {
        setQuickTemplates([]);
        return;
      }
      try {
        const res = await authorizedFetch(`/api/demand-quick-templates?departmentId=${encodeURIComponent(selectedDeptId)}`);
        if (!res.ok) {
          console.error('load quick templates error', await res.text());
          setQuickTemplates([]);
          return;
        }
        const json = await res.json();
        setQuickTemplates(Array.isArray(json.items) ? json.items : []);
      } catch (e) {
        console.error('load quick templates error', e);
        setQuickTemplates([]);
      }
    };

    loadQuickTemplates();
  }, [selectedDeptId]);

  useEffect(() => {
    const loadFieldsAndUsers = async () => {
      if (!selectedDeptId) {
        setDynamicFields([]);
        setFormData({});
        setDeptUsers([]);
        setDemandTypes([]);
        setSelectedDemandTypeId('');
        return;
      }

      try {
        const [fieldsRes, usersRes, demandTypesRes] = await Promise.all([
          authorizedFetch(`/api/department-fields?departmentId=${encodeURIComponent(selectedDeptId)}`),
          authorizedFetch(`/api/users/by-department?departmentId=${encodeURIComponent(selectedDeptId)}`),
          authorizedFetch(`/api/departments/${encodeURIComponent(selectedDeptId)}/demand-types`),
        ]);

        if (!fieldsRes.ok) {
          console.error('load department fields error', await fieldsRes.text());
          setDynamicFields([]);
          setFormData({});
        } else {
          const json = await fieldsRes.json();
          const items = (json.items || []) as FieldDefinition[];
          setDynamicFields(items);
          setFormData({});
        }

        if (!demandTypesRes.ok) {
          console.error('load demand types error', await demandTypesRes.text());
          setDemandTypes([]);
          setSelectedDemandTypeId('');
        } else {
          const json = await demandTypesRes.json();
          const items = (json.items || []) as DemandType[];
          setDemandTypes(items);
          setDemandTypesByDept((prev) => ({ ...prev, [selectedDeptId]: items }));
          setSelectedDemandTypeId((prev) => {
            if (prev && items.some((item) => String(item.id) === prev)) {
              return prev;
            }
            return items[0] ? String(items[0].id) : '';
          });
        }

        setDeptUsersLoading(true);
        if (!usersRes.ok) {
          console.error('load department users error', await usersRes.text());
          setDeptUsers([]);
        } else {
          const json = await usersRes.json();
          const items = (json.items || []) as { id: number; name: string | null; email: string | null }[];
          setDeptUsers(items);
        }
      } catch (e) {
        console.error('load department fields/users error', e);
        setDynamicFields([]);
        setFormData({});
        setDeptUsers([]);
        setDemandTypes([]);
        setSelectedDemandTypeId('');
      } finally {
        setDeptUsersLoading(false);
      }
    };

    loadFieldsAndUsers();
  }, [selectedDeptId]);

  useEffect(() => {
    const deptIds = Array.from(
      new Set(
        drafts
          .map((draft) => draftEdits[draft.id]?.departmentId || (draft.departmentId ? String(draft.departmentId) : ''))
          .filter(Boolean)
      )
    );
    const missing = deptIds.filter((deptId) => !demandTypesByDept[deptId]);
    if (missing.length === 0) return;

    let cancelled = false;
    const loadMissingTypes = async () => {
      const pairs = await Promise.all(
        missing.map(async (deptId) => {
          try {
            const res = await authorizedFetch(`/api/departments/${encodeURIComponent(deptId)}/demand-types`);
            if (!res.ok) return [deptId, []] as const;
            const json = await res.json();
            return [deptId, Array.isArray(json.items) ? json.items : []] as const;
          } catch {
            return [deptId, []] as const;
          }
        })
      );
      if (cancelled) return;
      setDemandTypesByDept((prev) => {
        const next = { ...prev };
        for (const [deptId, items] of pairs) {
          next[deptId] = items as DemandType[];
        }
        return next;
      });
    };

    loadMissingTypes();
    return () => {
      cancelled = true;
    };
  }, [drafts, draftEdits, demandTypesByDept]);

  useEffect(() => {
    if (!selectedDeptId) {
      setWorkflowConfig(null);
      return;
    }

    const loadWorkflowConfig = async () => {
      try {
        const res = await authorizedFetch(
          `/api/departments/${encodeURIComponent(selectedDeptId)}/workflow-config`
        );
        if (!res.ok) {
          console.error('load workflow config for new demand error', await res.text());
          setWorkflowConfig(null);
          return;
        }
        const json = await res.json();
        const cfg = (json.config || null) as DepartmentWorkflowConfig | null;
        if (!cfg || !Array.isArray(cfg.priorities) || !Array.isArray(cfg.statuses)) {
          setWorkflowConfig(null);
          return;
        }
        const sorted: DepartmentWorkflowConfig = {
          priorities: [...cfg.priorities].sort((a, b) => a.order - b.order),
          statuses: [...cfg.statuses].sort((a, b) => a.order - b.order),
          rules: cfg.rules,
        };
        setWorkflowConfig(sorted);
        setPriority((prev) => {
          if (sorted.priorities.length === 0) {
            return prev;
          }
          if (prev && sorted.priorities.some((item) => item.value === prev)) {
            return prev;
          }
          return sorted.priorities[0].value;
        });
      } catch (e) {
        console.error('load workflow config for new demand error', e);
        setWorkflowConfig(null);
      }
    };

    loadWorkflowConfig();
  }, [selectedDeptId]);

  useEffect(() => {
    if (requiresLeaderAssignment && assigneeEmail) {
      setAssigneeEmail('');
    }
  }, [requiresLeaderAssignment, assigneeEmail]);

  const handleDynamicChange = (id: string, value: any) => {
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handlePasteToDrafts = async () => {
    if (!pasteText.trim()) {
      setPasteResult('请先粘贴从飞书或 Excel 复制出来的内容');
      return;
    }

    try {
      setPasteResult(null);
      const res = await authorizedFetch('/api/demands/bulk-from-paste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: pasteText,
          departmentId: selectedDeptId ? Number(selectedDeptId) : undefined,
          demandTypeId: selectedDemandTypeId ? Number(selectedDemandTypeId) : undefined,
        }),
      });

      if (!res.ok) {
        console.error('paste to drafts error', await res.text());
        setPasteResult('生成草稿失败，请检查粘贴格式');
        return;
      }

      const json = await res.json();
      setPasteResult(`已生成 ${json.parsedCount || 0} 条需求草稿，可继续确认后创建正式需求。`);
      setPasteText('');
      await loadDrafts();
    } catch (e) {
      console.error('paste to drafts error', e);
      setPasteResult('生成草稿失败，请检查网络后重试');
    }
  };

  const applyTemplate = (template: QuickTemplate) => {
    const payload = template.payload || {};
    setTitle(payload.title || '');
    setDescription(payload.description || '');
    setDueDate(payload.dueDate || '');
    setPriority(payload.priority || priority);
    setSelectedCustomerId(payload.customerId ? String(payload.customerId) : '');
    setSelectedProjectId(payload.projectId ? String(payload.projectId) : '');
    setSelectedDemandTypeId(payload.demandTypeId ? String(payload.demandTypeId) : selectedDemandTypeId);
    setFormData(payload.customFields || {});
    setTemplateMessage(`已套用模板：${template.name}`);
  };

  const saveQuickTemplate = async () => {
    if (!selectedDeptId || !templateName.trim()) {
      setTemplateMessage('请填写模板名称，并确认已选择部门');
      return;
    }
    try {
      setTemplateMessage(null);
      const res = await authorizedFetch('/api/demand-quick-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: templateName.trim(),
          departmentId: Number(selectedDeptId),
          demandTypeId: selectedDemandTypeId ? Number(selectedDemandTypeId) : undefined,
          payload: {
            title,
            description,
            priority,
            dueDate,
            customerId: selectedCustomerId ? Number(selectedCustomerId) : undefined,
            projectId: selectedProjectId ? Number(selectedProjectId) : undefined,
            demandTypeId: selectedDemandTypeId ? Number(selectedDemandTypeId) : undefined,
            customFields: formData,
          },
        }),
      });
      if (!res.ok) {
        console.error('save quick template error', await res.text());
        setTemplateMessage('保存模板失败，请稍后重试');
        return;
      }
      const json = await res.json();
      setQuickTemplates((prev) => [json.template, ...prev].filter(Boolean));
      setTemplateName('');
      setTemplateMessage('常用模板已保存');
    } catch (e) {
      console.error('save quick template error', e);
      setTemplateMessage('保存模板失败，请检查网络后重试');
    }
  };

  const recentByType = (type: string) => recentInputs.filter((item) => item.input_type === type).slice(0, 5);

  const applyRecentInput = (item: RecentInput) => {
    if (item.input_type === 'customer') {
      setSelectedCustomerId(item.value);
      setSelectedProjectId('');
      return;
    }
    if (item.input_type === 'project') {
      setSelectedProjectId(item.value);
      return;
    }
    if (item.input_type === 'demand_type') {
      setSelectedDemandTypeId(item.value);
      return;
    }
    if (item.input_type === 'due_date') {
      setDueDate(item.value);
      return;
    }
    if (item.input_type === 'link') {
      const key = item.metadata?.key || dynamicFields.find((field) => /url|link|站点|链接|site/i.test(field.id) || /url|link|站点|链接|site/i.test(field.label))?.id;
      if (key) {
        setFormData((prev) => ({ ...prev, [key]: item.value }));
      }
    }
  };

  const formatRecentInput = (item: RecentInput) => {
    if (item.input_type === 'customer') {
      return customers.find((customer) => String(customer.id) === item.value)?.name || `客户 #${item.value}`;
    }
    if (item.input_type === 'project') {
      return projects.find((project) => String(project.id) === item.value)?.name || `项目 #${item.value}`;
    }
    if (item.input_type === 'demand_type') {
      return demandTypes.find((type) => String(type.id) === item.value)?.name || `类型 #${item.value}`;
    }
    return item.value;
  };

  const updateDraftEdit = (draftId: number, patch: Record<string, any>) => {
    setDraftEdits((prev) => ({
      ...prev,
      [draftId]: {
        ...(prev[draftId] || {}),
        ...patch,
      },
    }));
  };

  const saveDraftEdit = async (draft: DraftItem) => {
    const edit = draftEdits[draft.id] || buildDraftEdit(draft);
    const payload = {
      ...(draft.payload || {}),
      title: edit.title,
      description: edit.description,
      customerName: edit.customerName,
      projectName: edit.projectName,
      dueDate: edit.dueDate,
      rawText: edit.rawText,
      priority: edit.priority,
      customFields: normalizeDraftCustomFields(edit),
    };
    const res = await authorizedFetch(`/api/demands/drafts/${draft.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: edit.title,
        departmentId: edit.departmentId ? Number(edit.departmentId) : undefined,
        demandTypeId: edit.demandTypeId ? Number(edit.demandTypeId) : undefined,
        payload,
      }),
    });
    if (!res.ok) {
      setDraftMessage('草稿保存失败，请稍后重试');
      return null;
    }
    const json = await res.json();
    const updated = json.draft
      ? {
          id: json.draft.id,
          departmentId: json.draft.department_id,
          demandTypeId: json.draft.demand_type_id,
          customerId: json.draft.customer_id,
          projectId: json.draft.project_id,
          title: json.draft.title,
          payload: json.draft.payload || {},
          status: json.draft.status,
        }
      : null;
    if (updated) {
      setDrafts((prev) => prev.map((item) => (item.id === draft.id ? updated : item)));
    }
    setDraftMessage('草稿已保存');
    return updated || draft;
  };

  const confirmDraft = async (draft: DraftItem) => {
    try {
      setDraftMessage(null);
      const edit = draftEdits[draft.id] || buildDraftEdit(draft);
      const missing: string[] = [];
      if (!String(edit.title || '').trim()) missing.push('标题');
      if (!String(edit.description || '').trim()) missing.push('描述');
      if (!String(edit.departmentId || '').trim()) missing.push('部门');
      if (!String(edit.demandTypeId || '').trim()) missing.push('需求类型');
      if (missing.length > 0) {
        setDraftMessage(`草稿 #${draft.id} 缺少：${missing.join('、')}`);
        setExpandedDraftIds((prev) => ({ ...prev, [draft.id]: true }));
        return;
      }
      const payload = {
        ...(draft.payload || {}),
        title: edit.title,
        description: edit.description,
        customerName: edit.customerName,
        projectName: edit.projectName,
        dueDate: edit.dueDate,
        rawText: edit.rawText,
        priority: edit.priority,
        customFields: normalizeDraftCustomFields(edit),
      };
      const res = await authorizedFetch(`/api/demands/drafts/${draft.id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: edit.title,
          description: edit.description,
          dueDate: edit.dueDate,
          departmentId: Number(edit.departmentId),
          demandTypeId: Number(edit.demandTypeId),
          payload,
        }),
      });
      if (!res.ok) {
        console.error('confirm draft error', await res.text());
        setDraftMessage('草稿确认失败，请补齐标题、描述、部门和需求类型');
        return;
      }
      const json = await res.json();
      setDrafts((prev) => prev.filter((item) => item.id !== draft.id));
      if (json?.demand?.id) {
        router.push(`/demands/${json.demand.id}`);
      }
    } catch (e) {
      console.error('confirm draft error', e);
      setDraftMessage('草稿确认失败，请检查网络后重试');
    }
  };

  const deleteDraft = async (draftId: number) => {
    try {
      const res = await authorizedFetch(`/api/demands/drafts/${draftId}`, { method: 'DELETE' });
      if (!res.ok) {
        console.error('delete draft error', await res.text());
        setDraftMessage('删除草稿失败');
        return;
      }
      setDrafts((prev) => prev.filter((item) => item.id !== draftId));
    } catch (e) {
      console.error('delete draft error', e);
      setDraftMessage('删除草稿失败，请检查网络后重试');
    }
  };

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim() || !selectedDeptId) {
      setError('请填写标题、部门和需求描述');
      return;
    }
    if (!requiresLeaderAssignment && !assigneeEmail.trim()) {
      setError('请选择执行人，该字段为必填');
      return;
    }
    if (!creatorEmail) {
      setError('当前用户信息获取失败，请重新登录后再试');
      return;
    }
    setError(null);
    setAttachmentError(null);
    setSubmitting(true);
    try {
      const res = await authorizedFetch('/api/demands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          departmentId: Number(selectedDeptId),
          priority,
          dueDate,
          customerId: selectedCustomerId ? Number(selectedCustomerId) : undefined,
          projectId: selectedProjectId ? Number(selectedProjectId) : undefined,
          demandTypeId: selectedDemandTypeId ? Number(selectedDemandTypeId) : undefined,
          creatorEmail,
          assigneeEmail: requiresLeaderAssignment ? undefined : assigneeEmail.trim(),
          customFields: formData,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error('create demand error', text);
        setError('创建需求失败，请稍后重试');
        return;
      }

      const json = await res.json();
      const id = json?.demand?.id as string | undefined;

      if (id && pendingFiles.length > 0) {
        for (const file of pendingFiles) {
          try {
            const formDataUpload = new FormData();
            formDataUpload.append('file', file);
            formDataUpload.append('uploaderEmail', creatorEmail);
            const resUpload = await fetch(`/api/demands/${id}/attachments`, {
              method: 'POST',
              body: formDataUpload,
            });
            if (!resUpload.ok) {
              const text = await resUpload.text();
              console.error('upload attachment in create error', text);
              setAttachmentError('部分附件上传失败，请在详情页重新上传');
            }
          } catch (err) {
            console.error('upload attachment in create error', err);
            setAttachmentError('部分附件上传失败，请在详情页重新上传');
          }
        }
      }

      if (id) {
        router.push(`/demands/${id}`);
      } else {
        router.push('/demands');
      }
    } catch (e) {
      console.error('create demand error', e);
      setError('创建需求失败，请检查网络后重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-10 animate-fadeIn">
      <button 
        onClick={() => router.back()}
        className="flex items-center text-slate-500 hover:text-slate-800 mb-6 font-medium transition-colors"
      >
        <ArrowLeft className="w-5 h-5 mr-2" />
        返回列表
      </button>

      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-slate-900">提交新需求</h1>
        {/* 当前版本暂不开放 AI 辅助填写功能，按钮暂时隐藏 */}
        {/*
        <button className="hidden sm:flex items-center gap-2 text-purple-700 bg-purple-50 px-4 py-2 rounded-xl text-sm font-bold hover:bg-purple-100 transition-colors border border-purple-100">
             <Sparkles className="w-4 h-4" />
             AI 辅助填写
        </button>
        */}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-100 bg-slate-50/50">
           <h2 className="text-xl font-bold text-slate-800">基本信息</h2>
           <p className="text-slate-500 mt-1">请填写需求的核心内容，带 * 号为必填项。</p>
        </div>
        
        <div className="p-8 space-y-8">
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
            <div className="flex flex-col md:flex-row md:items-center gap-3">
              <div className="flex-1">
                <div className="text-sm font-bold text-blue-900">常用模板</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {quickTemplates.length === 0 ? (
                    <span className="text-xs text-blue-700">当前部门暂无模板，可填写表单后保存为常用模板。</span>
                  ) : (
                    quickTemplates.map((template) => (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => applyTemplate(template)}
                        className="px-3 py-1.5 rounded-full bg-white border border-blue-200 text-xs font-bold text-blue-700 hover:bg-blue-100"
                      >
                        {template.name}
                      </button>
                    ))
                  )}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="模板名称"
                  className="px-3 py-2 rounded-lg border border-blue-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={saveQuickTemplate}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-700"
                >
                  保存为模板
                </button>
              </div>
            </div>
            {templateMessage && <div className="mt-2 text-xs text-blue-700">{templateMessage}</div>}
          </div>

          {recentInputs.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                <Clock3 className="w-4 h-4 text-slate-500" />
                最近填写
              </div>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  { label: '客户', items: recentByType('customer').filter((item) => customers.some((customer) => String(customer.id) === item.value)) },
                  { label: '项目', items: recentByType('project').filter((item) => projects.some((project) => String(project.id) === item.value)) },
                  { label: '需求类型', items: recentByType('demand_type').filter((item) => demandTypes.some((type) => String(type.id) === item.value)) },
                  { label: '截止日期', items: recentByType('due_date') },
                  { label: '链接/站点', items: recentByType('link').filter((item) => !!item.value) },
                ].map((group) => (
                  group.items.length > 0 ? (
                    <div key={group.label}>
                      <div className="mb-1 text-xs font-bold text-slate-500">{group.label}</div>
                      <div className="flex flex-wrap gap-2">
                        {group.items.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => applyRecentInput(item)}
                            className="max-w-full truncate px-3 py-1.5 rounded-full border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                            title={formatRecentInput(item)}
                          >
                            {formatRecentInput(item)}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-base font-bold text-slate-700 mb-2">需求标题 <span className="text-red-500">*</span></label>
            <input 
              type="text" 
              placeholder="例如：Q4 营销活动落地页开发" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 text-base border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm transition-all"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <label className="block text-base font-bold text-slate-700 mb-2">所属部门 <span className="text-red-500">*</span></label>
              <select 
                value={selectedDeptId}
                onChange={(e) => setSelectedDeptId(e.target.value)}
                className="w-full px-4 py-3 text-base border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm bg-white transition-all"
              >
                <option value="">请选择部门</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-base font-bold text-slate-700 mb-2">需求类型</label>
              <select
                value={selectedDemandTypeId}
                onChange={(e) => setSelectedDemandTypeId(e.target.value)}
                className="w-full px-4 py-3 text-base border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm bg-white transition-all"
              >
                <option value="">通用需求</option>
                {demandTypes.map((item) => (
                  <option key={item.id} value={String(item.id)}>
                    {item.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-400 mt-1">用于创意/技术等部门按 UI、美工、视频、开发类型统计。</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <label className="block text-base font-bold text-slate-700 mb-2">客户</label>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full px-4 py-3 text-base border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm bg-white transition-all"
              >
                <option value="">暂不关联客户</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={String(customer.id)}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-base font-bold text-slate-700 mb-2">项目/站点</label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                disabled={!selectedCustomerId || projects.length === 0}
                className="w-full px-4 py-3 text-base border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm bg-white transition-all disabled:bg-slate-50 disabled:text-slate-400"
              >
                <option value="">{selectedCustomerId ? '暂不关联项目' : '请先选择客户'}</option>
                {projects.map((project) => (
                  <option key={project.id} value={String(project.id)}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <label className="block text-base font-bold text-slate-700 mb-2">优先级</label>
              <select
                value={priority || ''}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-4 py-3 text-base border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm bg-white transition-all"
              >
                {workflowConfig && workflowConfig.priorities.length > 0 ? (
                  <>
                    {workflowConfig.priorities.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </>
                ) : (
                  <>
                    <option value={Priority.MEDIUM}>{Priority.MEDIUM}</option>
                    <option value={Priority.LOW}>{Priority.LOW}</option>
                    <option value={Priority.HIGH}>{Priority.HIGH}</option>
                    <option value={Priority.CRITICAL}>{Priority.CRITICAL}</option>
                  </>
                )}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <label className="block text-base font-bold text-slate-700 mb-2">执行人 <span className="text-red-500">*</span></label>
              {requiresLeaderAssignment && (
                <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  当前部门由负责人统一分配，提交需求时无需指定执行人。
                </div>
              )}
              <select
                value={assigneeEmail}
                onChange={(e) => setAssigneeEmail(e.target.value)}
                className="w-full px-4 py-3 text-base border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm bg-white transition-all disabled:bg-slate-50 disabled:text-slate-400"
                disabled={requiresLeaderAssignment || !selectedDeptId || deptUsersLoading || deptUsers.length === 0}
              >
                {!selectedDeptId && <option value="">请先选择所属部门</option>}
                {selectedDeptId && deptUsersLoading && <option value="">正在加载该部门成员...</option>}
                {selectedDeptId && !deptUsersLoading && deptUsers.length === 0 && (
                  <option value="">该部门暂无可选执行人，请先在用户管理中添加</option>
                )}
                {selectedDeptId && !deptUsersLoading && deptUsers.length > 0 && (
                  <>
                    <option value="">请选择执行人</option>
                    {deptUsers.map((user) => {
                      if (!user.email) return null;
                      const displayName = user.name || user.email.split('@')[0];
                      return (
                        <option key={user.id} value={user.email}>
                          {displayName}（{user.email}）
                        </option>
                      );
                    })}
                  </>
                )}
              </select>
              <p className="text-xs text-slate-400 mt-1">执行人用于后续评分与统计，将从所属部门成员中选择。</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <label className="block text-base font-bold text-slate-700 mb-2">需求详情描述 <span className="text-red-500">*</span></label>
              <textarea 
                rows={6}
                placeholder="请详细描述需求背景、目标及具体要求..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-3 text-base border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm transition-all resize-none"
              ></textarea>
              {/* 当前版本暂不开放 AI 优化描述功能，按钮暂时隐藏 */}
              {/*
              <div className="mt-2 flex justify-end">
                <button className="text-sm text-purple-600 font-medium hover:underline flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> 优化描述文案
                </button>
              </div>
              */}
            </div>
            <div>
              <label className="block text-base font-bold text-slate-700 mb-2">期望完成日期</label>
              <input 
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-4 py-3 text-base border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm transition-all"
              />
              <p className="text-xs text-slate-400 mt-2">用于甘特图与进度统计，可后续在详情页调整。</p>
            </div>
          </div>

          {dynamicFields.length > 0 && (
            <div className="pt-6 border-t border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                {departments.find(d => d.id === selectedDeptId)?.name} 专属字段
                <span className="text-xs font-normal text-slate-400 bg-slate-100 px-2 py-0.5 rounded">已自动匹配模板</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {dynamicFields.map(field => {
                  const currentValue = formData[field.id];
                  const selectedValues = Array.isArray(currentValue)
                    ? (currentValue as string[])
                    : currentValue
                    ? [String(currentValue)]
                    : [];

                  return (
                    <div key={field.id} className={field.type === 'multiline' ? 'md:col-span-2' : ''}>
                      <label className="block text-base font-bold text-slate-700 mb-2">
                        {field.label} {field.required && <span className="text-red-500">*</span>}
                      </label>
                      {field.type === 'text' && (
                        <input
                          type="text"
                          placeholder={field.placeholder}
                          onChange={(e) => handleDynamicChange(field.id, e.target.value)}
                          className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                        />
                      )}
                      {field.type === 'number' && (
                        <input
                          type="number"
                          placeholder={field.placeholder}
                          onChange={(e) => handleDynamicChange(field.id, e.target.value)}
                          className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                        />
                      )}
                      {field.type === 'date' && (
                        <input
                          type="date"
                          onChange={(e) => handleDynamicChange(field.id, e.target.value)}
                          className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                        />
                      )}
                      {field.type === 'select' && (
                        <select
                          onChange={(e) => handleDynamicChange(field.id, e.target.value)}
                          className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm bg-white"
                        >
                          <option value="">请选择</option>
                          {field.options?.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      )}
                      {field.type === 'multi_select' && (
                        <div className="flex flex-wrap gap-2">
                          {field.options?.map((opt) => {
                            const checked = selectedValues.includes(opt);
                            return (
                              <label
                                key={opt}
                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs cursor-pointer select-none border-slate-200 hover:border-blue-400 hover:bg-blue-50"
                              >
                                <input
                                  type="checkbox"
                                  className="w-4 h-4 text-blue-600 rounded border-slate-300"
                                  checked={checked}
                                  onChange={(e) => {
                                    const prev = selectedValues;
                                    const next = e.target.checked
                                      ? Array.from(new Set([...prev, opt]))
                                      : prev.filter((v) => v !== opt);
                                    handleDynamicChange(field.id, next);
                                  }}
                                />
                                <span className="text-slate-700">{opt}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                      {field.type === 'multiline' && (
                        <textarea
                          rows={3}
                          placeholder={field.placeholder}
                          onChange={(e) => handleDynamicChange(field.id, e.target.value)}
                          className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm resize-none"
                        />
                      )}
                      {field.type === 'boolean' && (
                        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={!!currentValue}
                            onChange={(e) => handleDynamicChange(field.id, e.target.checked)}
                            className="w-4 h-4 text-blue-600 rounded border-slate-300"
                          />
                          <span>是 / 否</span>
                        </label>
                      )}
                      {field.type === 'url' && (
                        <input
                          type="url"
                          placeholder={field.placeholder || 'https://example.com'}
                          onChange={(e) => handleDynamicChange(field.id, e.target.value)}
                          className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                        />
                      )}
                      {field.type === 'email' && (
                        <input
                          type="email"
                          placeholder={field.placeholder || 'name@example.com'}
                          onChange={(e) => handleDynamicChange(field.id, e.target.value)}
                          className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                        />
                      )}
                      {field.type === 'phone' && (
                        <input
                          type="tel"
                          placeholder={field.placeholder || '请输入手机号'}
                          onChange={(e) => handleDynamicChange(field.id, e.target.value)}
                          className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="pt-6 border-t border-slate-100">
            <div className="flex items-center gap-2 mb-3">
              <ClipboardList className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-bold text-slate-900">从表格粘贴生成草稿</h3>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              可从飞书表格或 Excel 复制多行，系统会按标题、说明、客户、项目、截止等列生成需求草稿。
            </p>
            <textarea
              rows={4}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={'标题\t说明\t客户\t项目\t截止\n活动 Banner 修改\t替换主视觉\t客户A\t官网\t2026-05-10'}
              className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm resize-none text-sm"
            />
            <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-3">
              <button
                type="button"
                onClick={handlePasteToDrafts}
                className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 transition-colors"
              >
                生成草稿
              </button>
              {pasteResult && <span className="text-xs text-slate-500">{pasteResult}</span>}
            </div>
            {drafts.length > 0 && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-bold text-slate-800">待确认草稿</div>
                  {draftMessage && <div className="text-xs text-amber-700">{draftMessage}</div>}
                </div>
                <div className="space-y-3">
                  {drafts.map((draft) => {
                    const edit = draftEdits[draft.id] || buildDraftEdit(draft);
                    const deptTypes = edit.departmentId ? demandTypesByDept[edit.departmentId] || [] : [];
                    const dynamicEntries = Object.entries(edit.customFields || {}).filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '');
                    const expanded = expandedDraftIds[draft.id] !== false;
                    const missing = [
                      !String(edit.title || '').trim() ? '标题' : '',
                      !String(edit.description || '').trim() ? '描述' : '',
                      !String(edit.departmentId || '').trim() ? '部门' : '',
                      !String(edit.demandTypeId || '').trim() ? '需求类型' : '',
                    ].filter(Boolean);

                    return (
                      <div key={draft.id} className="rounded-xl bg-white border border-slate-100 px-4 py-3">
                        <div className="flex flex-col sm:flex-row sm:items-start gap-2 justify-between">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-900 truncate">
                              {edit.title || `草稿 #${draft.id}`}
                            </div>
                            <div className="text-xs text-slate-500 truncate">
                              {edit.description || edit.rawText || '等待确认创建'}
                            </div>
                            {missing.length > 0 && (
                              <div className="mt-1 text-xs text-rose-600">缺少：{missing.join('、')}</div>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setExpandedDraftIds((prev) => ({ ...prev, [draft.id]: !expanded }))}
                              className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50"
                            >
                              {expanded ? '收起预览' : '展开预览'}
                            </button>
                            <button
                              type="button"
                              onClick={() => saveDraftEdit(draft)}
                              className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700"
                            >
                              保存草稿
                            </button>
                            <button
                              type="button"
                              onClick={() => confirmDraft(draft)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700"
                            >
                              确认创建
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteDraft(draft.id)}
                              className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50"
                            >
                              删除
                            </button>
                          </div>
                        </div>
                        {expanded && (
                          <div className="mt-4 space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <label className="text-xs font-bold text-slate-600">
                                标题
                                <input value={edit.title || ''} onChange={(e) => updateDraftEdit(draft.id, { title: e.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-normal" />
                              </label>
                              <label className="text-xs font-bold text-slate-600">
                                截止时间
                                <input type="date" value={edit.dueDate || ''} onChange={(e) => updateDraftEdit(draft.id, { dueDate: e.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-normal" />
                              </label>
                              <label className="text-xs font-bold text-slate-600">
                                部门
                                <select value={edit.departmentId || ''} onChange={(e) => updateDraftEdit(draft.id, { departmentId: e.target.value, demandTypeId: '' })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white font-normal">
                                  <option value="">请选择部门</option>
                                  {departments.map((dept) => <option key={dept.id} value={dept.id}>{dept.name}</option>)}
                                </select>
                              </label>
                              <label className="text-xs font-bold text-slate-600">
                                需求类型
                                <select value={edit.demandTypeId || ''} onChange={(e) => updateDraftEdit(draft.id, { demandTypeId: e.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white font-normal">
                                  <option value="">请选择需求类型</option>
                                  {deptTypes.map((type) => <option key={type.id} value={String(type.id)}>{type.name}</option>)}
                                </select>
                              </label>
                              <label className="text-xs font-bold text-slate-600">
                                客户/品牌（历史字段）
                                <input value={edit.customerName || ''} onChange={(e) => updateDraftEdit(draft.id, { customerName: e.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-normal" />
                              </label>
                              <label className="text-xs font-bold text-slate-600">
                                项目/站点（历史字段）
                                <input value={edit.projectName || ''} onChange={(e) => updateDraftEdit(draft.id, { projectName: e.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-normal" />
                              </label>
                            </div>
                            <label className="block text-xs font-bold text-slate-600">
                              描述
                              <textarea rows={3} value={edit.description || ''} onChange={(e) => updateDraftEdit(draft.id, { description: e.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-normal resize-none" />
                            </label>
                            {dynamicEntries.length > 0 && (
                              <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                                <div className="mb-2 text-xs font-bold text-slate-600">解析字段</div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                  {dynamicEntries.map(([key, value]) => (
                                    <label key={key} className="text-xs font-bold text-slate-500">
                                      {key}
                                      <input value={String(value)} onChange={(e) => updateDraftEdit(draft.id, { customFields: { ...(edit.customFields || {}), [key]: e.target.value } })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-normal bg-white" />
                                    </label>
                                  ))}
                                </div>
                              </div>
                            )}
                            {edit.rawText && (
                              <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                                <div className="mb-1 text-xs font-bold text-slate-600">原始内容</div>
                                <div className="whitespace-pre-wrap break-words text-xs text-slate-500">{edit.rawText}</div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-base font-bold text-slate-700 mb-2">附件上传</label>
            {attachmentError && (
              <div className="mb-2 text-xs text-rose-600 bg-rose-50 border border-rose-100 px-3 py-2 rounded-lg">
                {attachmentError}
              </div>
            )}
            <label className="block border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:bg-slate-50 transition-colors cursor-pointer">
              <input
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = e.target.files;
                  if (!files || files.length === 0) {
                    return;
                  }
                  const list = Array.from(files);
                  setPendingFiles(list);
                }}
              />
              <div className="bg-blue-50 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 text-blue-600">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-slate-900 font-medium">点击上传或拖拽文件至此处</p>
              <p className="text-slate-500 text-sm mt-1">支持 PDF, Word, Excel, JPG, PNG (最大 20MB)</p>
            </label>
            {pendingFiles.length > 0 && (
              <div className="mt-3 text-xs text-slate-500 text-left space-y-1">
                <div className="font-bold text-slate-700">本次将随需求一并上传的附件：</div>
                {pendingFiles.map((file) => (
                  <div key={file.name} className="flex items-center justify-between">
                    <span className="truncate max-w-xs">{file.name}</span>
                    <span className="ml-2 whitespace-nowrap text-slate-400">
                      {(file.size / 1024).toFixed(1)} KB
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-between items-center gap-4">
          {error && (
            <div className="text-sm text-rose-600 bg-rose-50 px-3 py-2 rounded-lg border border-rose-100">
              {error}
            </div>
          )}
          <div className="flex justify-end gap-4 flex-1">
            <button 
              onClick={() => router.back()}
              className="px-6 py-3 text-slate-600 font-bold hover:bg-white rounded-xl border border-transparent hover:border-slate-200 transition-all"
            >
              取消
            </button>
            <button 
              onClick={handleSubmit}
              disabled={submitting}
              className="px-8 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-md hover:shadow-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? '提交中...' : '提交需求'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
