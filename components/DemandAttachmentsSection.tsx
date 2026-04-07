"use client";

import React, { type Dispatch, type SetStateAction } from "react";
import { Paperclip } from "lucide-react";
import { type AttachmentItem } from "./demand-detail/types";

interface DemandAttachmentsSectionProps {
  attachments: AttachmentItem[];
  attachmentsLoading: boolean;
  attachmentError: string | null;
  isEditing: boolean;
  currentUserEmail: string | null;
  attachmentUploading: boolean;
  demandCode: string; // 即页面中的 id
  openImagePreview: (files: AttachmentItem[], fileId: number) => void;
  setAttachmentError: (msg: string | null) => void;
  setAttachmentUploading: (uploading: boolean) => void;
  setAttachments: Dispatch<SetStateAction<AttachmentItem[]>>;
}

const DemandAttachmentsSection: React.FC<DemandAttachmentsSectionProps> = ({
  attachments,
  attachmentsLoading,
  attachmentError,
  isEditing,
  currentUserEmail,
  attachmentUploading,
  demandCode,
  openImagePreview,
  setAttachmentError,
  setAttachmentUploading,
  setAttachments,
}) => {
  return (
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
          const isImage = file.mimeType?.startsWith("image/");
          return (
            <div
              key={file.id}
              className="flex items-center justify-between p-3 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer group"
              onClick={() => {
                if (isImage) {
                  openImagePreview(attachments, file.id);
                } else if (file.fileUrl) {
                  window.open(file.fileUrl, "_blank");
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
                    {file.size > 0 ? `${(file.size / 1024).toFixed(1)} KB` : ""}
                    {file.createdAt ? ` · 上传于 ${file.createdAt}` : ""}
                  </div>
                </div>
              </div>
              <button className="text-sm font-bold text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                {isImage ? "预览" : "下载"}
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
                  setAttachmentError("当前用户信息获取失败，请重新登录后再试");
                  return;
                }
                setAttachmentUploading(true);
                setAttachmentError(null);
                try {
                  const formData = new FormData();
                  formData.append("file", file);
                  formData.append("uploaderEmail", currentUserEmail);
                  const res = await fetch(`/api/demands/${demandCode}/attachments`, {
                    method: "POST",
                    body: formData,
                  });
                  if (!res.ok) {
                    const text = await res.text();
                    console.error("upload attachment error", text);
                    setAttachmentError("上传附件失败，请稍后重试");
                    return;
                  }
                  const json = await res.json();
                  const attachment = json.attachment as AttachmentItem;
                  setAttachments((prev) => [attachment, ...prev]);
                  if (e.target) {
                    e.target.value = "";
                  }
                } catch (err) {
                  console.error("upload attachment error", err);
                  setAttachmentError("上传附件失败，请检查网络后重试");
                } finally {
                  setAttachmentUploading(false);
                }
              }}
              disabled={attachmentUploading}
            />
            {attachmentUploading ? "上传中..." : "上传附件"}
          </label>
        </div>
      )}
    </div>
  );
};

export default DemandAttachmentsSection;
