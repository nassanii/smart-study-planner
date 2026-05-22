import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, ActivityIndicator } from 'react-native';
import { useTheme } from '../theme/theme';
import { useAI } from '../context/ai_context';
import { useFocus } from '../context/focus_context';
import { useAppNavigation } from '../context/navigation_context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { showAlert, showConfirm } from '../services/dialogs';
import { extractErrorMessage } from '../services/errors';
import { scheduleApi } from '../services/api';
import { DatePickerModal } from '../components/DatePickerModal';
import { DailyCheckinModal } from '../components/DailyCheckinModal';

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

export const TasksScreen = () => {
  const { colors, fonts } = useTheme();
  const { subjects, tasks, latestSchedule, addTask, updateTask, removeTask, completeTask, addSubject, reloadAll } = useAI();
  const { activeSlotIndex, slotStatuses: liveSlotStatuses, setSlotStatuses } = useFocus();
  const { navigate } = useAppNavigation();

  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showDurationPicker, setShowDurationPicker] = useState(false);
  const [showCoursePicker, setShowCoursePicker] = useState(false);
  const [showAIPlanModal, setShowAIPlanModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [busy, setBusy] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const durationScrollRef = useRef(null);

  const WHEEL_ITEM_WIDTH = 72;
  const WHEEL_VISIBLE = 5;
  const WHEEL_HEIGHT = 90;
  const WHEEL_PAD = WHEEL_ITEM_WIDTH * Math.floor(WHEEL_VISIBLE / 2);
  const DURATION_MIN = 5;
  const DURATION_MAX = 180;
  const durationOptions = useMemo(
    () => Array.from({ length: DURATION_MAX - DURATION_MIN + 1 }, (_, i) => i + DURATION_MIN),
    []
  );

  const [taskForm, setTaskForm] = useState({
    title: '',
    subjectId: null,
    estimatedMinutes: '45',
    priority: 2,
    deadline: '',
    tag: '',
  });

  useEffect(() => {
    if (!showDurationPicker) return;
    const current = Number(taskForm.estimatedMinutes) || 45;
    const idx = Math.max(0, Math.min(durationOptions.length - 1, current - DURATION_MIN));
    const timeout = setTimeout(() => {
      durationScrollRef.current?.scrollTo({ x: idx * WHEEL_ITEM_WIDTH, animated: false });
    }, 60);
    return () => clearTimeout(timeout);
  }, [showDurationPicker, durationOptions.length, taskForm.estimatedMinutes]);

  useEffect(() => {
    reloadAll().catch(() => {});
  }, [reloadAll]);

  // Find under-the-hood General Tasks subject, fall back to first subject
  const generalSubject = useMemo(() => {
    return subjects.find((s) => s.name?.trim().toLowerCase() === 'general tasks') || subjects[0] || null;
  }, [subjects]);

  const generalSubjectId = generalSubject ? generalSubject.id : null;

  const ensureGeneralSubjectId = async () => {
    if (generalSubjectId) return generalSubjectId;
    try {
      const created = await addSubject({ name: 'General Tasks', difficulty: 5, priority: 2 });
      if (created?.id) return created.id;
    } catch (_) {}
    return null;
  };

  const activeTasks = useMemo(() => {
    return tasks.filter((t) => t.status !== 'done');
  }, [tasks]);

  const doneTasks = useMemo(() => {
    return tasks.filter((t) => t.status === 'done');
  }, [tasks]);

  // Totals calculations
  const totals = useMemo(() => {
    const total = tasks.length;
    const open = activeTasks.length;
    const done = doneTasks.length;
    return { total, open, done };
  }, [tasks, activeTasks, doneTasks]);

  const openTaskModal = (task = null) => {
    setEditingTask(task);
    if (task) {
      setTaskForm({
        title: task.title || '',
        subjectId: task.subject_id || generalSubjectId,
        estimatedMinutes: String(task.estimated_minutes || 45),
        priority: task.priority || 2,
        deadline: task.deadline || '',
        tag: task.tag || '',
      });
    } else {
      setTaskForm({
        title: '',
        subjectId: generalSubjectId,
        estimatedMinutes: '45',
        priority: 2,
        deadline: '',
        tag: '',
      });
    }
    setShowTaskModal(true);
  };

  const handleSaveTask = async () => {
    if (!taskForm.title.trim()) return showAlert('Required', 'Please enter a title.');

    setBusy(true);
    try {
      let targetSubjectId = taskForm.subjectId || generalSubjectId;
      if (!targetSubjectId) targetSubjectId = await ensureGeneralSubjectId();
      if (!targetSubjectId) {
        showAlert('Add a Course First', 'Please add at least one course before creating study blocks.');
        return;
      }

      const payload = {
        subjectId: targetSubjectId,
        title: taskForm.title.trim(),
        estimatedMinutes: Number(taskForm.estimatedMinutes) || 45,
        priority: Number(taskForm.priority) || 2,
        difficultyRating: editingTask?.difficulty_rating || generalSubject?.difficulty || 5,
        deadline: taskForm.deadline || null,
        taskType: 0, // Study
        isManual: true,
        tag: taskForm.tag?.trim() || null,
      };

      if (editingTask) {
        await updateTask(editingTask.id, payload);
      } else {
        await addTask(payload);
      }
      setShowTaskModal(false);
      setEditingTask(null);
    } catch (err) {
      showAlert('Error', extractErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleCompleteTask = (task) => {
    showConfirm({
      title: 'Mark done',
      message: `Mark "${task.title}" as completed?`,
      confirmText: 'Complete',
      onConfirm: () => completeTask(task.id, task.estimated_minutes || 25).catch((err) => showAlert('Error', extractErrorMessage(err))),
    });
  };

  const handleDeleteTask = (task) => {
    showConfirm({
      title: 'Delete Study Block',
      message: `Delete "${task.title}"?`,
      confirmText: 'Delete',
      destructive: true,
      onConfirm: () => removeTask(task.id).catch((err) => showAlert('Error', extractErrorMessage(err))),
    });
  };

  const startTask = (task) => {
    const taskSubject = subjects.find((s) => s.id === task.subject_id);
    navigate('focus', {
      autoStart: true,
      taskId: task.id,
      subjectId: task.subject_id || generalSubjectId,
      subjectName: taskSubject?.name || 'General Task',
      mode: 'Focus',
      duration: Number(task.estimated_minutes) || 25,
    });
  };

  const priorityColor = (p) => Number(p) === 1 ? '#F43F5E' : Number(p) === 3 ? '#10B981' : '#F59E0B';
  
  const startOfToday = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const sortedActiveTasks = useMemo(() => {
    return [...activeTasks].sort((a, b) => {
      if ((a.priority || 2) !== (b.priority || 2)) return (a.priority || 2) - (b.priority || 2);
      if (a.deadline && b.deadline) return new Date(a.deadline) - new Date(b.deadline);
      if (a.deadline) return -1;
      if (b.deadline) return 1;
      return (b.id || 0) - (a.id || 0); // Default fallback instead of difficulty rating
    });
  }, [activeTasks]);

  const sortedDoneTasks = useMemo(() => {
    return [...doneTasks].sort((a, b) => new Date(b.completed_at || 0) - new Date(a.completed_at || 0));
  }, [doneTasks]);

  const todayKey = useMemo(() => new Date().toISOString().split('T')[0], [tasks.length]);
  const tomorrowKey = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }, []);
  const weekRange = useMemo(() => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const daysFromMonday = (dayOfWeek + 6) % 7;
    const start = new Date(now);
    start.setDate(now.getDate() - daysFromMonday);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
  }, []);

  const dateOnly = (s) => String(s || '').split('T')[0];

  const FILTERS = useMemo(() => [
    { key: 'today',     label: 'Today',           icon: 'sunny-outline',           color: '#22C55E', test: (t) => dateOnly(t.deadline) === todayKey && t.status !== 'done' },
    { key: 'overdue',   label: 'Overdue',         icon: 'alert-circle-outline',    color: '#EF4444', test: (t) => t.deadline && dateOnly(t.deadline) < todayKey && t.status !== 'done' },
    { key: 'tomorrow',  label: 'Tomorrow',        icon: 'sunny',                   color: '#F97316', test: (t) => dateOnly(t.deadline) === tomorrowKey && t.status !== 'done' },
    { key: 'thisweek',  label: 'This Week',       icon: 'calendar-outline',        color: '#A855F7', test: (t) => t.deadline && dateOnly(t.deadline) >= weekRange.start && dateOnly(t.deadline) <= weekRange.end && t.status !== 'done' },
    { key: 'high',      label: 'High Priority',   icon: 'flag',                    color: '#EF4444', test: (t) => Number(t.priority) === 1 && t.status !== 'done' },
    { key: 'medium',    label: 'Medium Priority', icon: 'flag',                    color: '#F59E0B', test: (t) => Number(t.priority) === 2 && t.status !== 'done' },
    { key: 'low',       label: 'Low Priority',    icon: 'flag',                    color: '#10B981', test: (t) => Number(t.priority) === 3 && t.status !== 'done' },
    { key: 'all',       label: 'All',             icon: 'grid-outline',            color: '#F97316', test: () => true },
    { key: 'events',    label: 'Events',          icon: 'calendar-clear-outline',  color: '#14B8A6', navigate: 'events',
      test: (t) => typeof t.tag === 'string' && t.tag.startsWith('event:') && t.status !== 'done' },
    { key: 'completed', label: 'Completed',       icon: 'checkmark-circle-outline', color: '#9CA3AF', test: (t) => t.status === 'done' },
  ], [todayKey, tomorrowKey, weekRange]);

  const filterStats = useMemo(() => {
    const result = {};
    for (const f of FILTERS) {
      const matched = tasks.filter(f.test);
      result[f.key] = {
        count: matched.length,
        minutes: matched.reduce((s, t) => s + (Number(t.estimated_minutes) || 0), 0),
      };
    }
    return result;
  }, [tasks, FILTERS]);

  const activeFilter = useMemo(
    () => FILTERS.find((f) => f.key === selectedFilter) || null,
    [FILTERS, selectedFilter]
  );

  const filteredTasks = useMemo(() => {
    if (!activeFilter) return [];
    return tasks.filter(activeFilter.test);
  }, [tasks, activeFilter]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.trim().toLowerCase();
    return tasks.filter((t) => (t.title || '').toLowerCase().includes(q));
  }, [tasks, searchQuery]);

  const isSearching = searchQuery.trim().length > 0;

  const sortTaskList = (list) => [...list].sort((a, b) => {
    if ((a.status === 'done') !== (b.status === 'done')) return a.status === 'done' ? 1 : -1;
    if ((a.priority || 2) !== (b.priority || 2)) return (a.priority || 2) - (b.priority || 2);
    if (a.deadline && b.deadline) return new Date(a.deadline) - new Date(b.deadline);
    if (a.deadline) return -1;
    if (b.deadline) return 1;
    return (b.id || 0) - (a.id || 0);
  });

  const startSlot = (idx, slot, allSlots) => {
    const matchingSubject = subjects.find((s) => s.name === slot.subject);
    const resolvedSubjectId = slot.subject_id || matchingSubject?.id;
    navigate('focus', {
      autoStart: true,
      subjectId: resolvedSubjectId,
      taskId: slot.task_id,
      subjectName: slot.subject,
      duration: slot.adjusted_duration_minutes,
      index: idx,
      scheduleContext: {
        slots: allSlots,
        startIndex: idx,
      },
    });
  };

  const snoozeSlot = (idx, slot) => {
    const newStatus = { status: 'snoozed', reason: 'manual' };
    setSlotStatuses((prev) => ({ ...prev, [idx]: newStatus }));
    if (latestSchedule?.id) {
      scheduleApi.updateSlotStatus(latestSchedule.id, idx, newStatus).catch((err) => {
        showAlert('Snooze failed', extractErrorMessage(err));
      });
    }
  };

  const finishSlot = (idx, slot) => {
    const newStatus = { status: 'completed' };
    setSlotStatuses((prev) => ({ ...prev, [idx]: newStatus }));
    if (latestSchedule?.id) {
      scheduleApi.updateSlotStatus(latestSchedule.id, idx, newStatus).catch((err) => {
        showAlert('Finish failed', extractErrorMessage(err));
      });
    }
    if (slot.task_id) {
      completeTask(slot.task_id, slot.adjusted_duration_minutes || 25).catch(() => {});
    }
  };

  const renderTodayPlan = () => {
    const slots = latestSchedule?.aiSchedule?.scheduled_slots || [];
    if (slots.length === 0) return null;
    const persistedSlotStatuses = latestSchedule?.slot_statuses || latestSchedule?.slotStatuses || {};
    const slotStatuses = { ...persistedSlotStatuses, ...(liveSlotStatuses || {}) };
    return (
      <View style={{ marginBottom: 22 }}>
        <Text style={[styles.planSectionTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>AI Generated Plan</Text>
        <View style={{ gap: 8 }}>
          {slots.map((slot, idx) => {
            const isBreak = slot.activity_type === 'break';
            const status = slotStatuses[idx] || { status: 'pending' };
            const isDone = status.status === 'completed';
            const isPending = status.status === 'pending';
            const isCurrent = idx === activeSlotIndex;
            const accent = isBreak ? colors.textLight : colors.primary;
            return (
              <View
                key={idx}
                style={[styles.planSlot, {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderLeftColor: accent,
                  opacity: isDone ? 0.55 : 1,
                }]}
              >
                <Text style={[styles.planTime, { color: colors.textLight, fontFamily: fonts.bold }]}>{slot.time_slot}</Text>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[styles.planSubject, {
                      color: isBreak ? colors.textLight : accent,
                      fontFamily: fonts.bold,
                      textDecorationLine: isDone ? 'line-through' : 'none',
                    }]}
                    numberOfLines={1}
                  >
                    {slot.subject}
                  </Text>
                  <Text style={[styles.planMeta, { color: colors.textLight, fontFamily: fonts.medium }]} numberOfLines={1}>
                    {isBreak ? 'Break — Time to recharge' : `${slot.adjusted_duration_minutes} min · ${slot.activity_type === 'review' ? 'Revision' : 'Study'}`}
                  </Text>
                </View>
                {status.status === 'completed' && <Ionicons name="checkmark-circle" size={22} color="#10B981" />}
                {status.status === 'in_progress' && <Ionicons name="play-circle" size={22} color={colors.primary} />}
                {status.status === 'snoozed' && <Ionicons name="time" size={22} color="#F59E0B" />}
                {isPending && (
                  <View style={styles.planActions}>
                    <TouchableOpacity
                      onPress={() => startSlot(idx, slot, slots)}
                      style={[styles.planActionBtn, { backgroundColor: colors.primary }]}
                    >
                      <Ionicons name="play" size={13} color="#FFF" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => finishSlot(idx, slot)}
                      style={[styles.planActionBtn, { backgroundColor: '#10B981' }]}
                    >
                      <Ionicons name={isBreak ? 'play-skip-forward' : 'checkmark'} size={isBreak ? 12 : 14} color="#FFF" />
                    </TouchableOpacity>
                    {!isBreak && (
                      <TouchableOpacity
                        onPress={() => snoozeSlot(idx, slot)}
                        style={[styles.planActionBtn, { backgroundColor: '#F59E0B' }]}
                      >
                        <Ionicons name="time-outline" size={13} color="#FFF" />
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  const renderTaskList = (list, emptyText) => {
    if (!list || list.length === 0) {
      return <EmptyBlock colors={colors} fonts={fonts} text={emptyText} />;
    }
    return (
      <View style={styles.taskList}>
        {sortTaskList(list).map((task) => {
          const overdue = task.deadline && new Date(task.deadline) < startOfToday();
          const isDone = task.status === 'done';
          return (
            <View key={task.id} style={[styles.taskRow, { backgroundColor: colors.surface, borderColor: overdue && !isDone ? '#F43F5E' : colors.border }]}>
              <View style={{ flex: 1 }}>
                <View style={styles.taskTop}>
                  <Ionicons
                    name={isDone ? 'checkmark-circle' : 'flag'}
                    size={18}
                    color={isDone ? '#10B981' : priorityColor(task.priority)}
                    style={{ marginRight: 6, marginTop: 2 }}
                  />
                  <Text
                    style={[styles.taskTitle, {
                      color: colors.textDark,
                      fontFamily: fonts.bold,
                      textDecorationLine: isDone ? 'line-through' : 'none',
                      opacity: isDone ? 0.6 : 1,
                    }]}
                    numberOfLines={2}
                  >{task.title}</Text>
                </View>
                <Text style={[styles.taskMeta, { color: colors.textLight, fontFamily: fonts.medium }]}>
                  {(() => {
                    const courseName = subjects.find((s) => s.id === task.subject_id)?.name;
                    const cleanTag = task.tag?.startsWith('event:') ? task.tag.slice('event:'.length) : task.tag;
                    const timeStr = task.start_time ? task.start_time.slice(0, 5) : null;
                    return [
                      `${task.estimated_minutes || 25} min`,
                      timeStr ? `@ ${timeStr}` : null,
                      courseName && courseName.toLowerCase() !== 'general tasks' ? courseName : null,
                      cleanTag || null,
                      task.deadline ? `due ${formatDateDisplay(task.deadline)}` : null,
                    ].filter(Boolean).join(' | ');
                  })()}
                </Text>
              </View>
              <View style={styles.taskActions}>
                {!isDone && (
                  <>
                    <TouchableOpacity style={[styles.iconAction, { backgroundColor: colors.primary }]} onPress={() => startTask(task)}>
                      <Ionicons name="play" size={16} color="#FFF" />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.iconAction, { backgroundColor: '#10B981' }]} onPress={() => handleCompleteTask(task)}>
                      <Ionicons name="checkmark" size={17} color="#FFF" />
                    </TouchableOpacity>
                  </>
                )}
                <TouchableOpacity style={[styles.iconAction, { backgroundColor: colors.cardAlt }]} onPress={() => openTaskModal(task)}>
                  <Ionicons name="pencil-outline" size={16} color={colors.textDark} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.iconAction, { backgroundColor: colors.cardAlt }]} onPress={() => handleDeleteTask(task)}>
                  <Ionicons name="trash-outline" size={16} color={colors.textLight} />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerRow}>
          {(activeFilter || isSearching) ? (
            <TouchableOpacity
              onPress={() => { setSelectedFilter(null); setSearchQuery(''); }}
              style={[styles.backIconBtn, { backgroundColor: colors.surface }]}
            >
              <Ionicons name="chevron-back" size={22} color={colors.textDark} />
            </TouchableOpacity>
          ) : null}
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: colors.textDark, fontFamily: fonts.bold }]} numberOfLines={1}>
              {isSearching ? 'Search' : activeFilter ? activeFilter.label : 'Lists'}
            </Text>
            {!activeFilter && !isSearching && (
              <Text style={[styles.headerSub, { color: colors.textLight, fontFamily: fonts.medium }]}>
                Browse your study blocks by category.
              </Text>
            )}
          </View>
        </View>

        <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="search" size={18} color={colors.textLight} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search blocks"
            placeholderTextColor={colors.textLight}
            style={[styles.searchInput, { color: colors.textDark, fontFamily: fonts.medium }]}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.textLight} />
            </TouchableOpacity>
          )}
        </View>

        {isSearching ? (
          renderTaskList(searchResults, 'No study blocks match your search.')
        ) : activeFilter ? (
          <>
            {activeFilter.key === 'today' && renderTodayPlan()}
            {renderTaskList(filteredTasks, 'No study blocks here yet.')}
          </>
        ) : (
          <View style={{ gap: 8 }}>
            {FILTERS.map((f) => {
              const stats = filterStats[f.key] || { count: 0, minutes: 0 };
              return (
                <TouchableOpacity
                  key={f.key}
                  onPress={() => f.navigate ? navigate(f.navigate) : setSelectedFilter(f.key)}
                  style={[styles.filterRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <View style={[styles.filterIcon, { backgroundColor: f.color + '22' }]}>
                    <Ionicons name={f.icon} size={20} color={f.color} />
                  </View>
                  <Text style={[styles.filterLabel, { color: colors.textDark, fontFamily: fonts.bold }]}>{f.label}</Text>
                  <Text style={[styles.filterMinutes, { color: colors.textLight, fontFamily: fonts.medium }]}>{stats.minutes}m</Text>
                  <Text style={[styles.filterCount, { color: colors.textLight, fontFamily: fonts.bold }]}>{stats.count}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      <DailyCheckinModal
        visible={showAIPlanModal}
        onClose={() => setShowAIPlanModal(false)}
      />

      <TouchableOpacity style={styles.fab} activeOpacity={0.85} onPress={() => openTaskModal()}>
        <LinearGradient colors={[colors.primary, '#9F8FFF']} style={styles.fabInner}>
          <Ionicons name="add" size={32} color="#FFF" />
        </LinearGradient>
      </TouchableOpacity>

      {/* Task Creation & Editing Modal */}
      <Modal visible={showTaskModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.modalTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>
                {editingTask ? 'Edit Study Block' : 'New Study Block'}
              </Text>

              <View style={[styles.inputGroup, { borderColor: colors.border }]}>
                <Text style={[styles.miniLabel, { color: colors.textLight, fontFamily: fonts.bold }]}>TITLE</Text>
                <TextInput
                  value={taskForm.title}
                  onChangeText={(v) => setTaskForm({ ...taskForm, title: v })}
                  placeholder="e.g. Chapter 4 exercises"
                  placeholderTextColor={colors.textLight}
                  style={[styles.input, { color: colors.textDark, fontFamily: fonts.bold }]}
                />
              </View>

              <Text style={[styles.miniLabel, { color: colors.textLight, fontFamily: fonts.bold, marginTop: 10 }]}>COURSE (OPTIONAL)</Text>
              <TouchableOpacity
                onPress={() => setShowCoursePicker(true)}
                style={[styles.dateInput, {
                  borderColor: colors.border,
                  width: '100%',
                  height: 46,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 10,
                }]}
              >
                <Text style={{
                  color: taskForm.subjectId ? colors.textDark : colors.textLight,
                  fontFamily: fonts.bold,
                  fontSize: 15,
                }}>
                  {subjects.find((s) => s.id === taskForm.subjectId)?.name || 'Pick a course'}
                </Text>
                <Ionicons name="chevron-down" size={18} color={colors.textLight} />
              </TouchableOpacity>

              <Text style={[styles.miniLabel, { color: colors.textLight, fontFamily: fonts.bold, marginTop: 10 }]}>DURATION</Text>
              <TouchableOpacity
                onPress={() => setShowDurationPicker(true)}
                style={[styles.dateInput, {
                  borderColor: colors.border,
                  width: '100%',
                  height: 46,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }]}
              >
                <Text style={{
                  color: taskForm.estimatedMinutes ? colors.textDark : colors.textLight,
                  fontFamily: fonts.bold,
                  fontSize: 15,
                }}>
                  {taskForm.estimatedMinutes ? `${taskForm.estimatedMinutes} min` : 'Set Duration'}
                </Text>
                <Ionicons name="chevron-down" size={18} color={colors.textLight} />
              </TouchableOpacity>

              <Text style={[styles.miniLabel, { color: colors.textLight, fontFamily: fonts.bold, marginTop: 18 }]}>DESCRIPTION</Text>
              <TextInput
                value={taskForm.tag}
                onChangeText={(v) => setTaskForm({ ...taskForm, tag: v })}
                placeholder="e.g. Chapter 4 exercises or revision"
                placeholderTextColor={colors.textLight}
                maxLength={60}
                style={[styles.dateInput, { borderColor: colors.border, color: colors.textDark, fontFamily: fonts.bold, width: '100%', height: 46 }]}
              />

              <View style={styles.formRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.miniLabel, { color: colors.textLight, fontFamily: fonts.bold }]}>PRIORITY</Text>
                  <View style={styles.segmentRow}>
                    {[1, 2, 3].map((p) => {
                      const flagColor = p === 1 ? '#F43F5E' : p === 2 ? '#F59E0B' : '#10B981';
                      const isSel = taskForm.priority === p;
                      return (
                        <TouchableOpacity
                          key={p}
                          style={[styles.smallSegment, { borderColor: isSel ? flagColor : colors.border, backgroundColor: isSel ? flagColor + '12' : 'transparent' }]}
                          onPress={() => setTaskForm({ ...taskForm, priority: p })}
                        >
                          <Ionicons name="flag" size={18} color={flagColor} />
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
                
                <TouchableOpacity 
                  style={{ flex: 1 }} 
                  onPress={() => setShowDatePicker(true)}
                >
                  <Text style={[styles.miniLabel, { color: colors.textLight, fontFamily: fonts.bold }]}>DUE DATE</Text>
                  <View style={[styles.dateInput, { borderColor: colors.border, justifyContent: 'center', height: 42, paddingHorizontal: 10 }]}>
                    <Text style={{ color: taskForm.deadline ? colors.textDark : colors.textLight, fontFamily: fonts.bold, fontSize: 13 }}>
                      {taskForm.deadline ? formatDateDisplay(taskForm.deadline) : 'Select Date'}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              <View style={styles.modalFooter}>
                <TouchableOpacity style={[styles.modalBtn, { borderColor: colors.border, borderWidth: 1 }]} onPress={() => setShowTaskModal(false)}>
                  <Text style={[styles.modalBtnText, { color: colors.textLight, fontFamily: fonts.bold }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.primary }]} onPress={handleSaveTask} disabled={busy}>
                  {busy ? <ActivityIndicator color="#FFF" /> : <Text style={[styles.modalBtnText, { color: '#FFF', fontFamily: fonts.bold }]}>Save</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>

          <DatePickerModal
            visible={showDatePicker}
            onClose={() => setShowDatePicker(false)}
            selectedDate={taskForm.deadline}
            onSelect={(date) => setTaskForm({ ...taskForm, deadline: date })}
          />

          <Modal
            visible={showCoursePicker}
            transparent
            animationType="slide"
            onRequestClose={() => setShowCoursePicker(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={[styles.durationModalContent, { backgroundColor: colors.surface, maxHeight: '60%' }]}>
                <View style={styles.durationHeader}>
                  <Text style={[styles.modalTitle, { color: colors.textDark, fontFamily: fonts.bold, marginBottom: 0 }]}>Pick a Course</Text>
                  <TouchableOpacity onPress={() => setShowCoursePicker(false)}>
                    <Ionicons name="close" size={26} color={colors.textDark} />
                  </TouchableOpacity>
                </View>
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 26 }}>
                  {subjects.length === 0 ? (
                    <Text style={{ textAlign: 'center', color: colors.textLight, fontFamily: fonts.medium, padding: 20 }}>
                      You don't have any courses yet. Add one from Profile → Manage Courses.
                    </Text>
                  ) : subjects.map((sub) => {
                    const isSel = taskForm.subjectId === sub.id;
                    return (
                      <TouchableOpacity
                        key={sub.id}
                        onPress={() => {
                          setTaskForm({ ...taskForm, subjectId: sub.id });
                          setShowCoursePicker(false);
                        }}
                        style={{
                          paddingHorizontal: 26,
                          paddingVertical: 16,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          backgroundColor: isSel ? colors.primary + '12' : 'transparent',
                        }}
                      >
                        <Text style={{
                          color: isSel ? colors.primary : colors.textDark,
                          fontFamily: fonts.bold,
                          fontSize: 16,
                        }}>{sub.name}</Text>
                        {isSel && <Ionicons name="checkmark" size={22} color={colors.primary} />}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </View>
          </Modal>

          <Modal
            visible={showDurationPicker}
            transparent
            animationType="slide"
            onRequestClose={() => setShowDurationPicker(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={[styles.durationModalContent, { backgroundColor: colors.surface }]}>
                <View style={styles.durationHeader}>
                  <Text style={[styles.modalTitle, { color: colors.textDark, fontFamily: fonts.bold, marginBottom: 0 }]}>Select Duration</Text>
                  <TouchableOpacity onPress={() => setShowDurationPicker(false)}>
                    <Ionicons name="close" size={26} color={colors.textDark} />
                  </TouchableOpacity>
                </View>

                <View style={{
                  width: WHEEL_VISIBLE * WHEEL_ITEM_WIDTH,
                  height: WHEEL_HEIGHT,
                  alignSelf: 'center',
                  marginVertical: 22,
                }}>
                  <View
                    pointerEvents="none"
                    style={[styles.wheelLens, {
                      left: WHEEL_PAD,
                      width: WHEEL_ITEM_WIDTH,
                      top: 0,
                      bottom: 0,
                      borderColor: colors.primary + '40',
                      backgroundColor: colors.primary + '0C',
                    }]}
                  />
                  <ScrollView
                    ref={durationScrollRef}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    snapToInterval={WHEEL_ITEM_WIDTH}
                    decelerationRate="fast"
                    contentContainerStyle={{ paddingHorizontal: WHEEL_PAD }}
                    onMomentumScrollEnd={(e) => {
                      const idx = Math.round(e.nativeEvent.contentOffset.x / WHEEL_ITEM_WIDTH);
                      const value = durationOptions[Math.max(0, Math.min(durationOptions.length - 1, idx))];
                      if (value) setTaskForm((f) => ({ ...f, estimatedMinutes: String(value) }));
                    }}
                  >
                    {durationOptions.map((m) => {
                      const isSel = Number(taskForm.estimatedMinutes) === m;
                      return (
                        <View key={m} style={{ width: WHEEL_ITEM_WIDTH, height: WHEEL_HEIGHT, justifyContent: 'center', alignItems: 'center' }}>
                          <Text style={{
                            color: isSel ? colors.primary : colors.textDark,
                            fontFamily: fonts.bold,
                            fontSize: isSel ? 28 : 19,
                            opacity: isSel ? 1 : 0.45,
                          }}>{m}</Text>
                        </View>
                      );
                    })}
                  </ScrollView>
                </View>

                <Text style={{ textAlign: 'center', color: colors.textLight, fontFamily: fonts.medium, fontSize: 12, marginBottom: 8 }}>
                  minutes
                </Text>

                <TouchableOpacity
                  onPress={() => setShowDurationPicker(false)}
                  style={[styles.modalBtn, { backgroundColor: colors.primary, marginHorizontal: 26, marginBottom: 26 }]}
                >
                  <Text style={[styles.modalBtnText, { color: '#FFF', fontFamily: fonts.bold }]}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </View>
      </Modal>
    </View>
  );
};

const EmptyBlock = ({ colors, fonts, text }) => (
  <View style={[styles.emptyBlock, { backgroundColor: colors.surface, borderColor: colors.border }]}>
    <MaterialCommunityIcons name="clipboard-text-outline" size={28} color={colors.textLight} />
    <Text style={[styles.emptyBlockText, { color: colors.textLight, fontFamily: fonts.medium }]}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 110 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  backIconBtn: { width: 40, height: 40, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 26 },
  headerSub: { fontSize: 13, marginTop: 4, maxWidth: 260 },
  headerAddBtn: { width: 42, height: 42, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 18 },
  searchInput: { flex: 1, fontSize: 15, padding: 0 },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 16, borderWidth: 1 },
  planSectionTitle: { fontSize: 18, marginBottom: 12 },
  planSlot: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, borderLeftWidth: 4 },
  planTime: { width: 50, fontSize: 12 },
  planSubject: { fontSize: 15 },
  planMeta: { fontSize: 12, marginTop: 3 },
  planActions: { flexDirection: 'row', gap: 5 },
  planActionBtn: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  filterIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  filterLabel: { flex: 1, fontSize: 16 },
  filterMinutes: { fontSize: 13, marginRight: 10 },
  filterCount: { fontSize: 14, minWidth: 20, textAlign: 'right' },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  summaryCard: { flex: 1, borderRadius: 18, paddingVertical: 16, alignItems: 'center' },
  summaryValue: { fontSize: 22 },
  summaryLabel: { fontSize: 10, marginTop: 4, letterSpacing: 0.5 },
  emptyCard: { borderWidth: 1, borderRadius: 24, padding: 28, alignItems: 'center' },
  emptyTitle: { fontSize: 20, marginTop: 14, marginBottom: 6 },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 18 },
  primaryBtn: { paddingHorizontal: 22, height: 48, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  primaryBtnText: { color: '#FFF', fontSize: 15 },
  
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 10 },
  sectionTitle: { fontSize: 18 },
  sectionAction: { fontSize: 14 },
  
  taskList: { gap: 10, marginBottom: 22 },
  taskRow: { borderWidth: 1, borderRadius: 18, padding: 14, flexDirection: 'row', gap: 12, alignItems: 'center' },
  taskTop: { flexDirection: 'row', gap: 2, alignItems: 'center', flex: 1 },
  taskTitle: { flex: 1, fontSize: 15 },
  taskMeta: { fontSize: 12, marginTop: 6 },
  taskActions: { flexDirection: 'row', gap: 6 },
  iconAction: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  doneRow: { borderWidth: 1, borderRadius: 16, padding: 13, flexDirection: 'row', gap: 8, alignItems: 'center' },
  doneTitle: { fontSize: 14, flex: 1 },
  doneMeta: { fontSize: 12, marginTop: 3 },
  emptyBlock: { borderWidth: 1, borderRadius: 18, padding: 20, alignItems: 'center', marginBottom: 20 },
  emptyBlockText: { marginTop: 8, textAlign: 'center', fontSize: 13 },
  
  fab: { position: 'absolute', bottom: 30, right: 30, width: 66, height: 66, borderRadius: 33, elevation: 10, shadowColor: '#6B5CE7', shadowOpacity: 0.4, shadowRadius: 15 },
  fabInner: { flex: 1, borderRadius: 33, justifyContent: 'center', alignItems: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: { padding: 26, borderTopLeftRadius: 32, borderTopRightRadius: 32, elevation: 20, maxHeight: '85%' },
  modalTitle: { fontSize: 24, marginBottom: 18 },
  inputGroup: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 14 },
  miniLabel: { fontSize: 10, letterSpacing: 1, marginBottom: 8, opacity: 0.75 },
  input: { fontSize: 17, paddingVertical: 4 },
  segmentRow: { flexDirection: 'row', gap: 8 },
  segmentBtn: { flex: 1, height: 40, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  durationModalContent: { borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingTop: 20 },
  durationHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 26, paddingBottom: 6 },
  wheelLens: { position: 'absolute', borderRadius: 14, borderLeftWidth: 1, borderRightWidth: 1 },
  formRow: { flexDirection: 'row', gap: 12, marginTop: 18, marginBottom: 10 },
  smallSegment: { flex: 1, height: 42, borderWidth: 1.5, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dateInput: { flex: 1, height: 42, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 10 },
  modalFooter: { flexDirection: 'row', gap: 12, paddingBottom: 12, marginTop: 8 },
  modalBtn: { flex: 1, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  modalBtnText: { fontSize: 16 },
});