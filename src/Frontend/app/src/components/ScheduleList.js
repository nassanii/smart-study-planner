import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { COLORS } from '../theme/theme';

export const ScheduleList = ({ scheduleData, loading }) => {
  const renderItem = ({ item }) => {
    // Determine card background color based on subject tag
    let bgColor = COLORS.primaryLight;
    let barColor = COLORS.primary;
    let titleColor = COLORS.primary;

    if (item.tag) {
       const tagKey = item.tag.toLowerCase();
       if (COLORS.accent[tagKey]) {
           // Create a very light version of the accent color for background by blending with white or just using opacity in actual RN.
           // Since we don't have a color utility, we'll use predefined hex or opacity.
           bgColor = `${COLORS.accent[tagKey]}20`; // 20% opacity hex
           barColor = COLORS.accent[tagKey];
           titleColor = COLORS.accent[tagKey];
       }
    }

    if (item.activity_type === 'break') {
      return null; // Skip rendering breaks to match UI, or render as a thin line
    }

    return (
      <View style={styles.cardContainer}>
        <Text style={styles.timeText}>{item.time_slot}</Text>
        <View style={[styles.card, { backgroundColor: bgColor }]}>
          <View style={[styles.cardIndicator, { backgroundColor: barColor }]} />
          <View style={styles.cardContent}>
            <Text style={[styles.subjectText, { color: titleColor }]}>{item.subject}</Text>
            {/* Using dummy subtitles based on the screenshot */}
            <Text style={styles.subtitleText}>
               {item.tag === 'Math' ? 'Chapter 5 - Eigenvalues' : 
                item.tag === 'Science' ? 'Lab Report Due' : 
                item.tag === 'Literature' ? 'Shakespeare Essay Prep' : 
                'AI-Optimized Study Block'}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Today's Schedule</Text>
        <Text style={styles.headerDate}>Apr 8, 2026</Text>
      </View>
      
      {loading ? (
        <Text style={styles.loadingText}>Optimizing schedule with AI...</Text>
      ) : (
        <FlatList
          data={scheduleData}
          keyExtractor={(item, index) => index.toString()}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textDark,
  },
  headerDate: {
    color: COLORS.textLight,
    fontSize: 12,
  },
  loadingText: {
    textAlign: 'center',
    color: COLORS.textLight,
    marginTop: 20,
  },
  cardContainer: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  timeText: {
    width: 50,
    color: COLORS.textLight,
    fontSize: 12,
    marginTop: 15,
  },
  card: {
    flex: 1,
    flexDirection: 'row',
    borderRadius: 12,
    overflow: 'hidden',
    minHeight: 70,
  },
  cardIndicator: {
    width: 4,
    height: '100%',
  },
  cardContent: {
    padding: 15,
    justifyContent: 'center',
  },
  subjectText: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitleText: {
    fontSize: 12,
    color: COLORS.textLight,
  }
});
