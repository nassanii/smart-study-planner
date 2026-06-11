import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Modal, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useTheme } from '../theme/theme';
import { useAI } from '../context/ai_context';
import { useAppNavigation } from '../context/navigation_context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { focusApi, scheduleApi } from '../services/api';
import { DailyCheckinModal } from '../components/DailyCheckinModal';
import { DatePickerModal } from '../components/DatePickerModal';

import { useFocus } from '../context/focus_context';

const formatDateDisplay = (dateStr) => {
  if (!dateStr) return '';
  const dateOnly = String(dateStr).split('T')[0];
  const parts = dateOnly.split('-');
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthName = months[parseInt(m, 10) - 1] || m;
  return `${monthName} ${parseInt(d, 10)}, ${y}`;
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DURATION_OPTIONS = [25, 45, 60, 90];
const TASK_TYPES = ['homework', 'review', 'reading', 'exam prep'];

export const CalendarScreen = () => {
  const { colors, fonts } = useTheme();
  const [viewMode, setViewMode] = useState('Month');
  const now = new Date();
  const [selectedDay, setSelectedDay] = useState(now.getDate());
  const [currentDate, setCurrentDate] = useState(now);
  const [selectedDaySchedule, setSelectedDaySchedule] = useState(null);
  const [completedSessions, setCompletedSessions] = useState([]);

  // New state for slot interactions
  const [snoozeTarget, setSnoozeTarget] = useState(null);
  const [snoozeReason, setSnoozeReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [showPlanWizard, setShowPlanWizard] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [taskBusy, setTaskBusy] = useState(false);
  const [taskForm, setTaskForm] = useState({
    title: '',
    subjectId: null,
    estimatedMinutes: '45',
    priority: 2,
    difficultyRating: 5,
    tag: '',
    deadline: '',
  });

  const { latestSchedule, tasks, subjects, addTask, completeTask, snoozeTask, reloadBehavioral, reloadAll, generateSchedule } = useAI();
  const { slotStatuses: slotStatus, setSlotStatuses: setSlotStatus, activeSlotIndex } = useFocus();

  // Find under-the-hood General Tasks subject
  const generalSubject = React.useMemo(() => {
    return subjects.find(s => s.name?.trim().toLowerCase() === 'general tasks');
  }, [subjects]);

  const generalSubjectId = generalSubject ? generalSubject.id : null;
  
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const isTrulyToday = selectedDay === now.getDate() && month === now.getMonth() && year === now.getFullYear();
  const rawSlots = selectedDaySchedule?.aiSchedule?.scheduled_slots || (isTrulyToday ? (latestSchedule?.aiSchedule?.scheduled_slots || []) : []);
  
  // The AI payload returns task_id. We need to map this to subject_id for coloring and filtering.
  const mappedSlots = rawSlots.map(s => {
    if (s.activity_type === 'break') return s;
    const task = tasks.find(t => t.id === s.task_id);
    
    // Fuzzy matching fallback in case AI omits task_id but appends '(Part 1)' to subject name
    let fallbackSubjectId = null;
    if (!task) {
      const fuzzySub = subjects.find(sub => s.subject?.toLowerCase().includes(sub.name.toLowerCase()));
      if (fuzzySub) fallbackSubjectId = fuzzySub.id;
    }
    
    return { ...s, subject_id: task?.subject_id || fallbackSubjectId };
  });

  // Date key for current selection
  const selectedDateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
  const tasksForSelectedDay = tasks
    .filter((t) => t.deadline === selectedDateKey)
    .sort(sortCalendarTasks);
  const openTasksForSelectedDay = tasksForSelectedDay.filter((t) => t.status !== 'done');
  const doneTasksForSelectedDay = tasksForSelectedDay.filter((t) => t.status === 'done');
  const currentSlots = [...mappedSlots].sort((a, b) => {
    const startA = (a.time_slot || '').split('-')[0].trim();
    const startB = (b.time_slot || '').split('-')[0].trim();
    return startA.localeCompare(startB);
  });

  // Fetch month's completed sessions for dots
  useEffect(() => {
    const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(new Date(year, month + 1, 0).getDate()).padStart(2, '0')}`;
    focusApi.list({ from, to }).then(setCompletedSessions).catch(() => {});
  }, [year, month]);

  // Fetch schedule for selected day
  useEffect(() => {
    const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
    scheduleApi.byDate(dStr)
      .then(res => {
        // Map snake_case to camelCase for consistency with AIContext state
        setSelectedDaySchedule({
          ...res,
          generatedAt: res.generated_at,
          analysisResults: res.analysis_results,
          aiSchedule: res.ai_schedule,
          hasError: res.has_error,
          slotStatuses: res.slot_statuses,
        });
      })
      .catch(() => setSelectedDaySchedule(null));
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
    ...subjects.flatMap(s => {
      const events = [];
      if (s.midtermDate) events.push({ ...s, subject_id: s.id, name: `${s.name} midterm`, deadline: s.midtermDate, isExam: true, examType: 'Midterm' });
      if (s.finalDate) events.push({ ...s, subject_id: s.id, name: `${s.name} final`, deadline: s.finalDate, isExam: true, examType: 'Final' });
      if (!s.midtermDate && !s.finalDate && s.examDate) events.push({ ...s, subject_id: s.id, name: `${s.name} exam`, deadline: s.examDate, isExam: true, examType: 'Exam' });
      return events;
    }),
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
    if (item.status === 'done') return '#10B981';
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

  const { navigate } = useAppNavigation();

  const handleStart = (idx, item) => {
    if (idx !== activeSlotIndex) {
      Alert.alert("Sequence Required", "Please complete your current task first!");
      return;
    }
    
    // Resolve subjectId because AI schedule only provides the subject name
    const matchingSubject = subjects.find(s => s.name === item.subject);
    const resolvedSubjectId = item.subject_id || matchingSubject?.id;

    // Navigate to Focus with params
    navigate('focus', { 
      autoStart: true, 
      subjectId: resolvedSubjectId, 
      taskId: item.task_id,
      subjectName: item.subject,
      duration: item.adjusted_duration_minutes,
      index: idx,
      scheduleContext: {
        slots: currentSlots,
        startIndex: idx
      }
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
    
    // Update local selectedDaySchedule if it's today for immediate feedback
    if (isTrulyToday) {
      setSelectedDaySchedule(prev => {
        if (!prev) return prev;
        const newStatuses = { ...(prev.slotStatuses || prev.slot_statuses || {}), [snoozeTarget.idx]: { status: 'snoozed', reason } };
        return { ...prev, slotStatuses: newStatuses };
      });
    }

    const slots = currentSlots;
    const slot = slots?.[snoozeTarget.idx];
    
    // Persist to backend
    if (latestSchedule?.id && isTrulyToday) {
      scheduleApi.updateSlotStatus(latestSchedule.id, snoozeTarget.idx, { status: 'snoozed', reason })
        .catch(err => console.error("Failed to persist slot snooze:", err));
    }

    if (slot?.task_id) {
      snoozeTask(slot.task_id, reason).catch(() => {});
    }
    reloadAll().catch(() => {});
    reloadBehavioral().catch(() => {});
    setSnoozeTarget(null);
  };


  const reasons = ['Tired', 'Hungry', 'Emergency', 'Need prep', 'Other'];

  const openTaskModal = (dateKey = selectedDateKey) => {
    setTaskForm({
      title: '',
      subjectId: generalSubjectId,
      estimatedMinutes: '45',
      priority: 2,
      difficultyRating: 5,
      tag: '',
      deadline: dateKey || selectedDateKey,
    });
    setShowTaskModal(true);
  };

  const moveSelectionToDate = (dateKey) => {
    const next = parseDateKey(dateKey);
    setCurrentDate(next);
    setSelectedDay(next.getDate());
  };

  const handleCreateTask = async ({ keepAdding = false, advanceDay = false } = {}) => {
    if (!taskForm.title.trim()) {
      Alert.alert('Task needed', 'Write a short task title first.');
      return;
    }
    const targetSubjectId = taskForm.subjectId || generalSubjectId;
    if (!targetSubjectId) {
      Alert.alert('System Busy', 'Initializing workspace, please try again in a moment.');
      return;
    }
    setTaskBusy(true);
    try {
      await addTask({
        subjectId: targetSubjectId,
        title: taskForm.title.trim(),
        estimatedMinutes: Number(taskForm.estimatedMinutes) || 45,
        priority: Number(taskForm.priority) || 2,
        difficultyRating: Number(taskForm.difficultyRating) || 5,
        deadline: taskForm.deadline || selectedDateKey,
        tag: taskForm.tag?.trim() || null,
      });

      if (keepAdding) {
        const nextDate = advanceDay ? shiftDateKey(taskForm.deadline || selectedDateKey, 1) : (taskForm.deadline || selectedDateKey);
        if (advanceDay) moveSelectionToDate(nextDate);
        setTaskForm((prev) => ({
          ...prev,
          title: '',
          deadline: nextDate,
          subjectId: generalSubjectId,
          estimatedMinutes: '45',
          priority: 2,
          difficultyRating: 5,
          tag: '',
        }));
      } else {
        setShowTaskModal(false);
      }
    } catch (err) {
      Alert.alert('Could not save task', err.response?.data?.title || err.message || 'Please try again.');
    } finally {
      setTaskBusy(false);
    }
  };

  const handleCompleteCalendarTask = async (task) => {
    try {
      await completeTask(task.id, task.estimated_minutes || 25);
      const remaining = Math.max(0, openTasksForSelectedDay.length - 1);
      Alert.alert(
        'Ahsant!',
        remaining === 0
          ? 'That day is clean. Nothing left on the calendar.'
          : `${remaining} task${remaining === 1 ? '' : 's'} left for this day.`
      );
    } catch (err) {
      Alert.alert('Could not complete task', err.response?.data?.title || err.message || 'Please try again.');
    }
  };

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
                    <Text style={[styles.dayTextOff, { color: colors.border, fontFamily: fonts.medium }]}></Text>
                  </View>
                ))}
                
                {days.map(d => {
                  const isSel = selectedDay === d && month === currentDate.getMonth() && year === currentDate.getFullYear();
                  const events = dayEvents[d] || [];
                  const dateOfD = new Date(year, month, d);
                  const isCurrentWeek = viewMode === 'Week' && Math.abs(dateOfD - now) / (1000 * 60 * 60 * 24) < 7;

                  if (viewMode === 'Week' && !isCurrentWeek) return null;

                  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                  const isPast = dateOfD < todayStart;

                  return (
                      <TouchableOpacity 
                        key={d} 
                        style={[styles.dayCell, isSel && [styles.selectedDayCell, { backgroundColor: colors.primary }]]}
                        onPress={() => setSelectedDay(d)}
                      >
                        <Text style={[styles.dayText, { color: isSel ? '#FFF' : (isPast ? '#CBD5E1' : colors.textDark), fontFamily: fonts.bold }]}>{d}</Text>
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
                      <Text style={[styles.dayTextOff, { color: colors.border, fontFamily: fonts.medium }]}></Text>
                   </View>
                ))}
            </View>
          </View>
        )}

        {/* Legend */}
        {viewMode === 'Month' && (
          <View style={styles.legendRow}>
            {subjects
              .filter(s => s.name?.trim().toLowerCase() !== 'general tasks')
              .slice(0, 4)
              .concat([{ name: 'Exam', isExam: true }])
              .map((s, idx) => {
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

        {/* Tasks Section */}
        <View style={styles.taskSectionHeader}>
          <View>
            <Text style={[styles.sectionTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>Tasks on this date</Text>
            <Text style={[styles.dateSub, { color: colors.textLight, fontFamily: fonts.medium }]}>
              {doneTasksForSelectedDay.length} done · {openTasksForSelectedDay.length} remaining
            </Text>
          </View>
        </View>

        <View style={[styles.dayTasksCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {tasksForSelectedDay.length === 0 ? (
            <View style={styles.dayTasksEmpty}>
              <Ionicons name="calendar-clear-outline" size={28} color="#CBD5E1" />
              <Text style={[styles.dayTasksEmptyTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>No tasks here yet</Text>
              <Text style={[styles.dayTasksEmptyText, { color: colors.textLight, fontFamily: fonts.medium }]}>
                Pick this date for homework, review, reading, or exam prep.
              </Text>
            </View>
          ) : (
            tasksForSelectedDay.map((task) => {
              const done = task.status === 'done';
              const priorityColor = (p) => Number(p) === 1 ? '#F43F5E' : Number(p) === 3 ? '#10B981' : '#F59E0B';
              return (
                <View key={task.id} style={[styles.dayTaskRow, { borderBottomColor: colors.border }]}>
                  <View
                    style={[styles.taskCheck, { backgroundColor: done ? '#10B981' : colors.cardAlt }]}
                  >
                    <Ionicons name={done ? 'checkmark' : 'ellipse-outline'} size={16} color={done ? '#FFF' : colors.textLight} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="flag" size={16} color={priorityColor(task.priority)} />
                      <Text
                        style={[
                          styles.dayTaskTitle,
                          { color: done ? colors.textLight : colors.textDark, fontFamily: fonts.bold, flex: 1 },
                          done && styles.dayTaskDoneTitle
                        ]}
                        numberOfLines={2}
                      >
                        {task.title}
                      </Text>
                    </View>
                    <Text style={[styles.dayTaskMeta, { color: colors.textLight, fontFamily: fonts.medium, marginTop: 4 }]} numberOfLines={1}>
                      {task.estimated_minutes || 25} min{task.tag ? ` · ${task.tag}` : ''}
                    </Text>
                  </View>
                  <View style={[styles.taskStatePill, { backgroundColor: done ? '#10B98115' : colors.cardAlt }]}>
                    <Text style={[styles.taskStateText, { color: done ? '#10B981' : colors.textLight, fontFamily: fonts.bold }]}>
                      {done ? 'Done' : 'Open'}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
          {doneTasksForSelectedDay.length > 0 && (
            <View style={[styles.praiseStrip, { backgroundColor: '#10B98112' }]}>
              <Ionicons name="sparkles-outline" size={16} color="#10B981" />
              <Text style={[styles.praiseText, { color: '#047857', fontFamily: fonts.bold }]}>
                Nice work. {openTasksForSelectedDay.length === 0 ? 'This day is clear.' : `${openTasksForSelectedDay.length} left for this day.`}
              </Text>
            </View>
          )}
        </View>

        {/* Schedule Section */}
        <View style={styles.sectionHeader}>
           <Text style={[styles.sectionTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>
             {selectedDay === now.getDate() && month === now.getMonth() ? "Today's Schedule" : "Daily Program"}
           </Text>
           <Text style={[styles.dateSub, { color: colors.textLight, fontFamily: fonts.medium }]}>
             {new Date(year, month, selectedDay).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
           </Text>
        </View>

        {isTrulyToday && currentSlots.length > 0 && (
          <View style={[styles.progressCard, { backgroundColor: colors.primary + '08', borderColor: colors.primary + '20' }]}>
            <View style={styles.progressInfo}>
               <Text style={[styles.progressTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>Daily Progress</Text>
               <Text style={[styles.progressSub, { color: colors.textLight, fontFamily: fonts.medium }]}>
                 {Object.keys(selectedDaySchedule?.slot_statuses || selectedDaySchedule?.slotStatuses || slotStatus).filter(idx => {
                   const s = (selectedDaySchedule?.slot_statuses || selectedDaySchedule?.slotStatuses || slotStatus)[idx];
                   const item = currentSlots[idx];
                   return s.status === 'completed' && item?.activity_type !== 'break';
                 }).length} / {currentSlots.filter(s => s.activity_type !== 'break').length} tasks finished
               </Text>
            </View>
            <View style={[styles.progressBadge, { backgroundColor: colors.primary }]}>
               <Text style={[styles.progressBadgeText, { fontFamily: fonts.bold }]}>
                 {((Object.keys(selectedDaySchedule?.slot_statuses || selectedDaySchedule?.slotStatuses || slotStatus).filter(idx => {
                   const s = (selectedDaySchedule?.slot_statuses || selectedDaySchedule?.slotStatuses || slotStatus)[idx];
                   const item = currentSlots[idx];
                   return s.status === 'completed' && item?.activity_type !== 'break';
                 }).length / (currentSlots.filter(s => s.activity_type !== 'break').length || 1)) * 100).toFixed(0)}%
               </Text>
            </View>
          </View>
        )}

        <View style={styles.scheduleList}>
           {subjects.length === 0 ? (
             <View style={styles.emptyCard}>
                <Ionicons name="book-outline" size={32} color="#CBD5E1" style={{ marginBottom: 12 }} />
                <Text style={[styles.emptyText, { color: colors.textLight, fontFamily: fonts.medium }]}>No courses added yet. Add courses to create your plan.</Text>
             </View>
           ) : currentSlots.length === 0 ? (
             <View style={styles.emptyCard}>
                <Ionicons name="calendar-outline" size={32} color="#CBD5E1" style={{ marginBottom: 12 }} />
                <Text style={[styles.emptyText, { color: colors.textLight, fontFamily: fonts.medium, marginBottom: 20 }]}>No program found for this day.</Text>
                {isTrulyToday && (
                  <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
                    <TouchableOpacity
                       style={{ flex: 1, height: 56, borderRadius: 16, overflow: 'hidden', elevation: 6, shadowColor: colors.primary, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }}
                       onPress={() => setShowPlanWizard(true)}
                    >
                       <LinearGradient
                         colors={['#6366F1', '#8B5CF6']}
                         style={{ flex: 1, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 8 }}
                         start={{ x: 0, y: 0 }}
                         end={{ x: 1, y: 0 }}
                       >
                         <MaterialCommunityIcons name="brain" size={22} color="#FFF" />
                         <Text style={{ color: '#FFF', fontFamily: fonts.bold, fontSize: 14, letterSpacing: 0.5 }}>Create Plan</Text>
                       </LinearGradient>
                    </TouchableOpacity>
                  </View>
                )}
             </View>
           ) : (
             currentSlots.map((item, idx) => {
                const isBreak = item.activity_type === 'break';
                const subColor = isBreak ? colors.textLight : getEventColor({ subject_id: item.subject_id });
                const dayStatuses = selectedDaySchedule?.slot_statuses || selectedDaySchedule?.slotStatuses || (isTrulyToday ? slotStatus : {});
                const status = dayStatuses[idx] || { status: 'pending' };
                
                const isLocked = idx > activeSlotIndex && isTrulyToday;
                const isActiveTask = idx === activeSlotIndex && isTrulyToday;

                return (
                  <View key={idx} style={[
                    styles.scheduleItem, 
                    isLocked && { opacity: 0.5 },
                    isActiveTask && { transform: [{ scale: 1.02 }] }
                  ]}>
                     <Text style={[styles.timeText, { color: colors.textLight, fontFamily: fonts.bold }]}>{item.time_slot}</Text>
                     <View style={[
                       styles.taskBlock, 
                       { 
                         backgroundColor: isBreak ? colors.cardAlt : subColor + '10',
                         borderLeftColor: subColor,
                         borderWidth: isActiveTask ? 2 : 0,
                         borderColor: subColor + '40'
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

                        {isTrulyToday && status.status === 'pending' && !isLocked && (
                          <View style={styles.actionRow}>
                             <TouchableOpacity 
                               style={[styles.actionBtn, { backgroundColor: subColor }]} 
                               onPress={() => handleStart(idx, item)}
                             >
                               <Text style={[styles.actionBtnText, { fontFamily: fonts.bold }]}>Start {isBreak ? 'Break' : 'Session'}</Text>
                             </TouchableOpacity>
                             {!isBreak && (
                               <TouchableOpacity 
                                 style={[styles.actionBtn, styles.snoozeBtn, { backgroundColor: colors.cardAlt, borderColor: colors.border }]} 
                                 onPress={() => handleSnooze(idx, item)}
                               >
                                 <Text style={[styles.actionBtnText, { color: colors.textLight, fontFamily: fonts.bold }]}>Snooze</Text>
                               </TouchableOpacity>
                             )}
                          </View>
                        )}
                        {status.status === 'snoozed' && (
                          <Text style={styles.reasonText}>Moved: {status.reason}</Text>
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
            <Text style={[styles.modalSub, { color: colors.textLight, fontFamily: fonts.medium }]}>Why are you moving {snoozeTarget?.subject}?</Text>
            
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

      <Modal visible={showTaskModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.taskModalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.taskModalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>Add Calendar Task</Text>
                <Text style={[styles.modalSub, { color: colors.textLight, fontFamily: fonts.medium }]}>{taskForm.deadline || selectedDateKey}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowTaskModal(false)} style={[styles.closeTaskBtn, { backgroundColor: colors.cardAlt }]}>
                <Ionicons name="close" size={18} color={colors.textDark} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={[styles.taskInputGroup, { borderColor: colors.border }]}>
                <Text style={[styles.miniLabel, { color: colors.textLight, fontFamily: fonts.bold }]}>TASK</Text>
                <TextInput
                  value={taskForm.title}
                  onChangeText={(v) => setTaskForm({ ...taskForm, title: v })}
                  placeholder="e.g. Solve limits worksheet"
                  placeholderTextColor={colors.textLight}
                  style={[styles.taskTextInput, { color: colors.textDark, fontFamily: fonts.bold }]}
                  autoComplete="off"
                  autoCorrect={false}
                />
              </View>

              <Text style={[styles.miniLabel, { color: colors.textLight, fontFamily: fonts.bold, marginTop: 10 }]}>DURATION (MINUTES)</Text>
              <TextInput
                keyboardType="numeric"
                value={String(taskForm.estimatedMinutes)}
                onChangeText={(v) => setTaskForm({ ...taskForm, estimatedMinutes: v.replace(/[^0-9]/g, '') })}
                placeholder="e.g. 45"
                placeholderTextColor={colors.textLight}
                style={[styles.fullDateInput, { backgroundColor: colors.cardAlt, color: colors.textDark, fontFamily: fonts.bold, marginBottom: 10 }]}
              />
              <View style={styles.quickRow}>
                {DURATION_OPTIONS.map((minutes) => (
                  <TouchableOpacity
                    key={minutes}
                    style={[
                      styles.quickBtn,
                      { borderColor: Number(taskForm.estimatedMinutes) === minutes ? colors.primary : colors.border, backgroundColor: Number(taskForm.estimatedMinutes) === minutes ? colors.primary + '12' : 'transparent' }
                    ]}
                    onPress={() => setTaskForm({ ...taskForm, estimatedMinutes: String(minutes) })}
                  >
                    <Text style={{ color: Number(taskForm.estimatedMinutes) === minutes ? colors.primary : colors.textLight, fontFamily: fonts.bold }}>{minutes}m</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.miniLabel, { color: colors.textLight, fontFamily: fonts.bold, marginTop: 16 }]}>DESCRIPTION</Text>
              <TextInput
                value={taskForm.tag}
                onChangeText={(v) => setTaskForm({ ...taskForm, tag: v })}
                placeholder="e.g. Chapter 4 exercises or revision"
                placeholderTextColor={colors.textLight}
                maxLength={60}
                style={[styles.fullDateInput, { backgroundColor: colors.cardAlt, color: colors.textDark, fontFamily: fonts.bold }]}
              />

              <View style={styles.quickRowWithTop}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.miniLabel, { color: colors.textLight, fontFamily: fonts.bold }]}>PRIORITY</Text>
                  <View style={styles.quickRow}>
                    {[1, 2, 3].map((p) => {
                      const flagColor = p === 1 ? '#F43F5E' : p === 2 ? '#F59E0B' : '#10B981';
                      const isSel = taskForm.priority === p;
                      return (
                        <TouchableOpacity
                          key={p}
                          style={[styles.quickBtn, { borderColor: isSel ? flagColor : colors.border, backgroundColor: isSel ? flagColor + '12' : 'transparent' }]}
                          onPress={() => setTaskForm({ ...taskForm, priority: p })}
                        >
                          <Ionicons name="flag" size={18} color={flagColor} />
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
                
                <View style={{ flex: 1 }}>
                  <Text style={[styles.miniLabel, { color: colors.textLight, fontFamily: fonts.bold }]}>DIFFICULTY</Text>
                  <View style={styles.quickRow}>
                    {[3, 5, 8].map((d) => (
                      <TouchableOpacity
                        key={d}
                        style={[styles.quickBtn, { borderColor: taskForm.difficultyRating === d ? colors.primary : colors.border }]}
                        onPress={() => setTaskForm({ ...taskForm, difficultyRating: d })}
                      >
                        <Text style={{ color: taskForm.difficultyRating === d ? colors.primary : colors.textLight, fontFamily: fonts.bold }}>D{d}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              <Text style={[styles.miniLabel, { color: colors.textLight, fontFamily: fonts.bold, marginTop: 4 }]}>DATE</Text>
              <TouchableOpacity 
                onPress={() => setShowDatePicker(true)}
                style={[styles.fullDateInput, { backgroundColor: colors.cardAlt, justifyContent: 'center' }]}
              >
                <Text style={{ color: taskForm.deadline ? colors.textDark : colors.textLight, fontFamily: fonts.bold }}>
                  {taskForm.deadline ? formatDateDisplay(taskForm.deadline) : 'Select Date'}
                </Text>
              </TouchableOpacity>
            </ScrollView>

            <View style={styles.taskModalActions}>
              <TouchableOpacity style={[styles.taskSecondaryBtn, { borderColor: colors.border }]} onPress={() => handleCreateTask({ keepAdding: true, advanceDay: true })} disabled={taskBusy}>
                <Text style={[styles.taskSecondaryText, { color: colors.primary, fontFamily: fonts.bold }]}>Save + next day</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.taskPrimaryBtn, { backgroundColor: colors.primary }]} onPress={() => handleCreateTask()} disabled={taskBusy}>
                {taskBusy ? <ActivityIndicator color="#FFF" /> : <Text style={[styles.taskPrimaryText, { fontFamily: fonts.bold }]}>Save Task</Text>}
              </TouchableOpacity>
            </View>
          </View>

          <DatePickerModal
            visible={showDatePicker}
            onClose={() => setShowDatePicker(false)}
            selectedDate={taskForm.deadline}
            onSelect={(date) => setTaskForm({ ...taskForm, deadline: date })}
          />
        </View>
      </Modal>

      <DailyCheckinModal
        visible={showPlanWizard}
        onClose={() => setShowPlanWizard(false)}
        selectedDate={selectedDateKey}
      />

      {/* Floating Action Button for Plan Generation */}
      {isTrulyToday && (
        <TouchableOpacity
          style={styles.magicFab}
          activeOpacity={0.85}
          onPress={() => setShowPlanWizard(true)}
        >
          <LinearGradient colors={['#6366F1', '#8B5CF6']} style={styles.magicFabInner}>
            <MaterialCommunityIcons name="brain" size={36} color="#FFF" />
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );
};

const parseDateKey = (dateKey) => {
  const [y, m, d] = String(dateKey).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

const formatDateKey = (date) => (
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
);

const shiftDateKey = (dateKey, days) => {
  const date = parseDateKey(dateKey);
  date.setDate(date.getDate() + days);
  return formatDateKey(date);
};

const sortCalendarTasks = (a, b) => {
  if ((a.status === 'done') !== (b.status === 'done')) return a.status === 'done' ? 1 : -1;
  if ((a.priority || 2) !== (b.priority || 2)) return (a.priority || 2) - (b.priority || 2);
  return (b.difficulty_rating || 0) - (a.difficulty_rating || 0);
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
  weekDayText: { width: '14.28%', textAlign: 'center', fontSize: 13 },
  daysContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start' },
  dayCell: { width: '14.28%', height: 50, justifyContent: 'center', alignItems: 'center', marginBottom: 5 },
  selectedDayCell: { borderRadius: 14 },
  dayText: { fontSize: 16 },
  dayTextOff: { fontSize: 16 },
  dotsRow: { flexDirection: 'row', gap: 3, marginTop: 4, height: 4 },
  eventDot: { width: 4, height: 4, borderRadius: 2 },
  
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 15, marginBottom: 40, paddingHorizontal: 5 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12 },
  taskSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingHorizontal: 4 },
  addTaskBtn: { height: 42, paddingHorizontal: 14, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 6 },
  addTaskText: { color: '#FFF', fontSize: 13 },
  dayTasksCard: { borderWidth: 1, borderRadius: 22, padding: 14, marginBottom: 26 },
  dayTasksEmpty: { alignItems: 'center', paddingVertical: 20, paddingHorizontal: 12 },
  dayTasksEmptyTitle: { fontSize: 16, marginTop: 10 },
  dayTasksEmptyText: { textAlign: 'center', fontSize: 13, lineHeight: 18, marginTop: 5 },
  dayTaskRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 12, borderBottomWidth: 1 },
  taskCheck: { width: 34, height: 34, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  dayTaskTitle: { fontSize: 14 },
  dayTaskDoneTitle: { textDecorationLine: 'line-through' },
  dayTaskMeta: { fontSize: 12, marginTop: 4 },
  taskStatePill: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 10 },
  taskStateText: { fontSize: 10 },
  praiseStrip: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, marginTop: 10 },
  praiseText: { fontSize: 12, flex: 1 },
  
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20, paddingHorizontal: 4 },
  sectionTitle: { fontSize: 20 },
  dateSub: { fontSize: 13, opacity: 0.7 },
  progressCard: { flexDirection: 'row', alignItems: 'center', padding: 20, borderRadius: 24, borderWidth: 1, marginBottom: 25, marginHorizontal: 2 },
  progressInfo: { flex: 1 },
  progressTitle: { fontSize: 17, marginBottom: 4 },
  progressSub: { fontSize: 13, opacity: 0.7 },
  progressBadge: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8 },
  progressBadgeText: { color: '#FFF', fontSize: 16 },
  
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
  taskModalContent: { maxHeight: '88%' },
  taskModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 },
  closeTaskBtn: { width: 34, height: 34, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  modalTitle: { fontSize: 20, marginBottom: 8 },
  modalSub: { fontSize: 14, marginBottom: 20 },
  miniLabel: { fontSize: 10, letterSpacing: 1, marginBottom: 8, opacity: 0.75 },
  taskInputGroup: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 14 },
  taskTextInput: { fontSize: 17, paddingVertical: 4 },
  coursePicker: { marginBottom: 2 },
  courseChip: { borderWidth: 1.5, borderRadius: 13, paddingHorizontal: 12, paddingVertical: 9, marginRight: 8 },
  fullDateInput: { height: 48, borderRadius: 14, paddingHorizontal: 14, marginBottom: 16, fontSize: 14 },
  quickRow: { flexDirection: 'row', gap: 8 },
  quickRowWithTop: { flexDirection: 'row', gap: 12, marginTop: 18, marginBottom: 18 },
  quickBtn: { flex: 1, height: 40, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  typeWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: { borderWidth: 1.5, borderRadius: 13, paddingHorizontal: 12, paddingVertical: 9 },
  taskModalActions: { flexDirection: 'row', gap: 10, paddingTop: 12 },
  taskSecondaryBtn: { flex: 1, height: 50, borderRadius: 15, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  taskSecondaryText: { fontSize: 13 },
  taskPrimaryBtn: { flex: 1, height: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  taskPrimaryText: { color: '#FFF', fontSize: 14 },
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
  emptyText: { fontSize: 14 },
  magicFab: {
    position: 'absolute',
    bottom: 30,
    right: 24,
    width: 76,
    height: 76,
    borderRadius: 38,
    elevation: 12,
    shadowColor: '#6366F1',
    shadowOpacity: 0.5,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
  },
  magicFabInner: {
    flex: 1,
    borderRadius: 38,
    justifyContent: 'center',
    alignItems: 'center',
  }
});
