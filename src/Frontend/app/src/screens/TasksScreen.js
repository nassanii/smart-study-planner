import { extractErrorMessage } from '../services/errors';
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, ActivityIndicator } from 'react-native';
import { useTheme } from '../theme/theme';
import { useAI } from '../context/ai_context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { showAlert, showConfirm } from '../services/dialogs';



export const SubjectsScreen = () => {
  const { colors, fonts } = useTheme();
  const { tasks, subjects, addTask, removeTask, addSubject, updateSubject, removeSubject } = useAI();
  
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null);
  const [targetSubjectId, setTargetSubjectId] = useState(null);

  const [subjectForm, setSubjectForm] = useState({ name: '', difficulty: 5, priority: 2, examDate: '' });
  const [taskForm, setTaskForm] = useState({ title: '', difficulty_rating: 5, priority: 2, estimatedMinutes: 60 });
  const [busy, setBusy] = useState(false);

  const handleSaveSubject = async () => {
    if (!subjectForm.name) return showAlert('Required', 'Please enter a subject name.');
    setBusy(true);
    try {
      if (editingSubject) {
        await updateSubject(editingSubject.id, subjectForm);
      } else {
        await addSubject(subjectForm);
      }
      setShowSubjectModal(false);
      setSubjectForm({ name: '', difficulty: 5, priority: 2, examDate: '' });
      setEditingSubject(null);
    } catch (err) {
      showAlert('Error', extractErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteSubject = (s) => {
    showConfirm({
      title: 'Delete Subject',
      message: `Delete "${s.name}"? This will remove all associated tasks.`,
      confirmText: 'Delete',
      destructive: true,
      onConfirm: () => removeSubject(s.id),
    });
  };

  const handleAddTask = async () => {
    setBusy(true);
    try {
      await addTask({
        subjectId: targetSubjectId,
        title: taskForm.title,
        priority: taskForm.priority,
        difficultyRating: taskForm.difficulty_rating,
        estimatedMinutes: taskForm.estimatedMinutes,
      });
      setShowTaskModal(false);
      setTaskForm({ title: '', difficulty_rating: 5, priority: 2, estimatedMinutes: 60 });
    } catch (err) {
      showAlert('Error', extractErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteTask = (t) => {
    showConfirm({
      title: 'Remove Task',
      message: 'Delete this study goal?',
      confirmText: 'Delete',
      destructive: true,
      onConfirm: () => removeTask(t.id),
    });
  };

  const getPrioColor = (p) => p === 1 ? '#F43F5E' : p === 2 ? '#F59E0B' : '#10B981';
  const getPrioLabel = (p) => p === 1 ? 'High' : p === 2 ? 'Medium' : 'Low';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 12, paddingBottom: 100 }}>
        <View style={styles.header}>
           <Text style={[styles.headerTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>Subjects</Text>
           <View style={[styles.activeBadge, { backgroundColor: colors.primary + '15' }]}>
              <Text style={[styles.activeBadgeText, { color: colors.primary, fontFamily: fonts.bold }]}>{subjects.length} Active</Text>
           </View>
        </View>

        <View style={styles.taskList}>
           {subjects.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="library-outline" size={32} color="#CBD5E1" style={{ marginBottom: 12 }} />
                <Text style={[styles.emptyText, { color: colors.textLight, fontFamily: fonts.medium }]}>No subjects yet. Tap + to add one.</Text>
              </View>
           ) : (
             subjects.map((s) => {
                const subTasks = tasks.filter(t => t.subject_id === s.id);
                return (
                  <View key={s.id} style={[styles.taskCard, { backgroundColor: colors.surface, borderColor: colors.border, flexDirection: 'column', alignItems: 'stretch' }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={[styles.indicator, { backgroundColor: getPrioColor(s.priority) }]} />
                      <View style={styles.content}>
                          <View style={styles.titleRow}>
                            <Text style={[styles.taskTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>{s.name}</Text>
                            <View style={[styles.prioTag, { backgroundColor: getPrioColor(s.priority) + '15' }]}>
                                <Text style={[styles.prioTagText, { color: getPrioColor(s.priority), fontFamily: fonts.bold }]}>{getPrioLabel(s.priority)}</Text>
                            </View>
                          </View>
                          <View style={styles.metaRow}>
                            <Text style={[styles.metaText, { color: colors.textLight, fontFamily: fonts.medium }]}>
                              {s.examDate ? `Exam: ${new Date(s.examDate).toLocaleDateString()}` : 'No exam date'}
                            </Text>
                            <View style={[styles.dot, { backgroundColor: colors.border }]} />
                            <Text style={[styles.metaText, { color: colors.textLight, fontFamily: fonts.medium }]}>Diff: {s.difficulty}/10</Text>
                          </View>
                      </View>
                      <View style={styles.controls}>
                          <TouchableOpacity style={[styles.controlBtn, { backgroundColor: colors.cardAlt }]} onPress={() => { setEditingSubject(s); setSubjectForm({ name: s.name, difficulty: s.difficulty, priority: s.priority, examDate: s.examDate || '' }); setShowSubjectModal(true); }}>
                            <Ionicons name="pencil" size={16} color={colors.textDark} />
                          </TouchableOpacity>
                          <TouchableOpacity style={[styles.controlBtn, { backgroundColor: colors.cardAlt }]} onPress={() => handleDeleteSubject(s)}>
                            <Ionicons name="trash" size={16} color={colors.textDark} />
                          </TouchableOpacity>
                      </View>
                    </View>

                    {/* Mini Task List */}
                    <View style={{ marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: colors.border }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                          <Text style={{ fontSize: 12, color: colors.textLight, fontFamily: fonts.bold }}>TASKS ({subTasks.length})</Text>
                          <TouchableOpacity onPress={() => { setTargetSubjectId(s.id); setShowTaskModal(true); }}>
                            <Text style={{ fontSize: 12, color: colors.primary, fontFamily: fonts.bold }}>+ Add Task</Text>
                          </TouchableOpacity>
                        </View>
                        {subTasks.map(t => {
                          const progressPct = t.estimated_minutes > 0 
                            ? Math.min(100, Math.round(((t.actual_minutes || 0) / t.estimated_minutes) * 100)) 
                            : 0;
                          return (
                          <View key={t.id} style={{ marginBottom: 8, padding: 12, backgroundColor: colors.cardAlt, borderRadius: 10 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                               <Text style={{ fontSize: 14, color: colors.textDark, fontFamily: fonts.bold }}>{t.title || 'Study Session'}</Text>
                               <TouchableOpacity onPress={() => handleDeleteTask(t)}>
                                 <Ionicons name="close-circle" size={18} color={colors.textLight} />
                               </TouchableOpacity>
                            </View>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                               <Text style={{ fontSize: 11, color: colors.textLight, fontFamily: fonts.medium }}>Diff {t.difficulty_rating} • {t.actual_minutes || 0} / {t.estimated_minutes}m</Text>
                            </View>
                            <View style={{ height: 4, backgroundColor: colors.border, borderRadius: 2 }}>
                               <View style={{ height: 4, backgroundColor: colors.primary, borderRadius: 2, width: `${progressPct}%` }} />
                            </View>
                          </View>
                        )})}
                    </View>
                  </View>
                );
             })
           )}
        </View>
      </ScrollView>

      {/* FAB - Add Subject */}
      <TouchableOpacity style={styles.fab} activeOpacity={0.8} onPress={() => { setEditingSubject(null); setSubjectForm({ name: '', difficulty: 5, priority: 2, examDate: '' }); setShowSubjectModal(true); }}>
        <LinearGradient colors={[colors.primary, '#9F8FFF']} style={styles.fabInner}>
           <Ionicons name="add" size={32} color="#FFF" />
        </LinearGradient>
      </TouchableOpacity>

      {/* Subject Modal */}
      <Modal visible={showSubjectModal} transparent animationType="slide">
         <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
               <Text style={[styles.modalTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>{editingSubject ? 'Edit Subject' : 'New Subject'}</Text>
               
               <View style={[styles.inputGroup, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.inputHeader}>
                     <Ionicons name="book-outline" size={20} color={colors.primary} />
                     <Text style={[styles.miniLabel, { color: colors.textLight, fontFamily: fonts.bold, marginBottom: 0 }]}>SUBJECT NAME</Text>
                  </View>
                  <TextInput 
                     style={[styles.inputBoxText, { color: colors.textDark, fontFamily: fonts.bold }]} 
                     value={subjectForm.name}
                     onChangeText={v => setSubjectForm({...subjectForm, name: v})}
                     placeholder="e.g. Advanced Calculus"
                     placeholderTextColor={colors.textLight}
                  />
               </View>

               <Text style={[styles.miniLabel, { color: colors.textLight, fontFamily: fonts.bold, marginTop: 20 }]}>PRIORITY</Text>
               <View style={styles.prioGrid}>
                  {[1, 2, 3].map(p => (
                      <TouchableOpacity
                         key={p}
                         style={[styles.prioSelect, { borderColor: subjectForm.priority === p ? colors.primary : colors.border }]}
                         onPress={() => setSubjectForm({...subjectForm, priority: p})}
                      >
                         <Text style={{ color: subjectForm.priority === p ? colors.textDark : colors.textLight, fontFamily: fonts.bold }}>{p === 1 ? 'High' : p === 2 ? 'Med' : 'Low'}</Text>
                      </TouchableOpacity>
                  ))}
               </View>

               <Text style={[styles.miniLabel, { color: colors.textLight, fontFamily: fonts.bold, marginTop: 25 }]}>DIFFICULTY: {subjectForm.difficulty}/10</Text>
               <View style={styles.diffBarRow}>
                  {[...Array(10)].map((_, i) => (
                    <TouchableOpacity
                      key={i}
                      style={[styles.diffBit, { backgroundColor: subjectForm.difficulty > i ? colors.primary : colors.cardAlt }]}
                      onPress={() => setSubjectForm({...subjectForm, difficulty: i + 1})}
                    />
                  ))}
               </View>

               <View style={styles.modalFooter}>
                  <TouchableOpacity style={[styles.actionBtn, { borderColor: colors.border, borderWidth: 1 }]} onPress={() => setShowSubjectModal(false)}>
                     <Text style={[styles.actionBtnText, { color: colors.textLight, fontFamily: fonts.bold }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary }]} onPress={handleSaveSubject} disabled={busy}>
                     {busy ? <ActivityIndicator color="#FFF" /> : <Text style={[styles.actionBtnText, { color: '#FFF', fontFamily: fonts.bold }]}>Save Subject</Text>}
                  </TouchableOpacity>
               </View>
            </View>
         </View>
      </Modal>

      {/* Task Modal (Add task to subject) */}
      <Modal visible={showTaskModal} transparent animationType="slide">
         <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
               <Text style={[styles.modalTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>New Study Task</Text>

               <View style={[styles.inputGroup, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.inputHeader}>
                     <Ionicons name="bookmark-outline" size={20} color={colors.primary} />
                     <Text style={[styles.miniLabel, { color: colors.textLight, fontFamily: fonts.bold, marginBottom: 0 }]}>TASK TITLE</Text>
                  </View>
                  <TextInput
                    style={[styles.inputBoxText, { color: colors.textDark, fontFamily: fonts.bold }]}
                    placeholder="e.g. Chapter 1 Review"
                    placeholderTextColor={colors.textLight}
                    value={taskForm.title}
                    onChangeText={v => setTaskForm({ ...taskForm, title: v })}
                  />
               </View>

               <View style={[styles.inputGroup, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.inputHeader}>
                     <Ionicons name="time-outline" size={20} color={colors.primary} />
                     <Text style={[styles.miniLabel, { color: colors.textLight, fontFamily: fonts.bold, marginBottom: 0 }]}>ESTIMATED MINUTES</Text>
                  </View>
                  <TextInput
                    style={[styles.inputBoxText, { color: colors.textDark, fontFamily: fonts.bold }]}
                    keyboardType="numeric"
                    value={taskForm.estimatedMinutes ? String(taskForm.estimatedMinutes) : ''}
                    onChangeText={v => setTaskForm({ ...taskForm, estimatedMinutes: v.replace(/[^0-9]/g, '') })}
                  />
               </View>

               <Text style={[styles.miniLabel, { color: colors.textLight, fontFamily: fonts.bold, marginTop: 20 }]}>PRIORITY</Text>
               <View style={styles.prioGrid}>
                  {[1, 2, 3].map(p => (
                      <TouchableOpacity
                         key={p}
                         style={[styles.prioSelect, { borderColor: taskForm.priority === p ? colors.primary : colors.border }]}
                         onPress={() => setTaskForm({...taskForm, priority: p})}
                      >
                         <Text style={{ color: taskForm.priority === p ? colors.textDark : colors.textLight, fontFamily: fonts.bold }}>{p === 1 ? 'High' : p === 2 ? 'Med' : 'Low'}</Text>
                      </TouchableOpacity>
                  ))}
               </View>

               <Text style={[styles.miniLabel, { color: colors.textLight, fontFamily: fonts.bold, marginTop: 25 }]}>TASK DIFFICULTY: {taskForm.difficulty_rating}/10</Text>
               <View style={styles.diffBarRow}>
                  {[...Array(10)].map((_, i) => (
                    <TouchableOpacity
                      key={i}
                      style={[styles.diffBit, { backgroundColor: taskForm.difficulty_rating > i ? colors.primary : colors.cardAlt }]}
                      onPress={() => setTaskForm({...taskForm, difficulty_rating: i + 1})}
                    />
                  ))}
               </View>

               <View style={styles.modalFooter}>
                  <TouchableOpacity style={[styles.actionBtn, { borderColor: colors.border, borderWidth: 1 }]} onPress={() => setShowTaskModal(false)}>
                     <Text style={[styles.actionBtnText, { color: colors.textLight, fontFamily: fonts.bold }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary }]} onPress={handleAddTask} disabled={busy}>
                     {busy ? <ActivityIndicator color="#FFF" /> : <Text style={[styles.actionBtnText, { color: '#FFF', fontFamily: fonts.bold }]}>Add Task</Text>}
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
  taskList: { gap: 16 },
  taskCard: { padding: 18, borderRadius: 24, borderWidth: 1, elevation: 2, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 10 },
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
  inputGroup: { padding: 15, borderRadius: 16, borderWidth: 1, marginBottom: 15 },
  inputHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  inputBoxText: { fontSize: 18, paddingLeft: 30, outlineStyle: 'none' },
  miniLabel: { fontSize: 10, letterSpacing: 1, marginBottom: 10, opacity: 0.7 },
  prioGrid: { flexDirection: 'row', gap: 12, marginBottom: 5 },
  prioSelect: { flex: 1, height: 40, borderRadius: 12, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  diffBarRow: { flexDirection: 'row', gap: 5, marginTop: 5, marginBottom: 25 },
  diffBit: { flex: 1, height: 8, borderRadius: 4 },
  modalFooter: { flexDirection: 'row', gap: 15, paddingBottom: 20, paddingTop: 10 },
  actionBtn: { flex: 1, height: 50, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  actionBtnText: { fontSize: 16 },
  emptyCard: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 14 }
});
