import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Modal, TextInput, Alert } from 'react-native';
import { useTheme } from '../theme/theme';
import { useAI } from '../context/ai_context';
import { useAppNavigation } from '../context/navigation_context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { focusApi, scheduleApi } from '../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const CalendarScreen = () => {
  const { colors, fonts } = useTheme();
  const [viewMode, setViewMode] = useState('Month');
  const now = new Date();
  const [selectedDay, setSelectedDay] = useState(now.getDate());
  const [currentDate, setCurrentDate] = useState(now);
  const [selectedDaySchedule, setSelectedDaySchedule] = useState(null);
  const [completedSessions, setCompletedSessions] = useState([]);

  // New state for slot interactions
  const [slotStatus, setSlotStatus] = useState({}); 
  const [snoozeTarget, setSnoozeTarget] = useState(null); 
  const [snoozeReason, setSnoozeReason] = useState('');
  const [customReason, setCustomReason] = useState('');

  const { latestSchedule, tasks, subjects, snoozeTask, reloadBehavioral } = useAI();
  
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const isTrulyToday = selectedDay === now.getDate() && month === now.getMonth() && year === now.getFullYear();
  const currentSlots = selectedDaySchedule?.aiSchedule?.scheduled_slots || (isTrulyToday ? (latestSchedule?.aiSchedule?.scheduled_slots || []) : []);

  // Fetch month's completed sessions for dots
  useEffect(() => {
    const from = new Date(year, month, 1).toISOString().split('T')[0];
    const to = new Date(year, month + 1, 0).toISOString().split('T')[0];
    focusApi.list({ from, to }).then(setCompletedSessions).catch(() => {});
  }, [year, month]);

  // Fetch schedule for selected day
  useEffect(() => {
    const dStr = new Date(year, month, selectedDay).toISOString().split('T')[0];
    scheduleApi.byDate(dStr).then(setSelectedDaySchedule).catch(() => setSelectedDaySchedule(null));
  }, [selectedDay, year, month]);

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const prevMonthDays = Array.from({ length: firstDayOfMonth }, (_, i) => daysInPrevMonth - firstDayOfMonth + i + 1);
  const nextMonthDays = Array.from({ length: 42 - (daysInMonth + firstDayOfMonth) }, (_, i) => i + 1);
  
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Map tasks, exams, AND completed sessions to days for dots
  const dayEvents = [
    ...tasks, 
    ...subjects.map(s => s.examDate ? { ...s, deadline: s.examDate, isExam: true } : null).filter(Boolean),
    ...completedSessions.map(s => ({ ...s, deadline: s.completedAt, isSession: true }))
  ].reduce((acc, item) => {
      const dateStr = item.deadline || item.examDate || item.completedAt;
      if (!dateStr) return acc;
      const d = new Date(dateStr);
      if (d.getMonth() === month && d.getFullYear() === year) {
        const day = d.getDate();
        if (!acc[day]) acc[day] = [];
        // Only add if not already present for same subject to avoid dot clutter
        if (!acc[day].find(x => x.subject_id === item.subject_id && x.isSession === item.isSession)) {
          acc[day].push(item);
        }
      }
      return acc;
    }, {});

  const getEventColor = (item) => {
    if (item.isExam) return '#F43F5E';
    const subId = item.subject_id || item.subjectId;
    const idx = subjects.findIndex(s => s.id === subId);
    if (idx === -1) return '#6C5CE7';
    const colorsList = ['#6366F1', '#10B981', '#F43F5E', '#F59E0B', '#06B6D4', '#8B5CF6'];
    return colorsList[idx % colorsList.length];
  };

  const changeMonth = (offset) => {
    const next = new Date(currentDate);
    next.setMonth(next.getMonth() + offset);
    setCurrentDate(next);
  };

  const { navigate, lastCompletedSession } = useAppNavigation();

  // Observe focus session completions to update slot status
  useEffect(() => {
    if (!lastCompletedSession) return;
    const inProgressIdx = Object.keys(slotStatus).find(
      k => slotStatus[k]?.status === 'in_progress'
    );
    if (inProgressIdx !== undefined) {
      setSlotStatus(prev => ({ ...prev, [inProgressIdx]: { status: 'completed' } }));
    } else {
      // Manual session completion: find the next pending slot for this subject and mark it
      const subject = subjects.find(s => s.id === lastCompletedSession.subjectId);
      if (subject) {
        const slots = selectedDaySchedule?.aiSchedule?.scheduled_slots || (isTrulyToday ? (latestSchedule?.aiSchedule?.scheduled_slots || []) : []);
        const targetIdx = slots.findIndex((slot, idx) => {
          const status = slotStatus[idx] || { status: 'pending' };
          return status.status === 'pending' && slot.subject === subject.name;
        });
        
        if (targetIdx !== -1) {
          setSlotStatus(prev => ({ ...prev, [targetIdx]: { status: 'completed' } }));
        }
      }
    }
  }, [lastCompletedSession, subjects, selectedDaySchedule, latestSchedule, isTrulyToday]);

  const handleStart = (idx, item) => {
    if (idx > 0) {
      const prev = slotStatus[idx - 1];
      if (!prev || (prev.status !== 'completed' && prev.status !== 'snoozed' && prev.status !== 'in_progress')) {
        Alert.alert("Sequence Required", "Please complete or snooze the previous session first!");
        return;
      }
    }
    setSlotStatus(prev => ({ ...prev, [idx]: { status: 'in_progress' } }));
    
    // Resolve subjectId because AI schedule only provides the subject name
    const matchingSubject = subjects.find(s => s.name === item.subject);
    const resolvedSubjectId = item.subject_id || matchingSubject?.id;

    // Navigate to Focus with params
    navigate('focus', { 
      autoStart: true, 
      subjectId: resolvedSubjectId, 
      taskId: item.task_id,
      subjectName: item.subject,
      duration: item.adjusted_duration_minutes 
    });
  };

  const handleSnooze = (idx, item) => {
    setSnoozeTarget({ idx, subject: item.subject });
    setSnoozeReason('');
    setCustomReason('');
  };

  const confirmSnooze = () => {
    const reason = snoozeReason === 'Other' ? customReason : snoozeReason;
    if (!reason) {
      Alert.alert("Reason Required", "Please select or enter a reason.");
      return;
    }
    setSlotStatus(prev => ({ ...prev, [snoozeTarget.idx]: { status: 'snoozed', reason } }));
    // Persist snooze to backend if slot has a linked task
    const slots = currentSlots;
    const slot = slots?.[snoozeTarget.idx];
    if (slot?.task_id) {
      snoozeTask(slot.task_id, reason).catch(() => {});
    }
    reloadBehavioral().catch(() => {});
    setSnoozeTarget(null);
  };


  const reasons = ['Tired', 'Hungry', 'Emergency', 'Need prep', 'Other'];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 12, paddingBottom: 100 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>
            {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </Text>
          <View style={styles.navRow}>
            <TouchableOpacity onPress={() => changeMonth(-1)} style={[styles.navBtn, { backgroundColor: colors.surface }]}>
              <Ionicons name="chevron-back" size={20} color={colors.textLight} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => changeMonth(1)} style={[styles.navBtn, { backgroundColor: colors.surface }]}>
              <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
            </TouchableOpacity>
          </View>
        </View>

        {/* View Toggles */}
        <View style={[styles.toggleRow, { backgroundColor: colors.cardAlt }]}>
          {['Month', 'Week', 'Day'].map(m => {
            const isSel = viewMode === m;
            return (
              <TouchableOpacity 
                key={m} 
                style={[styles.toggleBtn, isSel && { backgroundColor: colors.primary }]}
                onPress={() => setViewMode(m)}
              >
                <Text style={[
                  styles.toggleText, 
                  { 
                    color: isSel ? '#FFF' : colors.textLight,
                    fontFamily: isSel ? fonts.bold : fonts.medium
                  }
                ]}>{m}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Calendar Grid */}
        {viewMode !== 'Day' && (
          <View style={styles.calendarGrid}>
            <View style={styles.weekHeader}>
                {weekDays.map(d => (
                  <Text key={d} style={[styles.weekDayText, { color: '#94A3B8', fontFamily: fonts.semiBold }]}>{d}</Text>
                ))}
            </View>
            <View style={styles.daysContainer}>
                {viewMode === 'Month' && prevMonthDays.map((d, i) => (
                  <View key={`prev-${i}`} style={styles.dayCell}>
                    <Text style={[styles.dayTextOff, { color: colors.border, fontFamily: fonts.medium }]}>{d}</Text>
                  </View>
                ))}
                
                {days.map(d => {
                  const isSel = selectedDay === d && month === currentDate.getMonth() && year === currentDate.getFullYear();
                  const events = dayEvents[d] || [];
                  const dateOfD = new Date(year, month, d);
                  const isCurrentWeek = viewMode === 'Week' && Math.abs(dateOfD - now) / (1000 * 60 * 60 * 24) < 7;

                  if (viewMode === 'Week' && !isCurrentWeek) return null;

                  return (
                      <TouchableOpacity 
                        key={d} 
                        style={[styles.dayCell, isSel && [styles.selectedDayCell, { backgroundColor: colors.primary }]]}
                        onPress={() => setSelectedDay(d)}
                      >
                        <Text style={[styles.dayText, { color: isSel ? '#FFF' : colors.textDark, fontFamily: fonts.bold }]}>{d}</Text>
                        <View style={styles.dotsRow}>
                          {events.slice(0, 3).map((item, idx) => (
                            <View key={idx} style={[
                              styles.eventDot, 
                              { backgroundColor: isSel ? '#FFF' : getEventColor(item) },
                              item.isSession && { borderRadius: 1 } // Square dots for worked days?
                            ]} />
                          ))}
                        </View>
                      </TouchableOpacity>
                  );
                })}

                {viewMode === 'Month' && nextMonthDays.map((d, i) => (
                   <View key={`next-${i}`} style={styles.dayCell}>
                      <Text style={[styles.dayTextOff, { color: colors.border, fontFamily: fonts.medium }]}>{d}</Text>
                   </View>
                ))}
            </View>
          </View>
        )}

        {/* Legend */}
        {viewMode === 'Month' && (
          <View style={styles.legendRow}>
            {subjects.slice(0, 4).concat([{ name: 'Exam', isExam: true }]).map((s, idx) => {
              const colorsList = ['#6366F1', '#10B981', '#F43F5E', '#F59E0B', '#06B6D4', '#8B5CF6'];
              const color = s.isExam ? '#F43F5E' : colorsList[idx % colorsList.length];
              return (
                <View key={idx} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: color }]} />
                  <Text style={[styles.legendText, { color: colors.textLight, fontFamily: fonts.medium }]}>{s.name}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Schedule Section */}
        <View style={styles.sectionHeader}>
           <Text style={[styles.sectionTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>
             {selectedDay === now.getDate() && month === now.getMonth() ? "Today's Schedule" : "Daily Program"}
           </Text>
           <Text style={[styles.dateSub, { color: colors.textLight, fontFamily: fonts.medium }]}>
             {new Date(year, month, selectedDay).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
           </Text>
        </View>

        <View style={styles.scheduleList}>
           {currentSlots.length === 0 ? (
             <View style={styles.emptyCard}>
                <Ionicons name="calendar-outline" size={32} color="#CBD5E1" style={{ marginBottom: 12 }} />
                <Text style={[styles.emptyText, { color: colors.textLight, fontFamily: fonts.medium }]}>No program found for this day.</Text>
             </View>
           ) : (
             currentSlots.map((item, idx) => {
                const isBreak = item.activity_type === 'break';
                const subColor = isBreak ? colors.textLight : getEventColor({ subject_id: item.subject_id });
                const status = slotStatus[idx] || { status: 'pending' };
                const isLocked = idx > 0 && !(slotStatus[idx-1]?.status === 'completed' || slotStatus[idx-1]?.status === 'snoozed' || slotStatus[idx-1]?.status === 'in_progress');

                return (
                  <View key={idx} style={[styles.scheduleItem, isLocked && { opacity: 0.5 }]}>
                     <Text style={[styles.timeText, { color: colors.textLight, fontFamily: fonts.bold }]}>{item.time_slot}</Text>
                     <View style={[
                       styles.taskBlock, 
                       { 
                         backgroundColor: isBreak ? colors.cardAlt : subColor + '10',
                         borderLeftColor: subColor
                       }
                     ]}>
                        <View style={styles.taskHeader}>
                           <View style={{ flex: 1 }}>
                              <Text style={[styles.taskBlockTitle, { color: subColor, fontFamily: fonts.bold }]}>{item.subject}</Text>
                              <Text style={[styles.taskBlockSub, { color: colors.textLight, fontFamily: fonts.medium }]}>
                                {isBreak ? 'Break — Time to recharge' : `${item.adjusted_duration_minutes} min • ${item.activity_type === 'review' ? 'Revision' : 'Study'}`}
                              </Text>
                           </View>
                           {status.status === 'completed' && <Ionicons name="checkmark-circle" size={24} color="#10B981" />}
                           {status.status === 'in_progress' && <Ionicons name="play-circle" size={24} color={colors.primary} />}
                           {status.status === 'snoozed' && <Ionicons name="time" size={24} color="#F59E0B" />}
                        </View>

                        {isTrulyToday && !isBreak && status.status === 'pending' && (
                          <View style={styles.actionRow}>
                             <TouchableOpacity 
                               style={[styles.actionBtn, { backgroundColor: subColor }]} 
                               onPress={() => handleStart(idx, item)}
                             >
                               <Text style={[styles.actionBtnText, { fontFamily: fonts.bold }]}>Start</Text>
                             </TouchableOpacity>
                             <TouchableOpacity 
                               style={[styles.actionBtn, styles.snoozeBtn, { backgroundColor: colors.cardAlt, borderColor: colors.border }]} 
                               onPress={() => handleSnooze(idx, item)}
                             >
                               <Text style={[styles.actionBtnText, { color: colors.textLight, fontFamily: fonts.bold }]}>Snooze</Text>
                             </TouchableOpacity>
                          </View>
                        )}
                        {status.status === 'snoozed' && (
                          <Text style={styles.reasonText}>Skipped: {status.reason}</Text>
                        )}
                     </View>
                  </View>
                );
             })
           )}
        </View>
      </ScrollView>

      {/* Snooze Modal */}
      <Modal visible={!!snoozeTarget} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>Snooze Session</Text>
            <Text style={[styles.modalSub, { color: colors.textLight, fontFamily: fonts.medium }]}>Why are you skipping {snoozeTarget?.subject}?</Text>
            
            <View style={styles.reasonsGrid}>
              {reasons.map(r => (
                <TouchableOpacity 
                  key={r} 
                  style={[styles.reasonBtn, { borderColor: colors.border, backgroundColor: colors.cardAlt }, snoozeReason === r && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                  onPress={() => setSnoozeReason(r)}
                >
                  <Text style={[styles.reasonBtnText, { color: colors.textLight }, snoozeReason === r && { color: '#FFF' }, { fontFamily: fonts.medium }]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {snoozeReason === 'Other' && (
              <TextInput 
                style={[styles.reasonInput, { backgroundColor: colors.cardAlt, borderColor: colors.border, color: colors.textDark }]}
                placeholder="Type your reason..."
                value={customReason}
                onChangeText={setCustomReason}
                placeholderTextColor={colors.textLight}
              />
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setSnoozeTarget(null)}>
                <Text style={[styles.cancelBtnText, { color: colors.textLight, fontFamily: fonts.bold }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: colors.primary }]} onPress={confirmSnooze}>
                <Text style={[styles.confirmBtnText, { fontFamily: fonts.bold }]}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  headerTitle: { fontSize: 26 },
  navRow: { flexDirection: 'row', gap: 10 },
  navBtn: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  
  toggleRow: { flexDirection: 'row', padding: 5, borderRadius: 24, marginBottom: 35 },
  toggleBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 18 },
  toggleText: { fontSize: 14 },
  
  calendarGrid: { marginBottom: 30 },
  weekHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  weekDayText: { width: (SCREEN_WIDTH - 44) / 7, textAlign: 'center', fontSize: 13 },
  daysContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start' },
  dayCell: { width: (SCREEN_WIDTH - 44) / 7, height: 50, justifyContent: 'center', alignItems: 'center', marginBottom: 5 },
  selectedDayCell: { borderRadius: 14 },
  dayText: { fontSize: 16 },
  dayTextOff: { fontSize: 16 },
  dotsRow: { flexDirection: 'row', gap: 3, marginTop: 4, height: 4 },
  eventDot: { width: 4, height: 4, borderRadius: 2 },
  
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 15, marginBottom: 40, paddingHorizontal: 5 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12 },
  
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 25 },
  sectionTitle: { fontSize: 20 },
  dateSub: { fontSize: 13 },
  
  scheduleList: { gap: 15 },
  scheduleItem: { flexDirection: 'row', gap: 15 },
  timeText: { fontSize: 13, width: 45, marginTop: 15, textAlign: 'right' },
  taskBlock: { flex: 1, padding: 20, borderRadius: 22, borderLeftWidth: 6, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 10, elevation: 1 },
  taskBlockTitle: { fontSize: 16, marginBottom: 4 },
  taskBlockSub: { fontSize: 12 },
  taskHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 5 },
  actionBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  actionBtnText: { color: '#FFF', fontSize: 13 },
  snoozeBtn: { borderWidth: 1 },
  reasonText: { fontSize: 12, color: '#F59E0B', marginTop: 10, fontStyle: 'italic' },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 25 },
  modalContent: { borderRadius: 28, padding: 25, width: '100%', maxWidth: 400 },
  modalTitle: { fontSize: 20, marginBottom: 8 },
  modalSub: { fontSize: 14, marginBottom: 20 },
  reasonsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  reasonBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  reasonBtnText: { fontSize: 13 },
  reasonInput: { width: '100%', height: 50, borderRadius: 12, paddingHorizontal: 15, marginBottom: 20, borderWidth: 1 },
  modalActions: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, paddingVertical: 15, alignItems: 'center' },
  cancelBtnText: { fontSize: 15 },
  confirmBtn: { flex: 2, paddingVertical: 15, borderRadius: 16, alignItems: 'center' },
  confirmBtnText: { color: '#FFF', fontSize: 15 },

  emptyCard: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 14 }
});
