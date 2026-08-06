import { useEffect } from 'react';

export function Toast({
  message,
  tone = 'error',
  onClose,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  sticky = false,
}) {
  useEffect(() => {
    if (!message || sticky) return undefined;
    const timer = setTimeout(onClose, actionLabel || secondaryActionLabel ? 10000 : 6000);
    return () => clearTimeout(timer);
  }, [message, onClose, actionLabel, secondaryActionLabel, sticky]);

  if (!message) return null;

  return (
    <div className={`toast toast--${tone}`} role="alert">
      <span className="toast-message">{message}</span>
      <div className="toast-actions">
        {secondaryActionLabel && onSecondaryAction ? (
          <button
            type="button"
            className="toast-action toast-action--ghost"
            onClick={() => {
              onSecondaryAction();
            }}
          >
            {secondaryActionLabel}
          </button>
        ) : null}
        {actionLabel && onAction ? (
          <button
            type="button"
            className="toast-action"
            onClick={() => {
              onAction();
            }}
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
      <button type="button" className="toast-close" onClick={onClose} aria-label="关闭提示">
        ×
      </button>
    </div>
  );
}
