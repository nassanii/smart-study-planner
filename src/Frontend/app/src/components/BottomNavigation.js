import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/theme';

const TABS = [
  { name: 'Home', icon: 'home', id: 'home' },
  { name: 'Calendar', icon: 'calendar', id: 'calendar' },
  { name: 'Tasks', icon: 'checkmark-circle', id: 'tasks' },
  { name: 'Focus', icon: 'time', id: 'focus' },
  { name: 'Profile', icon: 'person', id: 'profile' },
];

export const BottomNavigation = ({ activeTab = 'home', onTabPress }) => {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
      {TABS.map((tab) => {
        const isActive = tab.id === activeTab;
        // The icons in design are filled when active, outline when inactive (handled by Ionicons name usually, but we'll approximate with color/weight for now)
        const iconName = isActive ? tab.icon : `${tab.icon}-outline`;

        return (
          <TouchableOpacity 
            key={tab.id} 
            style={styles.tab}
            onPress={() => onTabPress && onTabPress(tab.id)}
          >
            <Ionicons 
              name={iconName} 
              size={24} 
              color={isActive ? colors.primary : colors.textLight} 
            />
            <Text style={[styles.tabText, { color: isActive ? colors.primary : colors.textLight }]}>
              {tab.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    fontSize: 10,
    marginTop: 4,
    fontWeight: '500',
  }
});
