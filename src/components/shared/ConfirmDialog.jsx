import { useState, useEffect, useCallback } from 'react';
import { _registerConfirmHandler } from '../../utils/confirm';
import './ConfirmDialog.css';

const ICONS = {
  danger:  '🗑️',
  warning: '⚠️',
  primary: '✓',
};

const DEFAULT_TITLES = {
  danger:  'Confirm Delete',
  warning: 'Confirmation Required',
  primary: 'Confirm Action',
};

export default function ConfirmDialogProvider() {
  const [dialog, setDialog] = useState(null);

  const handleRequest = useCallback((req) => {
    setDialog(req);
  }, []);

  useEffect(() => {
    _registerConfirmHandler(handleRequest);
  }, [handleRequest]);

  const resolve = (value) => {
    if (dialog?.resolve) dialog.resolve(value);
    setDialog(null);
  };

  if (!dialog) return null;

  const variant  = dialog.options?.variant  || 'primary';
  const title    = dialog.options?.title    || DEFAULT_TITLES[variant];
  const okLabel  = dialog.options?.confirmLabel || 'Yes, Confirm';
  const cancelLabel = dialog.options?.cancelLabel || 'Cancel';

  return (
    <div
      className="confirm-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) resolve(false); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      <div className="confirm-dialog">
        {/* Icon */}
        <div className="confirm-icon-strip">
          <div className={`confirm-icon-circle ${variant}`}>
            {ICONS[variant]}
          </div>
        </div>

        {/* Text */}
        <div className="confirm-body">
          <p className="confirm-title" id="confirm-title">{title}</p>
          <p className="confirm-message">{dialog.message}</p>
        </div>

        {/* Buttons */}
        <div className="confirm-actions">
          <button
            type="button"
            className="confirm-btn confirm-btn-cancel"
            onClick={() => resolve(false)}
            autoFocus
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`confirm-btn confirm-btn-ok ${variant}`}
            onClick={() => resolve(true)}
          >
            {okLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
