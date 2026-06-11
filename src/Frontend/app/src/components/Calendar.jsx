import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES } from '../theme/theme';

export const Calendar = () => {
  const [viewMode, setViewMode] = useState('Month');
  
  const renderHeader = () => (
    <View style={styles.headerRow}>
      <Text style={styles.monthText}>April 2026</Text>
      <View style={styles.navButtons}>
        <TouchableOpacity style={styles.navBtn}>
          <Ionicons name="chevron-back" size={20} color={COLORS.textDark} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.navBtn}>
           <Ionicons name="chevron-forward" size={20} color={COLORS.textDark} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderToggle = () => (
    <View style={styles.toggleContainer}>
      {['Month', 'Week', 'Day'].map(mode => (
        <TouchableOpacity
          key={mode}
          style={[styles.toggleBtn, viewMode === mode && styles.toggleBtnActive]}
          onPress={() => setViewMode(mode)}
        >
          <Text style={[styles.toggleText, viewMode === mode && styles.toggleTextActive]}>{mode}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderDaysHeader = () => (
    <View style={styles.daysRow}>
      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
        <Text key={day} style={styles.dayHeaderText}>{day}</Text>
      ))}
    </View>
  );

  const renderMockDates = () => {
    // Array simulating the dates in the design
    const dates = [
      ...Array.from({length: 3}, (_, i) => ({ day: 29 + i, prev: true })),
      { day: 1, dot: 'math' }, { day: 2 }, { day: 3, dot: 'science' }, { day: 4 },
      { day: 5, dots: ['math', 'science'] }, { day: 6 }, { day: 7, dot: 'history' }, { day: 8, active: true, dots: ['surface', 'surface'] },
      { day: 9, dot: 'math' }, { day: 10 }, { day: 11 }, { day: 12, dot: 'literature' }, { day: 13 },
      { day: 14, dot: 'science' }, { day: 15 }, { day: 16 }, { day: 17, dots: ['math', 'science'] },
      { day: 18 }, { day: 19 }, { day: 20, dot: 'literature' }, { day: 21 }, { day: 22 },
      { day: 23 }, { day: 24, dot: 'literature' }, { day: 25 }, { day: 26 }, { day: 27 },
      { day: 28 }, { day: 29 }, { day: 30 }, { day: 1, next: true }, { day: 2, next: true }
    ];

    return (
      <View style={styles.datesGrid}>
        {dates.map((item, index) => {
          const isFaded = item.prev || item.next;
          return (
            <View key={index} style={styles.dateCell}>
              <View style={[styles.dateBubble, item.active && styles.dateBubbleActive]}>
                <Text style={[
                  styles.dateText, 
                  isFaded && styles.dateTextFaded,
                  item.active && styles.dateTextActive
                ]}>
                  {item.day}
                </Text>
                
                {item.dot && (
                  <View style={[styles.dot, { backgroundColor: COLORS.accent[item.dot] }]} />
                )}
                
                {item.dots && (
                  <View style={styles.dotsRow}>
                    {item.dots.map((d, i) => (
                      <View key={i} style={[styles.dot, { backgroundColor: d === 'surface' ? COLORS.surface : COLORS.accent[d] }]} />
                    ))}
                  </View>
                )}
              </View>
            </View>
          )
        })}
      </View>
    );
  };

  const renderLegend = () => (
    <View style={styles.legendContainer}>
      {['Math', 'Science', 'Literature', 'History', 'Exam'].map(subject => (
        <View key={subject} style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: COLORS.accent[subject.toLowerCase()] }]} />
          <Text style={styles.legendText}>{subject}</Text>
        </View>
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      {renderHeader()}
      {renderToggle()}
      {renderDaysHeader()}
      {renderMockDates()}
      {renderLegend()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 10,
    backgroundColor: COLORS.background,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  monthText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.textDark,
  },
  navButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#F3F2F8',
    borderRadius: 25,
    padding: 4,
    marginBottom: 20,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 20,
  },
  toggleBtnActive: {
    backgroundColor: COLORS.primary,
  },
  toggleText: {
    color: COLORS.textLight,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: COLORS.surface,
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 10,
  },
  dayHeaderText: {
    color: COLORS.textLight,
    fontSize: 12,
    fontWeight: '600',
    width: 30,
    textAlign: 'center',
  },
  datesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  dateCell: {
    width: '14.28%',
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateBubble: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  dateBubbleActive: {
    backgroundColor: COLORS.primary,
    elevation: 5,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  dateText: {
    color: COLORS.textDark,
    fontSize: 16,
    fontWeight: '500',
  },
  dateTextFaded: {
    color: '#D0D0D0',
  },
  dateTextActive: {
    color: COLORS.surface,
    fontWeight: 'bold',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
    marginHorizontal: 1,
  },
  dotsRow: {
    flexDirection: 'row',
  },
  legendContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 20,
    gap: 15,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  legendText: {
    color: COLORS.textLight,
    fontSize: 12,
  }
});
