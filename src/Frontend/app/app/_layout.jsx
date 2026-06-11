import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import * as Font from 'expo-font';
import { purgeWebCaches } from '../src/services/cache_buster';
import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold
} from '@expo-google-fonts/outfit';

import { NavigationProvider } from '../src/context/navigation_context';
import { ThemeProvider, useTheme } from '../src/theme/theme';
import { AuthProvider, useAuth } from '../src/context/auth_context';
import { AIProvider } from '../src/context/ai_context';
import { FocusProvider } from '../src/context/focus_context';
import { AppDialogHost } from '../src/components/AppDialogHost';
import { GlobalLoader } from '../src/components/GlobalLoader';
import Toast from 'react-native-toast-message';

function AuthGuard({ children }) {
  const { isAuthenticated, hydrating } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (hydrating) return;

    const publicRoutes = ['login', 'reset_password'];
    const isPublicRoute = publicRoutes.includes(segments[0]);
    if (!isAuthenticated && !isPublicRoute) {
      // Redirect to login if the user is unauthenticated and not already on the login screen
      router.replace('/login');
    }
  }, [isAuthenticated, hydrating, segments]);

  if (hydrating) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#6B5CE7" />
      </View>
    );
  }

  return children;
}

export default function RootLayout() {
  useEffect(() => {
    purgeWebCaches();
  }, []);

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
              <AuthGuard>
                <Stack screenOptions={{ headerShown: false }} />
                <AppDialogHost />
                <GlobalLoader />
                <Toast />
              </AuthGuard>
            </FocusProvider>
          </AIProvider>
        </AuthProvider>
      </ThemeProvider>
    </NavigationProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAF9FF',
  },
});
