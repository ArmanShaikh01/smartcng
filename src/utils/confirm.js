/**
 * Smart CNG — Imperative Confirm Dialog Utility
 * Usage (async/await, works anywhere without props):
 *
 *   import { confirm } from '../utils/confirm';
 *   const ok = await confirm('Are you sure you want to remove this operator?');
 *   if (!ok) return;
 *
 *   // Custom options:
 *   const ok = await confirm('Delete user?', {
 *     title: 'Delete User',
 *     confirmLabel: 'Yes, Delete',
 *     variant: 'danger',   // 'danger' | 'warning' | 'primary'
 *   });
 */

let _handler = null;

export const _registerConfirmHandler = (fn) => { _handler = fn; };

export const confirm = (message, options = {}) => {
  return new Promise((resolve) => {
    if (!_handler) {
      // Fallback to native if component not mounted
      resolve(window.confirm(message));
      return;
    }
    _handler({ message, options, resolve });
  });
};
