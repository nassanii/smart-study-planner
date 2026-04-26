import { showDialog } from './dialog_bus';

export function showAlert(title, message) {
  return showDialog({ kind: 'alert', title, message });
}

export function showConfirm({ title, message, confirmText = 'Confirm', cancelText = 'Cancel', destructive = false, onConfirm, onCancel }) {
  return showDialog({ kind: 'confirm', title, message, confirmText, cancelText, destructive }).then(ok => {
    if (ok) onConfirm?.(); else onCancel?.();
    return ok;
  });
}
