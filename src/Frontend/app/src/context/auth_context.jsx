import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { authApi } from '../services/api';
import { setTokens, getTokens, clearTokens } from '../services/auth_storage';
import { setAuthFailureHandler } from '../services/api_client';
import { setNotificationUserScope } from '../services/notifications_bus';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [refreshToken, setRefreshToken] = useState(null);
  const [hydrating, setHydrating] = useState(true);

  useEffect(() => {
    setNotificationUserScope(user?.userId || null);
  }, [user?.userId]);

  const applyTokens = useCallback(async (tokens) => {
    console.log('[auth] applyTokens user=', tokens.user?.userId, 'isOnboarded=', tokens.user?.isOnboarded);
    await setTokens(tokens);
    setAccessToken(tokens.accessToken || null);
    setRefreshToken(tokens.refreshToken || null);
    setUser(tokens.user || null);
  }, []);

  const logout = useCallback(async () => {
    console.log('[auth] logout called');
    const stored = await getTokens();
    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
    await clearTokens().catch(() => {});
    if (stored.refreshToken) {
      authApi.logout(stored.refreshToken).catch(() => {});
    }
  }, []);

  useEffect(() => {
    setAuthFailureHandler(() => {
      setUser(null);
      setAccessToken(null);
      setRefreshToken(null);
    });
  }, []);

  useEffect(() => {
    (async () => {
      const stored = await getTokens();
      if (stored.accessToken && stored.user) {
        setAccessToken(stored.accessToken);
        setRefreshToken(stored.refreshToken);
        setUser(stored.user);
        try {
          const fresh = await authApi.me();
          setUser(fresh);
          await setTokens({ ...stored, user: fresh });
        } catch (_) {
          await clearTokens();
          setUser(null);
          setAccessToken(null);
          setRefreshToken(null);
        }
      }
      setHydrating(false);
    })();
  }, []);

  const pushTokenRegistrationRef = useRef(null);
  useEffect(() => {
    if (!user) {
      pushTokenRegistrationRef.current = null;
      return;
    }

    const registrationKey = `${user.userId}:${user.pushToken || 'no-token'}`;
    if (pushTokenRegistrationRef.current === registrationKey) {
      return;
    }

    let cancelled = false;
    pushTokenRegistrationRef.current = registrationKey;

    const persistPushToken = async (token) => {
      if (!token || cancelled) {
        if (!token) pushTokenRegistrationRef.current = null;
        return;
      }

      pushTokenRegistrationRef.current = `${user.userId}:${token}`;
      if (token === user.pushToken) return;

      const updatedUser = { ...user, pushToken: token };
      setUser((current) => (
        current?.userId === user.userId ? { ...current, pushToken: token } : current
      ));

      const stored = await getTokens();
      if (stored.accessToken && stored.user?.userId === user.userId) {
        await setTokens({ ...stored, user: { ...stored.user, pushToken: token } });
      }
    };

    import('../services/notifications')
      .then(async ({ registerPushTokenWithBackend }) => {
        const token = await registerPushTokenWithBackend(user.pushToken);
        await persistPushToken(token);
      })
      .catch((err) => {
        pushTokenRegistrationRef.current = null;
        console.log('[auth] error loading notification service', err);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  const login = useCallback(async (email, password) => {
    const data = await authApi.login({ email, password });
    await applyTokens({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresAt: data.expiresAt,
      user: data.user,
    });
    return data.user;
  }, [applyTokens]);

  const register = useCallback(async (name, email, password) => {
    console.log('[auth] register attempt', email);
    const data = await authApi.register({ name, email, password });
    console.log('[auth] register success, accessToken length=', data.accessToken?.length);
    await applyTokens({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresAt: data.expiresAt,
      user: data.user,
    });
    return data.user;
  }, [applyTokens]);

  const refreshUser = useCallback(async () => {
    const fresh = await authApi.me();
    setUser(fresh);
    const stored = await getTokens();
    await setTokens({ ...stored, user: fresh });
    return fresh;
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      accessToken,
      refreshToken,
      isAuthenticated: !!accessToken,
      hydrating,
      login,
      register,
      logout,
      refreshUser,
      setUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};
