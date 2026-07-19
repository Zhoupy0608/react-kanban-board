import { useEffect, useRef } from 'react';
import { styles } from '../styles/kanbanStyles';

export function Modal({ open, title, onClose, onSubmit, submitLabel = '确定', children }) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !panelRef.current) return;
    const focusable = panelRef.current.querySelector('input, textarea');
    focusable?.focus();
    if (focusable?.select) focusable.select();
  }, [open]);

  if (!open) return null;

  return (
    <div
      style={styles.modalOverlay}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        style={styles.modalPanel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h3 style={styles.modalTitle}>{title}</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          {children}
          <div style={styles.modalActions}>
            <button type="button" style={styles.modalCancelBtn} onClick={onClose}>
              取消
            </button>
            <button type="submit" style={styles.modalSubmitBtn}>
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
