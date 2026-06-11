import React from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { SafeAreaView, View, StyleSheet, StatusBar } from 'react-native';
import { useTheme } from '../../src/theme/theme';
import { BottomNavigation } from '../../src/components/BottomNavigation';

export default function TabsLayout() {
  const { colors, isDarkMode } = useTheme();
  const segments = useSegments();
  const activeTab = segments[segments.length - 1] || 'home';
  const router = useRouter();

  const handleTabPress = (tabId) => {
    router.replace(`/(tabs)/${tabId}`);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={colors.background} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.content}>
          <Slot />
        </View>
        <BottomNavigation activeTab={activeTab} onTabPress={handleTabPress} />
      </View>
    </SafeAreaView>
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
});
