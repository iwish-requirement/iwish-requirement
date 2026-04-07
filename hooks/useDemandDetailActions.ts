import React from "react";
import { type AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { authorizedFetch } from "../lib/authFetch";
import { DemandStatus, type Demand } from "../types";
import { type AttachmentItem, type CommentAttachment, type DemandComment } from "../components/demand-detail/types";

async function uploadCommentAttachments(
  demandId: string,
  commentId: number,
  files: File[],
  uploaderEmail: string,
  setCommentAttachmentError: (message: string | null) => void,
  errorPrefix: "评论" | "回复"
) {
  const uploadedAttachments: CommentAttachment[] = [];

  for (const file of files) {
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("uploaderEmail", uploaderEmail);
      const uploadRes = await fetch(`/api/demands/${demandId}/comments/${commentId}/attachments`, {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        const text = await uploadRes.text();
        console.error(`upload ${errorPrefix} attachment error`, text);
        setCommentAttachmentError(`上传${errorPrefix}附件失败，请稍后重试`);
        continue;
      }

      const uploadJson = await uploadRes.json();
      uploadedAttachments.push(uploadJson.attachment as CommentAttachment);
    } catch (err) {
      console.error(`upload ${errorPrefix} attachment error`, err);
      setCommentAttachmentError(`上传${errorPrefix}附件失败，请检查网络后重试`);
    }
  }

  return uploadedAttachments;
}

interface UseDemandMutationActionsParams {
  id: string;
  router: AppRouterInstance;
  demand: Demand | null;
  draftTitle: string;
  draftDescription: string;
  draftPriority: string;
  draftDueDate: string;
  draftStatus: string;
  draftCustomFields: Record<string, any>;
  deleteSubmitting: boolean;
  setDeleteSubmitting: React.Dispatch<React.SetStateAction<boolean>>;
  setDeleteError: React.Dispatch<React.SetStateAction<string | null>>;
  setDeleteModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSaving: React.Dispatch<React.SetStateAction<boolean>>;
  setSaveError: React.Dispatch<React.SetStateAction<string | null>>;
  setDemand: React.Dispatch<React.SetStateAction<Demand | null>>;
  setIsEditing: React.Dispatch<React.SetStateAction<boolean>>;
  setStatusUpdating: React.Dispatch<React.SetStateAction<boolean>>;
  setStatusUpdateError: React.Dispatch<React.SetStateAction<string | null>>;
  setDraftStatus: React.Dispatch<React.SetStateAction<string>>;
  setAssigningAssignee: React.Dispatch<React.SetStateAction<boolean>>;
  setAssignError: React.Dispatch<React.SetStateAction<string | null>>;
}

export function useDemandMutationActions({
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
}: UseDemandMutationActionsParams) {
  const handleDeleteDemand = React.useCallback(async () => {
    if (deleteSubmitting) {
      return;
    }

    setDeleteSubmitting(true);
    setDeleteError(null);

    const res = await authorizedFetch(`/api/demands/${id}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("delete demand error", text);
      setDeleteError(text || "删除失败，请稍后重试");
      setDeleteSubmitting(false);
      return;
    }

    setDeleteSubmitting(false);
    setDeleteModalOpen(false);
    router.push("/demands");
  }, [deleteSubmitting, id, router, setDeleteError, setDeleteModalOpen, setDeleteSubmitting]);

  const handleSave = React.useCallback(async () => {
    if (!demand) return;
    if (!draftTitle.trim() || !draftDescription.trim()) {
      setSaveError("请填写标题和需求描述");
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      const res = await authorizedFetch(`/api/demands/${demand.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
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
        console.error("update demand error", text);
        setSaveError("保存失败，请稍后重试");
        return;
      }

      const json = await res.json();
      setDemand(json.demand as Demand);
      setIsEditing(false);
    } catch (err) {
      console.error("update demand error", err);
      setSaveError("保存失败，请检查网络后重试");
    } finally {
      setSaving(false);
    }
  }, [
    demand,
    draftCustomFields,
    draftDescription,
    draftDueDate,
    draftPriority,
    draftStatus,
    draftTitle,
    setDemand,
    setIsEditing,
    setSaveError,
    setSaving,
  ]);

  const handleQuickStatusChange = React.useCallback(async (nextStatus: string) => {
    if (!demand) return;
    if (!nextStatus || nextStatus === demand.status) return;

    setStatusUpdating(true);
    setStatusUpdateError(null);
    try {
      const res = await authorizedFetch(`/api/demands/${demand.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: nextStatus,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("quick update status error", text);
        setStatusUpdateError("状态更新失败，请稍后重试");
        return;
      }

      const json = await res.json();
      const updatedDemand = json.demand as Demand;
      setDemand(updatedDemand);
      setDraftStatus(updatedDemand.status || DemandStatus.PENDING);
    } catch (err) {
      console.error("quick update status error", err);
      setStatusUpdateError("状态更新失败，请检查网络后重试");
    } finally {
      setStatusUpdating(false);
    }
  }, [demand, setDemand, setDraftStatus, setStatusUpdateError, setStatusUpdating]);

  const handleAssignAssignee = React.useCallback(async (nextAssigneeEmail: string) => {
    if (!demand || !nextAssigneeEmail.trim()) return;

    setAssigningAssignee(true);
    setAssignError(null);
    try {
      const res = await authorizedFetch(`/api/demands/${demand.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assigneeEmail: nextAssigneeEmail.trim(),
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("assign demand error", text);
        setAssignError("分配执行人失败，请稍后重试");
        return;
      }

      const json = await res.json();
      const updatedDemand = json.demand as Demand;
      setDemand(updatedDemand);
      setDraftStatus(updatedDemand.status || DemandStatus.PENDING);
    } catch (err) {
      console.error("assign demand error", err);
      setAssignError("分配执行人失败，请检查网络后重试");
    } finally {
      setAssigningAssignee(false);
    }
  }, [demand, setAssignError, setAssigningAssignee, setDemand, setDraftStatus]);

  return {
    handleDeleteDemand,
    handleSave,
    handleQuickStatusChange,
    handleAssignAssignee,
  };
}

interface UseDemandCommentActionsParams {
  id: string;
  currentUserEmail: string | null;
  commentInput: string;
  pendingCommentFiles: File[];
  replyContentMap: Record<number, string>;
  pendingReplyFilesMap: Record<number, File[]>;
  replyToCommentId: number | null;
  commentDeleteTargetId: number | null;
  commentDeleteSubmitting: boolean;
  editingCommentId: number | null;
  editingCommentContent: string;
  setCommentInput: React.Dispatch<React.SetStateAction<string>>;
  setCommentError: React.Dispatch<React.SetStateAction<string | null>>;
  setCommentSubmitting: React.Dispatch<React.SetStateAction<boolean>>;
  setComments: React.Dispatch<React.SetStateAction<DemandComment[]>>;
  setPendingCommentFiles: React.Dispatch<React.SetStateAction<File[]>>;
  setCommentAttachmentUploadingId: React.Dispatch<React.SetStateAction<number | null>>;
  setCommentAttachmentError: React.Dispatch<React.SetStateAction<string | null>>;
  setReplySubmittingForParentId: React.Dispatch<React.SetStateAction<number | null>>;
  setReplyContentMap: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  setPendingReplyFilesMap: React.Dispatch<React.SetStateAction<Record<number, File[]>>>;
  setReplyForCommentId: React.Dispatch<React.SetStateAction<number | null>>;
  setReplyToCommentId: React.Dispatch<React.SetStateAction<number | null>>;
  setCommentDeleteSubmitting: React.Dispatch<React.SetStateAction<boolean>>;
  setCommentDeleteError: React.Dispatch<React.SetStateAction<string | null>>;
  setCommentDeleteTargetId: React.Dispatch<React.SetStateAction<number | null>>;
  setEditingCommentId: React.Dispatch<React.SetStateAction<number | null>>;
  setEditingCommentContent: React.Dispatch<React.SetStateAction<string>>;
  setEditingCommentSubmitting: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useDemandCommentActions({
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
}: UseDemandCommentActionsParams) {
  const handleAddComment = React.useCallback(async () => {
    const content = commentInput.trim();
    const hasFiles = pendingCommentFiles.length > 0;

    if (!content && !hasFiles) {
      setCommentError("请填写评论内容或添加图片/文件");
      return;
    }
    if (!currentUserEmail) {
      setCommentError("当前用户信息获取失败，请重新登录后再试");
      return;
    }

    setCommentSubmitting(true);
    setCommentError(null);
    try {
      const res = await fetch(`/api/demands/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          authorEmail: currentUserEmail,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("create comment error", text);
        setCommentError("发表评论失败，请稍后重试");
        return;
      }

      const json = await res.json();
      let newComment = json.comment as DemandComment;

      if (hasFiles) {
        setCommentAttachmentUploadingId(newComment.id);
        const uploadedAttachments = await uploadCommentAttachments(
          id,
          newComment.id,
          pendingCommentFiles,
          currentUserEmail,
          setCommentAttachmentError,
          "评论"
        );

        if (uploadedAttachments.length) {
          newComment = {
            ...newComment,
            attachments: [...uploadedAttachments, ...(newComment.attachments || [])],
          };
        }
      }

      setComments((prev) => [...prev, newComment]);
      setCommentInput("");
      setPendingCommentFiles([]);
    } catch (err) {
      console.error("create comment error", err);
      setCommentError("发表评论失败，请检查网络后重试");
    } finally {
      setCommentSubmitting(false);
      setCommentAttachmentUploadingId(null);
    }
  }, [
    commentInput,
    currentUserEmail,
    id,
    pendingCommentFiles,
    setCommentAttachmentError,
    setCommentAttachmentUploadingId,
    setCommentError,
    setCommentInput,
    setCommentSubmitting,
    setComments,
    setPendingCommentFiles,
  ]);

  const handleDeleteComment = React.useCallback(async (commentId: number) => {
    if (!currentUserEmail) {
      setCommentError("当前用户信息获取失败，请重新登录后再试");
      return false;
    }

    setCommentError(null);
    try {
      const res = await fetch(`/api/demands/${id}/comments/${commentId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authorEmail: currentUserEmail }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("delete comment error", text);
        setCommentError("删除评论失败，请稍后重试");
        return false;
      }

      setComments((prev) => prev.filter((comment) => comment.id !== commentId));
      if (editingCommentId === commentId) {
        setEditingCommentId(null);
        setEditingCommentContent("");
      }
      return true;
    } catch (err) {
      console.error("delete comment error", err);
      setCommentError("删除评论失败，请检查网络后重试");
      return false;
    }
  }, [
    currentUserEmail,
    editingCommentId,
    id,
    setCommentError,
    setComments,
    setEditingCommentContent,
    setEditingCommentId,
  ]);

  const handleConfirmDeleteComment = React.useCallback(async () => {
    if (commentDeleteTargetId == null || commentDeleteSubmitting) {
      return;
    }

    try {
      setCommentDeleteSubmitting(true);
      setCommentDeleteError(null);
      const deleted = await handleDeleteComment(commentDeleteTargetId);
      if (deleted) {
        setCommentDeleteTargetId(null);
      }
    } catch (err) {
      console.error("delete comment with confirm modal error", err);
      setCommentDeleteError("删除评论失败，请稍后重试");
    } finally {
      setCommentDeleteSubmitting(false);
    }
  }, [
    commentDeleteSubmitting,
    commentDeleteTargetId,
    handleDeleteComment,
    setCommentDeleteError,
    setCommentDeleteSubmitting,
    setCommentDeleteTargetId,
  ]);

  const handleReplySubmit = React.useCallback(async (parentId: number) => {
    const content = (replyContentMap[parentId] || "").trim();
    const pendingFiles = pendingReplyFilesMap[parentId] || [];
    const hasFiles = pendingFiles.length > 0;

    if (!content && !hasFiles) {
      setCommentError("请填写回复内容或添加图片/文件");
      return;
    }
    if (!currentUserEmail) {
      setCommentError("当前用户信息获取失败，请重新登录后再试");
      return;
    }

    const targetReplyToId = replyToCommentId || parentId;

    setCommentError(null);
    setReplySubmittingForParentId(parentId);
    try {
      const res = await fetch(`/api/demands/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content || "",
          authorEmail: currentUserEmail,
          parentId,
          replyToCommentId: targetReplyToId,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("create reply comment error", text);
        setCommentError("回复失败，请稍后重试");
        return;
      }

      const json = await res.json();
      let newComment = json.comment as DemandComment;

      if (hasFiles) {
        setCommentAttachmentUploadingId(newComment.id);
        const uploadedAttachments = await uploadCommentAttachments(
          id,
          newComment.id,
          pendingFiles,
          currentUserEmail,
          setCommentAttachmentError,
          "回复"
        );

        if (uploadedAttachments.length) {
          newComment = {
            ...newComment,
            attachments: [...uploadedAttachments, ...(newComment.attachments || [])],
          };
        }
      }

      setComments((prev) => [...prev, newComment]);
      setReplyContentMap((prev) => ({ ...prev, [parentId]: "" }));
      setPendingReplyFilesMap((prev) => {
        const next = { ...prev };
        delete next[parentId];
        return next;
      });
      setReplyForCommentId(null);
      setReplyToCommentId(null);
    } catch (err) {
      console.error("create reply comment error", err);
      setCommentError("回复失败，请检查网络后重试");
    } finally {
      setReplySubmittingForParentId(null);
      setCommentAttachmentUploadingId(null);
    }
  }, [
    currentUserEmail,
    id,
    pendingReplyFilesMap,
    replyContentMap,
    replyToCommentId,
    setCommentAttachmentError,
    setCommentAttachmentUploadingId,
    setCommentError,
    setComments,
    setPendingReplyFilesMap,
    setReplyContentMap,
    setReplyForCommentId,
    setReplySubmittingForParentId,
    setReplyToCommentId,
  ]);

  const handleSaveEditComment = React.useCallback(async (commentId: number) => {
    const content = editingCommentContent.trim();
    if (!content) {
      setCommentError("评论内容不能为空");
      return;
    }
    if (!currentUserEmail) {
      setCommentError("当前用户信息获取失败，请重新登录后再试");
      return;
    }

    setEditingCommentSubmitting(true);
    setCommentError(null);
    try {
      const res = await fetch(`/api/demands/${id}/comments/${commentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          authorEmail: currentUserEmail,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("update comment error", text);
        setCommentError("更新评论失败，可能已超过可编辑时间");
        return;
      }

      setComments((prev) =>
        prev.map((comment) => (comment.id === commentId ? { ...comment, content } : comment))
      );
      setEditingCommentId(null);
      setEditingCommentContent("");
    } catch (err) {
      console.error("update comment error", err);
      setCommentError("更新评论失败，请检查网络后重试");
    } finally {
      setEditingCommentSubmitting(false);
    }
  }, [
    currentUserEmail,
    editingCommentContent,
    id,
    setCommentError,
    setComments,
    setEditingCommentContent,
    setEditingCommentId,
    setEditingCommentSubmitting,
  ]);

  return {
    handleAddComment,
    handleConfirmDeleteComment,
    handleReplySubmit,
    handleSaveEditComment,
  };
}
