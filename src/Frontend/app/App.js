import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ActivityIndicator, SafeAreaView, StatusBar } from 'react-native';
import * as Font from 'expo-font';
import { purgeWebCaches } from './src/services/cache_buster';
import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold
} from '@expo-google-fonts/outfit';

import { NavigationProvider, useAppNavigation } from './src/context/navigation_context';
import { ThemeProvider, useTheme } from './src/theme/theme';
import { AuthProvider, useAuth } from './src/context/auth_context';
import { AIProvider, useAI } from './src/context/ai_context';
import { FocusProvider } from './src/context/focus_context';
import { SplashScreen } from './src/screens/SplashScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { SubjectsScreen } from './src/screens/TasksScreen';
import { CalendarScreen } from './src/screens/CalendarScreen';
import { FocusScreen } from './src/screens/FocusScreen';
import { AnalyticsScreen } from './src/screens/AnalyticsScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { EditProfileScreen } from './src/screens/EditProfileScreen';
import { ChangePasswordScreen } from './src/screens/ChangePasswordScreen';
import { BottomNavigation } from './src/components/BottomNavigation';
import { AppDialogHost } from './src/components/AppDialogHost';
import { GlobalLoader } from './src/components/GlobalLoader';
import Toast from 'react-native-toast-message';

const MainApp = () => {
  const { isSplashScreenVisible, setIsSplashScreenVisible, colors, isDarkMode } = useTheme();
  const { isAuthenticated, hydrating: authHydrating, user } = useAuth();
  const { userData } = useAI();
  const { activeTab, setActiveTab, navHydrating } = useAppNavigation();

  console.log('[MainApp] authHydrating=', authHydrating, 'navHydrating=', navHydrating, 'isAuthenticated=', isAuthenticated);

  if (isSplashScreenVisible || authHydrating || navHydrating) {
    return <SplashScreen onFinish={() => setIsSplashScreenVisible(false)} />;
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  if (!(user?.isOnboarded ?? userData.isOnboarded)) {
    return <OnboardingScreen />;
  }

  const renderScreen = () => {
    switch (activeTab) {
      case 'home': return <DashboardScreen />;
      case 'calendar': return <CalendarScreen />;
      case 'subjects': return <SubjectsScreen />;
      case 'focus': return <FocusScreen />;
      case 'analytics': return <AnalyticsScreen />;
      case 'profile': return <ProfileScreen />;
      case 'edit_profile': return <EditProfileScreen />;
      case 'change_password': return <ChangePasswordScreen />;
      default: return <DashboardScreen />;
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={colors.background} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.content}>
          {renderScreen()}
        </View>
        <BottomNavigation activeTab={activeTab} onTabPress={setActiveTab} />
      </View>
    </SafeAreaView>
  );
};

export default function App() {
  useEffect(() => { purgeWebCaches(); }, []);

  const [fontsLoaded] = Font.useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#6B5CE7" />
      </View>
    );
  }

  return (
    <NavigationProvider>
      <ThemeProvider>
        <AuthProvider>
          <AIProvider>
            <FocusProvider>
              <MainApp />
              <AppDialogHost />
              <GlobalLoader />
              <Toast />
            </FocusProvider>
          </AIProvider>
        </AuthProvider>
      </ThemeProvider>
    </NavigationProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  }
});
