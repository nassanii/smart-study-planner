import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Modal, ScrollView } from 'react-native';
import { useTheme } from '../theme/theme';
import { useAI } from '../context/ai_context';
import { useAppNavigation } from '../context/navigation_context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { showAlert } from '../services/dialogs';

import { useFocus } from '../context/focus_context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const FocusScreen = () => {
  const { colors, fonts } = useTheme();
  const { navigationParams, clearParams, activeTab } = useAppNavigation();
  const { subjects, tasks, startFocusSession } = useAI();
  const {
    mode, setMode,
    timeLeft, setTimeLeft,
    initialDuration, setInitialDuration,
    isActive, setIsActive,
    activeSession, setActiveSession,
    selectedSubjectId, setSelectedSubjectId,
    selectedTaskId, setSelectedTaskId,
    plannedSubjectName, setPlannedSubjectName,
    scheduleSlots, setScheduleSlots,
    currentSlotIndex, setCurrentSlotIndex,
    startSession,
    completeSession,
    resetTimer,
    MODE_DURATIONS
  } = useFocus();

  const [showSnoozeModal, setShowSnoozeModal] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [focusRating, setFocusRating] = useState(0);

  const [showUpNextModal, setShowUpNextModal] = useState(false);
  const [nextSlotPreview, setNextSlotPreview] = useState(null);

  // Auto-pause when leaving the focus tab
  useEffect(() => {
    if (activeTab !== 'focus' && isActive) {
      setIsActive(false);
    }
  }, [activeTab, isActive, setIsActive]);

  // Handle Auto-Start from Calendar or Up Next
  useEffect(() => {
    if (navigationParams?.autoStart) {
      startSession(navigationParams);
      clearParams();
    }
  }, [navigationParams, startSession, clearParams]);

  // UI Local effect: we no longer auto-close at zero
  // instead we show an "Overtime" indicator
  const isOvertime = timeLeft < 0;

  const triggerUpNextFlow = () => {
    if (scheduleSlots && currentSlotIndex !== null && currentSlotIndex + 1 < scheduleSlots.length) {
      const nextSlot = scheduleSlots[currentSlotIndex + 1];
      setNextSlotPreview(nextSlot);
      setShowUpNextModal(true);
    } else {
      resetTimer();
    }
  };

  const toggleTimer = async () => {
    if (isActive) {
      setIsActive(false);
      return;
    }
    
    if (!activeSession) {
      // If we have a schedule, ensure we start the active slot
      if (scheduleSlots && activeSlotIndex !== null && activeSlotIndex < scheduleSlots.length) {
        const currentSlot = scheduleSlots[activeSlotIndex];
        const matchingSubject = subjects.find(s => s.name === currentSlot.subject);
        const resolvedSubjectId = currentSlot.subject_id || matchingSubject?.id;

        try {
          await startSession({
            taskId: currentSlot.task_id,
            subjectId: resolvedSubjectId,
            mode: currentSlot.activity_type === 'break' ? 'Short' : 'Focus',
            subjectName: currentSlot.subject,
            duration: currentSlot.adjusted_duration_minutes,
            index: activeSlotIndex
          });
        } catch (err) {
          showAlert('Could not start session', err.message);
        }
        return;
      }

      if (mode === 'Focus' && !selectedSubjectId) {
        showAlert('Pick a subject', 'Please complete onboarding to add subjects first.');
        return;
      }
      
      try {
        await startSession({
          taskId: selectedTaskId,
          subjectId: selectedSubjectId,
          mode: mode,
        });
      } catch (err) {
        showAlert('Could not start session', err.response?.data?.title || err.message);
      }
    } else {
      setIsActive(true);
    }
  };

  const handleFinishManual = () => {
    setIsActive(false);
    if (activeSession) {
      setShowRatingModal(true);
    } else {
      triggerUpNextFlow();
    }
  };

  const handleSnooze = () => {
    setIsActive(false);
    setShowSnoozeModal(true);
  };

  const selectSnoozeReason = async (reason) => {
    setShowSnoozeModal(false);
    try {
      await completeSession(1, reason);
      triggerUpNextFlow();
    } catch (err) {
      showAlert('Failed', err.response?.data?.title || err.message);
    }
  };

  const submitRating = async (rating) => {
    setFocusRating(rating);
    try {
      await completeSession(rating);
      setShowRatingModal(false);
      setFocusRating(0);
      triggerUpNextFlow();
    } catch (err) {
      showAlert('Failed', err.response?.data?.title || err.message);
    }
  };

  const startNextSlot = async () => {
    if (!nextSlotPreview) return;
    setShowUpNextModal(false);
    try {
      await startSession({
        taskId: nextSlotPreview.task_id,
        subjectId: nextSlotPreview.subject_id,
        duration: nextSlotPreview.adjusted_duration_minutes,
        subjectName: nextSlotPreview.subject,
        scheduleContext: {
          slots: scheduleSlots,
          startIndex: currentSlotIndex + 1
        },
        index: currentSlotIndex + 1
      });
    } catch (err) {
      showAlert('Auto-start failed', err.message);
    }
  };

  const formatTime = (seconds) => {
    const absSeconds = Math.abs(seconds);
    const mins = Math.floor(absSeconds / 60);
    const secs = absSeconds % 60;
    const timeStr = `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
    return seconds < 0 ? `+${timeStr}` : timeStr;
  };

  const upcomingTasksForSubject = tasks.filter(t => t.subject_id === selectedSubjectId && t.status !== 'done');
  const selectedSubjectName = mode === 'Break' 
    ? 'Break' 
    : (plannedSubjectName || subjects.find(s => s.id === selectedSubjectId)?.name || '—');

  const { behavioralLogs } = useAI();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ paddingTop: 12, paddingBottom: 30 }} showsVerticalScrollIndicator={false} style={{ width: '100%' }}>
        <View style={styles.header}>
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
             <Text style={[styles.headerTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>Focus</Text>
             <MaterialCommunityIcons name="clock-fast" size={28} color={colors.textDark} />
          </View>
          <View style={{flex: 1}} />
          <View style={[styles.sessionBadge, { backgroundColor: 'rgba(107, 92, 231, 0.12)' }]}>
             <Text style={[styles.sessionBadgeText, { color: colors.primary, fontFamily: fonts.bold }]}>{mode}</Text>
          </View>
        </View>

        {upcomingTasksForSubject.length > 0 && (
          <>
            <Text style={[styles.fieldLabel, { color: colors.textLight, fontFamily: fonts.semiBold }]}>TASK (OPTIONAL)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 22 }}>
              <TouchableOpacity
                onPress={() => setSelectedTaskId(null)}
                style={[styles.chip, {
                  borderColor: selectedTaskId === null ? colors.primary : colors.border,
                  backgroundColor: selectedTaskId === null ? colors.primary + '15' : 'transparent'
                }]}
              >
                <Text style={{ color: selectedTaskId === null ? colors.primary : colors.textDark, fontFamily: fonts.bold }}>None</Text>
              </TouchableOpacity>
              {upcomingTasksForSubject.map(t => (
                <TouchableOpacity
                  key={t.id}
                  onPress={() => setSelectedTaskId(t.id)}
                  style={[styles.chip, {
                    borderColor: selectedTaskId === t.id ? colors.primary : colors.border,
                    backgroundColor: selectedTaskId === t.id ? colors.primary + '15' : 'transparent'
                  }]}
                >
                  <Text style={{ color: selectedTaskId === t.id ? colors.primary : colors.textDark, fontFamily: fonts.bold }}>#{t.id} · D{t.difficulty_rating}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        <View style={[styles.modeSelector, { backgroundColor: colors.cardAlt, justifyContent: 'center' }]}>
           {Object.keys(MODE_DURATIONS).map(m => {
             const isSel = mode === m;
             if (!isSel) return null; // Only show current mode
             return (
               <View key={m} style={[styles.modeBtn, { backgroundColor: colors.surface, width: '100%' }]}>
                  <Text style={[styles.modeText, { color: colors.primary, fontFamily: fonts.bold }]}>{m === 'Focus' ? '🎯 Focus Session' : '☕ Rest Break'}</Text>
               </View>
             );
           })}
        </View>

        <View style={[styles.timerCircle, { borderColor: 'rgba(107, 92, 231, 0.08)' }]}>
          <LinearGradient colors={isActive ? ['rgba(107, 92, 231, 0.03)', 'transparent'] : ['transparent', 'transparent']} style={styles.circleInner}>
             <Text style={{ color: colors.textLight, fontFamily: fonts.semiBold, fontSize: 14, marginBottom: -10, letterSpacing: 1, textTransform: 'uppercase' }}>
               {mode === 'Focus' ? 'Studied' : 'Rested'}: {formatTime(initialDuration - timeLeft)}
             </Text>
             <Text style={[styles.timerText, { color: isOvertime ? '#F43F5E' : colors.textDark, fontFamily: fonts.bold }]}>{formatTime(timeLeft)}</Text>
             <Text style={[styles.timerSubtitle, { color: isOvertime ? '#F43F5E' : colors.textLight, fontFamily: fonts.medium, marginTop: -15 }]}>
               {isOvertime ? 'Overtime' : (mode === 'Focus' ? 'Until Break' : 'Until Study')}
             </Text>
             <Text style={[styles.timerSubtitle, { color: colors.primary, fontFamily: fonts.bold, marginTop: 10, fontSize: 16 }]}>
               {selectedSubjectName}
             </Text>
          </LinearGradient>
        </View>

        {isActive && (
          <TouchableOpacity 
            style={[styles.finishBtn, { backgroundColor: colors.surface, borderColor: isOvertime ? '#F43F5E' : colors.primary }]} 
            onPress={handleFinishManual}
          >
            <Ionicons name="stop-circle" size={20} color={isOvertime ? '#F43F5E' : colors.primary} />
            <Text style={[styles.finishBtnText, { color: isOvertime ? '#F43F5E' : colors.primary, fontFamily: fonts.bold }]}>
              Finish {mode === 'Focus' ? 'Study' : 'Break'}
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.controls}>
          <TouchableOpacity style={[styles.smallBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={resetTimer}>
            <MaterialCommunityIcons name="reload" size={24} color={colors.textDark} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.playButton} onPress={toggleTimer} activeOpacity={0.8}>
            <LinearGradient colors={[colors.primary, '#8575F3']} style={styles.playGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Ionicons name={isActive ? "pause" : "play"} size={36} color="#FFF" style={{ marginLeft: isActive ? 0 : 4 }} />
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.smallBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={handleSnooze} disabled={!activeSession}>
            <MaterialCommunityIcons name="bell-sleep-outline" size={26} color={activeSession ? colors.textDark : colors.border} />
          </TouchableOpacity>
        </View>

        <View style={[styles.statsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
           <View style={styles.statCol}>
              <Text style={[styles.statBig, { color: colors.primary, fontFamily: fonts.bold }]}>{behavioralLogs.study_hours_today.toFixed(1)}h</Text>
              <Text style={[styles.statSmall, { color: colors.textLight, fontFamily: fonts.bold }]}>Study Today</Text>
           </View>
           <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
           <View style={styles.statCol}>
              <Text style={[styles.statBig, { color: colors.accent.science || '#22C55E', fontFamily: fonts.bold }]}>{behavioralLogs.last_focus_ratings.length}</Text>
              <Text style={[styles.statSmall, { color: colors.textLight, fontFamily: fonts.bold }]}>Sessions</Text>
           </View>
           <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
           <View style={styles.statCol}>
              <View style={styles.fireRow}>
                 <Ionicons name="flame" size={18} color={colors.accent.exam} />
                 <Text style={[styles.statBig, { color: colors.accent.exam, marginLeft: 4, fontFamily: fonts.bold }]}>{behavioralLogs.snooze_count_today}</Text>
              </View>
              <Text style={[styles.statSmall, { color: colors.textLight, fontFamily: fonts.bold }]}>Snoozes</Text>
           </View>
        </View>
      </ScrollView>

      <Modal visible={showSnoozeModal} transparent animationType="fade">
         <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
               <Text style={[styles.modalTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>Why snooze? 😴</Text>
               <Text style={[styles.modalSub, { color: colors.textLight, fontFamily: fonts.medium }]}>The AI uses this to prevent your future burnout.</Text>
               {['Feeling Fatigued', 'Too Difficult', 'External Distraction', 'Emergency'].map((r) => (
                  <TouchableOpacity key={r} style={[styles.reasonBtn, { backgroundColor: colors.cardAlt }]} onPress={() => selectSnoozeReason(r)}>
                     <Text style={[styles.reasonText, { color: colors.textDark, fontFamily: fonts.semiBold }]}>{r}</Text>
                     <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
                  </TouchableOpacity>
               ))}
               <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowSnoozeModal(false); setIsActive(true); }}>
                  <Text style={[styles.cancelText, { color: colors.textLight, fontFamily: fonts.bold }]}>Continue Session</Text>
               </TouchableOpacity>
            </View>
         </View>
      </Modal>

      <Modal visible={showRatingModal} transparent animationType="slide">
         <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface, alignItems: 'center' }]}>
               <View style={styles.congratsIcon}>
                  <MaterialCommunityIcons name="party-popper" size={48} color={colors.primary} />
               </View>
               <Text style={[styles.modalTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>Great Session!</Text>
               <Text style={[styles.modalSub, { color: colors.textLight, fontFamily: fonts.medium, textAlign: 'center' }]}>How was your focus during this block?</Text>
               <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((s) => (
                     <TouchableOpacity key={s} onPress={() => setFocusRating(s)}>
                        <Ionicons name={focusRating >= s ? "star" : "star-outline"} size={40} color={focusRating >= s ? "#FFD93D" : colors.border} />
                     </TouchableOpacity>
                  ))}
               </View>
               <TouchableOpacity style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: focusRating === 0 ? 0.5 : 1 }]} disabled={focusRating === 0} onPress={() => submitRating(focusRating)}>
                  <Text style={{ color: '#FFF', fontFamily: fonts.bold }}>Submit to AI Advisor</Text>
               </TouchableOpacity>
            </View>
         </View>
      </Modal>

      <Modal visible={showUpNextModal} transparent animationType="slide">
         <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface, alignItems: 'center' }]}>
               <View style={[styles.congratsIcon, { backgroundColor: 'rgba(34, 197, 94, 0.1)' }]}>
                  <MaterialCommunityIcons name="fast-forward" size={48} color={colors.accent.science || '#22C55E'} />
               </View>
               <Text style={[styles.modalTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>Up Next</Text>
               <Text style={[styles.modalSub, { color: colors.textLight, fontFamily: fonts.medium, textAlign: 'center' }]}>
                 {nextSlotPreview?.subject === 'Break' ? "Time for a well-deserved break!" : `Get ready for ${nextSlotPreview?.subject}`}
               </Text>
               
               <View style={[styles.statsCard, { marginBottom: 30, backgroundColor: colors.cardAlt, borderWidth: 0 }]}>
                 <View style={styles.statCol}>
                   <Text style={[styles.statBig, { color: colors.textDark, fontSize: 18, fontFamily: fonts.bold }]}>{nextSlotPreview?.adjusted_duration_minutes}m</Text>
                   <Text style={[styles.statSmall, { color: colors.textLight, fontFamily: fonts.bold }]}>Duration</Text>
                 </View>
                 <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                 <View style={styles.statCol}>
                   <Text style={[styles.statBig, { color: colors.primary, fontSize: 18, fontFamily: fonts.bold }]}>{nextSlotPreview?.subject}</Text>
                   <Text style={[styles.statSmall, { color: colors.textLight, fontFamily: fonts.bold }]}>Activity</Text>
                 </View>
               </View>

               <TouchableOpacity style={[styles.submitBtn, { backgroundColor: colors.primary }]} onPress={startNextSlot}>
                  <Text style={{ color: '#FFF', fontFamily: fonts.bold }}>Start Next Block</Text>
               </TouchableOpacity>
               
               <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowUpNextModal(false); }}>
                  <Text style={[styles.cancelText, { color: colors.textLight, fontFamily: fonts.bold }]}>I'll start later</Text>
               </TouchableOpacity>
            </View>
         </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 22, alignItems: 'center' },
  header: { flexDirection: 'row', width: '100%', alignItems: 'center', marginBottom: 25 },
  headerTitle: { fontSize: 26 },
  sessionBadge: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20 },
  sessionBadgeText: { fontSize: 12 },
  fieldLabel: { fontSize: 11, letterSpacing: 1, marginBottom: 10, opacity: 0.6, alignSelf: 'flex-start' },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, borderWidth: 1.5, marginRight: 10 },
  modeSelector: { flexDirection: 'row', borderRadius: 24, padding: 5, marginBottom: 30, width: '100%' },
  modeBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 18 },
  modeText: { fontSize: 14 },
  timerCircle: { alignSelf: 'center', width: SCREEN_WIDTH * 0.7, height: SCREEN_WIDTH * 0.7, borderRadius: (SCREEN_WIDTH * 0.7) / 2, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center', marginBottom: 35 },
  circleInner: { width: '100%', height: '100%', borderRadius: (SCREEN_WIDTH * 0.7) / 2, justifyContent: 'center', alignItems: 'center' },
  timerText: { fontSize: 70, letterSpacing: -2, marginBottom: 4 },
  timerSubtitle: { fontSize: 16, opacity: 0.6 },
  controls: { flexDirection: 'row', alignSelf: 'center', alignItems: 'center', gap: 30, marginBottom: 35 },
  finishBtn: { 
    flexDirection: 'row', 
    alignSelf: 'center', 
    alignItems: 'center', 
    paddingHorizontal: 24, 
    paddingVertical: 12, 
    borderRadius: 20, 
    borderWidth: 1.5, 
    marginBottom: 20,
    gap: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5
  },
  finishBtnText: { fontSize: 14 },
  playButton: { width: 88, height: 88, borderRadius: 44, elevation: 10, shadowColor: '#6B5CE7', shadowOpacity: 0.35, shadowRadius: 15, shadowOffset: { width: 0, height: 10 } },
  playGradient: { flex: 1, borderRadius: 44, justifyContent: 'center', alignItems: 'center' },
  smallBtn: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', borderWidth: 1, elevation: 3, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10 },
  statsCard: { flexDirection: 'row', width: '100%', justifyContent: 'space-between', padding: 20, borderRadius: 24, borderWidth: 1, elevation: 4, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 12 },
  dividerLine: { width: 1, height: '60%', alignSelf: 'center' },
  statCol: { alignItems: 'center', flex: 1 },
  statBig: { fontSize: 22, marginBottom: 6 },
  statSmall: { fontSize: 12, opacity: 0.5 },
  fireRow: { flexDirection: 'row', alignItems: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 25 },
  modalContent: { padding: 30, borderRadius: 32 },
  modalTitle: { fontSize: 24, marginBottom: 10 },
  modalSub: { fontSize: 15, marginBottom: 30 },
  reasonBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderRadius: 16, marginBottom: 12 },
  reasonText: { fontSize: 16 },
  cancelBtn: { marginTop: 20, alignSelf: 'center' },
  cancelText: { fontSize: 14 },
  congratsIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(107, 92, 231, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  starsRow: { flexDirection: 'row', gap: 10, marginBottom: 40, marginTop: 20 },
  submitBtn: { height: 58, width: '100%', borderRadius: 18, justifyContent: 'center', alignItems: 'center' }
});
