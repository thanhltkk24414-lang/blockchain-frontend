import type { ReactNode } from 'react';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open,
  title,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  confirmDisabled = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title">
      <div className="modal-panel confirm-modal">
        <h3 id="confirm-modal-title">{title}</h3>
        <div className="confirm-modal-body">{children}</div>
        <div className="confirm-modal-actions">
          <button type="button" className="btn ghost" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn${danger ? ' admin-danger-btn' : ' primary'}`}
            disabled={confirmDisabled}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
