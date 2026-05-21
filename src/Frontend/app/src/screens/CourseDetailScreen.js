import { extractErrorMessage } from '../services/errors';
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, ActivityIndicator } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/theme';
import { useAI } from '../context/ai_context';
import { useAppNavigation } from '../context/navigation_context';
import { showAlert, showConfirm } from '../services/dialogs';

const DURATION_OPTIONS = [25, 45, 60, 90];
const TASK_TYPES = ['homework', 'review', 'reading', 'exam prep'];

export const CourseDetailScreen = () => {
  const { colors, fonts } = useTheme();
  const { subjects, tasks, addTask, completeTask, removeTask } = useAI();
  const { navigationParams, navigate } = useAppNavigation();
  const course = subjects.find((s) => s.id === navigationParams?.courseId) || subjects[0];

  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskForm, setTaskForm] = useState({
    title: '',
    estimatedMinutes: 45,
    priority: 2,
    difficultyRating: 5,
    deadline: '',
    tag: 'homework',
  });
  const [busy, setBusy] = useState(false);

  const courseTasks = useMemo(() => {
    if (!course) return [];
    return tasks.filter((t) => t.subject_id === course.id);
  }, [course, tasks]);

  const activeTasks = courseTasks.filter((t) => t.status !== 'done');
  const doneTasks = courseTasks.filter((t) => t.status === 'done');
  const overdueTasks = activeTasks.filter((t) => t.deadline && new Date(t.deadline) < startOfToday());
  const studiedMinutes = courseTasks.reduce((sum, t) => sum + Number(t.actual_minutes || 0), 0);
  const estimatedMinutes = courseTasks.reduce((sum, t) => sum + Number(t.estimated_minutes || 0), 0);
  const progress = courseTasks.length === 0 ? 0 : Math.round((doneTasks.length / courseTasks.length) * 100);
  const nextTask = [...activeTasks].sort(sortTasks)[0];
  const lastDone = [...doneTasks].sort((a, b) => new Date(b.completed_at || 0) - new Date(a.completed_at || 0))[0];
  const insights = buildInsights({ course, activeTasks, doneTasks, overdueTasks, studiedMinutes, estimatedMinutes, lastDone });

  if (!course) {
    return (
      <View style={[styles.emptyPage, { backgroundColor: colors.background }]}>
        <Ionicons name="library-outline" size={42} color={colors.textLight} />
        <Text style={[styles.emptyTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>No courses yet</Text>
        <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.primary }]} onPress={() => navigate('subjects')}>
          <Text style={[styles.primaryBtnText, { fontFamily: fonts.bold }]}>Add Course</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const openTaskModal = () => {
    setTaskForm({
      title: '',
      estimatedMinutes: 45,
      priority: course.priority || 2,
      difficultyRating: course.difficulty || 5,
      deadline: course.examDate || '',
      tag: 'homework',
    });
    setShowTaskModal(true);
  };

  const handleSaveTask = async () => {
    if (!taskForm.title.trim()) return showAlert('Required', 'Please enter a task title.');
    setBusy(true);
    try {
      await addTask({
        subjectId: course.id,
        title: taskForm.title.trim(),
        estimatedMinutes: Number(taskForm.estimatedMinutes) || 45,
        priority: Number(taskForm.priority) || 2,
        difficultyRating: Number(taskForm.difficultyRating) || course.difficulty || 5,
        deadline: taskForm.deadline || null,
        tag: taskForm.tag,
      });
      setShowTaskModal(false);
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
      title: 'Delete Task',
      message: `Delete "${task.title}"?`,
      confirmText: 'Delete',
      destructive: true,
      onConfirm: () => removeTask(task.id).catch((err) => showAlert('Error', extractErrorMessage(err))),
    });
  };

  const startTask = (task = nextTask) => {
    if (!task) return;
    navigate('focus', {
      autoStart: true,
      taskId: task.id,
      subjectId: course.id,
      subjectName: course.name,
      mode: 'Focus',
      duration: task.estimated_minutes || 25,
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <TouchableOpacity style={[styles.backBtn, { backgroundColor: colors.surface }]} onPress={() => navigate('subjects')}>
            <Ionicons name="chevron-back" size={22} color={colors.textDark} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[styles.courseTitle, { color: colors.textDark, fontFamily: fonts.bold }]} numberOfLines={1}>{course.name}</Text>
            <Text style={[styles.courseSub, { color: colors.textLight, fontFamily: fonts.medium }]}>
              {course.examDate ? `Exam ${new Date(course.examDate).toLocaleDateString()}` : 'No exam date'} | Difficulty {course.difficulty}/10
            </Text>
          </View>
        </View>

        <LinearGradient colors={[colors.primary, '#8B5CF6']} style={styles.heroCard}>
          <View style={styles.heroTop}>
            <Text style={[styles.heroLabel, { fontFamily: fonts.bold }]}>COURSE PROGRESS</Text>
            <Text style={[styles.heroPct, { fontFamily: fonts.bold }]}>{progress}%</Text>
          </View>
          <View style={styles.heroProgressBg}>
            <View style={[styles.heroProgressFill, { width: `${progress}%` }]} />
          </View>
          <Text style={[styles.heroText, { fontFamily: fonts.medium }]}>
            {doneTasks.length} finished | {activeTasks.length} open | {formatHours(studiedMinutes)} logged
          </Text>
        </LinearGradient>

        <View style={styles.statsGrid}>
          <StatCard colors={colors} fonts={fonts} label="OPEN" value={activeTasks.length} icon="list-outline" />
          <StatCard colors={colors} fonts={fonts} label="DONE" value={doneTasks.length} icon="checkmark-circle-outline" />
          <StatCard colors={colors} fonts={fonts} label="OVERDUE" value={overdueTasks.length} icon="alert-circle-outline" />
        </View>

        <View style={[styles.nextCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sectionEyebrow, { color: colors.primary, fontFamily: fonts.bold }]}>NEXT UP</Text>
            <Text style={[styles.nextTitle, { color: colors.textDark, fontFamily: fonts.bold }]} numberOfLines={2}>
              {nextTask ? nextTask.title : 'No open tasks'}
            </Text>
            <Text style={[styles.nextMeta, { color: colors.textLight, fontFamily: fonts.medium }]}>
              {nextTask ? `${nextTask.estimated_minutes || 25} min | ${priorityLabel(nextTask.priority)} | ${nextTask.tag || 'study'}` : 'Add a task to start tracking this course.'}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.nextBtn, { backgroundColor: nextTask ? colors.primary : colors.cardAlt }]}
            onPress={() => nextTask ? startTask(nextTask) : openTaskModal()}
          >
            <Ionicons name={nextTask ? 'play' : 'add'} size={22} color={nextTask ? '#FFF' : colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>Details to notice</Text>
        </View>
        <View style={styles.insightsList}>
          {insights.map((item, idx) => (
            <View key={idx} style={[styles.insightCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name={item.icon} size={18} color={item.color || colors.primary} />
              <Text style={[styles.insightCopy, { color: colors.textDark, fontFamily: fonts.medium }]}>{item.text}</Text>
            </View>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>Open tasks</Text>
          <TouchableOpacity onPress={openTaskModal}>
            <Text style={[styles.sectionAction, { color: colors.primary, fontFamily: fonts.bold }]}>Add</Text>
          </TouchableOpacity>
        </View>
        {activeTasks.length === 0 ? (
          <EmptyBlock colors={colors} fonts={fonts} text="No open tasks. Add homework, review, reading, or exam prep." />
        ) : (
          <View style={styles.taskList}>
            {[...activeTasks].sort(sortTasks).map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                colors={colors}
                fonts={fonts}
                onStart={() => startTask(task)}
                onComplete={() => handleCompleteTask(task)}
                onDelete={() => handleDeleteTask(task)}
              />
            ))}
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>Finished</Text>
        </View>
        {doneTasks.length === 0 ? (
          <EmptyBlock colors={colors} fonts={fonts} text="Completed tasks will show here with actual study time." />
        ) : (
          <View style={styles.taskList}>
            {[...doneTasks].sort((a, b) => new Date(b.completed_at || 0) - new Date(a.completed_at || 0)).slice(0, 8).map((task) => (
              <View key={task.id} style={[styles.doneRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.doneTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>{task.title}</Text>
                  <Text style={[styles.doneMeta, { color: colors.textLight, fontFamily: fonts.medium }]}>
                    {task.actual_minutes || task.estimated_minutes || 0} min | {task.completed_at ? new Date(task.completed_at).toLocaleDateString() : 'completed'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal visible={showTaskModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>New Task</Text>

            <View style={[styles.inputGroup, { borderColor: colors.border }]}>
              <Text style={[styles.miniLabel, { color: colors.textLight, fontFamily: fonts.bold }]}>TASK</Text>
              <TextInput
                value={taskForm.title}
                onChangeText={(v) => setTaskForm({ ...taskForm, title: v })}
                placeholder="e.g. Chapter 4 exercises"
                placeholderTextColor={colors.textLight}
                style={[styles.input, { color: colors.textDark, fontFamily: fonts.bold }]}
              />
            </View>

            <Text style={[styles.miniLabel, { color: colors.textLight, fontFamily: fonts.bold }]}>DURATION</Text>
            <View style={styles.segmentRow}>
              {DURATION_OPTIONS.map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.segmentBtn, { borderColor: taskForm.estimatedMinutes === m ? colors.primary : colors.border, backgroundColor: taskForm.estimatedMinutes === m ? colors.primary + '12' : 'transparent' }]}
                  onPress={() => setTaskForm({ ...taskForm, estimatedMinutes: m })}
                >
                  <Text style={{ color: taskForm.estimatedMinutes === m ? colors.primary : colors.textLight, fontFamily: fonts.bold }}>{m}m</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.miniLabel, { color: colors.textLight, fontFamily: fonts.bold, marginTop: 18 }]}>TYPE</Text>
            <View style={styles.wrapRow}>
              {TASK_TYPES.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.typeChip, { borderColor: taskForm.tag === type ? colors.primary : colors.border, backgroundColor: taskForm.tag === type ? colors.primary + '12' : 'transparent' }]}
                  onPress={() => setTaskForm({ ...taskForm, tag: type })}
                >
                  <Text style={{ color: taskForm.tag === type ? colors.primary : colors.textDark, fontFamily: fonts.medium }}>{type}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.formRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.miniLabel, { color: colors.textLight, fontFamily: fonts.bold }]}>PRIORITY</Text>
                <View style={styles.segmentRow}>
                  {[1, 2, 3].map((p) => (
                    <TouchableOpacity
                      key={p}
                      style={[styles.smallSegment, { borderColor: taskForm.priority === p ? colors.primary : colors.border }]}
                      onPress={() => setTaskForm({ ...taskForm, priority: p })}
                    >
                      <Text style={{ color: taskForm.priority === p ? colors.primary : colors.textLight, fontFamily: fonts.bold }}>{priorityLabel(p)[0]}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.miniLabel, { color: colors.textLight, fontFamily: fonts.bold }]}>DUE</Text>
                <TextInput
                  value={taskForm.deadline}
                  onChangeText={(v) => setTaskForm({ ...taskForm, deadline: v })}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textLight}
                  style={[styles.dateInput, { borderColor: colors.border, color: colors.textDark, fontFamily: fonts.bold }]}
                />
              </View>
            </View>

            <Text style={[styles.miniLabel, { color: colors.textLight, fontFamily: fonts.bold, marginTop: 18 }]}>
              DIFFICULTY: {taskForm.difficultyRating}/10
            </Text>
            <View style={styles.diffBarRow}>
              {[...Array(10)].map((_, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.diffBit, { backgroundColor: taskForm.difficultyRating > i ? colors.primary : colors.cardAlt }]}
                  onPress={() => setTaskForm({ ...taskForm, difficultyRating: i + 1 })}
                />
              ))}
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={[styles.modalBtn, { borderColor: colors.border, borderWidth: 1 }]} onPress={() => setShowTaskModal(false)}>
                <Text style={[styles.modalBtnText, { color: colors.textLight, fontFamily: fonts.bold }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.primary }]} onPress={handleSaveTask} disabled={busy}>
                {busy ? <ActivityIndicator color="#FFF" /> : <Text style={[styles.modalBtnText, { color: '#FFF', fontFamily: fonts.bold }]}>Save Task</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const TaskRow = ({ task, colors, fonts, onStart, onComplete, onDelete }) => {
  const overdue = task.deadline && new Date(task.deadline) < startOfToday();
  return (
    <View style={[styles.taskRow, { backgroundColor: colors.surface, borderColor: overdue ? '#F43F5E' : colors.border }]}>
      <View style={{ flex: 1 }}>
        <View style={styles.taskTop}>
          <Text style={[styles.taskTitle, { color: colors.textDark, fontFamily: fonts.bold }]} numberOfLines={2}>{task.title}</Text>
          <View style={[styles.priorityPill, { backgroundColor: priorityColor(task.priority) + '15' }]}>
            <Text style={[styles.priorityText, { color: priorityColor(task.priority), fontFamily: fonts.bold }]}>{priorityLabel(task.priority)}</Text>
          </View>
        </View>
        <Text style={[styles.taskMeta, { color: colors.textLight, fontFamily: fonts.medium }]}>
          {task.estimated_minutes || 25} min | D{task.difficulty_rating || 5} | {task.tag || 'study'}
          {task.deadline ? ` | due ${new Date(task.deadline).toLocaleDateString()}` : ''}
        </Text>
      </View>
      <View style={styles.taskActions}>
        <TouchableOpacity style={[styles.iconAction, { backgroundColor: colors.primary }]} onPress={onStart}>
          <Ionicons name="play" size={16} color="#FFF" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.iconAction, { backgroundColor: '#10B981' }]} onPress={onComplete}>
          <Ionicons name="checkmark" size={17} color="#FFF" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.iconAction, { backgroundColor: colors.cardAlt }]} onPress={onDelete}>
          <Ionicons name="trash-outline" size={16} color={colors.textLight} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const StatCard = ({ colors, fonts, label, value, icon }) => (
  <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
    <Ionicons name={icon} size={20} color={colors.primary} />
    <Text style={[styles.statValue, { color: colors.textDark, fontFamily: fonts.bold }]}>{value}</Text>
    <Text style={[styles.statLabel, { color: colors.textLight, fontFamily: fonts.bold }]}>{label}</Text>
  </View>
);

const EmptyBlock = ({ colors, fonts, text }) => (
  <View style={[styles.emptyBlock, { backgroundColor: colors.surface, borderColor: colors.border }]}>
    <MaterialCommunityIcons name="clipboard-text-outline" size={28} color={colors.textLight} />
    <Text style={[styles.emptyBlockText, { color: colors.textLight, fontFamily: fonts.medium }]}>{text}</Text>
  </View>
);

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const sortTasks = (a, b) => {
  if ((a.priority || 2) !== (b.priority || 2)) return (a.priority || 2) - (b.priority || 2);
  if (a.deadline && b.deadline) return new Date(a.deadline) - new Date(b.deadline);
  if (a.deadline) return -1;
  if (b.deadline) return 1;
  return (b.difficulty_rating || 0) - (a.difficulty_rating || 0);
};

const priorityLabel = (p) => Number(p) === 1 ? 'High' : Number(p) === 3 ? 'Low' : 'Medium';
const priorityColor = (p) => Number(p) === 1 ? '#F43F5E' : Number(p) === 3 ? '#10B981' : '#F59E0B';
const formatHours = (minutes) => minutes < 60 ? `${minutes}m` : `${Math.round(minutes / 60)}h`;

const buildInsights = ({ course, activeTasks, doneTasks, overdueTasks, studiedMinutes, estimatedMinutes, lastDone }) => {
  const insights = [];
  if (overdueTasks.length > 0) {
    insights.push({ icon: 'alert-circle-outline', color: '#F43F5E', text: `${overdueTasks.length} task${overdueTasks.length > 1 ? 's are' : ' is'} overdue in ${course.name}.` });
  }
  if (activeTasks.length >= 4) {
    insights.push({ icon: 'layers-outline', text: `${course.name} has ${activeTasks.length} open tasks. Start with the highest priority one.` });
  }
  if (!lastDone) {
    insights.push({ icon: 'time-outline', text: `No completed study task logged for ${course.name} yet.` });
  } else {
    const days = Math.floor((Date.now() - new Date(lastDone.completed_at).getTime()) / 86400000);
    if (days >= 3) insights.push({ icon: 'calendar-outline', text: `You have not finished a ${course.name} task in ${days} days.` });
  }
  const hardTasks = activeTasks.filter((t) => Number(t.difficulty_rating || 0) >= 8);
  if (hardTasks.length > 0) {
    insights.push({ icon: 'barbell-outline', text: `${hardTasks.length} hard task${hardTasks.length > 1 ? 's need' : ' needs'} shorter focused sessions.` });
  }
  if (studiedMinutes > estimatedMinutes && estimatedMinutes > 0) {
    insights.push({ icon: 'speedometer-outline', text: `${course.name} is taking more time than estimated. Consider lowering session size.` });
  }
  if (insights.length === 0) {
    insights.push({ icon: 'checkmark-circle-outline', text: `${course.name} looks clean. Add tasks to get deeper tracking.` });
  }
  return insights.slice(0, 4);
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 110 },
  emptyPage: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTitle: { fontSize: 20, marginTop: 12, marginBottom: 18 },
  primaryBtn: { height: 48, paddingHorizontal: 22, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { color: '#FFF', fontSize: 15 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 },
  backBtn: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  courseTitle: { fontSize: 28 },
  courseSub: { fontSize: 13, marginTop: 4 },
  heroCard: { borderRadius: 26, padding: 22, marginBottom: 14 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroLabel: { color: 'rgba(255,255,255,0.72)', fontSize: 11, letterSpacing: 1 },
  heroPct: { color: '#FFF', fontSize: 30 },
  heroProgressBg: { height: 9, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden', marginTop: 18 },
  heroProgressFill: { height: '100%', backgroundColor: '#FFF', borderRadius: 9 },
  heroText: { color: '#FFF', marginTop: 14, fontSize: 14 },
  statsGrid: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  statCard: { flex: 1, borderRadius: 18, paddingVertical: 15, alignItems: 'center' },
  statValue: { fontSize: 20, marginTop: 6 },
  statLabel: { fontSize: 10, marginTop: 3, letterSpacing: 0.5 },
  nextCard: { borderWidth: 1, borderRadius: 22, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 },
  sectionEyebrow: { fontSize: 10, letterSpacing: 1, marginBottom: 5 },
  nextTitle: { fontSize: 18 },
  nextMeta: { fontSize: 12, marginTop: 5 },
  nextBtn: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, marginTop: 4 },
  sectionTitle: { fontSize: 18 },
  sectionAction: { fontSize: 14 },
  insightsList: { gap: 9, marginBottom: 20 },
  insightCard: { borderWidth: 1, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  insightCopy: { flex: 1, fontSize: 13, lineHeight: 18 },
  taskList: { gap: 10, marginBottom: 20 },
  taskRow: { borderWidth: 1, borderRadius: 18, padding: 14, flexDirection: 'row', gap: 12, alignItems: 'center' },
  taskTop: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  taskTitle: { flex: 1, fontSize: 15 },
  priorityPill: { paddingHorizontal: 7, paddingVertical: 4, borderRadius: 8 },
  priorityText: { fontSize: 9, letterSpacing: 0.4 },
  taskMeta: { fontSize: 12, marginTop: 6 },
  taskActions: { flexDirection: 'row', gap: 6 },
  iconAction: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  doneRow: { borderWidth: 1, borderRadius: 16, padding: 13, flexDirection: 'row', gap: 10, alignItems: 'center' },
  doneTitle: { fontSize: 14 },
  doneMeta: { fontSize: 12, marginTop: 3 },
  emptyBlock: { borderWidth: 1, borderRadius: 18, padding: 20, alignItems: 'center', marginBottom: 20 },
  emptyBlockText: { marginTop: 8, textAlign: 'center', fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: { padding: 26, borderTopLeftRadius: 32, borderTopRightRadius: 32, elevation: 20 },
  modalTitle: { fontSize: 24, marginBottom: 18 },
  inputGroup: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 14 },
  miniLabel: { fontSize: 10, letterSpacing: 1, marginBottom: 8, opacity: 0.75 },
  input: { fontSize: 17, paddingVertical: 4 },
  segmentRow: { flexDirection: 'row', gap: 8 },
  segmentBtn: { flex: 1, height: 40, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: { borderWidth: 1.5, borderRadius: 13, paddingHorizontal: 12, paddingVertical: 9 },
  formRow: { flexDirection: 'row', gap: 12, marginTop: 18 },
  smallSegment: { flex: 1, height: 42, borderWidth: 1.5, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dateInput: { height: 42, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 10 },
  diffBarRow: { flexDirection: 'row', gap: 5, marginBottom: 22 },
  diffBit: { flex: 1, height: 9, borderRadius: 6 },
  modalFooter: { flexDirection: 'row', gap: 12, paddingBottom: 8 },
  modalBtn: { flex: 1, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  modalBtnText: { fontSize: 16 },
});
