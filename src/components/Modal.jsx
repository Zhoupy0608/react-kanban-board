import { useEffect, useRef } from 'react';

export function Modal({
  open,
  title,
  onClose,
  onSubmit,
  submitLabel = '确定',
  cancelLabel = '取消',
  danger = false,
  children,
}) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !panelRef.current) return;
    const focusable = panelRef.current.querySelector(
      danger ? '.modal-submit, .modal-submit-danger' : 'input, textarea, .modal-submit, .modal-submit-danger'
    );
    focusable?.focus();
    if (focusable?.select) focusable.select();
  }, [open, danger]);

  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className={`modal-panel${danger ? ' modal-panel--danger' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="modal-head">
          <h3 className="modal-title">{title}</h3>
          <button
            type="button"
            className="modal-close"
            aria-label="关闭"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <form
          className="modal-form"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          <div className="modal-body">{children}</div>
          <div className="modal-actions">
            <button type="button" className="modal-cancel" onClick={onClose}>
              {cancelLabel}
            </button>
            <button
              type="submit"
              className={danger ? 'modal-submit-danger' : 'modal-submit'}
            >
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
