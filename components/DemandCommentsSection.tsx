"use client";

import React, { type Dispatch, type RefObject, type SetStateAction } from "react";
import { Paperclip, ArrowRight } from "lucide-react";
import {
  type CommentAttachment,
  type DemandComment,
  type MentionContext,
  type MentionUser,
} from "./demand-detail/types";

interface DemandCommentsSectionProps {
  // 为了尽快完成组件抽离，这里使用一个聚合的 context 对象承载所有评论相关状态和方法
  // 后续可以再把 any 拆成更精细的类型
  commentEmojis: readonly string[];
  commentError: string | null;
  setCommentError: Dispatch<SetStateAction<string | null>>;
  commentAttachmentError: string | null;
  commentsLoading: boolean;
  topLevelComments: DemandComment[];
  currentUserEmail: string | null;
  canEditComment: (comment: DemandComment) => boolean;
  repliesByParentId: Record<number, DemandComment[]>;
  replyContentMap: Record<number, string>;
  setReplyContentMap: Dispatch<SetStateAction<Record<number, string>>>;
  replyForCommentId: number | null;
  setReplyForCommentId: Dispatch<SetStateAction<number | null>>;
  replyToCommentId: number | null;
  setReplyToCommentId: Dispatch<SetStateAction<number | null>>;
  replySubmittingForParentId: number | null;
  getAvatarInitial: (label?: string, email?: string | null) => string;
  editingCommentId: number | null;
  editingCommentContent: string;
  setEditingCommentContent: Dispatch<SetStateAction<string>>;
  handleCancelEditComment: () => void;
  handleSaveEditComment: (commentId: number) => void;
  editingCommentSubmitting: boolean;
  renderContentWithMentions: (text: string) => React.ReactNode;
  openImagePreview: (files: CommentAttachment[], fileId: number) => void;
  commentMap: Record<number, DemandComment>;
  expandedReplyParents: Record<number, boolean>;
  setExpandedReplyParents: Dispatch<SetStateAction<Record<number, boolean>>>;
  setCommentDeleteError: Dispatch<SetStateAction<string | null>>;
  setCommentDeleteTargetId: Dispatch<SetStateAction<number | null>>;
  activeReplyInputRef: RefObject<HTMLDivElement | null>;
  activeMentionContext: MentionContext | null;
  visibleMentionUsers: MentionUser[];
  handleSelectMention: (user: MentionUser) => void;
  pendingReplyFilesMap: Record<number, File[]>;
  setPendingReplyFilesMap: Dispatch<SetStateAction<Record<number, File[]>>>;
  openReplyEmojiForParentId: number | null;
  setOpenReplyEmojiForParentId: Dispatch<SetStateAction<number | null>>;
  handleReplySubmit: (parentId: number) => void;
  mainCommentInputRef: RefObject<HTMLDivElement | null>;
  currentUserDisplayName: string;
  commentInput: string;
  setCommentInput: Dispatch<SetStateAction<string>>;
  updateMentionState: (value: string, context: MentionContext) => void;
  handleMainInputKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  commentSubmitting: boolean;
  setPendingCommentFiles: Dispatch<SetStateAction<File[]>>;
  pendingCommentFiles: File[];
  showMainEmojiPicker: boolean;
  setShowMainEmojiPicker: Dispatch<SetStateAction<boolean>>;
  handleStartEditComment: (comment: DemandComment) => void;
  handleAddComment: () => void;
}

const DemandCommentsSection: React.FC<DemandCommentsSectionProps> = ({
  commentEmojis,
  commentError,
  setCommentError,
  commentAttachmentError,
  commentsLoading,
  topLevelComments,
  currentUserEmail,
  canEditComment,
  repliesByParentId,
  replyContentMap,
  setReplyContentMap,
  replyForCommentId,
  setReplyForCommentId,
  replyToCommentId,
  setReplyToCommentId,
  replySubmittingForParentId,
  getAvatarInitial,
  editingCommentId,
  editingCommentContent,
  setEditingCommentContent,
  handleCancelEditComment,
  handleSaveEditComment,
  editingCommentSubmitting,
  renderContentWithMentions,
  openImagePreview,
  commentMap,
  expandedReplyParents,
  setExpandedReplyParents,
  setCommentDeleteError,
  setCommentDeleteTargetId,
  activeReplyInputRef,
  activeMentionContext,
  visibleMentionUsers,
  handleSelectMention,
  pendingReplyFilesMap,
  setPendingReplyFilesMap,
  openReplyEmojiForParentId,
  setOpenReplyEmojiForParentId,
  handleReplySubmit,
  mainCommentInputRef,
  currentUserDisplayName,
  commentInput,
  setCommentInput,
  updateMentionState,
  handleMainInputKeyDown,
  commentSubmitting,
  setPendingCommentFiles,
  pendingCommentFiles,
  showMainEmojiPicker,
  setShowMainEmojiPicker,
  handleStartEditComment,
  handleAddComment,
}) => {

  return (
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
          const replyValue = replyContentMap[comment.id] || "";
          const isReplying = replyForCommentId === comment.id;
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
                        {editingCommentSubmitting ? "保存中..." : "保存"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">{renderContentWithMentions(comment.content)}</p>
                )}

                {comment.attachments && comment.attachments.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {comment.attachments.map((file) => {
                      const isImage = file.mimeType?.startsWith("image/");
                      return (
                        <button
                          key={file.id}
                          type="button"
                          onClick={() => {
                            if (isImage) {
                              openImagePreview(comment.attachments || [], file.id);
                            } else if (file.fileUrl) {
                              window.open(file.fileUrl, "_blank");
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
                              {file.size > 0 ? `${(file.size / 1024).toFixed(1)} KB` : ""}
                              {file.createdAt ? ` · 上传于 ${file.createdAt}` : ""}
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
                                        {editingCommentSubmitting ? "保存中..." : "保存"}
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">
                                    {reply.replyToCommentId && commentMap[reply.replyToCommentId] && commentMap[reply.replyToCommentId].id !== comment.id
                                      ? `回复 ${commentMap[reply.replyToCommentId].authorLabel}：`
                                      : ""}
                                    {renderContentWithMentions(reply.content)}
                                  </p>
                                )}

                                {reply.attachments && reply.attachments.length > 0 && (
                                  <div className="mt-2 space-y-2">
                                    {reply.attachments.map((file) => {
                                      const isImage = file.mimeType?.startsWith("image/");
                                      return (
                                        <button
                                          key={file.id}
                                          type="button"
                                          onClick={() => {
                                            if (isImage) {
                                              openImagePreview(reply.attachments || [], file.id);
                                            } else if (file.fileUrl) {
                                              window.open(file.fileUrl, "_blank");
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
                                              {file.size > 0 ? `${(file.size / 1024).toFixed(1)} KB` : ""}
                                              {file.createdAt ? ` · 上传于 ${file.createdAt}` : ""}
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
                            {isExpanded ? "收起回复" : `展开全部 ${replies.length} 条回复`}
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
                  ref={
                    replyForCommentId === comment.id
                      ? (activeReplyInputRef as React.RefObject<HTMLDivElement>)
                      : undefined
                  }
                >
                  <textarea
                    rows={2}
                    value={replyValue}
                    disabled={isReplySubmitting}
                    onChange={(e) => {
                      const value = e.target.value;
                      setReplyContentMap((prev) => ({ ...prev, [comment.id]: value }));
                      updateMentionState(value, { type: "reply", parentId: comment.id });
                      if (commentError) {
                        setCommentError(null);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (!isReplySubmitting) {
                          handleReplySubmit(comment.id);
                        }
                      }
                    }}
                    placeholder={replyToCommentId && commentMap[replyToCommentId]
                      ? `回复 ${commentMap[replyToCommentId].authorLabel}...`
                      : "回复这条评论..."}
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
                          e.target.value = "";
                        }
                      }}
                    />
                    <Paperclip className="w-3 h-3" />
                  </label>
                  <button
                    type="button"
                    disabled={isReplySubmitting}
                    onClick={() => {
                      const next = (replyValue || "") + "@";
                      setReplyContentMap((prev) => ({ ...prev, [comment.id]: next }));
                      updateMentionState(next, { type: "reply", parentId: comment.id });
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
                      {commentEmojis.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => {
                            setReplyContentMap((prev) => ({
                              ...prev,
                              [comment.id]: ((prev[comment.id] || "") + emoji),
                            }));
                          }}
                          className="w-7 h-7 flex items-center justify-center text-lg hover:bg-slate-100 rounded"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                  {activeMentionContext && activeMentionContext.type === "reply" && activeMentionContext.parentId === comment.id && visibleMentionUsers.length > 0 && (
                    <div className="absolute left-0 -top-40 md:-top-44 bg-white border border-slate-200 rounded-xl shadow-md px-2 py-2 z-20 w-64 max-h-56 overflow-y-auto">
                      {visibleMentionUsers.map((user) => {
                        const displayName = user.name || (user.email ? user.email.split("@")[0] : "");
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
                      {pendingReplyFilesMap[comment.id].map((file: File, index: number) => (
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
                    {isReplySubmitting ? "发送中..." : "发送"}
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
        <div
          className="flex-1 relative"
          ref={mainCommentInputRef as React.RefObject<HTMLDivElement>}
        >
          <textarea
            rows={2}
            placeholder="发表评论，补充需求背景或进展..."
            value={commentInput}
            onChange={(e) => {
              const value = e.target.value;
              setCommentInput(value);
              updateMentionState(value, { type: "main" });
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
              const next = (commentInput || "") + "@";
              setCommentInput(next);
              updateMentionState(next, { type: "main" });
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
                  e.target.value = "";
                }
              }}
            />
            <Paperclip className="w-4 h-4" />
          </label>
          <button
            type="button"
            onClick={() => setShowMainEmojiPicker((prev: boolean) => !prev)}
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
              {commentEmojis.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    setCommentInput((prev) => (prev || "") + emoji);
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
              {pendingCommentFiles.map((file: File, index: number) => (
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
          {activeMentionContext && activeMentionContext.type === "main" && visibleMentionUsers.length > 0 && (
            <div className="absolute left-0 -top-40 md:-top-44 bg-white border border-slate-200 rounded-xl shadow-md px-2 py-2 z-20 w-64 max-h-56 overflow-y-auto">
              {visibleMentionUsers.map((user) => {
                const displayName = user.name || (user.email ? user.email.split("@")[0] : "");
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
  );
};

export default React.memo(DemandCommentsSection);
