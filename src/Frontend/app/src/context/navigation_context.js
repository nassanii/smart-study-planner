import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NavigationContext = createContext(null);
const TAB_PERSIST_KEY = 'ssp.activeTab';

export const NavigationProvider = ({ children }) => {
  const [activeTab, _setActiveTab] = useState('home');
  const [navigationParams, setNavigationParams] = useState({});
  const [lastCompletedSession, setLastCompletedSession] = useState(null);
  const [navHydrating, setNavHydrating] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const savedTab = await AsyncStorage.getItem(TAB_PERSIST_KEY);
        if (savedTab) {
          _setActiveTab(savedTab);
        }
      } catch (err) {
        console.warn('Failed to load active tab:', err);
      } finally {
        setNavHydrating(false);
      }
    })();
  }, []);

  const setActiveTab = async (tabId) => {
    _setActiveTab(tabId);
    try {
      await AsyncStorage.setItem(TAB_PERSIST_KEY, tabId);
    } catch (err) {
      console.warn('Failed to save active tab:', err);
    }
  };

  const navigate = (tabId, params = {}) => {
    setActiveTab(tabId);
    setNavigationParams(params);
  };

  const clearParams = () => {
    setNavigationParams({});
  };

  return (
    <NavigationContext.Provider value={{ activeTab, setActiveTab, navigate, navigationParams, clearParams, lastCompletedSession, setLastCompletedSession, navHydrating }}>
      {children}
    </NavigationContext.Provider>
  );
};

export const useAppNavigation = () => {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error('useAppNavigation must be used inside <NavigationProvider>');
  return ctx;
};
