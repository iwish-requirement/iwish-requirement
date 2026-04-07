"use client";

import React from "react";
import { type CommentAttachment } from "./types";

interface ImagePreviewLightboxProps {
  imagePreviewList: CommentAttachment[];
  imagePreviewIndex: number;
  setImagePreviewList: React.Dispatch<React.SetStateAction<CommentAttachment[]>>;
  setImagePreviewIndex: React.Dispatch<React.SetStateAction<number>>;
}

const ImagePreviewLightbox = React.memo(function ImagePreviewLightbox({
  imagePreviewList,
  imagePreviewIndex,
  setImagePreviewList,
  setImagePreviewIndex,
}: ImagePreviewLightboxProps) {
  if (imagePreviewList.length === 0) {
    return null;
  }

  const close = () => {
    setImagePreviewList([]);
    setImagePreviewIndex(0);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70">
      <button type="button" className="absolute inset-0 cursor-zoom-out" onClick={close} />
      <div className="relative z-50 max-w-5xl w-full px-4">
        <div className="flex justify-between items-center mb-3 text-slate-100 text-xs">
          <span>{imagePreviewList[imagePreviewIndex]?.fileName}</span>
          <button
            type="button"
            className="px-2 py-1 rounded bg-black/40 hover:bg-black/60"
            onClick={close}
          >
            关闭
          </button>
        </div>
        <div className="relative bg-black rounded-xl flex items-center justify-center overflow-hidden max-h-[80vh] min-h-[320px]">
          {imagePreviewList.length > 1 && (
            <button
              type="button"
              className="absolute left-2 top-1/2 -translate-y-1/2 px-2 py-1 rounded-full bg-black/40 hover:bg-black/70 text-slate-100 text-sm"
              onClick={(event) => {
                event.stopPropagation();
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
              onClick={(event) => {
                event.stopPropagation();
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
  );
});

export default ImagePreviewLightbox;
