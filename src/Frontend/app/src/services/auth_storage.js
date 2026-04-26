import AsyncStorage from '@react-native-async-storage/async-storage';

const ACCESS_KEY = 'ssp.accessToken';
const REFRESH_KEY = 'ssp.refreshToken';
const EXPIRES_KEY = 'ssp.expiresAt';
const USER_KEY = 'ssp.user';

export async function setTokens({ accessToken, refreshToken, expiresAt, user }) {
  await AsyncStorage.multiSet([
    [ACCESS_KEY, accessToken || ''],
    [REFRESH_KEY, refreshToken || ''],
    [EXPIRES_KEY, expiresAt || ''],
    [USER_KEY, user ? JSON.stringify(user) : ''],
  ]);
}

export async function getTokens() {
  const entries = await AsyncStorage.multiGet([ACCESS_KEY, REFRESH_KEY, EXPIRES_KEY, USER_KEY]);
  const map = Object.fromEntries(entries);
  return {
    accessToken: map[ACCESS_KEY] || null,
    refreshToken: map[REFRESH_KEY] || null,
    expiresAt: map[EXPIRES_KEY] || null,
    user: map[USER_KEY] ? JSON.parse(map[USER_KEY]) : null,
  };
}

export async function clearTokens() {
  await AsyncStorage.multiRemove([ACCESS_KEY, REFRESH_KEY, EXPIRES_KEY, USER_KEY]);
}
