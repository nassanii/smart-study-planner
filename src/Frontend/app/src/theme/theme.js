import React, { createContext, useContext, useState } from 'react';

// Light and Dark Color Definitions
export const lightColors = {
  background: '#FAF9FF', 
  surface: '#FFFFFF',
  primary: '#6B5CE7',
  primaryLight: '#E8E7FD', 
  textDark: '#1A1A24', 
  textLight: '#A0A0A0',
  border: '#F0F0F0',
  cardAlt: '#F4F3FA',
  accent: {
    math: '#4FA5FF', // More saturated blue from design
    science: '#2ED4A1', // Vibrant green
    literature: '#FF6B8B', // Vibrant pink 
    history: '#FFD166', // Deep yellow
    exam: '#FF4757',
    focus: '#A29BFE' 
  }
};

export const darkColors = {
  background: '#12121A', // Darkest pixel
  surface: '#1E1E28', // Cards surface
  primary: '#7B6CF6', // Slightly lighter purple for dark mode contrast
  primaryLight: '#2A2A3A', // Dark purple-tinted gray
  textDark: '#FFFFFF', // Actually white in dark mode
  textLight: '#8A8A9E', // Dimmer text
  border: '#333344',
  cardAlt: '#252532',
  accent: {
    math: '#4FA5FF', 
    science: '#2ED4A1', 
    literature: '#FF6B8B', 
    history: '#FFD166', 
    exam: '#FF4757',
    focus: '#7B6CF6' 
  }
};

export const SIZES = {
  base: 8,
  small: 12,
  font: 14,
  medium: 16,
  large: 20,
  xlarge: 24,
  padding: 20,
  radius: 16,
};

export const FONTS = {
  bold: 'Outfit_700Bold', 
  semiBold: 'Outfit_600SemiBold', 
  regular: 'Outfit_400Regular',
  medium: 'Outfit_500Medium',
};

// Default export is standard light colors to prevent breaking existing imports temporarily
export const COLORS = lightColors;

// Theme Context Definition
const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);

  const toggleTheme = () => {
    setIsDarkMode(prev => !prev);
  };

  const theme = {
    isDarkMode,
    colors: isDarkMode ? darkColors : lightColors,
    toggleTheme,
    sizes: SIZES,
    fonts: FONTS
  };

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
