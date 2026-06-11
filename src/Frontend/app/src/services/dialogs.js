import { Alert, Platform } from 'react-native';
import Toast from 'react-native-toast-message';

export function showAlert(title, message) {
  if (Platform.OS === 'web') {
    alert(title + (message ? '\n\n' + message : ''));
  } else {
    Alert.alert(title, message);
  }
}

export function showError(title, message) {
  if (Platform.OS === 'web') {
    alert('Error: ' + title + (message ? '\n\n' + message : ''));
  } else {
    Alert.alert(title, message);
  }
}

export function showToast(message, destructive = false) {
  if (Platform.OS === 'web') {
    console.log('[Toast]', message);
  } else {
    Toast.show({
      type: destructive ? 'error' : 'success',
      text1: destructive ? 'Error' : 'Success',
      text2: message,
      position: 'top',
      visibilityTime: 3000,
    });
  }
}

export function showConfirm({ title, message, confirmText = 'Confirm', cancelText = 'Cancel', destructive = false, onConfirm, onCancel }) {
  if (Platform.OS === 'web') {
    const result = window.confirm(title + (message ? '\n\n' + message : ''));
    if (result) {
      if (onConfirm) onConfirm();
    } else {
      if (onCancel) onCancel();
    }
  } else {
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
}

