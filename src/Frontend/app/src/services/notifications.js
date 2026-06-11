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

let foregroundMirrorInstalled = false;
const recentNotificationKeys = new Map();

function notificationKey(title, body) {
  return `${title || ''}\n${body || ''}`;
}

function rememberNotification(title, body) {
  const key = notificationKey(title, body);
  recentNotificationKeys.set(key, Date.now());

  for (const [storedKey, timestamp] of recentNotificationKeys.entries()) {
    if (Date.now() - timestamp > 10000) {
      recentNotificationKeys.delete(storedKey);
    }
  }
}

function wasRecentlyShown(title, body) {
  const timestamp = recentNotificationKeys.get(notificationKey(title, body));
  return timestamp ? Date.now() - timestamp < 3000 : false;
}

async function ensureAndroidNotificationChannel() {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync('default', {
    name: 'default',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF231F7C',
  });
}

function installForegroundNotificationMirror() {
  if (foregroundMirrorInstalled || Platform.OS === 'web') return;
  foregroundMirrorInstalled = true;

  Notifications.addNotificationReceivedListener((notification) => {
    const content = notification?.request?.content;
    if (!content || content.data?.mirroredForegroundPush) return;

    const title = content.title || '';
    const body = content.body || '';
    if (!title && !body) return;
    if (wasRecentlyShown(title, body)) return;

    console.log('[notifications] Foreground push received; mirroring as local notification:', title);
    rememberNotification(title, body);

    Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: 'default',
        data: {
          ...(content.data || {}),
          mirroredForegroundPush: true,
        },
      },
      trigger: null,
    }).catch((error) => {
      console.log('[notifications] Failed to mirror foreground push notification:', error);
    });
  });
}

installForegroundNotificationMirror();

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

    await ensureAndroidNotificationChannel();

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

export async function showLocalNotificationAsync(title, body, data = {}) {
  if (Platform.OS === 'web') return;

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[notifications] Local notification skipped because permission is not granted.');
      return;
    }

    await ensureAndroidNotificationChannel();
    rememberNotification(title, body);

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: 'default',
        data: {
          ...data,
          localAppNotification: true,
        },
      },
      trigger: null,
    });
  } catch (error) {
    console.log('[notifications] Failed to show local notification:', error);
  }
}

export async function registerPushTokenWithBackend(currentPushToken = null) {
  try {
    const token = await registerForPushNotificationsAsync();
    if (token) {
      if (token !== currentPushToken) {
        await usersApi.registerPushToken(token);
        console.log('[notifications] Push token registered with backend successfully.');
      } else {
        console.log('[notifications] Backend already has the current push token.');
      }
      return token;
    }
    return null;
  } catch (error) {
    console.error('[notifications] Failed to register push token with backend:', error);
    return null;
  }
}
