import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { usersApi } from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotificationsAsync() {
  if (Platform.OS === 'web') {
    console.log('[notifications] Push notifications are not supported on Web in this build.');
    return null;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[notifications] Permission for push notifications was denied.');
      return null;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    const tokenData = await Notifications.getDevicePushTokenAsync();
    const token = tokenData?.data ?? null;

    if (!token) {
      console.log('[notifications] No FCM device token returned. Make sure this is a dev/production build (Expo Go does not support FCM).');
      return null;
    }

    console.log('[notifications] FCM device token obtained:', token);
    return token;
  } catch (error) {
    console.error('[notifications] Error obtaining FCM device token:', error);
    return null;
  }
}

export async function registerPushTokenWithBackend() {
  try {
    const token = await registerForPushNotificationsAsync();
    if (token) {
      await usersApi.registerPushToken(token);
      console.log('[notifications] Push token registered with backend successfully.');
    }
  } catch (error) {
    console.error('[notifications] Failed to register push token with backend:', error);
  }
}
