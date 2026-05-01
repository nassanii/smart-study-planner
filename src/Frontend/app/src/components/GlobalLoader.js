import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from '../theme/theme';
import { subscribeLoading } from '../services/loading_bus';

export const GlobalLoader = () => {
  const { colors, fonts } = useTheme();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => subscribeLoading(setIsLoading), []);

  if (!isLoading) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      <View style={[styles.pill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
         <ActivityIndicator size="small" color={colors.primary} />
         <Text style={[styles.text, { color: colors.textDark, fontFamily: fonts.medium }]}>Syncing...</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 55, // sits just below the status bar
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
    elevation: 9999,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  text: {
    fontSize: 13,
    marginLeft: 8,
  }
});
