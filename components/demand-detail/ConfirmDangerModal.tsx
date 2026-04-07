"use client";

import React from "react";
import Modal from "../ui/Modal";

interface ConfirmDangerModalProps {
  isOpen: boolean;
  title: string;
  error: string | null;
  description: string;
  note?: string;
  confirmLabel: string;
  confirmingLabel: string;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const ConfirmDangerModal = React.memo(function ConfirmDangerModal({
  isOpen,
  title,
  error,
  description,
  note,
  confirmLabel,
  confirmingLabel,
  isSubmitting,
  onClose,
  onConfirm,
}: ConfirmDangerModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4">
        {error && (
          <div className="text-xs text-rose-600 bg-rose-50 border border-rose-100 px-3 py-2 rounded-lg">
            {error}
          </div>
        )}
        <p className="text-sm text-slate-600">{description}</p>
        {note && <p className="text-xs text-slate-400">{note}</p>}
        <div className="pt-4 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="px-4 py-2 bg-rose-600 text-white font-bold rounded-lg hover:bg-rose-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting ? confirmingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
});

export default ConfirmDangerModal;
