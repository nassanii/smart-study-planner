import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal } from 'react-native';
import { useTheme } from '../theme/theme';
import { useAI } from '../context/ai_context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export const TasksScreen = () => {
  const { colors, fonts } = useTheme();
  const { tasks, updateTaskDifficulty, addTask } = useAI();
  const [filter, setFilter] = useState('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTask, setNewTask] = useState({ subject: '', difficulty_rating: 5, priority: 2, deadline: 'May 15, 2026' });

  const handleAddTask = () => {
    if (newTask.subject) {
      addTask({
         ...newTask,
         days_since_last_study: 0,
         consecutive_days_studied: 0,
         status: 'upcoming'
      });
      setNewTask({ subject: '', difficulty_rating: 5, priority: 2, deadline: 'May 15, 2026' });
      setShowAddModal(false);
    }
  };

  const getPrioColor = (p) => p === 1 ? colors.accent.exam : p === 2 ? '#FFD166' : colors.accent.science;
  const getPrioLabel = (p) => p === 1 ? 'High' : p === 2 ? 'Medium' : 'Low';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 12, paddingBottom: 100 }}>
        <View style={styles.header}>
           <Text style={[styles.headerTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>Study Plan</Text>
           <View style={[styles.activeBadge, { backgroundColor: 'rgba(107, 92, 231, 0.1)' }]}>
              <Text style={[styles.activeBadgeText, { color: colors.primary, fontFamily: fonts.bold }]}>{tasks.length} Active</Text>
           </View>
        </View>

        <View style={[styles.filterRow, { backgroundColor: colors.cardAlt }]}>
          {['All', 'High', 'Today', 'Done'].map(f => (
            <TouchableOpacity 
              key={f} 
              style={[styles.filterBtn, filter === f && { backgroundColor: colors.surface }]}
              onPress={() => setFilter(f)}
            >
              <Text style={[
                styles.filterText, 
                { 
                  color: filter === f ? colors.primary : colors.textLight,
                  fontFamily: filter === f ? fonts.bold : fonts.medium 
                }
              ]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.taskList}>
           {tasks.map((item) => (
             <View key={item.id} style={[styles.taskCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.indicator, { backgroundColor: getPrioColor(item.priority) }]} />
                <View style={styles.content}>
                   <View style={styles.titleRow}>
                      <Text style={[styles.taskTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>{item.subject}</Text>
                      <View style={[styles.prioTag, { backgroundColor: getPrioColor(item.priority) + '15' }]}>
                         <Text style={[styles.prioTagText, { color: getPrioColor(item.priority), fontFamily: fonts.bold }]}>{getPrioLabel(item.priority)}</Text>
                      </View>
                   </View>
                   <View style={styles.metaRow}>
                      <Text style={[styles.metaText, { color: colors.textLight, fontFamily: fonts.medium }]}>Exam: {item.deadline || 'Jun 10'}</Text>
                      <View style={[styles.dot, { backgroundColor: colors.border }]} />
                      <Text style={[styles.metaText, { color: colors.textLight, fontFamily: fonts.medium }]}>Difficulty: {item.difficulty_rating}/10</Text>
                   </View>
                </View>
                <View style={styles.controls}>
                   <TouchableOpacity 
                     style={[styles.controlBtn, { backgroundColor: colors.cardAlt }]} 
                     onPress={() => updateTaskDifficulty(item.id, Math.max(1, item.difficulty_rating - 1))}
                   >
                      <Ionicons name="remove" size={16} color={colors.textDark} />
                   </TouchableOpacity>
                   <TouchableOpacity 
                     style={[styles.controlBtn, { backgroundColor: colors.primary }]} 
                     onPress={() => updateTaskDifficulty(item.id, Math.min(10, item.difficulty_rating + 1))}
                   >
                      <Ionicons name="add" size={16} color="#FFF" />
                   </TouchableOpacity>
                </View>
             </View>
           ))}
        </View>
      </ScrollView>

      <TouchableOpacity 
        style={styles.fab} 
        activeOpacity={0.8}
        onPress={() => setShowAddModal(true)}
      >
        <LinearGradient colors={[colors.primary, '#9F8FFF']} style={styles.fabInner}>
           <Ionicons name="add" size={32} color="#FFF" />
        </LinearGradient>
      </TouchableOpacity>

      <Modal visible={showAddModal} transparent animationType="slide">
         <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
               <Text style={[styles.modalTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>New AI Task</Text>
               <TextInput 
                  style={[styles.modalInput, { backgroundColor: colors.cardAlt, color: colors.textDark, fontFamily: fonts.medium }]} 
                  placeholder="Subject name..."
                  placeholderTextColor={colors.textLight}
                  value={newTask.subject}
                  onChangeText={v => setNewTask({...newTask, subject: v})}
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
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary }]} onPress={handleAddTask}>
                     <Text style={[styles.actionBtnText, { color: '#FFF', fontFamily: fonts.bold }]}>Create AI Task</Text>
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
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaText: { fontSize: 12, opacity: 0.6 },
  dot: { width: 3, height: 3, borderRadius: 1.5 },
  controls: { flexDirection: 'row', gap: 10 },
  controlBtn: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  fab: { position: 'absolute', bottom: 30, right: 30, width: 66, height: 66, borderRadius: 33, elevation: 10, shadowColor: '#6B5CE7', shadowOpacity: 0.4, shadowRadius: 15 },
  fabInner: { flex: 1, borderRadius: 33, justifyContent: 'center', alignItems: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: { padding: 30, borderTopLeftRadius: 40, borderTopRightRadius: 40, elevation: 20 },
  modalTitle: { fontSize: 24, marginBottom: 25 },
  modalInput: { height: 60, borderRadius: 18, paddingHorizontal: 20, marginBottom: 30, fontSize: 16 },
  fieldLabel: { fontSize: 11, letterSpacing: 1, marginBottom: 15, opacity: 0.6 },
  difficultyRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 35 },
  diffBox: { height: 10, flex: 1, borderRadius: 5 },
  diffVal: { fontSize: 18, marginLeft: 10, width: 25, textAlign: 'right' },
  prioGrid: { flexDirection: 'row', gap: 12, marginBottom: 40 },
  prioSelect: { flex: 1, height: 54, borderRadius: 16, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  prioDot: { width: 8, height: 8, borderRadius: 4 },
  prioSelectText: { fontSize: 13 },
  modalFooter: { flexDirection: 'row', gap: 15, paddingBottom: 20 },
  actionBtn: { flex: 1, height: 58, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  actionBtnText: { fontSize: 16 }
});
