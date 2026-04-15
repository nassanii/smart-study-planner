import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { useTheme } from '../theme/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming, 
  withDelay, 
  interpolate 
} from 'react-native-reanimated';

const LoadingDot = ({ delay }) => {
  const { colors } = useTheme();
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withDelay(delay, withRepeat(withTiming(1, { duration: 600 }), -1, true));
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: interpolate(opacity.value, [0.3, 1], [0.8, 1.2]) }]
  }));

  return <Animated.View style={[styles.dot, { backgroundColor: colors.primary }, animatedStyle]} />;
};

export const SplashScreen = ({ onFinish }) => {
  const { colors, fonts } = useTheme();

  useEffect(() => {
    const timer = setTimeout(() => {
      onFinish && onFinish();
    }, 2500);
    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[colors.primary, '#9F8FFF']}
        style={styles.iconContainer}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
         <MaterialCommunityIcons name="book-open-page-variant" size={60} color="#FFF" />
      </LinearGradient>
      
      <Text style={[styles.title, { color: colors.textDark, fontFamily: fonts.bold }]}>
        Study<Text style={{ color: colors.accent.math }}>Plan</Text>
      </Text>
      <Text style={[styles.subtitle, { color: colors.textLight, fontFamily: fonts.regular }]}>
        Smart Study Planning
      </Text>
      
      <View style={styles.loadingDots}>
        <LoadingDot delay={0} />
        <LoadingDot delay={200} />
        <LoadingDot delay={400} />
      </View>

      <Text style={[styles.version, { color: colors.textLight, fontFamily: fonts.medium }]}>
        Version 1.0.0
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    elevation: 12,
    shadowColor: '#6B5CE7',
    shadowOpacity: 0.4,
    shadowRadius: 25,
    shadowOffset: { width: 0, height: 10 },
  },
  title: {
    fontSize: 34,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 80,
  },
  loadingDots: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 100,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  version: {
    position: 'absolute',
    bottom: 40,
    fontSize: 12,
  }
});
