"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Upload, Sparkles } from 'lucide-react';
import { Department, FieldDefinition, Priority, type DepartmentWorkflowConfig } from '../../../../types';
import { getSupabaseClient } from '../../../../lib/supabase';
import { authorizedFetch } from '../../../../lib/authFetch';

export default function NewDemandPage() {
  const router = useRouter();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState('');
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
    const loadFieldsAndUsers = async () => {
      if (!selectedDeptId) {
        setDynamicFields([]);
        setFormData({});
        setDeptUsers([]);
        return;
      }

      try {
        const [fieldsRes, usersRes] = await Promise.all([
          authorizedFetch(`/api/department-fields?departmentId=${encodeURIComponent(selectedDeptId)}`),
          authorizedFetch(`/api/users/by-department?departmentId=${encodeURIComponent(selectedDeptId)}`),
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
      } finally {
        setDeptUsersLoading(false);
      }
    };

    loadFieldsAndUsers();
  }, [selectedDeptId]);

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
