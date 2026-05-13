"use client";

export const runtime = "edge";

import React, { useEffect, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, User, MessageSquare, CheckCircle2, Edit3, ArrowRight, Copy } from 'lucide-react';
import { hasPermission } from '../../../../lib/permissions';
import { authorizedFetch } from '../../../../lib/authFetch';
import { DemandStatus } from '../../../../types';
import Badge from '../../../../components/ui/Badge';
import DemandAttachmentsSection from '../../../../components/DemandAttachmentsSection';
import ConfirmDangerModal from '../../../../components/demand-detail/ConfirmDangerModal';
import DemandCustomFieldsSection from '../../../../components/demand-detail/DemandCustomFieldsSection';
import ImagePreviewLightbox from '../../../../components/demand-detail/ImagePreviewLightbox';
import DemandSidebarSections from '../../../../components/demand-detail/DemandSidebarSections';
import {
  type AttachmentItem,
  type CommentAttachment,
  type DemandComment,
  type MentionContext,
  type MentionUser,
} from '../../../../components/demand-detail/types';
import {
  useDemandDetailBootstrap,
  useDemandThreadData,
} from '../../../../hooks/useDemandDetailPageData';
import {
  useDemandCommentActions,
  useDemandMutationActions,
} from '../../../../hooks/useDemandDetailActions';

const DemandCommentsSectionComponent = dynamic(
  () => import('../../../../components/DemandCommentsSection')
);

const COMMENT_EMOJIS = ['😀','😂','🤣','😅','😍','🤔','👍','🚀','🎉','😭'] as const;

const getAvatarInitial = (label?: string, email?: string | null) => {
  const base = (label || '') || (email || '');
  if (!base) return '';
  const trimmed = base.trim();
  if (!trimmed) return '';
  const first = trimmed[0];
  return first.toUpperCase();
};

export default function DemandDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const {
    departments,
    templateFields,
    demand,
    setDemand,
    loading,
    error,
    workflowConfig,
    currentUserRole,
    currentUserPermissions,
    currentUserId,
    currentUserEmail,
    currentUserDepartmentId,
    mentionUsers,
  } = useDemandDetailBootstrap(id);
  const {
    comments,
    setComments,
    commentsLoading,
    attachments,
    setAttachments,
    attachmentsLoading,
    attachmentError,
    setAttachmentError,
  } = useDemandThreadData(id);

  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [draftPriority, setDraftPriority] = useState<string>('');
  const [draftDueDate, setDraftDueDate] = useState('');
  const [draftStatus, setDraftStatus] = useState<string>('');
  const [draftCustomFields, setDraftCustomFields] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [statusUpdateError, setStatusUpdateError] = useState<string | null>(null);
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
  const [replyForCommentId, setReplyForCommentId] = useState<number | null>(null);
  const [replyToCommentId, setReplyToCommentId] = useState<number | null>(null);
  const [replyContentMap, setReplyContentMap] = useState<Record<number, string>>({});
  const [commentAttachmentUploadingId, setCommentAttachmentUploadingId] = useState<number | null>(null);
  const [commentAttachmentError, setCommentAttachmentError] = useState<string | null>(null);
  const [expandedReplyParents, setExpandedReplyParents] = useState<Record<number, boolean>>({});
  const [showMainEmojiPicker, setShowMainEmojiPicker] = useState(false);
  const [openReplyEmojiForParentId, setOpenReplyEmojiForParentId] = useState<number | null>(null);
  const [mentionQuery, setMentionQuery] = useState('');
  const [activeMentionContext, setActiveMentionContext] = useState<MentionContext | null>(null);
  const [pendingCommentFiles, setPendingCommentFiles] = useState<File[]>([]);
  const [pendingReplyFilesMap, setPendingReplyFilesMap] = useState<Record<number, File[]>>({});
  const [attachmentUploading, setAttachmentUploading] = useState(false);
  const [imagePreviewList, setImagePreviewList] = useState<CommentAttachment[]>([]);
  const [imagePreviewIndex, setImagePreviewIndex] = useState(0);
  const [deptUsers, setDeptUsers] = useState<{ id: number; name: string | null; email: string | null }[]>([]);
  const [deptUsersLoading, setDeptUsersLoading] = useState(false);
  const [assigningAssignee, setAssigningAssignee] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

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

  // 计算允许的“向前推进”状态（只允许往后阶段，不允许倒退）
  const getAllowedNextStatuses = React.useMemo(() => {
    if (!demand || !workflowConfig || workflowConfig.statuses.length === 0) {
      return null;
    }

    const currentStatusConfig = workflowConfig.statuses.find((s) => s.value === demand.status);
    if (!currentStatusConfig) {
      // 如果当前状态不在配置中，只允许切到配置里的其他状态
      return workflowConfig.statuses.filter((s) => s.value !== demand.status);
    }

    const currentOrder = currentStatusConfig.order;

    // 如果配置了 transitions，则：只允许 transitions 中，且 order 比当前大的状态
    if (currentStatusConfig.transitions && currentStatusConfig.transitions.length > 0) {
      return workflowConfig.statuses.filter(
        (s) => currentStatusConfig.transitions!.includes(s.value) && s.order > currentOrder
      );
    }

    // 如果没有配置 transitions，则：只允许所有 order 在当前之后的状态
    return workflowConfig.statuses.filter((s) => s.order > currentOrder);
  }, [demand, workflowConfig]);

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
    if (!demand) {
      return;
    }

    setDraftTitle(demand.title);
    setDraftDescription(demand.description);
    setDraftPriority(demand.priority || workflowConfig?.priorities[0]?.value || '');
    setDraftDueDate(demand.dueDate || '');
    setDraftStatus(demand.status || workflowConfig?.statuses[0]?.value || '');
    setDraftCustomFields(demand.customFields || {});
  }, [demand, workflowConfig]);

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

  useEffect(() => {
    const loadDeptUsers = async () => {
      if (!demand?.departmentId) {
        setDeptUsers([]);
        return;
      }

      setDeptUsersLoading(true);
      try {
        const res = await authorizedFetch(
          `/api/users/by-department?departmentId=${encodeURIComponent(demand.departmentId)}`
        );
        if (!res.ok) {
          console.error('load department users in detail error', await res.text());
          setDeptUsers([]);
          return;
        }

        const json = await res.json();
        setDeptUsers(
          (json.items || []) as { id: number; name: string | null; email: string | null }[]
        );
      } catch (err) {
        console.error('load department users in detail error', err);
        setDeptUsers([]);
      } finally {
        setDeptUsersLoading(false);
      }
    };

    loadDeptUsers();
  }, [demand?.departmentId]);

  const deptName = demand
    ? departments.find(d => d.id === demand.departmentId)?.name || 'Loading...'
    : 'Loading...';

  const canDeleteDemand =
    (currentUserRole
      ? hasPermission(currentUserRole, 'demand.delete', currentUserPermissions || undefined)
      : false) ||
    (!!demand && !!currentUserId && demand.creatorUserId === currentUserId);
  const demandDepartment = demand
    ? departments.find((department) => department.id === demand.departmentId)
    : null;
  const isDesignDemand = (demandDepartment?.slug || '').toLowerCase() === 'design';
  const isSameDepartmentMember =
    !!demand && !!currentUserDepartmentId && currentUserDepartmentId === Number(demand.departmentId);
  const canAssignDemand =
    !!demand &&
    (currentUserRole === 'admin' ||
      (isDesignDemand && isSameDepartmentMember) ||
      (currentUserRole === 'manager' && isSameDepartmentMember));

  const normalizedStatusForFlow: DemandStatus | null =
    demand?.status === DemandStatus.DELAYED
      ? DemandStatus.IN_PROGRESS
      : demand?.status === DemandStatus.IGNORED
      ? DemandStatus.DONE
      : (demand?.status as DemandStatus) ?? null;

  const currentStatusIndex =
    workflowConfig && workflowConfig.statuses.length > 0 && demand
      ? workflowConfig.statuses.findIndex((s) => s.value === demand.status)
      : normalizedStatusForFlow != null
      ? statusFlowOrder.indexOf(normalizedStatusForFlow)
      : -1;

  const { handleDeleteDemand, handleSave, handleQuickStatusChange, handleAssignAssignee } =
    useDemandMutationActions({
      id,
      router,
      demand,
      draftTitle,
      draftDescription,
      draftPriority,
      draftDueDate,
      draftStatus,
      draftCustomFields,
      deleteSubmitting,
      setDeleteSubmitting,
      setDeleteError,
      setDeleteModalOpen,
      setSaving,
      setSaveError,
      setDemand,
      setIsEditing,
      setStatusUpdating,
      setStatusUpdateError,
      setDraftStatus,
      setAssigningAssignee,
      setAssignError,
    });

  const {
    handleAddComment,
    handleConfirmDeleteComment,
    handleReplySubmit,
    handleSaveEditComment,
  } = useDemandCommentActions({
    id,
    currentUserEmail,
    commentInput,
    pendingCommentFiles,
    replyContentMap,
    pendingReplyFilesMap,
    replyToCommentId,
    commentDeleteTargetId,
    commentDeleteSubmitting,
    editingCommentId,
    editingCommentContent,
    setCommentInput,
    setCommentError,
    setCommentSubmitting,
    setComments,
    setPendingCommentFiles,
    setCommentAttachmentUploadingId,
    setCommentAttachmentError,
    setReplySubmittingForParentId,
    setReplyContentMap,
    setPendingReplyFilesMap,
    setReplyForCommentId,
    setReplyToCommentId,
    setCommentDeleteSubmitting,
    setCommentDeleteError,
    setCommentDeleteTargetId,
    setEditingCommentId,
    setEditingCommentContent,
    setEditingCommentSubmitting,
  });


  const handleStartEdit = () => {
    setIsEditing(true);
    setSaveError(null);
  };

  const handleCopyDemand = async () => {
    if (!demand) return;
    try {
      const res = await authorizedFetch(`/api/demands/${encodeURIComponent(demand.id)}/copy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        console.error('copy demand error', await res.text());
        return;
      }
      const json = await res.json();
      const nextId = json?.demand?.id as string | undefined;
      if (nextId) {
        router.push(`/demands/${nextId}`);
      }
    } catch (err) {
      console.error('copy demand error', err);
    }
  };

  const handleCancelEdit = () => {
    if (demand) {
      setDraftTitle(demand.title);
      setDraftDescription(demand.description);
      setDraftPriority(demand.priority || '');
      setDraftDueDate(demand.dueDate || '');
      setDraftStatus(demand.status || '');
      setDraftCustomFields(demand.customFields || {});
    }
    setIsEditing(false);
    setSaveError(null);
  };

  const openImagePreview = (
    allFiles: CommentAttachment[] | AttachmentItem[],
    targetId: number
  ) => {
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

  const topLevelComments = React.useMemo(
    () => comments.filter((c) => !c.parentId),
    [comments]
  );

  const repliesByParentId = React.useMemo(() => {
    const groupedReplies: Record<number, DemandComment[]> = {};

    comments.forEach((comment) => {
      if (!comment.parentId) {
        return;
      }

      if (!groupedReplies[comment.parentId]) {
        groupedReplies[comment.parentId] = [];
      }

      groupedReplies[comment.parentId].push(comment);
    });

    return groupedReplies;
  }, [comments]);

  const commentMap = React.useMemo(() => {
    const nextCommentMap: Record<number, DemandComment> = {};

    comments.forEach((comment) => {
      nextCommentMap[comment.id] = comment;
    });

    return nextCommentMap;
  }, [comments]);

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

  const filteredMentionUsers = React.useMemo(() => {
    if (!mentionQuery) {
      return mentionUsers;
    }

    const q = mentionQuery.toLowerCase();
    return mentionUsers.filter((user) => {
      const name = (user.name || '').toLowerCase();
      const email = (user.email || '').toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [mentionQuery, mentionUsers]);

  const visibleMentionUsers = React.useMemo(
    () => filteredMentionUsers.slice(0, 8),
    [filteredMentionUsers]
  );

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
                      onClick={handleCopyDemand}
                      className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-bold text-slate-600 bg-slate-50 rounded-lg hover:bg-slate-100 border border-slate-200"
                    >
                      <Copy className="w-3 h-3" /> 复制
                    </button>
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
            
            <DemandCustomFieldsSection
              templateFields={templateFields}
              isEditing={isEditing}
              demandCustomFields={demand.customFields}
              draftCustomFields={draftCustomFields}
              setDraftCustomFields={setDraftCustomFields}
            />

            <DemandAttachmentsSection
              attachments={attachments}
              attachmentsLoading={attachmentsLoading}
              attachmentError={attachmentError}
              isEditing={isEditing}
              currentUserEmail={currentUserEmail}
              attachmentUploading={attachmentUploading}
              demandCode={id}
              openImagePreview={openImagePreview}
              setAttachmentError={setAttachmentError}
              setAttachmentUploading={setAttachmentUploading}
              setAttachments={setAttachments}
            />
          </div>

          <ImagePreviewLightbox
            imagePreviewList={imagePreviewList}
            imagePreviewIndex={imagePreviewIndex}
            setImagePreviewList={setImagePreviewList}
            setImagePreviewIndex={setImagePreviewIndex}
          />

          <DemandCommentsSectionComponent
            commentEmojis={COMMENT_EMOJIS}
            commentError={commentError}
            setCommentError={setCommentError}
            commentAttachmentError={commentAttachmentError}
            commentsLoading={commentsLoading}
            topLevelComments={topLevelComments}
            currentUserEmail={currentUserEmail}
            canEditComment={canEditComment}
            repliesByParentId={repliesByParentId}
            replyContentMap={replyContentMap}
            setReplyContentMap={setReplyContentMap}
            replyForCommentId={replyForCommentId}
            setReplyForCommentId={setReplyForCommentId}
            replyToCommentId={replyToCommentId}
            setReplyToCommentId={setReplyToCommentId}
            replySubmittingForParentId={replySubmittingForParentId}
            getAvatarInitial={getAvatarInitial}
            editingCommentId={editingCommentId}
            editingCommentContent={editingCommentContent}
            setEditingCommentContent={setEditingCommentContent}
            handleCancelEditComment={handleCancelEditComment}
            handleSaveEditComment={handleSaveEditComment}
            editingCommentSubmitting={editingCommentSubmitting}
            renderContentWithMentions={renderContentWithMentions}
            openImagePreview={openImagePreview}
            commentMap={commentMap}
            expandedReplyParents={expandedReplyParents}
            setExpandedReplyParents={setExpandedReplyParents}
            setCommentDeleteError={setCommentDeleteError}
            setCommentDeleteTargetId={setCommentDeleteTargetId}
            activeReplyInputRef={activeReplyInputRef}
            activeMentionContext={activeMentionContext}
            visibleMentionUsers={visibleMentionUsers}
            handleSelectMention={handleSelectMention}
            pendingReplyFilesMap={pendingReplyFilesMap}
            setPendingReplyFilesMap={setPendingReplyFilesMap}
            openReplyEmojiForParentId={openReplyEmojiForParentId}
            setOpenReplyEmojiForParentId={setOpenReplyEmojiForParentId}
            handleReplySubmit={handleReplySubmit}
            mainCommentInputRef={mainCommentInputRef}
            currentUserDisplayName={currentUserDisplayName}
            commentInput={commentInput}
            setCommentInput={setCommentInput}
            updateMentionState={updateMentionState}
            handleMainInputKeyDown={handleMainInputKeyDown}
            commentSubmitting={commentSubmitting}
            setPendingCommentFiles={setPendingCommentFiles}
            pendingCommentFiles={pendingCommentFiles}
            showMainEmojiPicker={showMainEmojiPicker}
            setShowMainEmojiPicker={setShowMainEmojiPicker}
            handleStartEditComment={handleStartEditComment}
            handleAddComment={handleAddComment}
          />
        </div>

        <ConfirmDangerModal
          isOpen={deleteModalOpen}
          title="确认删除需求"
          error={deleteError}
          description="确认要删除当前需求吗？删除后将无法在列表中继续查看该需求，相关评分记录和评论不会自动清理，请谨慎操作。"
          note="如果只是暂时不推进，建议将状态调整为「不处理」，而不是直接删除。"
          confirmLabel="确认删除"
          confirmingLabel="删除中..."
          isSubmitting={deleteSubmitting}
          onClose={() => {
            if (deleteSubmitting) return;
            setDeleteModalOpen(false);
            setDeleteError(null);
          }}
          onConfirm={handleDeleteDemand}
        />

        <ConfirmDangerModal
          isOpen={commentDeleteTargetId != null}
          title="确认删除评论"
          error={commentDeleteError}
          description="确认要删除这条评论吗？删除后将无法恢复，相关附件也会一并不可见。"
          confirmLabel="确认删除"
          confirmingLabel="删除中..."
          isSubmitting={commentDeleteSubmitting}
          onClose={() => {
            if (commentDeleteSubmitting) return;
            setCommentDeleteTargetId(null);
            setCommentDeleteError(null);
          }}
          onConfirm={handleConfirmDeleteComment}
        />

        <DemandSidebarSections
          demand={demand}
          isEditing={isEditing}
          saveError={saveError}
          statusUpdateError={statusUpdateError}
          draftDueDate={draftDueDate}
          setDraftDueDate={setDraftDueDate}
          draftPriority={draftPriority}
          setDraftPriority={setDraftPriority}
          draftStatus={draftStatus}
          setDraftStatus={setDraftStatus}
          workflowConfig={workflowConfig}
          quickStatusOptions={quickStatusOptions}
          statusUpdating={statusUpdating}
          handleQuickStatusChange={handleQuickStatusChange}
          getAllowedNextStatuses={getAllowedNextStatuses}
          currentStatusIndex={currentStatusIndex}
          normalizedStatusForFlow={normalizedStatusForFlow}
          statusFlowOrder={statusFlowOrder}
          canAssignDemand={canAssignDemand}
          assigneeOptions={deptUsers}
          assigneeOptionsLoading={deptUsersLoading}
          assigningAssignee={assigningAssignee}
          assignError={assignError}
          handleAssignAssignee={handleAssignAssignee}
          getAvatarInitial={getAvatarInitial}
        />
      </div>
    </div>
  );
}
