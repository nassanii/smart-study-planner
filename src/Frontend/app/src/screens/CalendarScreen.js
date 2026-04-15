import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { useTheme } from '../theme/theme';
import { useAI } from '../context/ai_context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const CalendarScreen = () => {
  const { colors, fonts } = useTheme();
  const [viewMode, setViewMode] = useState('Month'); 
  const [selectedDay, setSelectedDay] = useState(8); 
  const [currentMonth, setCurrentMonth] = useState('April 2026');

  const days = Array.from({ length: 30 }, (_, i) => i + 1);
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 12, paddingBottom: 100 }}
      >
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>{currentMonth}</Text>
          <View style={styles.headerRight}>
             <View style={styles.navArrows}>
                <TouchableOpacity style={[styles.arrowBtn, { backgroundColor: colors.cardAlt }]}>
                   <Ionicons name="chevron-back" size={20} color={colors.textDark} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.arrowBtn, { backgroundColor: colors.cardAlt }]}>
                   <Ionicons name="chevron-forward" size={20} color={colors.textDark} />
                </TouchableOpacity>
             </View>
             <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]}>
                <Ionicons name="add" size={24} color="#FFF" />
             </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.toggleRow, { backgroundColor: colors.cardAlt }]}>
          {['Month', 'Week', 'Day'].map(m => {
            const isSel = viewMode === m;
            return (
              <TouchableOpacity 
                key={m} 
                style={[styles.toggleBtn, isSel && { backgroundColor: colors.surface }]}
                onPress={() => setViewMode(m)}
              >
                <Text style={[
                  styles.toggleText, 
                  { 
                    color: isSel ? colors.primary : colors.textLight,
                    fontFamily: isSel ? fonts.bold : fonts.medium
                  }
                ]}>{m}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.calendarGrid}>
           <View style={styles.weekHeader}>
              {weekDays.map(d => (
                 <Text key={d} style={[styles.weekDayText, { color: colors.textLight, fontFamily: fonts.semiBold }]}>{d}</Text>
              ))}
           </View>
           <View style={styles.daysContainer}>
              {/* Offset for April 2026 starts on Wed (3) */}
              {[29, 30, 31].map(d => (
                 <View key={`prev-${d}`} style={styles.dayCell}>
                    <Text style={[styles.dayTextOff, { color: '#D1D1DB', fontFamily: fonts.medium }]}>{d}</Text>
                 </View>
              ))}
              {days.map(d => {
                 const isSel = selectedDay === d;
                 const hasEvent = [1, 3, 5, 8, 9, 12, 14, 17, 20, 24].includes(d);
                 const eventColors = {
                    1: colors.primary,
                    3: colors.accent.science,
                    5: colors.accent.literature,
                    8: colors.primary,
                    12: colors.accent.exam
                 };
                 return (
                    <TouchableOpacity 
                       key={d} 
                       style={[styles.dayCell, isSel && { backgroundColor: colors.primary, borderRadius: 12 }]}
                       onPress={() => setSelectedDay(d)}
                    >
                       <Text style={[styles.dayText, { color: isSel ? '#FFF' : colors.textDark, fontFamily: fonts.bold }]}>{d}</Text>
                       {hasEvent && !isSel && (
                          <View style={styles.dotsRow}>
                             <View style={[styles.eventDot, { backgroundColor: eventColors[d] || colors.primary }]} />
                             {d === 5 || d === 8 || d === 17 || d === 24 ? <View style={[styles.eventDot, { backgroundColor: colors.accent.science }]} /> : null}
                          </View>
                       )}
                       {isSel && <View style={styles.selDots}><View style={styles.whiteDot}/><View style={styles.whiteDot}/></View>}
                    </TouchableOpacity>
                 );
              })}
           </View>
        </View>

        <View style={styles.legendRow}>
           {[
              { l: 'Math', c: colors.primary },
              { l: 'Science', c: colors.accent.science },
              { l: 'Literature', c: colors.accent.literature },
              { l: 'History', c: '#FDCB6E' },
              { l: 'Exam', c: colors.accent.exam }
           ].map((item, idx) => (
              <View key={idx} style={styles.legendItem}>
                 <View style={[styles.legendDot, { backgroundColor: item.c }]} />
                 <Text style={[styles.legendText, { color: colors.textLight, fontFamily: fonts.medium }]}>{item.l}</Text>
              </View>
           ))}
        </View>

        <View style={styles.sectionHeader}>
           <Text style={[styles.sectionTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>Today's Schedule</Text>
           <Text style={[styles.dateSub, { color: colors.textLight, fontFamily: fonts.medium }]}>Apr 8, 2026</Text>
        </View>

        <View style={styles.scheduleList}>
           {[
              { time: '9:00', title: 'Linear Algebra', sub: 'Chapter 5 — Eigenvalues', color: 'rgba(107, 92, 231, 0.1)' },
              { time: '11:00', title: 'Biology Lab', sub: 'Lab Report Due', color: 'rgba(52, 211, 153, 0.1)' },
              { time: '2:00', title: 'Literature Review', sub: 'Shakespeare Essay Prep', color: 'rgba(236, 72, 153, 0.1)' },
              { time: '4:00', title: 'Focus Session', sub: 'AI-Optimized Study Block', color: 'rgba(107, 92, 231, 0.1)' }
           ].map((item, idx) => (
              <View key={idx} style={styles.scheduleItem}>
                 <Text style={[styles.timeText, { color: colors.textLight, fontFamily: fonts.bold }]}>{item.time}</Text>
                 <View style={[styles.taskBlock, { backgroundColor: item.color, borderColor: item.color.replace('0.1', '0.2'), borderLeftColor: item.color.replace('0.1', '1') }]}>
                    <Text style={[styles.taskBlockTitle, { color: item.color.replace('0.1', '1'), fontFamily: fonts.bold }]}>{item.title}</Text>
                    <Text style={[styles.taskBlockSub, { color: colors.textLight, fontFamily: fonts.medium }]}>{item.sub}</Text>
                 </View>
              </View>
           ))}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  headerTitle: { fontSize: 26 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  navArrows: { flexDirection: 'row', gap: 8 },
  arrowBtn: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  addBtn: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', elevation: 4 },
  toggleRow: { flexDirection: 'row', padding: 6, borderRadius: 20, marginBottom: 35 },
  toggleBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 16 },
  toggleText: { fontSize: 14 },
  calendarGrid: { marginBottom: 30 },
  weekHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15, paddingHorizontal: 10 },
  weekDayText: { width: 40, textAlign: 'center', fontSize: 13, opacity: 0.6 },
  daysContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 5 },
  dayCell: { width: (SCREEN_WIDTH - 80) / 7, height: 50, justifyContent: 'center', alignItems: 'center' },
  dayText: { fontSize: 16 },
  dayTextOff: { fontSize: 16 },
  dotsRow: { flexDirection: 'row', gap: 3, marginTop: 4 },
  eventDot: { width: 4, height: 4, borderRadius: 2 },
  selDots: { flexDirection: 'row', gap: 3, marginTop: 4 },
  whiteDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#FFF' },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 15, marginBottom: 40, paddingHorizontal: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 25 },
  sectionTitle: { fontSize: 20 },
  dateSub: { fontSize: 13, opacity: 0.6 },
  scheduleList: { gap: 20 },
  scheduleItem: { flexDirection: 'row', gap: 20 },
  timeText: { fontSize: 14, width: 40, marginTop: 10 },
  taskBlock: { flex: 1, padding: 18, borderRadius: 20, borderLeftWidth: 4, borderWidth: 1 },
  taskBlockTitle: { fontSize: 16, marginBottom: 4 },
  taskBlockSub: { fontSize: 12 }
});
