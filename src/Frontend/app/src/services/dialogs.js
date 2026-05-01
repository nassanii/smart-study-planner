import { showDialog } from './dialog_bus';
import Toast from 'react-native-toast-message';

export function showAlert(title, message) {
  return showDialog({ kind: 'alert', title, message });
}

export function showError(title, message) {
  return showDialog({ kind: 'alert', title, message, destructive: true });
}

export function showToast(message, destructive = false) {
  Toast.show({
    type: destructive ? 'error' : 'success',
    text1: destructive ? 'Error' : 'Success',
    text2: message,
    position: 'top',
    visibilityTime: 3000,
  });
}

export function showConfirm({ title, message, confirmText = 'Confirm', cancelText = 'Cancel', destructive = false, onConfirm, onCancel }) {
  return showDialog({ kind: 'confirm', title, message, confirmText, cancelText, destructive }).then(ok => {
    if (ok) onConfirm?.(); else onCancel?.();
    return ok;
  });
}
