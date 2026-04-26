import axios from 'axios';
import Constants from 'expo-constants';
import { getTokens, setTokens, clearTokens } from './auth_storage';

const baseURL = Constants.expoConfig?.extra?.apiBaseUrl
  || Constants.manifest?.extra?.apiBaseUrl
  || 'http://localhost:5080/api/v1';

export const apiClient = axios.create({
  baseURL,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store',
    'Pragma': 'no-cache',
  },
});

let onAuthFailure = null;
export const setAuthFailureHandler = (fn) => { onAuthFailure = fn; };

apiClient.interceptors.request.use(async (config) => {
  config.headers = config.headers || {};
  config.headers['X-Client-Ts'] = Date.now().toString();
  if (!config.skipAuth) {
    const { accessToken } = await getTokens();
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
  }
  if (typeof console !== 'undefined') {
    console.log('[api ->]', (config.method || 'get').toUpperCase(), config.baseURL + config.url);
  }
  return config;
});

apiClient.interceptors.response.use(
  (res) => {
    if (typeof console !== 'undefined') {
      console.log('[api <-]', res.status, res.config.url);
    }
    return res;
  },
  (err) => {
    if (typeof console !== 'undefined') {
      console.log('[api !!]', err.response?.status || 'NETWORK', err.config?.url, err.response?.data?.title || err.message);
    }
    return Promise.reject(err);
  }
);

let refreshPromise = null;

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (!original || original._retried || error.response?.status !== 401) {
      return Promise.reject(error);
    }
    if (original.url && original.url.includes('/auth/')) {
      return Promise.reject(error);
    }

    const { refreshToken } = await getTokens();
    if (!refreshToken) {
      onAuthFailure?.();
      return Promise.reject(error);
    }

    if (!refreshPromise) {
      refreshPromise = apiClient
        .post('/auth/refresh', { refreshToken }, { skipAuth: true })
        .then(async (res) => {
          await setTokens({
            accessToken: res.data.accessToken,
            refreshToken: res.data.refreshToken,
            expiresAt: res.data.expiresAt,
            user: res.data.user,
          });
          return res.data.accessToken;
        })
        .catch(async (err) => {
          await clearTokens();
          onAuthFailure?.();
          throw err;
        })
        .finally(() => { refreshPromise = null; });
    }

    try {
      const newAccess = await refreshPromise;
      original._retried = true;
      original.headers = original.headers || {};
      original.headers.Authorization = `Bearer ${newAccess}`;
      return apiClient(original);
    } catch (refreshErr) {
      return Promise.reject(refreshErr);
    }
  }
);
