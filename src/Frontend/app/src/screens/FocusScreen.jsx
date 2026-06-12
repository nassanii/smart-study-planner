import { extractErrorMessage } from '../services/errors';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Modal, ScrollView } from 'react-native';
import { useTheme } from '../theme/theme';
import { useAI } from '../context/ai_context';
import { useAppNavigation } from '../context/navigation_context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { showAlert, showConfirm } from '../services/dialogs';
import { scheduleApi } from '../services/api';

import { useFocus } from '../context/focus_context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const FocusScreen = () => {
  const { colors, fonts } = useTheme();
  const { navigationParams, clearParams, activeTab } = useAppNavigation();
  const { subjects, tasks, latestSchedule, startFocusSession } = useAI();
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
    slotStatuses, setSlotStatuses,
    activeSlotIndex,
    sessionElapsedSeconds,
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
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [showBlockPicker, setShowBlockPicker] = useState(false);

  const resolveSubjectId = (slotSubjectId, rawName) => {
    if (slotSubjectId) return slotSubjectId;
    if (!rawName) return null;
    // Strip "(Review)", "(Part 1)", "(Revision)" etc. for matching against course names
    const clean = String(rawName).replace(/\s*\(.*?\)\s*$/g, '').trim().toLowerCase();
    const exact = subjects.find((s) => (s.name || '').trim().toLowerCase() === clean);
    if (exact) return exact.id;
    // Loose contains match as last resort
    const loose = subjects.find((s) => clean.includes((s.name || '').trim().toLowerCase()));
    return loose?.id || null;
  };

  const todayBlocks = useMemo(() => {
    const blocks = [];
    const todayKey = new Date().toISOString().split('T')[0];

    const slots = latestSchedule?.aiSchedule?.scheduled_slots || [];
    const slotStatusesMap = latestSchedule?.slot_statuses || latestSchedule?.slotStatuses || {};
    slots.forEach((slot, idx) => {
      if (slot.activity_type === 'break') return;
      const status = slotStatusesMap[idx]?.status;
      if (status === 'completed') return;
      blocks.push({
        key: `ai-${idx}`,
        time: slot.time_slot,
        title: slot.subject,
        topic: slot.activity_type === 'review' ? 'Revision' : 'Study',
        duration: slot.adjusted_duration_minutes || 50,
        subjectId: resolveSubjectId(slot.subject_id, slot.subject),
        subjectName: slot.subject,
        taskId: slot.task_id,
        source: 'AI',
      });
    });

    const seenTaskIds = new Set();
    tasks.forEach((t) => {
      if (t.status === 'done') return;
      // Only truly user-added manual tasks — skip onboarding-seeded ones (is_manual=false)
      if (!t.is_manual) return;
      // Skip legacy "Initial Study Session" rows that were created with is_manual=true defaults
      if (t.title === 'Initial Study Session') return;
      const dStr = String(t.deadline || '').split('T')[0];
      // Only show tasks dated for today (no-deadline tasks are not part of today's plan)
      if (dStr !== todayKey) return;
      if (seenTaskIds.has(t.id)) return;
      seenTaskIds.add(t.id);
      const subjectName = subjects.find((s) => s.id === t.subject_id)?.name || 'Study';
      blocks.push({
        key: `task-${t.id}`,
        time: t.start_time ? String(t.start_time).slice(0, 5) : '--:--',
        title: t.title,
        topic: t.tag?.startsWith('event:') ? t.tag.slice('event:'.length) : t.tag,
        duration: t.estimated_minutes || 45,
        subjectId: t.subject_id,
        subjectName,
        taskId: t.id,
        source: 'Manual',
        hasTime: !!t.start_time,
      });
    });

    // Sort: blocks with a time first (by time), then untimed manual tasks at the end
    return blocks.sort((a, b) => {
      const aTimed = a.time !== '--:--';
      const bTimed = b.time !== '--:--';
      if (aTimed && !bTimed) return -1;
      if (!aTimed && bTimed) return 1;
      return String(a.time).localeCompare(String(b.time));
    });
  }, [latestSchedule, tasks, subjects]);

  const pickBlock = (block) => {
    // Study blocks always run in Focus mode — reset in case we were on Break
    setMode('Focus');
    setSelectedSubjectId(block.subjectId);
    setPlannedSubjectName(block.subjectName);
    setSelectedTaskId(block.taskId || null);
    setIsActive(false);
    setActiveSession(null);
    const seconds = (block.duration || 25) * 60;
    setInitialDuration(seconds);
    setTimeLeft(seconds);
    setShowBlockPicker(false);
  };

  const hasSessionInProgress = () => {
    if (activeSession) return true;
    if (isActive) return true;
    // Timer has counted down from its initial value -> session was started
    if (initialDuration > 0 && timeLeft > 0 && timeLeft < initialDuration) return true;
    // Studied seconds have accumulated
    if ((sessionElapsedSeconds || 0) > 0) return true;
    return false;
  };

  const openBlockPicker = () => {
    if (hasSessionInProgress()) {
      showConfirm({
        title: 'Session in progress',
        message: 'You have an active study session. End it first or continue with the current block?',
        confirmText: 'End Session',
        cancelText: 'Continue',
        destructive: true,
        onConfirm: () => {
          setIsActive(false);
          if (activeSession) {
            setShowRatingModal(true);
          } else {
            // No backend session - just reset locally so the picker opens with a clean slate
            resetTimer();
            setShowBlockPicker(true);
          }
        },
      });
      return;
    }
    setShowBlockPicker(true);
  };

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

    // If the timer is mid-session (counted down but not finished), just resume — don't restart.
    if (initialDuration > 0 && timeLeft > 0 && timeLeft < initialDuration) {
      setIsActive(true);
      return;
    }

    if (!activeSession) {
      const userPicked = !!plannedSubjectName && plannedSubjectName !== 'Break';
      // No block picked yet → open the picker so the user can choose one
      if (!userPicked) {
        setShowBlockPicker(true);
        return;
      }

      try {
        await startSession({
          taskId: selectedTaskId,
          subjectId: selectedSubjectId,
          subjectName: plannedSubjectName,
          duration: initialDuration > 0 ? Math.round(initialDuration / 60) : undefined,
          mode: mode,
        });
      } catch (err) {
        showAlert('Could not start session', err.response?.data?.title || err.message);
      }
    } else {
      setIsActive(true);
    }
  };

  const handleFinishManual = async () => {
    setIsActive(false);
    if (activeSession) {
      setShowRatingModal(true);
    } else {
      // It's a break session (or manual session without task)
      await completeSession();
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
      // Finish Study button completes the focus session AND marks the task done
      await completeSession(rating, null, true);
      setShowRatingModal(false);
      setFocusRating(0);
      triggerUpNextFlow();
    } catch (err) {
      showAlert('Failed', err.response?.data?.title || err.message);
    }
  };

  const [rating, setRating] = useState(3);
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [isTaskFinished, setIsTaskFinished] = useState(false);

  const handleFinish = async () => {
    try {
      await completeSession(rating, null, isTaskFinished);
      setShowFinishModal(false);
      setIsTaskFinished(false);
      setShowUpNextModal(true);
    } catch (err) {
      showAlert('Error completing session', err.message);
    }
  };

  const startNextSlot = async () => {
    if (!nextSlotPreview) return;
    setShowUpNextModal(false);
    const isBreakSlot = nextSlotPreview.activity_type === 'break' || nextSlotPreview.subject === 'Break';
    try {
      await startSession({
        taskId: nextSlotPreview.task_id,
        // For study slots, resolve subjectId so "math 2 (Review)" → math 2's id
        subjectId: isBreakSlot ? null : resolveSubjectId(nextSlotPreview.subject_id, nextSlotPreview.subject),
        duration: nextSlotPreview.adjusted_duration_minutes,
        subjectName: nextSlotPreview.subject,
        mode: isBreakSlot ? 'Break' : 'Focus',
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

  const skipNextSlot = async () => {
    const skipIdx = (currentSlotIndex ?? -1) + 1;
    setSlotStatuses((prev) => ({ ...prev, [skipIdx]: { status: 'completed', reason: 'skipped' } }));
    if (latestSchedule?.id) {
      scheduleApi.updateSlotStatus(latestSchedule.id, skipIdx, { status: 'completed', reason: 'skipped' }).catch(() => {});
    }
    setCurrentSlotIndex(skipIdx);
    // Look for the next non-completed slot to show
    const nextIdx = skipIdx + 1;
    if (scheduleSlots && nextIdx < scheduleSlots.length) {
      setNextSlotPreview(scheduleSlots[nextIdx]);
    } else {
      setShowUpNextModal(false);
      setNextSlotPreview(null);
      resetTimer();
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
  const liveStudyHoursToday = (Number(behavioralLogs.study_hours_today) || 0) + (sessionElapsedSeconds / 3600);
  const liveSessionCount = (behavioralLogs.last_focus_ratings?.length || 0) + (activeSession && mode === 'Focus' ? 1 : 0);

  const handleSwitchTarget = async (subject, task = null) => {
    setShowSwitchModal(false);
    try {
      if (activeSession) {
        await completeSession(3, null, false);
      }
      await startSession({
        taskId: task?.id,
        subjectId: subject.id,
        subjectName: subject.name,
        mode: 'Focus',
        duration: task?.estimated_minutes || 25
      });
    } catch (err) {
      showAlert('Switch failed', extractErrorMessage(err));
    }
  };

  const formatDurationLong = (totalHours) => {
    const totalSeconds = Math.round(totalHours * 3600);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

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

        {mode === 'Focus' && (
          <>
            <Text style={[styles.fieldLabel, { color: colors.textLight, fontFamily: fonts.semiBold }]}>STUDY BLOCK</Text>
            <TouchableOpacity
              onPress={openBlockPicker}
              style={[styles.blockPickerBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={styles.blockPickerTextWrap}>
                {(() => {
                  const hasBlock = plannedSubjectName && plannedSubjectName !== 'Break';
                  // Prefer the task title when a specific task is selected
                  const pickedTask = selectedTaskId ? tasks.find((t) => t.id === selectedTaskId) : null;
                  const title = pickedTask?.title || (hasBlock ? plannedSubjectName : null);
                  const subtitleParts = [];
                  if (pickedTask) {
                    const subjName = subjects.find((s) => s.id === pickedTask.subject_id)?.name;
                    if (subjName) subtitleParts.push(subjName);
                  }
                  subtitleParts.push(`${Math.round((initialDuration || 0) / 60)} min`);
                  return (
                    <>
                      <Text style={[
                        styles.blockPickerTitle,
                        {
                          color: title ? colors.textDark : colors.textLight,
                          fontFamily: fonts.bold,
                        },
                      ]} numberOfLines={2}>
                        {title || 'Pick a block to start'}
                      </Text>
                      {title && (
                        <Text
                          style={[styles.blockPickerSubtitle, { color: colors.textLight, fontFamily: fonts.medium }]}
                          numberOfLines={1}
                        >
                          {subtitleParts.join(' · ')}
                        </Text>
                      )}
                    </>
                  );
                })()}
              </View>
              <Ionicons name="chevron-down" size={20} color={colors.textLight} style={{ position: 'absolute', right: 16 }} />
            </TouchableOpacity>
          </>
        )}

        <View style={[styles.timerCircle, { borderColor: 'rgba(107, 92, 231, 0.08)' }]}>
          <LinearGradient colors={isActive ? ['rgba(107, 92, 231, 0.03)', 'transparent'] : ['transparent', 'transparent']} style={styles.circleInner}>
             <Text style={{ color: colors.textLight, fontFamily: fonts.semiBold, fontSize: 14, marginBottom: -10, letterSpacing: 1, textTransform: 'uppercase' }}>
               {mode === 'Focus' ? 'Studied' : 'Rested'}: {formatTime(initialDuration - timeLeft)}
             </Text>
             <Text style={[styles.timerText, { color: isOvertime ? '#F43F5E' : colors.textDark, fontFamily: fonts.bold }]}>{formatTime(timeLeft)}</Text>
             <Text style={[styles.timerSubtitle, { color: isOvertime ? '#F43F5E' : colors.textLight, fontFamily: fonts.medium, marginTop: -15 }]}>
               {isOvertime ? 'Overtime' : (mode === 'Focus' ? 'Until Break' : 'Until Study')}
             </Text>
             <Text
               style={[styles.timerSubject, { color: colors.primary, fontFamily: fonts.bold }]}
               numberOfLines={2}
               adjustsFontSizeToFit
               minimumFontScale={0.82}
             >
               {selectedSubjectName}
             </Text>
          </LinearGradient>
        </View>

        <View style={styles.controls}>
          <TouchableOpacity style={[styles.smallBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={resetTimer}>
            <MaterialCommunityIcons name="reload" size={24} color={colors.textDark} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.playButton} onPress={toggleTimer} activeOpacity={0.8}>
            <LinearGradient colors={[colors.primary, '#8575F3']} style={styles.playGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Ionicons name={isActive ? "pause" : "play"} size={26} color="#FFF" style={{ marginLeft: isActive ? 0 : 3 }} />
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.smallBtn, { backgroundColor: colors.surface, borderColor: isOvertime ? '#F43F5E' : '#10B981' }]}
            onPress={handleFinishManual}
          >
            <Ionicons name="stop-circle" size={26} color={isOvertime ? '#F43F5E' : '#10B981'} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.smallBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={handleSnooze} disabled={!activeSession}>
            <MaterialCommunityIcons name="bell-sleep-outline" size={26} color={activeSession ? colors.textDark : colors.border} />
          </TouchableOpacity>
        </View>

         <View style={[styles.statsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.statCol}>
               <Text style={[styles.statBig, { color: colors.primary, fontFamily: fonts.bold }]}>
                  {formatDurationLong(liveStudyHoursToday)}
               </Text>
               <Text style={[styles.statSmall, { color: colors.textLight, fontFamily: fonts.bold }]}>Study Today</Text>
            </View>
           <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
           <View style={styles.statCol}>
              <Text style={[styles.statBig, { color: colors.accent.science || '#22C55E', fontFamily: fonts.bold }]}>{liveSessionCount}</Text>
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

      <Modal visible={showBlockPicker} transparent animationType="slide" onRequestClose={() => setShowBlockPicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <Text style={[styles.modalTitle, { color: colors.textDark, fontFamily: fonts.bold, marginBottom: 0 }]}>Pick a Study Block</Text>
              <TouchableOpacity onPress={() => setShowBlockPicker(false)}>
                <Ionicons name="close" size={26} color={colors.textDark} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalSub, { color: colors.textLight, fontFamily: fonts.medium }]}>
              Today's planned blocks — AI generated and manual.
            </Text>
            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              {todayBlocks.length === 0 ? (
                <Text style={{ textAlign: 'center', color: colors.textLight, fontFamily: fonts.medium, padding: 28 }}>
                  No study blocks for today. Generate a plan or add one manually.
                </Text>
              ) : todayBlocks.map((b) => (
                <TouchableOpacity
                  key={b.key}
                  onPress={() => pickBlock(b)}
                  style={[styles.blockRow, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}
                >
                  <View style={{ width: 56 }}>
                    <Text style={{ color: colors.textLight, fontFamily: fonts.bold, fontSize: 13 }}>{b.time}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.textDark, fontFamily: fonts.bold, fontSize: 15 }} numberOfLines={1}>
                      {b.title}
                    </Text>
                    <Text style={{ color: colors.textLight, fontFamily: fonts.medium, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                      {b.duration} min{b.subjectName && b.source === 'Manual' ? ` · ${b.subjectName}` : ''}{b.topic ? ` · ${b.topic}` : (b.source === 'AI' ? ' · Study' : '')}
                    </Text>
                  </View>
                  <View style={[styles.blockSourceBadge, { backgroundColor: b.source === 'AI' ? colors.primary + '20' : '#10B98120' }]}>
                    <Text style={{ color: b.source === 'AI' ? colors.primary : '#10B981', fontFamily: fonts.bold, fontSize: 10 }}>
                      {b.source}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showSwitchModal} transparent animationType="slide" onRequestClose={() => setShowSwitchModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>Switch Course</Text>
            <Text style={[styles.modalSub, { color: colors.textLight, fontFamily: fonts.medium }]}>
              Your current time will be saved before starting the new course.
            </Text>
            <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
              {subjects.map(subject => {
                const subjectTasks = tasks.filter(t => t.subject_id === subject.id && t.status !== 'done').slice(0, 3);
                return (
                  <View key={subject.id} style={[styles.switchCourseCard, { backgroundColor: colors.cardAlt }]}>
                    <TouchableOpacity onPress={() => handleSwitchTarget(subject)} style={styles.switchCourseHeader}>
                      <Text style={[styles.switchCourseName, { color: colors.textDark, fontFamily: fonts.bold }]}>{subject.name}</Text>
                      <Ionicons name="play-circle-outline" size={22} color={colors.primary} />
                    </TouchableOpacity>
                    {subjectTasks.map(task => (
                      <TouchableOpacity key={task.id} style={styles.switchTaskRow} onPress={() => handleSwitchTarget(subject, task)}>
                        <Text style={[styles.switchTaskText, { color: colors.textLight, fontFamily: fonts.medium }]} numberOfLines={1}>
                          {task.title} · {task.estimated_minutes || 25}m
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                );
              })}
            </ScrollView>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowSwitchModal(false)}>
              <Text style={[styles.cancelText, { color: colors.textLight, fontFamily: fonts.bold }]}>Cancel</Text>
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
                   <Text
                     style={[styles.statBig, styles.upNextActivityText, { color: colors.primary, fontFamily: fonts.bold }]}
                     numberOfLines={2}
                     adjustsFontSizeToFit
                     minimumFontScale={0.78}
                   >
                     {nextSlotPreview?.subject}
                   </Text>
                   <Text style={[styles.statSmall, { color: colors.textLight, fontFamily: fonts.bold }]}>Activity</Text>
                 </View>
               </View>

               <TouchableOpacity style={[styles.submitBtn, { backgroundColor: colors.primary }]} onPress={startNextSlot}>
                  <Text style={{ color: '#FFF', fontFamily: fonts.bold }}>
                    {nextSlotPreview?.subject === 'Break' ? 'Start Break' : 'Start Session'}
                  </Text>
               </TouchableOpacity>

               {nextSlotPreview?.subject === 'Break' ? (
                  <TouchableOpacity style={styles.cancelBtn} onPress={skipNextSlot}>
                     <Text style={[styles.cancelText, { color: colors.textLight, fontFamily: fonts.bold }]}>Skip Break</Text>
                  </TouchableOpacity>
               ) : (
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowUpNextModal(false); }}>
                     <Text style={[styles.cancelText, { color: colors.textLight, fontFamily: fonts.bold }]}>I'll start later</Text>
                  </TouchableOpacity>
               )}
            </View>
         </View>
      </Modal>

      <Modal visible={showFinishModal} transparent animationType="slide">
         <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>Finish Session</Text>
            <Text style={[styles.modalSub, { color: colors.textLight, fontFamily: fonts.medium }]}>How was your focus during this block?</Text>

            <View style={styles.ratingContainer}>
              {[1, 2, 3, 4, 5].map((num) => (
                <TouchableOpacity
                  key={num}
                  style={[styles.ratingBtn, rating === num && { backgroundColor: colors.primary }]}
                  onPress={() => setRating(num)}
                >
                  <Text style={[styles.ratingText, { color: rating === num ? '#FFF' : colors.textLight }]}>{num}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.checkboxContainer, { marginTop: 20 }]}
              onPress={() => setIsTaskFinished(!isTaskFinished)}
            >
              <View style={[styles.checkbox, isTaskFinished && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                {isTaskFinished && <Ionicons name="checkmark" size={16} color="#FFF" />}
              </View>
              <Text style={[styles.checkboxLabel, { color: colors.textDark, fontFamily: fonts.medium }]}>Mark entire task as completed</Text>
            </TouchableOpacity>

            <View style={styles.modalActions}>
               <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: colors.primary }]} onPress={handleFinish}>
                  <Text style={{ color: '#FFF', fontFamily: fonts.bold }}>Complete Session</Text>
               </TouchableOpacity>
               <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowFinishModal(false)}>
                  <Text style={[styles.cancelText, { color: colors.textLight, fontFamily: fonts.bold }]}>Cancel</Text>
               </TouchableOpacity>
            </View>
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
  blockPickerBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 68, paddingHorizontal: 46, paddingVertical: 12, borderRadius: 16, borderWidth: 1.5, marginBottom: 18 },
  blockPickerTextWrap: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center' },
  blockPickerTitle: { width: '100%', fontSize: 15, lineHeight: 19, textAlign: 'center' },
  blockPickerSubtitle: { width: '100%', fontSize: 12, lineHeight: 16, marginTop: 3, textAlign: 'center' },
  blockRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 8 },
  blockSourceBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  modeSelector: { flexDirection: 'row', borderRadius: 24, padding: 5, marginBottom: 30, width: '100%' },
  modeBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 18 },
  modeText: { fontSize: 14 },
  timerCircle: { alignSelf: 'center', width: SCREEN_WIDTH * 0.7, height: SCREEN_WIDTH * 0.7, borderRadius: (SCREEN_WIDTH * 0.7) / 2, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center', marginBottom: 35 },
  circleInner: { width: '100%', height: '100%', borderRadius: (SCREEN_WIDTH * 0.7) / 2, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 26 },
  timerText: { fontSize: 70, letterSpacing: -2, marginBottom: 4 },
  timerSubtitle: { fontSize: 16, opacity: 0.6 },
  timerSubject: { width: '100%', marginTop: 10, fontSize: 16, lineHeight: 20, textAlign: 'center' },
  ratingBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  ratingText: {
    fontSize: 18,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxLabel: {
    fontSize: 16,
  },
  modalActions: {
    flexDirection: 'row',
    marginTop: 24,
  },
  controls: { flexDirection: 'row', alignSelf: 'center', alignItems: 'center', gap: 18, marginBottom: 35 },
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
  switchBtn: {
    flexDirection: 'row',
    alignSelf: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
  },
  switchBtnText: { fontSize: 13 },
  playButton: { width: 60, height: 60, borderRadius: 30, elevation: 6, shadowColor: '#6B5CE7', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  playGradient: { flex: 1, borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
  smallBtn: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', borderWidth: 1, elevation: 3, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10 },
  statsCard: { flexDirection: 'row', width: '100%', justifyContent: 'space-between', padding: 20, borderRadius: 24, borderWidth: 1, elevation: 4, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 12 },
  dividerLine: { width: 1, height: '60%', alignSelf: 'center' },
  statCol: { alignItems: 'center', flex: 1 },
  statBig: { fontSize: 22, marginBottom: 6 },
  upNextActivityText: { width: '100%', fontSize: 16, lineHeight: 20, textAlign: 'center' },
  statSmall: { fontSize: 12, opacity: 0.5 },
  fireRow: { flexDirection: 'row', alignItems: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 25 },
  modalContent: { padding: 30, borderRadius: 32 },
  modalTitle: { fontSize: 24, marginBottom: 10 },
  modalSub: { fontSize: 15, marginBottom: 30 },
  reasonBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderRadius: 16, marginBottom: 12 },
  reasonText: { fontSize: 16 },
  switchCourseCard: { borderRadius: 18, padding: 14, marginBottom: 10 },
  switchCourseHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchCourseName: { fontSize: 16 },
  switchTaskRow: { paddingTop: 10, marginTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)' },
  switchTaskText: { fontSize: 13 },
  cancelBtn: { marginTop: 20, alignSelf: 'center' },
  cancelText: { fontSize: 14 },
  congratsIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(107, 92, 231, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  starsRow: { flexDirection: 'row', gap: 10, marginBottom: 40, marginTop: 20 },
  submitBtn: { height: 58, width: '100%', borderRadius: 18, justifyContent: 'center', alignItems: 'center' }
});
