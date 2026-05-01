import React, { useState, useEffect } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Platform } from 'react-native';
import { useTheme } from '../theme/theme';
import { useAI } from '../context/ai_context';
import { Ionicons } from '@expo/vector-icons';
import { slotsApi } from '../services/api';
import { showAlert } from '../services/dialogs';

export const DailyCheckinModal = ({ visible, onClose }) => {
  const { colors, fonts } = useTheme();
  const { subjects, addSubject, generateSchedule, userData } = useAI();
  const [newSubject, setNewSubject] = useState({ name: '', difficulty: 5, priority: 2, examDate: '' });
  const [loading, setLoading] = useState(false);
  const [slots, setSlots] = useState([]);
  const [newSlot, setNewSlot] = useState({ start: '08:00', end: '10:00' });
  const [showHourPicker, setShowHourPicker] = useState(false);
  const [activeSlotField, setActiveSlotField] = useState('start');
  
  const hours = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);

  useEffect(() => {
    if (visible) {
      const todayDate = new Date().toISOString().split('T')[0];
      slotsApi.list(todayDate).then(setSlots).catch(console.warn);
      // Pre-fill examDate with user's global deadline if available
      if (userData?.deadline && !newSubject.examDate) {
        setNewSubject(prev => ({ ...prev, examDate: userData.deadline }));
      }
    }
  }, [visible]);

  const handleAddSlot = async () => {
    try {
      const dayOfWeek = new Date().getDay();
      const created = await slotsApi.create({ dayOfWeek, startTime: newSlot.start + ':00', endTime: newSlot.end + ':00' });
      setSlots(prev => [...prev, created].sort((a, b) => a.startTime.localeCompare(b.startTime)));
    } catch (err) {
      showAlert('Error', err.response?.data?.title || err.message);
    }
  };

  const handleRemoveSlot = async (id) => {
    try {
      await slotsApi.remove(id);
      setSlots(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      showAlert('Error', err.response?.data?.title || err.message);
    }
  };

  const handleAddSubject = async () => {
    const trimmedName = newSubject.name.trim();
    if (!trimmedName) return;
    
    // Client-side duplicate check
    if (subjects.some(s => s.name.toLowerCase() === trimmedName.toLowerCase())) {
      showAlert('Duplicate Subject', 'You have already added a subject with this name.');
      return;
    }

    if (!newSubject.examDate) {
      showAlert('Missing Date', 'Please set an exam/deadline date for this subject.');
      return;
    }

    try {
      await addSubject({ 
        name: trimmedName, 
        difficulty: newSubject.difficulty, 
        priority: newSubject.priority,
        examDate: newSubject.examDate
      });
      setNewSubject({ name: '', difficulty: 5, priority: 2, examDate: userData?.deadline || '' });
    } catch (err) {
      showAlert('Error', err.response?.data?.title || err.message);
    }
  };

  const handleGenerate = async () => {
    if (subjects.length === 0) {
      showAlert('No Subjects', 'Please add at least one subject to generate your study plan for today.');
      return;
    }
    setLoading(true);
    try {
      await generateSchedule();
      onClose();
    } catch (err) {
      console.warn(err);
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <ScrollView style={[styles.container, { backgroundColor: colors.background }]} showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
          <Text style={[styles.title, { color: colors.textDark, fontFamily: fonts.bold }]}>Good Morning!</Text>
          <Text style={[styles.subtitle, { color: colors.textLight, fontFamily: fonts.medium }]}>
            Let's plan your day. Set your available time blocks, add any new subjects, then generate your AI study plan.
          </Text>

          {/* ── SECTION 1: TIME BLOCKS ── */}
          <Text style={[styles.label, { color: colors.textDark, fontFamily: fonts.bold }]}>Today's Study Blocks</Text>
          <ScrollView style={styles.slotsList} horizontal showsHorizontalScrollIndicator={false}>
            {slots.length === 0 && (
              <Text style={{ color: colors.textLight, fontFamily: fonts.medium, fontSize: 13, paddingVertical: 8 }}>No time blocks yet — add one below</Text>
            )}
            {slots.map(s => (
              <View key={s.id} style={[styles.slotChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={{ color: colors.textDark, fontFamily: fonts.medium, fontSize: 13 }}>{s.startTime.slice(0,5)} - {s.endTime.slice(0,5)}</Text>
                <TouchableOpacity onPress={() => handleRemoveSlot(s.id)} style={{ marginLeft: 8 }}>
                  <Ionicons name="close-circle" size={16} color={colors.textLight} />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>

          <View style={styles.formContainer}>
            <Text style={[styles.fieldLabel, { color: colors.textLight, fontFamily: fonts.semiBold, marginBottom: 15 }]}>ADD TIME BLOCK</Text>
            <View style={styles.modalRow}>
              <View style={{ flex: 1, marginRight: 10 }}>
                 <Text style={[styles.miniLabel, { color: colors.textLight, fontFamily: fonts.bold }]}>START TIME</Text>
                 <TouchableOpacity 
                    style={[styles.modalInputBox, { backgroundColor: colors.surface }]}
                    onPress={() => { setActiveSlotField('start'); setShowHourPicker(true); }}
                 >
                    <Text style={{ color: colors.textDark, fontFamily: fonts.bold }}>{newSlot.start}</Text>
                 </TouchableOpacity>
              </View>
              <View style={{ flex: 1, marginRight: 10 }}>
                 <Text style={[styles.miniLabel, { color: colors.textLight, fontFamily: fonts.bold }]}>END TIME</Text>
                 <TouchableOpacity 
                    style={[styles.modalInputBox, { backgroundColor: colors.surface }]}
                    onPress={() => { setActiveSlotField('end'); setShowHourPicker(true); }}
                 >
                    <Text style={{ color: colors.textDark, fontFamily: fonts.bold }}>{newSlot.end}</Text>
                 </TouchableOpacity>
              </View>
              <TouchableOpacity 
                style={[styles.addBtn, { backgroundColor: colors.primary, alignSelf: 'flex-end', marginBottom: 20 }]}
                onPress={handleAddSlot}
              >
                <Ionicons name="add" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* ── SECTION 2: SUBJECTS ── */}
          <Text style={[styles.label, { color: colors.textDark, fontFamily: fonts.bold, marginTop: 10 }]}>Your Subjects</Text>
          <Text style={{ color: colors.textLight, fontFamily: fonts.medium, fontSize: 12, marginBottom: 12 }}>
            {subjects.length === 0 ? 'No subjects yet — add your first one below!' : 'Want to add a new subject before generating the plan?'}
          </Text>
          <ScrollView style={styles.subjectsList} horizontal showsHorizontalScrollIndicator={false}>
            {subjects.map(s => (
              <View key={s.id} style={[styles.chip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={{ color: colors.textDark, fontFamily: fonts.medium }}>{s.name}</Text>
              </View>
            ))}
          </ScrollView>

          <View style={styles.formContainer}>
            <Text style={[styles.fieldLabel, { color: colors.textLight, fontFamily: fonts.semiBold }]}>ADD NEW SUBJECT</Text>
            
            {/* Subject Name */}
            <View style={[styles.inputGroup, { backgroundColor: colors.surface, borderColor: colors.border }]}>
               <View style={styles.inputHeader}>
                  <Ionicons name="book-outline" size={20} color={colors.primary} />
                  <Text style={[styles.miniLabel, { color: colors.textLight, fontFamily: fonts.bold, marginBottom: 0 }]}>SUBJECT NAME</Text>
               </View>
               <TextInput 
                  style={[styles.inputBoxText, { color: colors.textDark, fontFamily: fonts.bold }]} 
                  value={newSubject.name}
                  onChangeText={(v) => setNewSubject({ ...newSubject, name: v })}
                  placeholder="e.g. Advanced Calculus"
                  placeholderTextColor={colors.textLight}
               />
            </View>

            {/* Exam Date */}
            <View style={[styles.inputGroup, { backgroundColor: colors.surface, borderColor: colors.border }]}>
               <View style={styles.inputHeader}>
                  <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                  <Text style={[styles.miniLabel, { color: colors.textLight, fontFamily: fonts.bold, marginBottom: 0 }]}>EXAM / DEADLINE DATE</Text>
               </View>
               {Platform.OS === 'web' ? (
                 <input
                    type="date"
                    value={newSubject.examDate}
                    onChange={(e) => setNewSubject({ ...newSubject, examDate: e.target.value })}
                    style={{
                       fontSize: 16,
                       fontFamily: 'Outfit_700Bold',
                       color: colors.textDark,
                       backgroundColor: 'transparent',
                       border: 'none',
                       outline: 'none',
                       width: '100%',
                       paddingLeft: 30,
                       height: 30
                    }}
                 />
               ) : (
                 <TextInput 
                    style={[styles.inputBoxText, { color: colors.textDark, fontFamily: fonts.bold }]} 
                    value={newSubject.examDate}
                    onChangeText={(v) => setNewSubject({ ...newSubject, examDate: v })}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.textLight}
                 />
               )}
            </View>
            
            {/* Priority */}
            <View style={{ marginTop: 10 }}>
               <Text style={[styles.miniLabel, { color: colors.textLight, fontFamily: fonts.bold }]}>PRIORITY</Text>
               <View style={styles.priorityGrid}>
                  {[
                     { v: 1, l: 'High', c: '#F43F5E' },
                     { v: 2, l: 'Med', c: '#F59E0B' },
                     { v: 3, l: 'Low', c: '#10B981' }
                  ].map(p => (
                     <TouchableOpacity
                        key={p.v}
                        onPress={() => setNewSubject({ ...newSubject, priority: p.v })}
                        style={[styles.prioSelect, { 
                           borderColor: newSubject.priority === p.v ? p.c : colors.border,
                           backgroundColor: newSubject.priority === p.v ? p.c + '15' : colors.surface 
                        }]}
                     >
                        <Text style={{ color: newSubject.priority === p.v ? p.c : colors.textLight, fontFamily: fonts.bold }}>{p.l}</Text>
                     </TouchableOpacity>
                  ))}
               </View>
            </View>

            {/* Difficulty */}
            <Text style={[styles.miniLabel, { color: colors.textLight, fontFamily: fonts.bold, marginTop: 25 }]}>DIFFICULTY: {newSubject.difficulty}/10</Text>
            <View style={styles.diffBarRow}>
               {[...Array(10)].map((_, i) => (
                 <TouchableOpacity 
                   key={i} 
                   style={[styles.diffBit, { backgroundColor: newSubject.difficulty > i ? colors.primary : colors.surface }]} 
                   onPress={() => setNewSubject({ ...newSubject, difficulty: i + 1 })}
                 />
               ))}
            </View>
            
            <TouchableOpacity 
              style={[styles.mainBtn, { marginTop: 30, backgroundColor: colors.primary }]}
              onPress={handleAddSubject}
            >
              <Text style={{ color: '#FFF', fontFamily: fonts.bold }}>ADD SUBJECT</Text>
            </TouchableOpacity>
          </View>

          {/* ── GENERATE BUTTON ── */}
          <TouchableOpacity 
            style={[styles.generateBtn, { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 }]}
            onPress={handleGenerate}
            disabled={loading}
          >
            <Text style={[styles.generateText, { fontFamily: fonts.bold }]}>
              {loading ? 'Generating AI Plan...' : "Generate Today's Plan"}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <Modal visible={showHourPicker} transparent animationType="fade">
         <View style={styles.modalOverlaySecondary}>
            <View style={{ backgroundColor: colors.surface, width: '80%', borderRadius: 20, padding: 20, maxHeight: '60%' }}>
               <Text style={{ fontFamily: fonts.bold, fontSize: 18, marginBottom: 15, textAlign: 'center' }}>Select Hour</Text>
               <ScrollView>
                  {hours.map(h => (
                     <TouchableOpacity 
                        key={h} 
                        style={{ paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: colors.border, alignItems: 'center' }}
                        onPress={() => {
                           setNewSlot({ ...newSlot, [activeSlotField]: h });
                           setShowHourPicker(false);
                        }}
                     >
                        <Text style={{ color: colors.textDark, fontFamily: fonts.medium, fontSize: 16 }}>{h}</Text>
                     </TouchableOpacity>
                  ))}
               </ScrollView>
               <TouchableOpacity 
                  style={{ marginTop: 15, padding: 15, backgroundColor: colors.border, borderRadius: 10, alignItems: 'center' }}
                  onPress={() => setShowHourPicker(false)}
               >
                  <Text style={{ color: colors.textDark, fontFamily: fonts.bold }}>Cancel</Text>
               </TouchableOpacity>
            </View>
         </View>
      </Modal>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxHeight: '90%',
    marginTop: 'auto',
  },
  title: {
    fontSize: 24,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    marginBottom: 24,
    lineHeight: 22,
  },
  label: {
    fontSize: 16,
    marginBottom: 12,
  },
  slotsList: {
    maxHeight: 45,
    marginBottom: 16,
  },
  slotChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
  },
  subjectsList: {
    maxHeight: 50,
    marginBottom: 16,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 10,
  },
  inputGroup: { padding: 15, borderRadius: 16, borderWidth: 1, marginBottom: 15 },
  inputHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  inputBoxText: { fontSize: 18, paddingLeft: 30, outlineStyle: 'none' },
  addBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  generateBtn: {
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  generateText: {
    color: '#fff',
    fontSize: 18,
  },
  formContainer: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 16,
  },
  fieldLabel: {
    fontSize: 12,
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  miniLabel: { fontSize: 10, letterSpacing: 1, marginBottom: 10, opacity: 0.7 },
  modalOverlaySecondary: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalInputBox: { height: 50, borderRadius: 12, paddingHorizontal: 15, marginBottom: 15, justifyContent: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  modalRow: { flexDirection: 'row', marginBottom: 5 },
  priorityGrid: { flexDirection: 'row', gap: 10 },
  prioSelect: { flex: 1, height: 40, borderRadius: 12, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  diffBarRow: { flexDirection: 'row', gap: 5, marginTop: 5 },
  diffBit: { flex: 1, height: 8, borderRadius: 4 },
  mainBtn: { height: 50, borderRadius: 16, justifyContent: 'center', alignItems: 'center' }
});
