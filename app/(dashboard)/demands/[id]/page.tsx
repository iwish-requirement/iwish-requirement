"use client";

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Calendar, User, MessageSquare, Paperclip, Clock, CheckCircle2, Edit3, ArrowRight, Grid } from 'lucide-react';
import { getSupabaseClient } from '../../../../lib/supabase';
import { authorizedFetch } from '../../../../lib/authFetch';
import { hasPermission } from '../../../../lib/permissions';
import { Department, FieldDefinition, Demand, Priority, DemandStatus } from '../../../../types';
import Badge from '../../../../components/ui/Badge';
import Modal from '../../../../components/ui/Modal';

const COMMENT_EMOJIS = ['😀','😂','🤣','😅','😍','🤔','👍','🚀','🎉','😭'] as const;

const getAvatarInitial = (label?: string, email?: string | null) => {
  const base = (label || '') || (email || '');
  if (!base) return '';
  const trimmed = base.trim();
  if (!trimmed) return '';
  const first = trimmed[0];
  return first.toUpperCase();
};

interface CommentAttachment {
  id: number;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

interface DemandComment {
  id: number;
  content: string;
  authorLabel: string;
  authorEmail?: string;
  createdAt: string;
  parentId?: number | null;
  replyToCommentId?: number | null;
  attachments?: CommentAttachment[];
}

interface MentionUser {
  id: number;
  name: string | null;
  email: string | null;
}

export default function DemandDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  
  const [departments, setDepartments] = useState<Department[]>([]);
  const [templateFields, setTemplateFields] = useState<FieldDefinition[]>([]);
  const [demand, setDemand] = useState<Demand | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [draftPriority, setDraftPriority] = useState<Priority | ''>('');
  const [draftDueDate, setDraftDueDate] = useState('');
  const [draftStatus, setDraftStatus] = useState<DemandStatus | ''>('');
  const [draftCustomFields, setDraftCustomFields] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [statusUpdateError, setStatusUpdateError] = useState<string | null>(null);
  const [comments, setComments] = useState<DemandComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [currentUserPermissions, setCurrentUserPermissions] = useState<PermissionKey[] | null>(null);
  const [commentInput, setCommentInput] = useState('');
  const [commentError, setCommentError] = useState<string | null>(null);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentDeleteTargetId, setCommentDeleteTargetId] = useState<number | null>(null);
  const [commentDeleteSubmitting, setCommentDeleteSubmitting] = useState(false);
  const [commentDeleteError, setCommentDeleteError] = useState<string | null>(null);
  const [replySubmittingForParentId, setReplySubmittingForParentId] = useState<number | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editingCommentContent, setEditingCommentContent] = useState('');
  const [editingCommentSubmitting, setEditingCommentSubmitting] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [replyForCommentId, setReplyForCommentId] = useState<number | null>(null);
  const [replyToCommentId, setReplyToCommentId] = useState<number | null>(null);
  const [replyContentMap, setReplyContentMap] = useState<Record<number, string>>({});
  const [commentAttachmentUploadingId, setCommentAttachmentUploadingId] = useState<number | null>(null);
  const [commentAttachmentError, setCommentAttachmentError] = useState<string | null>(null);
  const [expandedReplyParents, setExpandedReplyParents] = useState<Record<number, boolean>>({});
  const [showMainEmojiPicker, setShowMainEmojiPicker] = useState(false);
  const [openReplyEmojiForParentId, setOpenReplyEmojiForParentId] = useState<number | null>(null);
  const [mentionUsers, setMentionUsers] = useState<MentionUser[]>([]);
  const [mentionQuery, setMentionQuery] = useState('');
  const [activeMentionContext, setActiveMentionContext] = useState<{ type: 'main' | 'reply'; parentId?: number } | null>(null);
  const [pendingCommentFiles, setPendingCommentFiles] = useState<File[]>([]);
  const [pendingReplyFilesMap, setPendingReplyFilesMap] = useState<Record<number, File[]>>({});
  const [attachments, setAttachments] = useState<{
    id: number;
    fileName: string;
    fileUrl: string;
    mimeType: string;
    size: number;
    createdAt: string;
  }[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [attachmentUploading, setAttachmentUploading] = useState(false);
  const [imagePreviewList, setImagePreviewList] = useState<CommentAttachment[]>([]);
  const [imagePreviewIndex, setImagePreviewIndex] = useState(0);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const mainCommentInputRef = useRef<HTMLDivElement | null>(null);

  const quickStatusOptions: DemandStatus[] = [
    DemandStatus.PENDING,
    DemandStatus.IN_PROGRESS,
    DemandStatus.DONE,
    DemandStatus.DELAYED,
    DemandStatus.IGNORED,
  ];

  const statusFlowOrder: DemandStatus[] = [
    DemandStatus.PENDING,
    DemandStatus.IN_PROGRESS,
    DemandStatus.DONE,
  ];

  const activeReplyInputRef = useRef<HTMLDivElement | null>(null);

  const handleDeleteDemand = async () => {
    if (deleteSubmitting) {
      return;
    }

    setDeleteSubmitting(true);
    setDeleteError(null);

    const res = await authorizedFetch(`/api/demands/${id}`, {
      method: 'DELETE',
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('delete demand error', text);
      setDeleteError(text || '删除失败，请稍后重试');
      setDeleteSubmitting(false);
      return;
    }

    setDeleteSubmitting(false);
    setDeleteModalOpen(false);
    router.push('/demands');
  };

  const currentUserDisplayName = React.useMemo(() => {
    if (!currentUserEmail) return '';
    const user = mentionUsers.find(
      (u) => u.email && u.email.toLowerCase() === currentUserEmail.toLowerCase()
    );
    if (user?.name) return user.name;
    const prefix = currentUserEmail.split('@')[0] || '';
    return prefix.toUpperCase();
  }, [mentionUsers, currentUserEmail]);

  useEffect(() => {
    const loadDepartments = async () => {
      try {
        const res = await fetch('/api/departments');
        if (!res.ok) {
          const text = await res.text();
          console.error('load departments for demand detail error', text);
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
      } catch (e) {
        console.error('load departments for demand detail error', e);
      }
    };

    loadDepartments();
  }, []);

  useEffect(() => {
    const fetchDemand = async () => {
      if (!id) return;
      try {
        const res = await fetch(`/api/demands/${id}`);
        if (!res.ok) {
          const text = await res.text();
          console.error('load demand error', text);
          setError('加载需求失败');
          setLoading(false);
          return;
        }
        const json = await res.json();
        setDemand(json.demand);
      } catch (e) {
        console.error('load demand error', e);
        setError('加载需求失败');
      } finally {
        setLoading(false);
      }
    };

    fetchDemand();
  }, [id]);

  useEffect(() => {
    const initDraftAndFields = async () => {
      if (!demand) {
        return;
      }

      setDraftTitle(demand.title);
      setDraftDescription(demand.description);
      setDraftPriority(demand.priority || Priority.MEDIUM);
      setDraftDueDate(demand.dueDate || '');
      setDraftStatus(demand.status || DemandStatus.PENDING);
      setDraftCustomFields(demand.customFields || {});

      if (!demand.departmentId) {
        setTemplateFields([]);
        return;
      }

      try {
        const res = await authorizedFetch(`/api/department-fields?departmentId=${encodeURIComponent(demand.departmentId)}`);
        if (!res.ok) {
          console.error('load department fields in detail error', await res.text());
          setTemplateFields([]);
          return;
        }
        const json = await res.json();
        const items = (json.items || []) as FieldDefinition[];
        setTemplateFields(items);
      } catch (e) {
        console.error('load department fields in detail error', e);
        setTemplateFields([]);
      }
    };

    initDraftAndFields();
  }, [demand]);

  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const supabase = getSupabaseClient();
        const { data } = await supabase.auth.getUser();
        const authUser = data?.user;
        if (!authUser?.email || !authUser.id) {
          return;
        }

        setCurrentUserEmail(authUser.email);

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
          console.error('demand detail auth sync error', await res.text());
          return;
        }

        const json = await res.json();
        const u = (json.user || {}) as {
          role?: string | null;
          permissions?: PermissionKey[] | null;
        };

        if (typeof u.role === 'string') {
          setCurrentUserRole(u.role);
        }

        if (Array.isArray(u.permissions)) {
          setCurrentUserPermissions(u.permissions as PermissionKey[]);
        }
      } catch (e) {
        console.error('load current user in demand detail error', e);
      }
    };

    loadCurrentUser();
  }, []);

  useEffect(() => {
    const supabase = getSupabaseClient();
    supabase
      .from('users')
      .select('id, name, email')
      .limit(50)
      .then(({ data, error }) => {
        if (error) {
          console.error('load mention users error', error);
          return;
        }
        if (data) {
          setMentionUsers(data as MentionUser[]);
        }
      })
      .catch((e) => {
        console.error('load mention users error', e);
      });
  }, []);

  useEffect(() => {
    if (!id) {
      return;
    }

    const controller = new AbortController();

    const fetchComments = async () => {
      setCommentsLoading(true);
      setCommentError(null);
      try {
        const res = await fetch(`/api/demands/${id}/comments`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          console.error('load comments error', await res.text());
          return;
        }
        const json = await res.json();
        setComments(json.comments || []);
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
        console.error('load comments error', e);
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
          console.error('load attachments error', await res.text());
          return;
        }
        const json = await res.json();
        setAttachments(json.attachments || []);
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
        console.error('load attachments error', e);
      } finally {
        setAttachmentsLoading(false);
      }
    };

    fetchComments();
    fetchAttachments();

    return () => controller.abort();
  }, [id]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (commentsLoading) return;
    if (!comments.length) return;

    const hash = window.location.hash;
    if (!hash || !hash.startsWith('#comment-')) return;

    const elementId = hash.slice(1);
    const el = document.getElementById(elementId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [commentsLoading, comments.length]);

  const deptName = demand
    ? departments.find(d => d.id === demand.departmentId)?.name || 'Loading...'
    : 'Loading...';

  const canDeleteDemand = currentUserRole
    ? hasPermission(currentUserRole, 'demand.delete', currentUserPermissions || undefined)
    : false;

  const normalizedStatusForFlow: DemandStatus | null =
    demand?.status === DemandStatus.DELAYED
      ? DemandStatus.IN_PROGRESS
      : demand?.status === DemandStatus.IGNORED
      ? DemandStatus.DONE
      : demand?.status ?? null;

  const currentStatusIndex =
    normalizedStatusForFlow != null ? statusFlowOrder.indexOf(normalizedStatusForFlow) : -1;

  const handleStartEdit = () => {
    setIsEditing(true);
    setSaveError(null);
  };

  const handleCancelEdit = () => {
    if (demand) {
      setDraftTitle(demand.title);
      setDraftDescription(demand.description);
      setDraftPriority(demand.priority || Priority.MEDIUM);
      setDraftDueDate(demand.dueDate || '');
      setDraftStatus(demand.status || DemandStatus.PENDING);
      setDraftCustomFields(demand.customFields || {});
    }
    setIsEditing(false);
    setSaveError(null);
  };

  const handleSave = async () => {
    if (!demand) return;
    if (!draftTitle.trim() || !draftDescription.trim()) {
      setSaveError('请填写标题和需求描述');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/demands/${demand.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: draftTitle.trim(),
          description: draftDescription.trim(),
          priority: draftPriority || demand.priority,
          dueDate: draftDueDate,
          status: draftStatus || demand.status,
          customFields: draftCustomFields,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error('update demand error', text);
        setSaveError('保存失败，请稍后重试');
        return;
      }

      const json = await res.json();
      setDemand(json.demand as Demand);
      setIsEditing(false);
    } catch (e) {
      console.error('update demand error', e);
      setSaveError('保存失败，请检查网络后重试');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickStatusChange = async (nextStatus: DemandStatus) => {
    if (!demand) return;
    if (nextStatus === demand.status) return;

    setStatusUpdating(true);
    setStatusUpdateError(null);
    try {
      const res = await fetch(`/api/demands/${demand.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: nextStatus,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error('quick update status error', text);
        setStatusUpdateError('状态更新失败，请稍后重试');
        return;
      }

      const json = await res.json();
      const updatedDemand = json.demand as Demand;
      setDemand(updatedDemand);
      setDraftStatus(updatedDemand.status || DemandStatus.PENDING);
    } catch (e) {
      console.error('quick update status error', e);
      setStatusUpdateError('状态更新失败，请检查网络后重试');
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleAddComment = async () => {
    const content = commentInput.trim();
    const hasFiles = pendingCommentFiles.length > 0;

    if (!content && !hasFiles) {
      setCommentError('请填写评论内容或添加图片/文件');
      return;
    }
    if (!currentUserEmail) {
      setCommentError('当前用户信息获取失败，请重新登录后再试');
      return;
    }

    setCommentSubmitting(true);
    setCommentError(null);
    try {
      const res = await fetch(`/api/demands/${id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          authorEmail: currentUserEmail,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error('create comment error', text);
        setCommentError('发表评论失败，请稍后重试');
        return;
      }

      const json = await res.json();
      let newComment = json.comment as DemandComment;

      if (hasFiles) {
        setCommentAttachmentUploadingId(newComment.id);
        const uploadedAttachments: CommentAttachment[] = [];

        for (const file of pendingCommentFiles) {
          try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('uploaderEmail', currentUserEmail);
            const uploadRes = await fetch(`/api/demands/${id}/comments/${newComment.id}/attachments`, {
              method: 'POST',
              body: formData,
            });
            if (!uploadRes.ok) {
              const text = await uploadRes.text();
              console.error('upload comment attachment from input error', text);
              setCommentAttachmentError('上传评论附件失败，请稍后重试');
              continue;
            }
            const uploadJson = await uploadRes.json();
            const attachment = uploadJson.attachment as CommentAttachment;
            uploadedAttachments.push(attachment);
          } catch (err) {
            console.error('upload comment attachment from input error', err);
            setCommentAttachmentError('上传评论附件失败，请检查网络后重试');
          }
        }

        if (uploadedAttachments.length) {
          newComment = {
            ...newComment,
            attachments: [...uploadedAttachments, ...(newComment.attachments || [])],
          };
        }
      }

      setComments(prev => [...prev, newComment]);
      setCommentInput('');
      setPendingCommentFiles([]);
    } catch (e) {
      console.error('create comment error', e);
      setCommentError('发表评论失败，请检查网络后重试');
    } finally {
      setCommentSubmitting(false);
      setCommentAttachmentUploadingId(null);
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!currentUserEmail) {
      setCommentError('当前用户信息获取失败，请重新登录后再试');
      return;
    }

    setCommentError(null);
    try {
      const res = await fetch(`/api/demands/${id}/comments/${commentId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authorEmail: currentUserEmail }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error('delete comment error', text);
        setCommentError('删除评论失败，请稍后重试');
        return;
      }

      setComments(prev => prev.filter(c => c.id !== commentId));
      if (editingCommentId === commentId) {
        setEditingCommentId(null);
        setEditingCommentContent('');
      }
    } catch (e) {
      console.error('delete comment error', e);
      setCommentError('删除评论失败，请检查网络后重试');
    }
  };

  const handleConfirmDeleteComment = async () => {
    if (commentDeleteTargetId == null || commentDeleteSubmitting) {
      return;
    }

    try {
      setCommentDeleteSubmitting(true);
      setCommentDeleteError(null);
      await handleDeleteComment(commentDeleteTargetId);
      setCommentDeleteTargetId(null);
    } catch (e) {
      console.error('delete comment with confirm modal error', e);
      setCommentDeleteError('删除评论失败，请稍后重试');
    } finally {
      setCommentDeleteSubmitting(false);
    }
  };

  const handleReplySubmit = async (parentId: number) => {
    const content = (replyContentMap[parentId] || '').trim();
    const pendingFiles = pendingReplyFilesMap[parentId] || [];
    const hasFiles = pendingFiles.length > 0;

    if (!content && !hasFiles) {
      setCommentError('请填写回复内容或添加图片/文件');
      return;
    }
    if (!currentUserEmail) {
      setCommentError('当前用户信息获取失败，请重新登录后再试');
      return;
    }

    const targetReplyToId = replyToCommentId || parentId;

    setCommentError(null);
    setReplySubmittingForParentId(parentId);
    try {
      const res = await fetch(`/api/demands/${id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: content || '',
          authorEmail: currentUserEmail,
          parentId,
          replyToCommentId: targetReplyToId,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error('create reply comment error', text);
        setCommentError('回复失败，请稍后重试');
        return;
      }

      const json = await res.json();
      let newComment = json.comment as DemandComment;

      if (hasFiles) {
        setCommentAttachmentUploadingId(newComment.id);
        const uploadedAttachments: CommentAttachment[] = [];

        for (const file of pendingFiles) {
          try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('uploaderEmail', currentUserEmail);
            const uploadRes = await fetch(`/api/demands/${id}/comments/${newComment.id}/attachments`, {
              method: 'POST',
              body: formData,
            });
            if (!uploadRes.ok) {
              const text = await uploadRes.text();
              console.error('upload reply attachment error', text);
              setCommentAttachmentError('上传回复附件失败，请稍后重试');
              continue;
            }
            const uploadJson = await uploadRes.json();
            const attachment = uploadJson.attachment as CommentAttachment;
            uploadedAttachments.push(attachment);
          } catch (err) {
            console.error('upload reply attachment error', err);
            setCommentAttachmentError('上传回复附件失败，请检查网络后重试');
          }
        }

        if (uploadedAttachments.length) {
          newComment = {
            ...newComment,
            attachments: [...uploadedAttachments, ...(newComment.attachments || [])],
          };
        }
      }

      setComments(prev => [...prev, newComment]);
      setReplyContentMap(prev => ({ ...prev, [parentId]: '' }));
      setPendingReplyFilesMap(prev => {
        const next = { ...prev };
        delete next[parentId];
        return next;
      });
      setReplyForCommentId(null);
      setReplyToCommentId(null);
    } catch (e) {
      console.error('create reply comment error', e);
      setCommentError('回复失败，请检查网络后重试');
    } finally {
      setCommentAttachmentUploadingId(null);
    }
  };

  const openImagePreview = (allFiles: CommentAttachment[] | { id: number; fileName: string; fileUrl: string; mimeType: string; size: number; createdAt: string }[], targetId: number) => {
    const images = (allFiles || []).filter((f) => f.mimeType && f.mimeType.startsWith('image/')) as CommentAttachment[];
    if (!images.length) return;
    const index = images.findIndex((f) => f.id === targetId);
    setImagePreviewList(images);
    setImagePreviewIndex(index >= 0 ? index : 0);
  };

  const FIVE_MINUTES_MS = 5 * 60 * 1000;

  const handleMainInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!commentSubmitting) {
        handleAddComment();
      }
    }
  };

  const canEditComment = (comment: DemandComment) => {
    if (!currentUserEmail || !comment.authorEmail) return false;
    if (comment.authorEmail.toLowerCase() !== currentUserEmail.toLowerCase()) return false;
    if (!comment.createdAt) return false;

    try {
      const createdAt = new Date(comment.createdAt.replace(' ', 'T') + 'Z');
      if (Number.isNaN(createdAt.getTime())) return false;
      const diffMs = Date.now() - createdAt.getTime();
      return diffMs <= FIVE_MINUTES_MS;
    } catch {
      return false;
    }
  };

  const handleStartEditComment = (comment: DemandComment) => {
    setEditingCommentId(comment.id);
    setEditingCommentContent(comment.content || '');
    setCommentError(null);
  };

  const handleCancelEditComment = () => {
    setEditingCommentId(null);
    setEditingCommentContent('');
  };

  const handleSaveEditComment = async (commentId: number) => {
    const content = editingCommentContent.trim();
    if (!content) {
      setCommentError('评论内容不能为空');
      return;
    }
    if (!currentUserEmail) {
      setCommentError('当前用户信息获取失败，请重新登录后再试');
      return;
    }

    setEditingCommentSubmitting(true);
    setCommentError(null);
    try {
      const res = await fetch(`/api/demands/${id}/comments/${commentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          authorEmail: currentUserEmail,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error('update comment error', text);
        setCommentError('更新评论失败，可能已超过可编辑时间');
        return;
      }

      setComments(prev => prev.map(c => (c.id === commentId ? { ...c, content } : c)));
      setEditingCommentId(null);
      setEditingCommentContent('');
    } catch (e) {
      console.error('update comment error', e);
      setCommentError('更新评论失败，请检查网络后重试');
    } finally {
      setEditingCommentSubmitting(false);
    }
  };

  const topLevelComments = comments.filter((c) => !c.parentId);
  const repliesByParentId: Record<number, DemandComment[]> = {};
  const commentMap: Record<number, DemandComment> = {};

  comments.forEach((c) => {
    commentMap[c.id] = c;
    if (c.parentId) {
      if (!repliesByParentId[c.parentId]) {
        repliesByParentId[c.parentId] = [];
      }
      repliesByParentId[c.parentId].push(c);
    }
  });

  const updateMentionState = (
    value: string,
    context: { type: 'main' | 'reply'; parentId?: number }
  ) => {
    const atIndex = value.lastIndexOf('@');
    if (atIndex === -1) {
      setActiveMentionContext(null);
      setMentionQuery('');
      return;
    }

    const query = value.slice(atIndex + 1);
    if (/\s/.test(query)) {
      setActiveMentionContext(null);
      setMentionQuery('');
      return;
    }

    setActiveMentionContext(context);
    setMentionQuery(query);
  };

  const handleSelectMention = (user: MentionUser) => {
    if (!activeMentionContext) {
      return;
    }

    const displayName = user.name || (user.email ? user.email.split('@')[0] : '');
    if (!displayName) {
      return;
    }

    if (activeMentionContext.type === 'main') {
      const value = commentInput;
      const atIndex = value.lastIndexOf('@');
      if (atIndex === -1) {
        setCommentInput(`${value}@${displayName} `);
      } else {
        const before = value.slice(0, atIndex);
        const after = value.slice(atIndex + 1 + mentionQuery.length);
        setCommentInput(`${before}@${displayName} ${after}`);
      }
    } else if (activeMentionContext.type === 'reply' && activeMentionContext.parentId) {
      const parentId = activeMentionContext.parentId;
      const value = replyContentMap[parentId] || '';
      const atIndex = value.lastIndexOf('@');
      if (atIndex === -1) {
        const nextValue = `${value}@${displayName} `;
        setReplyContentMap((prev) => ({ ...prev, [parentId]: nextValue }));
      } else {
        const before = value.slice(0, atIndex);
        const after = value.slice(atIndex + 1 + mentionQuery.length);
        const nextValue = `${before}@${displayName} ${after}`;
        setReplyContentMap((prev) => ({ ...prev, [parentId]: nextValue }));
      }
    }

    setActiveMentionContext(null);
    setMentionQuery('');
  };

  const filteredMentionUsers = mentionQuery
    ? mentionUsers.filter((user) => {
        const q = mentionQuery.toLowerCase();
        const name = (user.name || '').toLowerCase();
        const email = (user.email || '').toLowerCase();
        return name.includes(q) || email.includes(q);
      })
    : mentionUsers;

  const visibleMentionUsers = filteredMentionUsers.slice(0, 8);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;

      if (mainCommentInputRef.current && mainCommentInputRef.current.contains(target)) {
        return;
      }

      if (activeReplyInputRef.current && activeReplyInputRef.current.contains(target)) {
        return;
      }

      if (
        showMainEmojiPicker ||
        openReplyEmojiForParentId !== null ||
        activeMentionContext !== null
      ) {
        setShowMainEmojiPicker(false);
        setOpenReplyEmojiForParentId(null);
        setActiveMentionContext(null);
        setMentionQuery('');
      }
    };

    window.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMainEmojiPicker, openReplyEmojiForParentId, activeMentionContext]);

  const renderContentWithMentions = (text: string) => {
    if (!text) {
      return null;
    }
    const parts = text.split(/(@[^\s@]+)/g);
    return parts.map((part, index) => {
      if (part.startsWith('@') && part.length > 1) {
        return (
          <span key={index} className="text-blue-600 font-semibold">
            {part}
          </span>
        );
      }
      return <React.Fragment key={index}>{part}</React.Fragment>;
    });
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto pb-10 animate-fadeIn">
        <button 
          onClick={() => router.push('/demands')}
          className="flex items-center text-slate-500 hover:text-slate-800 mb-6 font-medium transition-colors"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          返回需求列表
        </button>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-slate-500">
          加载中...
        </div>
      </div>
    );
  }

  if (error || !demand) {
    return (
      <div className="max-w-6xl mx-auto pb-10 animate-fadeIn">
        <button 
          onClick={() => router.push('/demands')}
          className="flex items-center text-slate-500 hover:text-slate-800 mb-6 font-medium transition-colors"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          返回需求列表
        </button>
        <div className="bg-white rounded-2xl border border-rose-200 shadow-sm p-8 text-rose-600">
          {error || '未找到该需求，可能已被删除。'}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto pb-10 animate-fadeIn">
      <button 
        onClick={() => router.push('/demands')}
        className="flex items-center text-slate-500 hover:text-slate-800 mb-6 font-medium transition-colors"
      >
        <ArrowLeft className="w-5 h-5 mr-2" />
        返回需求列表
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-6 md:p-8">
            <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
              <div>
                 <div className="flex items-center gap-3 mb-2">
                    <span className="font-mono text-sm text-slate-500 bg-slate-100 px-2 py-1 rounded">{demand.id}</span>
                    <Badge variant="default">{deptName}</Badge>
                 </div>
                 <h1 className="text-2xl md:text-3xl font-bold text-slate-900 leading-tight">
                   {isEditing ? (
                     <input
                       value={draftTitle}
                       onChange={(e) => setDraftTitle(e.target.value)}
                       className="w-full border border-slate-300 rounded-lg px-3 py-2 text-base font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                     />
                   ) : (
                     demand.title
                   )}
                 </h1>
              </div>
              <div className="flex items-center gap-3">
                {isEditing ? (
                  <>
                    <button
                      onClick={handleCancelEdit}
                      className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {saving ? '保存中...' : '保存'}
                    </button>
                  </>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleStartEdit}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Edit3 className="w-5 h-5" />
                    </button>
                    {canDeleteDemand && (
                      <button
                        onClick={() => setDeleteModalOpen(true)}
                        className="px-2 py-1.5 text-xs font-bold text-rose-600 bg-rose-50 rounded-lg hover:bg-rose-100 border border-rose-100"
                      >
                        删除
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="prose prose-slate max-w-none mb-8 text-slate-700">
              <h3 className="text-lg font-bold text-slate-900">需求描述</h3>
              {isEditing ? (
                <textarea
                  rows={5}
                  value={draftDescription}
                  onChange={(e) => setDraftDescription(e.target.value)}
                  className="w-full mt-3 text-base leading-relaxed border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <p className="text-base leading-relaxed">{demand.description}</p>
              )}
            </div>
            
            {templateFields.length > 0 && (
              <div className="bg-slate-50 rounded-xl p-6 mb-8 border border-slate-100">
                 <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
                   <Grid className="w-4 h-4 text-slate-400" /> 业务专属信息
                 </h3>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8">
                    {templateFields.map((field) => {
                      const rawValue = isEditing
                        ? draftCustomFields[field.id]
                        : demand.customFields
                        ? demand.customFields[field.id]
                        : undefined;

                      if (!isEditing && (rawValue === undefined || rawValue === null || rawValue === '')) {
                        return null;
                      }

                      const value = rawValue ?? '';
                      const multiValues = Array.isArray(rawValue)
                        ? (rawValue as string[])
                        : rawValue
                        ? [String(rawValue)]
                        : [];
                      const booleanValue = typeof rawValue === 'boolean'
                        ? rawValue
                        : rawValue === 'true' || rawValue === '1';

                      const displayValue = (() => {
                        if (field.type === 'multi_select') {
                          return multiValues.join('、');
                        }
                        if (field.type === 'boolean') {
                          return booleanValue ? '是' : '否';
                        }
                        return value as string;
                      })();

                      return (
                        <div key={field.id} className={field.type === 'multiline' ? 'sm:col-span-2' : ''}>
                           <div className="text-xs font-bold text-slate-400 uppercase mb-1">{field.label}</div>
                           {isEditing ? (
                             <>
                               {field.type === 'text' && (
                                 <input
                                   type="text"
                                   value={value as string}
                                   onChange={(e) =>
                                     setDraftCustomFields((prev) => ({ ...prev, [field.id]: e.target.value }))
                                   }
                                   className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                 />
                               )}
                               {field.type === 'number' && (
                                 <input
                                   type="number"
                                   value={value as string}
                                   onChange={(e) =>
                                     setDraftCustomFields((prev) => ({ ...prev, [field.id]: e.target.value }))
                                   }
                                   className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                 />
                               )}
                               {field.type === 'date' && (
                                 <input
                                   type="date"
                                   value={value as string}
                                   onChange={(e) =>
                                     setDraftCustomFields((prev) => ({ ...prev, [field.id]: e.target.value }))
                                   }
                                   className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                 />
                               )}
                               {field.type === 'select' && (
                                 <select
                                   value={value as string}
                                   onChange={(e) =>
                                     setDraftCustomFields((prev) => ({ ...prev, [field.id]: e.target.value }))
                                   }
                                   className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
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
                                     const checked = multiValues.includes(opt);
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
                                             const prev = multiValues;
                                             const next = e.target.checked
                                               ? Array.from(new Set([...prev, opt]))
                                               : prev.filter((v) => v !== opt);
                                             setDraftCustomFields((prevFields) => ({
                                               ...prevFields,
                                               [field.id]: next,
                                             }));
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
                                   value={value as string}
                                   onChange={(e) =>
                                     setDraftCustomFields((prev) => ({ ...prev, [field.id]: e.target.value }))
                                   }
                                   className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
                                 />
                               )}
                               {field.type === 'boolean' && (
                                 <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                                   <input
                                     type="checkbox"
                                     checked={booleanValue}
                                     onChange={(e) =>
                                       setDraftCustomFields((prev) => ({
                                         ...prev,
                                         [field.id]: e.target.checked,
                                       }))
                                     }
                                     className="w-4 h-4 text-blue-600 rounded border-slate-300"
                                   />
                                   <span>是 / 否</span>
                                 </label>
                               )}
                               {field.type === 'url' && (
                                 <input
                                   type="url"
                                   value={value as string}
                                   onChange={(e) =>
                                     setDraftCustomFields((prev) => ({ ...prev, [field.id]: e.target.value }))
                                   }
                                   className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                   placeholder="https://example.com"
                                 />
                               )}
                               {field.type === 'email' && (
                                 <input
                                   type="email"
                                   value={value as string}
                                   onChange={(e) =>
                                     setDraftCustomFields((prev) => ({ ...prev, [field.id]: e.target.value }))
                                   }
                                   className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                   placeholder="name@example.com"
                                 />
                               )}
                               {field.type === 'phone' && (
                                 <input
                                   type="tel"
                                   value={value as string}
                                   onChange={(e) =>
                                     setDraftCustomFields((prev) => ({ ...prev, [field.id]: e.target.value }))
                                   }
                                   className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                   placeholder="请输入手机号"
                                 />
                               )}
                             </>
                           ) : (
                             <>
                               {field.type === 'url' && typeof value === 'string' && value ? (
                                 <a
                                   href={value as string}
                                   target="_blank"
                                   rel="noopener noreferrer"
                                   className="text-blue-600 hover:underline break-all text-sm md:text-base"
                                 >
                                   {value as string}
                                 </a>
                               ) : (
                                 <div className="text-slate-800 font-medium text-sm md:text-base break-words">
                                   {displayValue}
                                 </div>
                               )}
                             </>
                           )}
                        </div>
                      );
                    })}
                 </div>
              </div>
            )}

            <div className="border-t border-slate-100 pt-6">
              <h3 className="text-lg font-bold text-slate-900 mb-4">附件</h3>

              {attachmentError && (
                <div className="mb-3 text-xs text-rose-600 bg-rose-50 border border-rose-100 px-3 py-2 rounded-lg">
                  {attachmentError}
                </div>
              )}

              <div className="flex flex-col gap-3">
                {attachmentsLoading && (
                  <div className="text-xs text-slate-400">附件加载中...</div>
                )}
                {!attachmentsLoading && attachments.length === 0 && (
                  <div className="text-xs text-slate-400">暂无附件，可以上传设计稿、需求文档或截图。</div>
                )}
                {attachments.map((file) => {
                  const isImage = file.mimeType?.startsWith('image/');
                  return (
                    <div
                      key={file.id}
                      className="flex items-center justify-between p-3 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer group"
                      onClick={() => {
                        if (isImage) {
                          openImagePreview(attachments, file.id);
                        } else if (file.fileUrl) {
                          window.open(file.fileUrl, '_blank');
                        }
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 flex items-center justify-center bg-slate-100 rounded-lg overflow-hidden">
                          {isImage ? (
                            <img
                              src={file.fileUrl}
                              alt={file.fileName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Paperclip className="w-5 h-5 text-slate-500" />
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-slate-700 group-hover:text-blue-600">
                            {file.fileName}
                          </div>
                          <div className="text-xs text-slate-400">
                            {file.size > 0 ? `${(file.size / 1024).toFixed(1)} KB` : ''}
                            {file.createdAt ? ` · 上传于 ${file.createdAt}` : ''}
                          </div>
                        </div>
                      </div>
                      <button className="text-sm font-bold text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                        {isImage ? '预览' : '下载'}
                      </button>
                    </div>
                  );
                })}
              </div>

              {isEditing && (
                <div className="mt-4 flex justify-between items-center gap-3">
                  <p className="text-xs text-slate-400 flex-1">
                    支持上传设计稿、规格文档、截图等，文件将存储在内部 Supabase Storage 中。
                  </p>
                  <label className="relative inline-flex items-center justify-center px-4 py-2 text-xs font-bold text-blue-600 bg-blue-50 border border-blue-100 rounded-xl cursor-pointer hover:bg-blue-100">
                    <input
                      type="file"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (!currentUserEmail) {
                          setAttachmentError('当前用户信息获取失败，请重新登录后再试');
                          return;
                        }
                        setAttachmentUploading(true);
                        setAttachmentError(null);
                        try {
                          const formData = new FormData();
                          formData.append('file', file);
                          formData.append('uploaderEmail', currentUserEmail);
                          const res = await fetch(`/api/demands/${id}/attachments`, {
                            method: 'POST',
                            body: formData,
                          });
                          if (!res.ok) {
                            const text = await res.text();
                            console.error('upload attachment error', text);
                            setAttachmentError('上传附件失败，请稍后重试');
                            return;
                          }
                          const json = await res.json();
                          const attachment = json.attachment as {
                            id: number;
                            fileName: string;
                            fileUrl: string;
                            mimeType: string;
                            size: number;
                            createdAt: string;
                          };
                          setAttachments((prev) => [attachment, ...prev]);
                          if (e.target) {
                            e.target.value = '';
                          }
                        } catch (err) {
                          console.error('upload attachment error', err);
                          setAttachmentError('上传附件失败，请检查网络后重试');
                        } finally {
                          setAttachmentUploading(false);
                        }
                      }}
                      disabled={attachmentUploading}
                    />
                    {attachmentUploading ? '上传中...' : '上传附件'}
                  </label>
                </div>
              )}
            </div>
          </div>

          {imagePreviewList.length > 0 && (
            <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70">
              <button
                type="button"
                className="absolute inset-0 cursor-zoom-out"
                onClick={() => {
                  setImagePreviewList([]);
                  setImagePreviewIndex(0);
                }}
              />
              <div className="relative z-50 max-w-5xl w-full px-4">
                <div className="flex justify-between items-center mb-3 text-slate-100 text-xs">
                  <span>
                    {imagePreviewList[imagePreviewIndex]?.fileName}
                  </span>
                  <button
                    type="button"
                    className="px-2 py-1 rounded bg-black/40 hover:bg-black/60"
                    onClick={() => {
                      setImagePreviewList([]);
                      setImagePreviewIndex(0);
                    }}
                  >
                    关闭
                  </button>
                </div>
                <div className="relative bg-black rounded-xl flex items-center justify-center overflow-hidden max-h-[80vh] min-h-[320px]">
                  {imagePreviewList.length > 1 && (
                    <button
                      type="button"
                      className="absolute left-2 top-1/2 -translate-y-1/2 px-2 py-1 rounded-full bg-black/40 hover:bg-black/70 text-slate-100 text-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setImagePreviewIndex((prev) =>
                          prev === 0 ? imagePreviewList.length - 1 : prev - 1
                        );
                      }}
                    >
                      上一张
                    </button>
                  )}
                  {imagePreviewList[imagePreviewIndex] && (
                    <img
                      src={imagePreviewList[imagePreviewIndex].fileUrl}
                      alt={imagePreviewList[imagePreviewIndex].fileName}
                      className="max-h-[80vh] w-auto object-contain"
                    />
                  )}
                  {imagePreviewList.length > 1 && (
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 rounded-full bg-black/40 hover:bg-black/70 text-slate-100 text-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setImagePreviewIndex((prev) =>
                          prev === imagePreviewList.length - 1 ? 0 : prev + 1
                        );
                      }}
                    >
                      下一张
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-8">
             <h3 className="text-xl font-bold text-slate-900 mb-6">动态与评论</h3>

             {commentError && (
               <div className="mb-4 text-xs text-rose-600 bg-rose-50 border border-rose-100 px-3 py-2 rounded-lg">
                 {commentError}
               </div>
             )}

             {commentAttachmentError && (
               <div className="mb-4 text-xs text-rose-600 bg-rose-50 border border-rose-100 px-3 py-2 rounded-lg">
                 {commentAttachmentError}
               </div>
             )}

             <div className="space-y-6 relative before:absolute before:left-4 before:top-2 before:h-full before:w-0.5 before:bg-slate-100">
               {commentsLoading && (
                 <div className="pl-10 text-xs text-slate-400">评论加载中...</div>
               )}
               {!commentsLoading && topLevelComments.length === 0 && (
                 <div className="pl-10 text-xs text-slate-400">还没有评论，可以率先补充背景或决策信息。</div>
               )}
               {topLevelComments.map((comment) => {
                 const canDelete =
                   !!currentUserEmail &&
                   !!comment.authorEmail &&
                   comment.authorEmail.toLowerCase() === currentUserEmail.toLowerCase();
                 const canEdit = canEditComment(comment);
                 const replies = repliesByParentId[comment.id] || [];
                 const replyValue = replyContentMap[comment.id] || '';
                 const isReplying = replyForCommentId === comment.id;
                 const isUploading = commentAttachmentUploadingId === comment.id;
                 const isReplySubmitting = replySubmittingForParentId === comment.id;

                 return (
                   <div key={comment.id} id={`comment-${comment.id}`} className="relative pl-10">
                     <div
                       className="absolute left-0 top-0 w-9 h-9 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center border-2 border-white shadow-sm"
                       title={comment.authorEmail ? `${comment.authorLabel}（${comment.authorEmail}）` : comment.authorLabel}
                     >
                       <span className="text-sm font-bold">
                         {getAvatarInitial(comment.authorLabel, comment.authorEmail)}
                       </span>
                     </div>
                     <div className="bg-slate-50 p-4 rounded-xl rounded-tl-none">
                       <div className="flex justify-between items-start mb-1">
                         <div className="flex flex-col">
                           <span className="font-bold text-slate-900">
                             {comment.authorLabel}
                           </span>
                           {comment.authorEmail && (
                             <span className="text-[11px] text-slate-400">
                               {comment.authorEmail}
                             </span>
                           )}
                         </div>
                         <span className="text-xs text-slate-400 ml-3 whitespace-nowrap">{comment.createdAt}</span>
                       </div>
                       {editingCommentId === comment.id ? (
                         <div className="mt-1">
                           <textarea
                             value={editingCommentContent}
                             onChange={(e) => setEditingCommentContent(e.target.value)}
                             rows={3}
                             className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                           />
                           <div className="mt-2 flex justify-end gap-2">
                             <button
                               type="button"
                               onClick={handleCancelEditComment}
                               className="px-2 py-1 text-xs text-slate-500 hover:text-slate-700"
                             >
                               取消
                             </button>
                             <button
                               type="button"
                               onClick={() => handleSaveEditComment(comment.id)}
                               disabled={editingCommentSubmitting}
                               className="px-3 py-1 text-xs font-bold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                             >
                               {editingCommentSubmitting ? '保存中...' : '保存'}
                             </button>
                           </div>
                         </div>
                       ) : (
                         <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">{renderContentWithMentions(comment.content)}</p>
                       )}

                       {comment.attachments && comment.attachments.length > 0 && (
                         <div className="mt-3 space-y-2">
                           {comment.attachments.map((file) => {
                             const isImage = file.mimeType?.startsWith('image/');
                             return (
                               <button
                                 key={file.id}
                                 type="button"
                                 onClick={() => {
                                   if (isImage) {
                                     openImagePreview(comment.attachments || [], file.id);
                                   } else if (file.fileUrl) {
                                     window.open(file.fileUrl, '_blank');
                                   }
                                 }}
                                 className="w-full flex items-center gap-3 p-2 border border-slate-200 rounded-lg hover:bg-slate-100 text-left"
                               >
                                 <div className="w-10 h-10 flex items-center justify-center bg-slate-100 rounded-lg overflow-hidden">
                                   {isImage ? (
                                     <img
                                       src={file.fileUrl}
                                       alt={file.fileName}
                                       className="w-full h-full object-cover"
                                     />
                                   ) : (
                                     <Paperclip className="w-4 h-4 text-slate-500" />
                                   )}
                                 </div>
                                 <div className="flex-1 min-w-0">
                                   <div className="text-xs font-medium text-slate-700 truncate">
                                     {file.fileName}
                                   </div>
                                   <div className="text-[10px] text-slate-400">
                                     {file.size > 0 ? `${(file.size / 1024).toFixed(1)} KB` : ''}
                                     {file.createdAt ? ` · 上传于 ${file.createdAt}` : ''}
                                   </div>
                                 </div>
                               </button>
                             );
                           })}
                         </div>
                       )}

                       <div className="mt-3 flex items-center justify-between gap-3">
                         <div className="flex items-center gap-3">
                         <button
                           type="button"
                           disabled={isReplySubmitting}
                           onClick={() => {
                               setReplyForCommentId(comment.id);
                               setReplyToCommentId(comment.id);
                             }}
                             className="text-xs text-slate-400 hover:text-blue-600"
                           >
                             回复
                           </button>
                           {canEdit && (
                             <button
                               type="button"
                               onClick={() => handleStartEditComment(comment)}
                               className="text-xs text-slate-400 hover:text-blue-600"
                             >
                               编辑
                             </button>
                           )}
                           {canDelete && (
                             <button
                               type="button"
                               onClick={() => {
                                 setCommentDeleteError(null);
                                 setCommentDeleteTargetId(comment.id);
                               }}
                               className="text-xs text-slate-400 hover:text-rose-600"
                             >
                               删除
                             </button>
                           )}
                         </div>

                       </div>
                     </div>

                     {replies.length > 0 && (
                       <div className="mt-3 space-y-3">
                         {(() => {
                           const isExpanded = !!expandedReplyParents[comment.id];
                           const visibleReplies = isExpanded ? replies : replies.slice(0, 2);

                           return (
                             <>
                               {visibleReplies.map((reply) => {
                                 const canDeleteReply =
                                   !!currentUserEmail &&
                                   !!reply.authorEmail &&
                                   reply.authorEmail.toLowerCase() === currentUserEmail.toLowerCase();
                                 const canEditReply = canEditComment(reply);
                                 const isReplyUploading = commentAttachmentUploadingId === reply.id;

                                 return (
                                   <div key={reply.id} id={`comment-${reply.id}`} className="relative pl-10 pr-2 max-w-full">
                                     <div
                                       className="absolute left-0 top-0 w-9 h-9 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center border-2 border-white shadow-sm"
                                       title={reply.authorEmail ? `${reply.authorLabel}（${reply.authorEmail}）` : reply.authorLabel}
                                     >
                                       <span className="text-sm font-bold">
                                         {getAvatarInitial(reply.authorLabel, reply.authorEmail)}
                                       </span>
                                     </div>
                                     <div className="ml-6 bg-white p-3 rounded-xl rounded-tl-none border border-slate-100 max-w-full">
                                       <div className="flex justify-between items-start mb-1 gap-2 md:gap-3 flex-wrap">
                                         <div className="flex flex-col min-w-0">
                                           <span className="font-semibold text-slate-900 text-sm">
                                             {reply.authorLabel}
                                           </span>
                                           {reply.authorEmail && (
                                             <span className="text-xs text-slate-400 truncate max-w-full">
                                               {reply.authorEmail}
                                             </span>
                                           )}
                                         </div>
                                         <span className="text-[11px] md:text-xs text-slate-400 ml-3 md:ml-0 md:whitespace-nowrap">
                                           {reply.createdAt}
                                         </span>
                                       </div>
                                       {editingCommentId === reply.id ? (
                                         <div className="mt-1">
                                           <textarea
                                             value={editingCommentContent}
                                             onChange={(e) => setEditingCommentContent(e.target.value)}
                                             rows={3}
                                             className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                           />
                                           <div className="mt-2 flex justify-end gap-2">
                                             <button
                                               type="button"
                                               onClick={handleCancelEditComment}
                                               className="px-2 py-1 text-[11px] text-slate-500 hover:text-slate-700"
                                             >
                                               取消
                                             </button>
                                             <button
                                               type="button"
                                               onClick={() => handleSaveEditComment(reply.id)}
                                               disabled={editingCommentSubmitting}
                                               className="px-3 py-1 text-[11px] font-bold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                                             >
                                               {editingCommentSubmitting ? '保存中...' : '保存'}
                                             </button>
                                           </div>
                                         </div>
                                       ) : (
                                         <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">
                                           {reply.replyToCommentId && commentMap[reply.replyToCommentId] && commentMap[reply.replyToCommentId].id !== comment.id
                                             ? `回复 ${commentMap[reply.replyToCommentId].authorLabel}：`
                                             : ''}
                                           {renderContentWithMentions(reply.content)}
                                         </p>
                                       )}

                                       {reply.attachments && reply.attachments.length > 0 && (
                                         <div className="mt-2 space-y-2">
                                           {reply.attachments.map((file) => {
                                             const isImage = file.mimeType?.startsWith('image/');
                                             return (
                                               <button
                                                 key={file.id}
                                                 type="button"
                                                 onClick={() => {
                                                   if (isImage) {
                                                     openImagePreview(reply.attachments || [], file.id);
                                                   } else if (file.fileUrl) {
                                                     window.open(file.fileUrl, '_blank');
                                                   }
                                                 }}
                                                 className="w-full flex items-center gap-3 p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-left"
                                               >
                                                 <div className="w-9 h-9 flex items-center justify-center bg-slate-100 rounded-lg overflow-hidden">
                                                   {isImage ? (
                                                     <img
                                                       src={file.fileUrl}
                                                       alt={file.fileName}
                                                       className="w-full h-full object-cover"
                                                     />
                                                   ) : (
                                                     <Paperclip className="w-3 h-3 text-slate-500" />
                                                   )}
                                                 </div>
                                                 <div className="flex-1 min-w-0">
                                                   <div className="text-[11px] font-medium text-slate-700 truncate">
                                                     {file.fileName}
                                                   </div>
                                                   <div className="text-[10px] text-slate-400">
                                                     {file.size > 0 ? `${(file.size / 1024).toFixed(1)} KB` : ''}
                                                     {file.createdAt ? ` · 上传于 ${file.createdAt}` : ''}
                                                   </div>
                                                 </div>
                                               </button>
                                             );
                                           })}
                                         </div>
                                       )}

                                       <div className="mt-2 flex items-center justify-between gap-3">
                                         <div className="flex items-center gap-3">
                                           <button
                                             type="button"
                                             onClick={() => {
                                               setReplyForCommentId(comment.id);
                                               setReplyToCommentId(reply.id);
                                             }}
                                             className="text-[11px] text-slate-400 hover:text-blue-600"
                                           >
                                             回复
                                           </button>
                                           {canEditReply && (
                                             <button
                                               type="button"
                                               onClick={() => handleStartEditComment(reply)}
                                               className="text-[11px] text-slate-400 hover:text-blue-600"
                                             >
                                               编辑
                                             </button>
                                           )}
                                           {canDeleteReply && (
                                             <button
                                               type="button"
                                               onClick={() => {
                                                 setCommentDeleteError(null);
                                                 setCommentDeleteTargetId(reply.id);
                                               }}
                                               className="text-[11px] text-slate-400 hover:text-rose-600"
                                             >
                                               删除
                                             </button>
                                           )}
                                         </div>

                                       </div>
                                     </div>
                                   </div>
                                 );
                               })}

                               {replies.length > 2 && (
                                 <button
                                   type="button"
                                   onClick={() =>
                                     setExpandedReplyParents((prev) => ({
                                       ...prev,
                                       [comment.id]: !isExpanded,
                                     }))
                                   }
                                   className="ml-6 text-[11px] text-blue-600 hover:underline mt-1"
                                 >
                                   {isExpanded ? '收起回复' : `展开全部 ${replies.length} 条回复`}
                                 </button>
                               )}
                             </>
                           );
                         })()}
                       </div>
                     )}

                     {isReplying && (
                       <div
                         className="mt-3 ml-6 flex items-center gap-2 relative"
                         ref={replyForCommentId === comment.id ? activeReplyInputRef : undefined}
                       >
                         <textarea
                           rows={2}
                           value={replyValue}
                           disabled={isReplySubmitting}
                           onChange={(e) => {
                             const value = e.target.value;
                             setReplyContentMap((prev) => ({ ...prev, [comment.id]: value }));
                             updateMentionState(value, { type: 'reply', parentId: comment.id });
                             if (commentError) {
                               setCommentError(null);
                             }
                           }}
                           onKeyDown={(e) => {
                             if (e.key === 'Enter' && !e.shiftKey) {
                               e.preventDefault();
                               if (!isReplySubmitting) {
                                 handleReplySubmit(comment.id);
                               }
                             }
                           }}
                           placeholder={replyToCommentId && commentMap[replyToCommentId]
                             ? `回复 ${commentMap[replyToCommentId].authorLabel}...`
                             : '回复这条评论...'}
                           className="flex-1 pl-3 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                         />
                         <label className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-slate-100 cursor-pointer text-slate-500">
                           <input
                             type="file"
                             multiple
                             className="hidden"
                             onChange={(e) => {
                               const files = e.target.files ? Array.from(e.target.files) : [];
                               if (files.length) {
                                 setPendingReplyFilesMap((prev) => ({
                                   ...prev,
                                   [comment.id]: [...(prev[comment.id] || []), ...files],
                                 }));
                                 if (commentError) {
                                   setCommentError(null);
                                 }
                               }
                               if (e.target) {
                                 e.target.value = '';
                               }
                             }}
                           />
                           <Paperclip className="w-3 h-3" />
                         </label>
                         <button
                           type="button"
                           disabled={isReplySubmitting}
                           onClick={() => {
                             const next = (replyValue || '') + '@';
                             setReplyContentMap((prev) => ({ ...prev, [comment.id]: next }));
                             updateMentionState(next, { type: 'reply', parentId: comment.id });
                           }}
                           className="w-6 h-6 flex items-center justify-center text-xs rounded-full hover:bg-slate-100"
                         >
                           <span>@</span>
                         </button>
                         <button
                           type="button"
                           disabled={isReplySubmitting}
                           onClick={() =>
                             setOpenReplyEmojiForParentId((prev) => (prev === comment.id ? null : comment.id))
                           }
                           className="w-6 h-6 flex items-center justify-center text-base rounded-full hover:bg-slate-100"
                         >
                           <span>😊</span>
                         </button>
                         {openReplyEmojiForParentId === comment.id && (
                           <div className="absolute left-0 -bottom-28 md:-bottom-24 bg-white border border-slate-200 rounded-xl shadow-md px-2 py-1 flex flex-wrap gap-1 z-10 w-56">
                             {COMMENT_EMOJIS.map((emoji) => (
                               <button
                                 key={emoji}
                                 type="button"
                                 onClick={() => {
                                   setReplyContentMap((prev) => ({
                                     ...prev,
                                     [comment.id]: ((prev[comment.id] || '') + emoji),
                                   }));
                                 }}
                                 className="w-7 h-7 flex items-center justify-center text-lg hover:bg-slate-100 rounded"
                               >
                                 {emoji}
                               </button>
                             ))}
                           </div>
                         )}
                         {activeMentionContext && activeMentionContext.type === 'reply' && activeMentionContext.parentId === comment.id && visibleMentionUsers.length > 0 && (
                           <div className="absolute left-0 -top-40 md:-top-44 bg-white border border-slate-200 rounded-xl shadow-md px-2 py-2 z-20 w-64 max-h-56 overflow-y-auto">
                             {visibleMentionUsers.map((user) => {
                               const displayName = user.name || (user.email ? user.email.split('@')[0] : '');
                               return (
                                 <button
                                   key={user.id}
                                   type="button"
                                   onClick={() => handleSelectMention(user)}
                                   className="w-full flex flex-col items-start px-2 py-1.5 rounded-lg hover:bg-slate-50 text-left"
                                 >
                                   <span className="text-sm text-slate-900">{displayName}</span>
                                   {user.email && (
                                     <span className="text-[11px] text-slate-400">{user.email}</span>
                                   )}
                                 </button>
                               );
                             })}
                           </div>
                         )}
                         {pendingReplyFilesMap[comment.id] && pendingReplyFilesMap[comment.id].length > 0 && (
                           <div className="mt-2 flex flex-wrap gap-2">
                             {pendingReplyFilesMap[comment.id].map((file, index) => (
                               <div
                                 key={index}
                                 className="px-2 py-1 text-[10px] bg-slate-100 text-slate-600 rounded-full flex items-center gap-1 max-w-[180px]"
                               >
                                 <span className="truncate max-w-[140px]">{file.name}</span>
                                 <button
                                   type="button"
                                   onClick={() => {
                                     setPendingReplyFilesMap((prev) => {
                                       const next = { ...prev };
                                       const list = [...(next[comment.id] || [])];
                                       list.splice(index, 1);
                                       if (list.length) {
                                         next[comment.id] = list;
                                       } else {
                                         delete next[comment.id];
                                       }
                                       return next;
                                     });
                                   }}
                                   className="ml-1 text-[9px] text-slate-400 hover:text-slate-600"
                                 >
                                   ✕
                                 </button>
                               </div>
                             ))}
                           </div>
                         )}
                         <button
                           type="button"
                           disabled={isReplySubmitting}
                           onClick={() => handleReplySubmit(comment.id)}
                           className="px-3 py-2 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                         >
                           {isReplySubmitting ? '发送中...' : '发送'}
                         </button>
                         <button
                           type="button"
                           disabled={isReplySubmitting}
                           onClick={() => {
                             setReplyForCommentId(null);
                             setReplyToCommentId(null);
                           }}
                           className="px-2 py-2 text-xs text-slate-400 hover:text-slate-600"
                         >
                           取消
                         </button>
                       </div>
                     )}
                   </div>
                 );
               })}
             </div>

             <div className="mt-6 flex gap-3 pl-10">
               <div
                 className="w-9 h-9 bg-slate-200 rounded-full flex-shrink-0 flex items-center justify-center text-slate-600 text-sm font-bold"
                 title={currentUserEmail || undefined}
               >
                 {getAvatarInitial(currentUserDisplayName || undefined, currentUserEmail)}
               </div>
               <div className="flex-1 relative" ref={mainCommentInputRef}>
                 <textarea
                   rows={2}
                   placeholder="发表评论，补充需求背景或进展..."
                   value={commentInput}
                   onChange={(e) => {
                     const value = e.target.value;
                     setCommentInput(value);
                     updateMentionState(value, { type: 'main' });
                     if (commentError) {
                       setCommentError(null);
                     }
                   }}
                   onKeyDown={handleMainInputKeyDown}
                   disabled={commentSubmitting}
                   className="w-full pl-4 pr-28 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-50 resize-none"
                 />
                 <button
                   type="button"
                   onClick={() => {
                     const next = (commentInput || '') + '@';
                     setCommentInput(next);
                     updateMentionState(next, { type: 'main' });
                   }}
                   className="absolute right-20 top-2 w-7 h-7 flex items-center justify-center text-base rounded-full hover:bg-slate-100"
                 >
                   <span>@</span>
                 </button>
                 <label className="absolute right-28 top-2 w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-100 cursor-pointer text-slate-500">
                   <input
                     type="file"
                     multiple
                     className="hidden"
                     onChange={(e) => {
                       const files = e.target.files ? Array.from(e.target.files) : [];
                       if (files.length) {
                         setPendingCommentFiles((prev) => [...prev, ...files]);
                         if (commentError) {
                           setCommentError(null);
                         }
                       }
                       if (e.target) {
                         e.target.value = '';
                       }
                     }}
                   />
                   <Paperclip className="w-4 h-4" />
                 </label>
                 <button
                   type="button"
                   onClick={() => setShowMainEmojiPicker((prev) => !prev)}
                   className="absolute right-12 top-2 w-7 h-7 flex items-center justify-center text-lg rounded-full hover:bg-slate-100"
                 >
                   <span>😊</span>
                 </button>
                 <button
                   onClick={handleAddComment}
                   disabled={commentSubmitting}
                   className="absolute right-2 top-2 px-2 py-1 text-blue-600 hover:bg-blue-50 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed"
                 >
                   <ArrowRight className="w-5 h-5" />
                 </button>
                 {showMainEmojiPicker && (
                   <div className="absolute right-0 -bottom-28 md:-bottom-24 bg-white border border-slate-200 rounded-xl shadow-md px-2 py-1 flex flex-wrap gap-1 z-10 w-64">
                     {COMMENT_EMOJIS.map((emoji) => (
                       <button
                         key={emoji}
                         type="button"
                         onClick={() => {
                           setCommentInput((prev) => (prev || '') + emoji);
                         }}
                         className="w-7 h-7 flex items-center justify-center text-lg hover:bg-slate-100 rounded"
                       >
                         {emoji}
                       </button>
                     ))}
                   </div>
                 )}
                 {pendingCommentFiles.length > 0 && (
                   <div className="mt-2 flex flex-wrap gap-2">
                     {pendingCommentFiles.map((file, index) => (
                       <div
                         key={index}
                         className="px-2 py-1 text-[11px] bg-slate-100 text-slate-600 rounded-full flex items-center gap-1 max-w-[200px]"
                       >
                         <span className="truncate max-w-[150px]">{file.name}</span>
                         <button
                           type="button"
                           disabled={commentSubmitting}
                           onClick={() => {
                             setPendingCommentFiles((prev) => prev.filter((_, i) => i !== index));
                           }}
                           className="ml-1 text-[10px] text-slate-400 hover:text-slate-600"
                         >
                           ✕
                         </button>
                       </div>
                     ))}
                   </div>
                 )}
                 {activeMentionContext && activeMentionContext.type === 'main' && visibleMentionUsers.length > 0 && (
                   <div className="absolute left-0 -top-40 md:-top-44 bg-white border border-slate-200 rounded-xl shadow-md px-2 py-2 z-20 w-64 max-h-56 overflow-y-auto">
                     {visibleMentionUsers.map((user) => {
                       const displayName = user.name || (user.email ? user.email.split('@')[0] : '');
                       return (
                         <button
                           key={user.id}
                           type="button"
                           onClick={() => handleSelectMention(user)}
                           className="w-full flex flex-col items-start px-2 py-1.5 rounded-lg hover:bg-slate-50 text-left"
                         >
                           <span className="text-sm text-slate-900">{displayName}</span>
                           {user.email && (
                             <span className="text-[11px] text-slate-400">{user.email}</span>
                           )}
                         </button>
                       );
                     })}
                   </div>
                 )}
               </div>
             </div>
          </div>
        </div>

        <Modal
          isOpen={deleteModalOpen}
          onClose={() => {
            if (deleteSubmitting) return;
            setDeleteModalOpen(false);
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
              确认要删除当前需求吗？删除后将无法在列表中继续查看该需求，相关评分记录和评论不会自动清理，请谨慎操作。
            </p>
            <p className="text-xs text-slate-400">
              如果只是暂时不推进，建议将状态调整为「不处理」，而不是直接删除。
            </p>
            <div className="pt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  if (deleteSubmitting) return;
                  setDeleteModalOpen(false);
                  setDeleteError(null);
                }}
                disabled={deleteSubmitting}
                className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleDeleteDemand}
                disabled={deleteSubmitting}
                className="px-4 py-2 bg-rose-600 text-white font-bold rounded-lg hover:bg-rose-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {deleteSubmitting ? '删除中...' : '确认删除'}
              </button>
            </div>
          </div>
        </Modal>

        <Modal
          isOpen={commentDeleteTargetId != null}
          onClose={() => {
            if (commentDeleteSubmitting) return;
            setCommentDeleteTargetId(null);
            setCommentDeleteError(null);
          }}
          title="确认删除评论"
        >
          <div className="space-y-4">
            {commentDeleteError && (
              <div className="text-xs text-rose-600 bg-rose-50 border border-rose-100 px-3 py-2 rounded-lg">
                {commentDeleteError}
              </div>
            )}
            <p className="text-sm text-slate-600">
              确认要删除这条评论吗？删除后将无法恢复，相关附件也会一并不可见。
            </p>
            <div className="pt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  if (commentDeleteSubmitting) return;
                  setCommentDeleteTargetId(null);
                  setCommentDeleteError(null);
                }}
                disabled={commentDeleteSubmitting}
                className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteComment}
                disabled={commentDeleteSubmitting}
                className="px-4 py-2 bg-rose-600 text-white font-bold rounded-lg hover:bg-rose-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {commentDeleteSubmitting ? '删除中...' : '确认删除'}
              </button>
            </div>
          </div>
        </Modal>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
             <h3 className="text-base font-bold text-slate-900 mb-4 uppercase tracking-wide text-opacity-80">基本属性</h3>
             {saveError && (
               <div className="mb-3 text-xs text-rose-600 bg-rose-50 border border-rose-100 px-3 py-2 rounded-lg">
                 {saveError}
               </div>
             )}
             {statusUpdateError && (
               <div className="mb-3 text-xs text-rose-600 bg-rose-50 border border-rose-100 px-3 py-2 rounded-lg">
                 {statusUpdateError}
               </div>
             )}
             <div className="space-y-4">
               <div className="flex items-center justify-between">
                 <span className="text-slate-500 flex items-center gap-2"><Calendar className="w-4 h-4" /> 截止日期</span>
                 {isEditing ? (
                   <input
                     type="date"
                     value={draftDueDate}
                     onChange={(e) => setDraftDueDate(e.target.value)}
                     className="px-2 py-1 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                   />
                 ) : (
                   <span className="font-medium text-slate-900">{demand.dueDate}</span>
                 )}
               </div>
               <div className="flex items-center justify-between">
                 <span className="text-slate-500 flex items-center gap-2"><Clock className="w-4 h-4" /> 创建时间</span>
                 <span className="font-medium text-slate-900">{demand.createdAt}</span>
               </div>
               <div className="flex items-center justify-between">
                 <span className="text-slate-500">优先级</span>
                 {isEditing ? (
                   <select
                     value={draftPriority || demand.priority}
                     onChange={(e) => setDraftPriority(e.target.value as Priority)}
                     className="px-2 py-1 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                   >
                     <option value={Priority.MEDIUM}>{Priority.MEDIUM}</option>
                     <option value={Priority.LOW}>{Priority.LOW}</option>
                     <option value={Priority.HIGH}>{Priority.HIGH}</option>
                     <option value={Priority.CRITICAL}>{Priority.CRITICAL}</option>
                   </select>
                 ) : (
                   <span className="font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded">{demand.priority}</span>
                 )}
               </div>
               <div className="flex items-center justify-between">
                 <span className="text-slate-500">当前状态</span>
                 {isEditing ? (
                   <select
                     value={draftStatus || demand.status}
                     onChange={(e) => setDraftStatus(e.target.value as DemandStatus)}
                     className="px-2 py-1 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                   >
                     {quickStatusOptions.map((status) => (
                       <option key={status} value={status}>
                         {status}
                       </option>
                     ))}
                   </select>
                 ) : (
                   <div className="flex items-center gap-2">
                     <Badge variant="warning">{demand.status}</Badge>
                     <select
                       value={demand.status}
                       onChange={(e) => handleQuickStatusChange(e.target.value as DemandStatus)}
                       disabled={statusUpdating}
                       className="px-2 py-1 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                     >
                       {quickStatusOptions.map((status) => (
                         <option key={status} value={status}>
                           {status}
                         </option>
                       ))}
                     </select>
                     {statusUpdating && (
                       <span className="text-[11px] text-slate-400">更新中...</span>
                     )}
                   </div>
                 )}
               </div>
             </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
             <h3 className="text-base font-bold text-slate-900 mb-4 uppercase tracking-wide text-opacity-80">状态流转</h3>
             <div className="mt-2 space-y-3">
               <p className="text-xs text-slate-500">
                 默认流程为：待处理 → 进行中 → 已完成，"已延期"和"不处理"为特殊状态。当前状态会高亮，便于快速判断进度。
               </p>
               <div className="flex flex-col gap-3">
                 {statusFlowOrder.map((status, index) => {
                   const isPastOrCurrent = currentStatusIndex >= 0 && index <= currentStatusIndex;
                   const isCurrent = currentStatusIndex === index;
                   const isFuture = currentStatusIndex >= 0 && index > currentStatusIndex;

                   const circleStyle = isPastOrCurrent
                     ? 'bg-blue-600 text-white border-blue-600'
                     : 'bg-white text-slate-400 border-slate-300';
                   const barStyle = isPastOrCurrent
                     ? 'bg-blue-500'
                     : 'bg-slate-200';

                   return (
                     <div key={status} className="flex items-center gap-3">
                       <div className="flex items-center gap-2">
                         <div
                           className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs font-bold ${circleStyle}`}
                         >
                           {index + 1}
                         </div>
                         {index < statusFlowOrder.length - 1 && (
                           <div className={`h-0.5 w-6 rounded ${barStyle}`} />
                         )}
                       </div>
                       <div className="flex flex-col">
                         <span
                           className={`text-xs font-bold ${
                             isCurrent
                               ? 'text-blue-700'
                               : isPastOrCurrent
                               ? 'text-slate-800'
                               : 'text-slate-500'
                           }`}
                         >
                           {status}
                           {isCurrent && (
                             <span className="ml-1 text-[10px] text-blue-500">(当前)</span>
                           )}
                         </span>
                         {isFuture && index === currentStatusIndex + 1 && (
                           <span className="text-[10px] text-slate-400">
                             建议下一步将状态推进到此阶段
                           </span>
                         )}
                       </div>
                     </div>
                   );
                 })}
               </div>
               {demand && (demand.status === DemandStatus.DELAYED || demand.status === DemandStatus.IGNORED) && (
                 <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] text-amber-700">
                   {demand.status === DemandStatus.DELAYED
                     ? '当前需求处于"已延期"状态，这是在"进行中"基础上的特殊标记，用于提醒存在进度风险。'
                     : '当前需求处于"不处理"状态，表示本次不再推进，后续需要重新拉起时建议新建需求。'}
                 </div>
               )}
             </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
             <h3 className="text-base font-bold text-slate-900 mb-4 uppercase tracking-wide text-opacity-80">人员信息</h3>
             <div className="space-y-4">
               <div>
                 <div className="text-xs text-slate-400 mb-1">创建人</div>
                 <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs">
                      {getAvatarInitial(demand.creatorName || demand.creatorId, demand.creatorEmail)}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium text-slate-700">
                        {demand.creatorName || demand.creatorId}
                      </span>
                      {demand.creatorEmail && (
                        <span className="text-xs text-slate-400">{demand.creatorEmail}</span>
                      )}
                    </div>
                 </div>
               </div>
               <div>
                 <div className="text-xs text-slate-400 mb-1">执行人</div>
                 {demand.assigneeName || demand.assigneeId || demand.assigneeEmail ? (
                   <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-pink-100 text-pink-600 flex items-center justify-center font-bold text-xs">
                        {getAvatarInitial(
                          demand.assigneeName || demand.assigneeId,
                          demand.assigneeEmail
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-700">
                          {demand.assigneeName || demand.assigneeId}
                        </span>
                        {demand.assigneeEmail && (
                          <span className="text-xs text-slate-400">{demand.assigneeEmail}</span>
                        )}
                      </div>
                   </div>
                 ) : (
                   <div className="text-sm text-slate-400">暂未指定执行人</div>
                 )}
               </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}