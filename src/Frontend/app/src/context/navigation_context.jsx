import React, { createContext, useContext, useState } from 'react';
import { useRouter, useLocalSearchParams, useSegments } from 'expo-router';

const NavigationContext = createContext(null);

export const NavigationProvider = ({ children }) => {
  const router = useRouter();
  const localParams = useLocalSearchParams();
  const segments = useSegments();

  const [lastCompletedSession, setLastCompletedSession] = useState(null);
  const [navHydrating] = useState(false);

  // Derive the active tab from the current route segments
  // e.g. /(tabs)/home -> segments will be ['(tabs)', 'home']
  const activeTab = segments[segments.length - 1] || 'home';

  // Expose the current local search params as navigationParams for backward compatibility
  const navigationParams = localParams;

  const setActiveTab = (tabId) => {
    const tabRoutes = ['home', 'calendar', 'tasks', 'focus', 'profile'];
    if (tabRoutes.includes(tabId)) {
      router.replace(`/(tabs)/${tabId}`);
    } else {
      router.replace(`/${tabId}`);
    }
  };

  const navigate = (tabId, params = {}) => {
    const tabRoutes = ['home', 'calendar', 'tasks', 'focus', 'profile'];
    let targetPath = '';
    if (tabRoutes.includes(tabId)) {
      targetPath = `/(tabs)/${tabId}`;
    } else {
      targetPath = `/${tabId}`;
    }

    // Convert all params to string since Expo Router parameters in query are stringified
    const stringifiedParams = {};
    Object.keys(params).forEach((key) => {
      stringifiedParams[key] = String(params[key]);
    });

    router.push({
      pathname: targetPath,
      params: stringifiedParams,
    });
  };

  const clearParams = () => {
    // URL-based routing automatically isolates params per route, so this can be a no-op
  };

  return (
    <NavigationContext.Provider
      value={{
        activeTab,
        setActiveTab,
        navigate,
        navigationParams,
        clearParams,
        lastCompletedSession,
        setLastCompletedSession,
        navHydrating,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
};

export const useAppNavigation = () => {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error('useAppNavigation must be used inside <NavigationProvider>');
  return ctx;
};
