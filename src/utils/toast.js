/**
 * Smart CNG — Global Toast Utility
 * Usage (in any component, no props needed):
 *   import { toast } from '../utils/toast';
 *   toast.success('Operator created!');
 *   toast.error('Failed to delete user');
 *   toast.warning('Invalid phone number');
 *   toast.info('Station updated');
 */

let _handler = null;

export const _registerToastHandler = (fn) => { _handler = fn; };

const show = (message, type = 'info', duration = 4000) => {
  if (_handler) {
    _handler({ message, type, duration, id: Date.now() + Math.random() });
  } else {
    // Fallback if toast system not mounted yet
    console.warn('[Toast] Handler not registered. Message:', message);
  }
};

export const toast = {
  success: (msg, duration)  => show(msg, 'success', duration),
  error:   (msg, duration)  => show(msg, 'error',   duration),
  warning: (msg, duration)  => show(msg, 'warning', duration),
  info:    (msg, duration)  => show(msg, 'info',    duration),
};
