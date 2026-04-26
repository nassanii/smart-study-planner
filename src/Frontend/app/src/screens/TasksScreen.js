import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, ActivityIndicator } from 'react-native';
import { useTheme } from '../theme/theme';
import { useAI } from '../context/ai_context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { showAlert, showConfirm } from '../services/dialogs';

const FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'High', value: 'high' },
  { label: 'Today', value: 'today' },
  { label: 'Done', value: 'done' },
];

export const TasksScreen = () => {
  const { colors, fonts } = useTheme();
  const { tasks, subjects, latestSchedule, addTask, updateTaskDifficulty, completeTask, snoozeTask, removeTask, reloadTasks } = useAI();
  const [filter, setFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTask, setNewTask] = useState({ subjectId: null, difficulty_rating: 5, priority: 2, estimatedMinutes: 60 });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    reloadTasks(filter).catch(() => {});
  }, [filter, reloadTasks]);

  useEffect(() => {
    if (subjects.length && newTask.subjectId === null) {
      setNewTask(t => ({ ...t, subjectId: subjects[0].id }));
    }
  }, [subjects, newTask.subjectId]);

  const handleAddTask = async () => {
    if (!newTask.subjectId) {
      showAlert('Select a subject', 'Please add a subject in onboarding first or pick one.');
      return;
    }
    setBusy(true);
    try {
      await addTask({
        subjectId: newTask.subjectId,
        priority: newTask.priority,
        difficultyRating: newTask.difficulty_rating,
        estimatedMinutes: newTask.estimatedMinutes,
      });
      setNewTask({ subjectId: subjects[0]?.id ?? null, difficulty_rating: 5, priority: 2, estimatedMinutes: 60 });
      setShowAddModal(false);
    } catch (err) {
      showAlert('Could not create task', err.response?.data?.title || err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleComplete = (item) => {
    showConfirm({
      title: 'Complete task',
      message: `Mark "${item.subject}" as done?`,
      confirmText: 'Done',
      onConfirm: async () => {
        try { await completeTask(item.id, item.estimated_minutes || 50); }
        catch (err) { showAlert('Failed', err.response?.data?.title || err.message); }
      },
    });
  };

  const handleSnooze = (item) => {
    snoozeTask(item.id, 'manual snooze').catch(err =>
      showAlert('Failed', err.response?.data?.title || err.message)
    );
  };

  const handleDelete = (item) => {
    showConfirm({
      title: 'Delete task',
      message: 'Are you sure?',
      confirmText: 'Delete',
      destructive: true,
      onConfirm: async () => {
        try { await removeTask(item.id); }
        catch (err) { showAlert('Failed', err.response?.data?.title || err.message); }
      },
    });
  };

  const getPrioColor = (p) => p === 1 ? colors.accent.exam : p === 2 ? '#FFD166' : colors.accent.science;
  const getPrioLabel = (p) => p === 1 ? 'High' : p === 2 ? 'Medium' : 'Low';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 12, paddingBottom: 100 }}>
        <View style={styles.header}>
           <Text style={[styles.headerTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>Study Plan</Text>
           <View style={[styles.activeBadge, { backgroundColor: 'rgba(107, 92, 231, 0.1)' }]}>
              <Text style={[styles.activeBadgeText, { color: colors.primary, fontFamily: fonts.bold }]}>{tasks.length} {filter === 'done' ? 'Done' : 'Active'}</Text>
           </View>
        </View>

        <View style={[styles.filterRow, { backgroundColor: colors.cardAlt }]}>
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f.value}
              style={[styles.filterBtn, filter === f.value && { backgroundColor: colors.surface }]}
              onPress={() => setFilter(f.value)}
            >
              <Text style={[
                styles.filterText,
                {
                  color: filter === f.value ? colors.primary : colors.textLight,
                  fontFamily: filter === f.value ? fonts.bold : fonts.medium
                }
              ]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.taskList}>
           {(() => {
             const scheduledSlots = latestSchedule?.aiSchedule?.scheduled_slots || [];
             const scheduledTaskIds = new Set(scheduledSlots.filter(s => s.task_id).map(s => s.task_id));
             
             let displayItems = [];
             if (filter === 'today') {
               displayItems = scheduledSlots;
             } else if (filter === 'all') {
               // Show scheduled slots first, then other non-scheduled tasks
               const otherTasks = tasks.filter(t => !scheduledTaskIds.has(t.id));
               displayItems = [...scheduledSlots, ...otherTasks];
             } else {
               displayItems = tasks;
             }

             if (displayItems.length === 0) {
               return (
                 <Text style={{ color: colors.textLight, fontFamily: fonts.medium, textAlign: 'center', marginTop: 30 }}>
                   No tasks for this filter.
                 </Text>
               );
             }

             return displayItems.map((item, idx) => {
               const isAiSlot = item.time_slot !== undefined;
               const isBreak = item.activity_type === 'break';
               const id = isAiSlot ? `slot-${idx}` : item.id;
               const title = isAiSlot ? item.subject : item.subject;
               const priority = isAiSlot ? (isBreak ? 3 : 1) : item.priority;
               
               return (
                 <View key={id} style={[styles.taskCard, { backgroundColor: colors.surface, borderColor: isBreak ? 'transparent' : colors.border, opacity: isBreak ? 0.7 : 1 }]}>
                    <View style={[styles.indicator, { backgroundColor: isBreak ? colors.border : getPrioColor(priority) }]} />
                    <View style={styles.content}>
                       <View style={styles.titleRow}>
                          <Text style={[styles.taskTitle, { color: isBreak ? colors.textLight : colors.textDark, fontFamily: fonts.bold }]}>{title}</Text>
                          {!isBreak && (
                            <View style={[styles.prioTag, { backgroundColor: getPrioColor(priority) + '15' }]}>
                               <Text style={[styles.prioTagText, { color: getPrioColor(priority), fontFamily: fonts.bold }]}>{isAiSlot ? 'Scheduled' : getPrioLabel(priority)}</Text>
                            </View>
                          )}
                       </View>
                       <View style={styles.metaRow}>
                          <Text style={[styles.metaText, { color: colors.textLight, fontFamily: fonts.medium }]}>
                            {isAiSlot ? `${item.time_slot} · ${item.adjusted_duration_minutes}m` : (item.deadline ? `Exam: ${item.deadline}` : `Est: ${item.estimated_minutes}m`)}
                          </Text>
                          {!isAiSlot && (
                            <>
                              <View style={[styles.dot, { backgroundColor: colors.border }]} />
                              <Text style={[styles.metaText, { color: colors.textLight, fontFamily: fonts.medium }]}>D: {item.difficulty_rating}/10</Text>
                              <View style={[styles.dot, { backgroundColor: colors.border }]} />
                              <Text style={[styles.metaText, { color: colors.textLight, fontFamily: fonts.medium }]}>{item.status}</Text>
                            </>
                          )}
                       </View>
                    </View>
                    <View style={styles.controls}>
                       {!isAiSlot ? (
                         item.status !== 'done' ? (
                           <>
                             <TouchableOpacity style={[styles.controlBtn, { backgroundColor: colors.cardAlt }]} onPress={() => updateTaskDifficulty(item.id, Math.max(1, item.difficulty_rating - 1))}>
                                <Ionicons name="remove" size={16} color={colors.textDark} />
                             </TouchableOpacity>
                             <TouchableOpacity style={[styles.controlBtn, { backgroundColor: colors.primary }]} onPress={() => updateTaskDifficulty(item.id, Math.min(10, item.difficulty_rating + 1))}>
                                <Ionicons name="add" size={16} color="#FFF" />
                             </TouchableOpacity>
                             <TouchableOpacity style={[styles.controlBtn, { backgroundColor: colors.cardAlt }]} onPress={() => handleSnooze(item)}>
                                <Ionicons name="moon" size={16} color={colors.textDark} />
                             </TouchableOpacity>
                             <TouchableOpacity style={[styles.controlBtn, { backgroundColor: colors.accent.science || '#22C55E' }]} onPress={() => handleComplete(item)}>
                                <Ionicons name="checkmark" size={16} color="#FFF" />
                             </TouchableOpacity>
                           </>
                         ) : (
                           <TouchableOpacity style={[styles.controlBtn, { backgroundColor: colors.cardAlt }]} onPress={() => handleDelete(item)}>
                              <Ionicons name="trash" size={16} color={colors.textDark} />
                           </TouchableOpacity>
                         )
                       ) : (
                         !isBreak && (
                           <TouchableOpacity style={[styles.controlBtn, { backgroundColor: colors.accent.science || '#22C55E' }]} onPress={() => handleComplete({ id: item.task_id, subject: item.subject, estimated_minutes: item.adjusted_duration_minutes })}>
                              <Ionicons name="checkmark" size={16} color="#FFF" />
                           </TouchableOpacity>
                         )
                       )}
                    </View>
                 </View>
               );
             });
           })()}

        </View>
      </ScrollView>

      <TouchableOpacity style={styles.fab} activeOpacity={0.8} onPress={() => setShowAddModal(true)}>
        <LinearGradient colors={[colors.primary, '#9F8FFF']} style={styles.fabInner}>
           <Ionicons name="add" size={32} color="#FFF" />
        </LinearGradient>
      </TouchableOpacity>

      <Modal visible={showAddModal} transparent animationType="slide">
         <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
               <Text style={[styles.modalTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>New AI Task</Text>

               <Text style={[styles.fieldLabel, { color: colors.textLight, fontFamily: fonts.semiBold }]}>SUBJECT</Text>
               <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24 }}>
                 {subjects.map(s => (
                   <TouchableOpacity
                     key={s.id}
                     onPress={() => setNewTask({ ...newTask, subjectId: s.id })}
                     style={[styles.subjectChip, {
                       borderColor: newTask.subjectId === s.id ? colors.primary : colors.border,
                       backgroundColor: newTask.subjectId === s.id ? colors.primary + '15' : 'transparent'
                     }]}
                   >
                     <Text style={[{ color: newTask.subjectId === s.id ? colors.primary : colors.textDark, fontFamily: fonts.bold }]}>{s.name}</Text>
                   </TouchableOpacity>
                 ))}
               </ScrollView>

               <Text style={[styles.fieldLabel, { color: colors.textLight, fontFamily: fonts.semiBold }]}>ESTIMATED MINUTES</Text>
               <TextInput
                 style={[styles.modalInput, { backgroundColor: colors.cardAlt, color: colors.textDark, fontFamily: fonts.medium }]}
                 keyboardType="numeric"
                 value={String(newTask.estimatedMinutes)}
                 onChangeText={v => setNewTask({ ...newTask, estimatedMinutes: Math.max(5, parseInt(v || '0', 10) || 0) })}
               />

               <Text style={[styles.fieldLabel, { color: colors.textLight, fontFamily: fonts.semiBold }]}>INITIAL DIFFICULTY</Text>
               <View style={styles.difficultyRow}>
                  {[...Array(10)].map((_, i) => (
                    <TouchableOpacity
                      key={i}
                      style={[styles.diffBox, { backgroundColor: newTask.difficulty_rating > i ? colors.primary : colors.cardAlt }]}
                      onPress={() => setNewTask({...newTask, difficulty_rating: i + 1})}
                    />
                  ))}
                  <Text style={[styles.diffVal, { color: colors.textDark, fontFamily: fonts.bold }]}>{newTask.difficulty_rating}</Text>
               </View>

               <Text style={[styles.fieldLabel, { color: colors.textLight, fontFamily: fonts.semiBold }]}>PRIORITY LEVEL</Text>
               <View style={styles.prioGrid}>
                  {[1, 2, 3].map(p => (
                     <TouchableOpacity
                        key={p}
                        style={[styles.prioSelect, { borderColor: newTask.priority === p ? colors.primary : colors.border }]}
                        onPress={() => setNewTask({...newTask, priority: p})}
                     >
                        <View style={[styles.prioDot, { backgroundColor: getPrioColor(p) }]} />
                        <Text style={[styles.prioSelectText, { color: newTask.priority === p ? colors.textDark : colors.textLight, fontFamily: fonts.bold }]}>{getPrioLabel(p)}</Text>
                     </TouchableOpacity>
                  ))}
               </View>

               <View style={styles.modalFooter}>
                  <TouchableOpacity style={[styles.actionBtn, { borderColor: colors.border, borderWidth: 1 }]} onPress={() => setShowAddModal(false)}>
                     <Text style={[styles.actionBtnText, { color: colors.textLight, fontFamily: fonts.bold }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary }]} onPress={handleAddTask} disabled={busy}>
                     {busy ? <ActivityIndicator color="#FFF" /> : <Text style={[styles.actionBtnText, { color: '#FFF', fontFamily: fonts.bold }]}>Create AI Task</Text>}
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
  activeBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  activeBadgeText: { fontSize: 12 },
  filterRow: { flexDirection: 'row', padding: 5, borderRadius: 16, marginBottom: 30 },
  filterBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12 },
  filterText: { fontSize: 13 },
  taskList: { gap: 16 },
  taskCard: { flexDirection: 'row', padding: 18, borderRadius: 24, borderWidth: 1, alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 10 },
  indicator: { width: 4, height: 40, borderRadius: 2, marginRight: 18 },
  content: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 5 },
  taskTitle: { fontSize: 16 },
  prioTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  prioTagText: { fontSize: 10, letterSpacing: 0.5 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  metaText: { fontSize: 11, opacity: 0.6 },
  dot: { width: 3, height: 3, borderRadius: 1.5 },
  controls: { flexDirection: 'row', gap: 6 },
  controlBtn: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  fab: { position: 'absolute', bottom: 30, right: 30, width: 66, height: 66, borderRadius: 33, elevation: 10, shadowColor: '#6B5CE7', shadowOpacity: 0.4, shadowRadius: 15 },
  fabInner: { flex: 1, borderRadius: 33, justifyContent: 'center', alignItems: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: { padding: 30, borderTopLeftRadius: 40, borderTopRightRadius: 40, elevation: 20 },
  modalTitle: { fontSize: 24, marginBottom: 25 },
  modalInput: { height: 60, borderRadius: 18, paddingHorizontal: 20, marginBottom: 25, fontSize: 16 },
  fieldLabel: { fontSize: 11, letterSpacing: 1, marginBottom: 12, opacity: 0.6 },
  subjectChip: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, borderWidth: 1.5, marginRight: 10 },
  difficultyRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 30 },
  diffBox: { height: 10, flex: 1, borderRadius: 5 },
  diffVal: { fontSize: 18, marginLeft: 10, width: 25, textAlign: 'right' },
  prioGrid: { flexDirection: 'row', gap: 12, marginBottom: 35 },
  prioSelect: { flex: 1, height: 54, borderRadius: 16, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  prioDot: { width: 8, height: 8, borderRadius: 4 },
  prioSelectText: { fontSize: 13 },
  modalFooter: { flexDirection: 'row', gap: 15, paddingBottom: 20 },
  actionBtn: { flex: 1, height: 58, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  actionBtnText: { fontSize: 16 }
});
