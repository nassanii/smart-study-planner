import { Alert } from 'react-native';
import Toast from 'react-native-toast-message';

export function showAlert(title, message) {
  Alert.alert(title, message);
}

export function showError(title, message) {
  Alert.alert(title, message);
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
  Alert.alert(
    title,
    message,
    [
      { text: cancelText, onPress: onCancel, style: 'cancel' },
      { text: confirmText, onPress: onConfirm, style: destructive ? 'destructive' : 'default' }
    ],
    { cancelable: true }
  );
}

