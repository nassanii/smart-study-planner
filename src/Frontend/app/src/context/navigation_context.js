import React, { createContext, useContext, useState } from 'react';

const NavigationContext = createContext(null);

export const NavigationProvider = ({ children }) => {
  const [activeTab, setActiveTab] = useState('home');
  const [navigationParams, setNavigationParams] = useState({});
  const [lastCompletedSession, setLastCompletedSession] = useState(null);

  const navigate = (tabId, params = {}) => {
    setActiveTab(tabId);
    setNavigationParams(params);
  };

  const clearParams = () => {
    setNavigationParams({});
  };

  return (
    <NavigationContext.Provider value={{ activeTab, setActiveTab, navigate, navigationParams, clearParams, lastCompletedSession, setLastCompletedSession }}>
      {children}
    </NavigationContext.Provider>
  );
};

export const useAppNavigation = () => {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error('useAppNavigation must be used inside <NavigationProvider>');
  return ctx;
};
