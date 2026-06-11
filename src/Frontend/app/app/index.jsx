import React, { useState, useEffect } from 'react';
import { SplashScreen } from '../src/screens/SplashScreen';
import { useAuth } from '../src/context/auth_context';
import { useAI } from '../src/context/ai_context';
import { useRouter } from 'expo-router';

export default function EntryPoint() {
  const [showSplash, setShowSplash] = useState(true);
  const { isAuthenticated, hydrating: authHydrating, user } = useAuth();
  const { userData } = useAI();
  const router = useRouter();

  const handleFinish = () => {
    setShowSplash(false);
  };

  useEffect(() => {
    // If the splash animation is done and auth status is fully hydrated, redirect the user
    if (!showSplash && !authHydrating) {
      if (!isAuthenticated) {
        router.replace('/login');
      } else if (!(user?.isOnboarded ?? userData?.isOnboarded)) {
        router.replace('/onboarding');
      } else {
        router.replace('/(tabs)/home');
      }
    }
  }, [showSplash, authHydrating, isAuthenticated, user, userData, router]);

  // We always render the SplashScreen on first launch until it calls back onFinish
  if (showSplash) {
    return <SplashScreen onFinish={handleFinish} />;
  }

  return null;
}
