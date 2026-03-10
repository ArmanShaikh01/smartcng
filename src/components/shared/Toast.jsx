import { useState, useEffect, useCallback } from 'react';
import { _registerToastHandler } from '../../utils/toast';
import './Toast.css';

const ICONS = {
  success: '✓',
  error:   '✕',
  warning: '⚠',
  info:    'ℹ',
};

const LABELS = {
  success: 'Success',
  error:   'Error',
  warning: 'Warning',
  info:    'Info',
};

function ToastItem({ toast, onRemove }) {
  const [hiding, setHiding] = useState(false);

  const dismiss = useCallback(() => {
    setHiding(true);
    setTimeout(() => onRemove(toast.id), 280);
  }, [toast.id, onRemove]);

  useEffect(() => {
    const timer = setTimeout(dismiss, toast.duration);
    return () => clearTimeout(timer);
  }, [dismiss, toast.duration]);

  return (
    <div
      className={`toast ${toast.type}${hiding ? ' toast-hiding' : ''}`}
      style={{ '--toast-duration': `${toast.duration}ms` }}
      role="alert"
      aria-live="assertive"
    >
      <div className="toast-icon">{ICONS[toast.type]}</div>

      <div className="toast-body">
        <div className="toast-type-label">{LABELS[toast.type]}</div>
        <div className="toast-message">{toast.message}</div>
      </div>

      <button className="toast-close" onClick={dismiss} aria-label="Dismiss notification">
        ×
      </button>

      <div className="toast-progress" />
    </div>
  );
}

export default function ToastProvider() {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((toastData) => {
    setToasts(prev => [...prev, toastData]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => {
    _registerToastHandler(addToast);
  }, [addToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container" aria-label="Notifications">
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} onRemove={removeToast} />
      ))}
    </div>
  );
}
