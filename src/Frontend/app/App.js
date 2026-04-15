import React, { useState } from 'react';
import { StyleSheet, View, ActivityIndicator, SafeAreaView, StatusBar } from 'react-native';
import * as Font from 'expo-font';
import { 
  Outfit_400Regular, 
  Outfit_500Medium, 
  Outfit_600SemiBold, 
  Outfit_700Bold 
} from '@expo-google-fonts/outfit';

import { ThemeProvider, useTheme } from './src/theme/theme';
import { AIProvider, useAI } from './src/context/ai_context';
import { SplashScreen } from './src/screens/SplashScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { TasksScreen } from './src/screens/TasksScreen';
import { CalendarScreen } from './src/screens/CalendarScreen';
import { FocusScreen } from './src/screens/FocusScreen';
import { AnalyticsScreen } from './src/screens/AnalyticsScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { BottomNavigation } from './src/components/BottomNavigation';

const MainApp = () => {
  const { isSplashScreenVisible, setIsSplashScreenVisible, colors, isDarkMode } = useTheme();
  const { userData } = useAI();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState('home');

  if (isSplashScreenVisible) {
    return <SplashScreen onFinish={() => setIsSplashScreenVisible(false)} />;
  }

  if (!isAuthenticated) {
    return <LoginScreen onLogin={() => setIsAuthenticated(true)} />;
  }

  if (!userData.isOnboarded) {
    return <OnboardingScreen />;
  }

  const renderScreen = () => {
    switch (activeTab) {
      case 'home': return <DashboardScreen />;
      case 'calendar': return <CalendarScreen />;
      case 'tasks': return <TasksScreen />;
      case 'focus': return <FocusScreen />;
      case 'analytics': return <AnalyticsScreen />;
      case 'profile': return <ProfileScreen />;
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
    <ThemeProvider>
      <AIProvider>
        <MainApp />
      </AIProvider>
    </ThemeProvider>
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
