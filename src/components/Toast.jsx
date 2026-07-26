import { useEffect } from 'react';

export function Toast({ message, tone = 'error', onClose }) {
  useEffect(() => {
    if (!message) return undefined;
    const timer = setTimeout(onClose, 6000);
    return () => clearTimeout(timer);
  }, [message, onClose]);

  if (!message) return null;

  return (
    <div className={`toast toast--${tone}`} role="alert">
      <span className="toast-message">{message}</span>
      <button type="button" className="toast-close" onClick={onClose} aria-label="关闭提示">
        ×
      </button>
    </div>
  );
}
