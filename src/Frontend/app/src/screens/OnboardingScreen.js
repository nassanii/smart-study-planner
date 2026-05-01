import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Dimensions, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { useTheme } from '../theme/theme';
import { useAI } from '../context/ai_context';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { showError, showToast } from '../services/dialogs';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const PRIORITY_LABELS = {
  1: 'High',
  2: 'Medium',
  3: 'Low'
};

const PRIORITY_COLORS = {
  1: '#EF4444',
  2: '#F59E0B',
  3: '#10B981'
};

export const OnboardingScreen = () => {
  const { colors, fonts } = useTheme();
  const { completeOnboarding, userData, subjects: existingSubjects, reloadSubjects } = useAI();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Step 1: Goal & Constraints
  const [name, setName] = useState(userData?.name || '');
  const [deadline, setDeadline] = useState(userData?.deadline || '');

  // Step 2: Subjects
  const [subjects, setSubjects] = useState([]);
  const [showAddSubjectModal, setShowAddSubjectModal] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [newSub, setNewSub] = useState({
    name: '',
    difficulty: 5,
    priority: 2,
    estimatedMinutes: 50,
    examDate: ''
  });

  // Step 3: Slots
  const [slots, setSlots] = useState([
    { startTime: '17:00', endTime: '19:00' },
    { startTime: '20:00', endTime: '22:00' },
  ]);
  const [showAddSlotModal, setShowAddSlotModal] = useState(false);
  const [editingSlotIndex, setEditingSlotIndex] = useState(null);
  const [newSlot, setNewSlot] = useState({ startTime: '17:00', endTime: '18:00' });
  const [showHourPicker, setShowHourPicker] = useState(false);
  const [activeSlotField, setActiveSlotField] = useState(null); // 'startTime' | 'endTime'

  useEffect(() => {
    if (userData?.name && !name) setName(userData.name);
    if (userData?.deadline && !deadline) setDeadline(userData.deadline);
  }, [userData]);

  useEffect(() => {
    reloadSubjects();
  }, [reloadSubjects]);

  useEffect(() => {
    if (existingSubjects?.length > 0 && subjects.length === 0) {
      setSubjects(existingSubjects.map(s => ({
        name: s.name,
        difficulty: s.difficulty,
        priority: s.priority || 2,
        estimatedMinutes: s.estimatedMinutes || 50,
        examDate: s.examDate || deadline
      })));
    }
  }, [existingSubjects, deadline, subjects.length]);

  const nextStep = async () => {
    if (step === 1) {
      if (!name.trim()) return showToast("Please enter your name", true);
      if (!deadline) return showToast("Please select a final exam deadline", true);
      setStep(2);
    } else if (step === 2) {
      if (subjects.length === 0) return showToast("Please add at least one subject", true);
      setStep(3);
    } else {
      setIsSubmitting(true);
      try {
        await completeOnboarding({ name, deadline, subjects, slots });
      } catch (err) {
        setIsSubmitting(false);
        showError("Submission Failed", err.message || "Something went wrong while saving your plan.");
      }
    }
  };

  const saveSubject = () => {
    if (!newSub.name.trim()) return showToast("Subject name is required", true);
    
    const isDuplicate = subjects.some((s, idx) => 
      s.name.toLowerCase() === newSub.name.toLowerCase() && idx !== editingIndex
    );

    if (isDuplicate) {
      return showToast(`"${newSub.name}" is already in your list`, true);
    }

    if (editingIndex !== null) {
      const updated = [...subjects];
      updated[editingIndex] = { ...newSub };
      setSubjects(updated);
    } else {
      setSubjects([...subjects, { 
        ...newSub,
        examDate: newSub.examDate || deadline || new Date().toISOString().split('T')[0]
      }]);
    }
    
    setNewSub({ name: '', difficulty: 5, priority: 2, estimatedMinutes: 50, examDate: '' });
    setEditingIndex(null);
    setShowAddSubjectModal(false);
  };

  const editSubject = (index) => {
    setEditingIndex(index);
    setNewSub({ ...subjects[index] });
    setShowAddSubjectModal(true);
  };

  const removeSubject = (index) => {
    setSubjects(subjects.filter((_, i) => i !== index));
  };

  const saveSlot = () => {
    if (editingSlotIndex !== null) {
      const updated = [...slots];
      updated[editingSlotIndex] = { ...newSlot };
      setSlots(updated);
    } else {
      setSlots([...slots, { ...newSlot }]);
    }
    setShowAddSlotModal(false);
    setEditingSlotIndex(null);
  };

  const editSlot = (index) => {
    setEditingSlotIndex(index);
    setNewSlot({ ...slots[index] });
    setShowAddSlotModal(true);
  };

  const removeSlot = (index) => {
    setSlots(slots.filter((_, i) => i !== index));
  };

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.title, { color: colors.textDark, fontFamily: fonts.bold }]}>Academic Setup 🎓</Text>
      <Text style={[styles.subtitle, { color: colors.textLight, fontFamily: fonts.medium }]}>The AI Advisor uses these metrics to balance your study-life ratio.</Text>
      
      <View style={[styles.inputGroup, { backgroundColor: colors.cardAlt, borderColor: colors.border, borderWidth: 0 }]}>
        <View style={styles.inputHeader}>
           <Ionicons name="person-circle-outline" size={20} color={colors.primary} />
           <Text style={[styles.label, { color: colors.textLight, fontFamily: fonts.bold }]}>DISPLAY NAME</Text>
        </View>
        <TextInput 
          style={[styles.input, { color: colors.textDark, fontFamily: fonts.bold, outlineStyle: 'none' }]} 
          value={name}
          onChangeText={setName}
          placeholder="Enter your full name"
          placeholderTextColor={colors.textLight}
        />
      </View>

      <View style={[styles.inputGroup, { backgroundColor: colors.cardAlt, borderColor: colors.border, borderWidth: 0 }]}>
        <View style={styles.inputHeader}>
           <Ionicons name="calendar-outline" size={20} color={colors.accent.exam} />
           <Text style={[styles.label, { color: colors.textLight, fontFamily: fonts.bold }]}>FINAL EXAM DEADLINE</Text>
        </View>
        {Platform.OS === 'web' ? (
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            style={{
              fontSize: 20,
              fontFamily: 'Outfit_700Bold',
              color: colors.textDark,
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
              width: '100%',
              boxSizing: 'border-box',
              paddingLeft: 10,
              marginTop: 5,
              cursor: 'pointer'
            }}
          />
        ) : (
          <TextInput 
            style={[styles.input, { color: colors.textDark, fontFamily: fonts.bold, outlineStyle: 'none' }]} 
            value={deadline}
            onChangeText={setDeadline}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textLight}
          />
        )}
      </View>

      <View style={[styles.metaInfo, { backgroundColor: 'rgba(107, 92, 231, 0.05)', borderColor: colors.primaryLight, borderWidth: 1, marginTop: 20 }]}>
         <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
         <Text style={[styles.metaInfoText, { color: colors.textDark, fontFamily: fonts.medium }]}>
           We've removed the GPA and hours tracking to focus entirely on your availability and subject difficulty.
         </Text>
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.title, { color: colors.textDark, fontFamily: fonts.bold }]}>Subject Inventory 📚</Text>
      <Text style={[styles.subtitle, { color: colors.textLight, fontFamily: fonts.medium }]}>List the subjects you need the AI to organize for you.</Text>
      
      <ScrollView style={{ maxHeight: SCREEN_WIDTH * 1.1 }} showsVerticalScrollIndicator={false}>
        {subjects.length === 0 ? (
          <View style={{ alignItems: 'center', marginTop: 40, opacity: 0.5 }}>
             <MaterialCommunityIcons name="book-open-page-variant-outline" size={60} color={colors.textLight} />
             <Text style={{ fontFamily: fonts.medium, color: colors.textLight, marginTop: 10 }}>No subjects added yet.</Text>
          </View>
        ) : subjects.map((sub, idx) => (
          <Animated.View 
            key={idx} 
            entering={FadeInDown.delay(idx * 50)} 
            layout={Layout.springify()}
            style={[styles.subjectCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
             <View style={styles.subHeader}>
                <View style={styles.subIconRow}>
                   <MaterialCommunityIcons name="book-outline" size={20} color={colors.primary} />
                   <Text style={[styles.subName, { color: colors.textDark, fontFamily: fonts.bold }]}>{sub.name}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                   <TouchableOpacity onPress={() => editSubject(idx)} style={{ padding: 5 }}>
                      <Ionicons name="pencil" size={18} color={colors.textLight} />
                   </TouchableOpacity>
                   <TouchableOpacity onPress={() => removeSubject(idx)} style={{ padding: 5 }}>
                      <Ionicons name="trash-outline" size={18} color="#FF5252" />
                   </TouchableOpacity>
                </View>
             </View>

             <View style={styles.cardSettingsRow}>
                <View style={[styles.tag, { backgroundColor: colors.cardAlt }]}>
                   <Text style={[styles.tagText, { color: colors.textLight, fontFamily: fonts.bold }]}>{PRIORITY_LABELS[sub.priority]}</Text>
                </View>
                <View style={[styles.tag, { backgroundColor: colors.cardAlt }]}>
                   <Text style={[styles.tagText, { color: colors.textLight, fontFamily: fonts.bold }]}>{sub.estimatedMinutes}m</Text>
                </View>
                <View style={[styles.tag, { backgroundColor: colors.cardAlt }]}>
                   <Text style={[styles.tagText, { color: colors.textLight, fontFamily: fonts.bold }]}>Diff: {sub.difficulty}</Text>
                </View>
                <View style={[styles.tag, { backgroundColor: 'rgba(107, 92, 231, 0.1)', flex: 1 }]}>
                   <Ionicons name="calendar" size={10} color={colors.primary} style={{ marginRight: 4 }} />
                   <Text style={[styles.tagText, { color: colors.primary, fontFamily: fonts.bold }]}>{sub.examDate}</Text>
                </View>
             </View>
          </Animated.View>
        ))}
      </ScrollView>

      <TouchableOpacity 
         style={styles.fabContainer} 
         onPress={() => {
           setNewSub({ name: '', difficulty: 5, priority: 2, estimatedMinutes: 50, examDate: deadline || '' });
           setEditingIndex(null);
           setShowAddSubjectModal(true);
         }}
      >
         <LinearGradient
            colors={[colors.primary, '#8575F3']}
            style={styles.fab}
         >
            <Ionicons name="add" size={32} color="#FFF" />
         </LinearGradient>
         <Text style={[styles.fabText, { color: colors.primary, fontFamily: fonts.bold }]}>ADD SUBJECT</Text>
      </TouchableOpacity>

      <Modal visible={showAddSubjectModal} transparent animationType="fade">
         <View style={styles.modalOverlay}>
            <Animated.View 
              entering={FadeInDown.springify()} 
              style={[styles.modalContent, { backgroundColor: colors.surface }]}
            >
               <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>
                     {editingIndex !== null ? 'Edit Subject' : 'New Subject'}
                  </Text>
                  <TouchableOpacity onPress={() => { setShowAddSubjectModal(false); setEditingIndex(null); }}>
                     <Ionicons name="close" size={24} color={colors.textLight} />
                  </TouchableOpacity>
               </View>

               <Text style={[styles.miniLabel, { color: colors.textLight, fontFamily: fonts.bold }]}>SUBJECT NAME</Text>
               <View style={[styles.modalInputBox, { backgroundColor: colors.cardAlt }]}>
                  <TextInput 
                     style={[styles.modalInput, { color: colors.textDark, fontFamily: fonts.bold, outlineStyle: 'none' }]} 
                     placeholder="e.g. Organic Chemistry"
                     placeholderTextColor={colors.textLight}
                     value={newSub.name}
                     onChangeText={(v) => setNewSub({ ...newSub, name: v })}
                  />
               </View>

               <View style={styles.modalRow}>
                  <View style={{ flex: 1 }}>
                     <Text style={[styles.miniLabel, { color: colors.textLight, fontFamily: fonts.bold }]}>PRIORITY</Text>
                     <View style={styles.priorityGrid}>
                        {[1, 2, 3].map(p => (
                           <TouchableOpacity 
                              key={p} 
                              onPress={() => setNewSub({ ...newSub, priority: p })}
                              style={[styles.prioSelect, { 
                                 borderColor: newSub.priority === p ? PRIORITY_COLORS[p] : colors.border,
                                 backgroundColor: newSub.priority === p ? PRIORITY_COLORS[p] + '15' : 'transparent'
                              }]}
                           >
                              <Text style={{ color: newSub.priority === p ? PRIORITY_COLORS[p] : colors.textLight, fontFamily: fonts.bold, fontSize: 12 }}>{PRIORITY_LABELS[p]}</Text>
                           </TouchableOpacity>
                        ))}
                     </View>
                  </View>
               </View>

               <View style={styles.modalRow}>
                  <View style={{ flex: 1 }}>
                     <Text style={[styles.miniLabel, { color: colors.textLight, fontFamily: fonts.bold }]}>ESTIMATED MINUTES</Text>
                     <TextInput 
                        style={[styles.modalInputBox, { backgroundColor: colors.cardAlt, color: colors.textDark, fontFamily: fonts.bold, height: 50, paddingHorizontal: 15, outlineStyle: 'none' }]} 
                        keyboardType="numeric"
                        value={String(newSub.estimatedMinutes)}
                        onChangeText={(v) => setNewSub({ ...newSub, estimatedMinutes: parseInt(v) || 0 })}
                     />
                  </View>
                  <View style={{ flex: 1, marginLeft: 15 }}>
                     <Text style={[styles.miniLabel, { color: colors.textLight, fontFamily: fonts.bold }]}>EXAM DATE</Text>
                     <View style={[styles.modalInputBox, { backgroundColor: colors.cardAlt, height: 50, justifyContent: 'center' }]}>
                        {Platform.OS === 'web' ? (
                          <input
                             type="date"
                             value={newSub.examDate}
                             onChange={(e) => setNewSub({ ...newSub, examDate: e.target.value })}
                             style={{
                                fontSize: 14,
                                fontFamily: 'Outfit_700Bold',
                                color: colors.textDark,
                                backgroundColor: 'transparent',
                                border: 'none',
                                outline: 'none',
                                width: '100%',
                                paddingLeft: 10
                             }}
                          />
                        ) : (
                          <TextInput 
                             style={{ color: colors.textDark, fontFamily: fonts.bold, paddingLeft: 10, outlineStyle: 'none' }} 
                             value={newSub.examDate}
                             onChangeText={(v) => setNewSub({ ...newSub, examDate: v })}
                             placeholder="YYYY-MM-DD"
                          />
                        )}
                     </View>
                  </View>
               </View>

               <Text style={[styles.miniLabel, { color: colors.textLight, fontFamily: fonts.bold, marginTop: 15 }]}>DIFFICULTY: {newSub.difficulty}/10</Text>
               <View style={styles.diffBarRow}>
                  {[...Array(10)].map((_, i) => (
                    <TouchableOpacity 
                      key={i} 
                      style={[styles.diffBit, { backgroundColor: newSub.difficulty > i ? colors.primary : colors.cardAlt }]} 
                      onPress={() => setNewSub({ ...newSub, difficulty: i + 1 })}
                    />
                  ))}
               </View>

               <TouchableOpacity style={[styles.mainBtn, { marginTop: 30, backgroundColor: colors.primary }]} onPress={saveSubject}>
                  <Text style={{ color: '#FFF', fontFamily: fonts.bold }}>{editingIndex !== null ? 'UPDATE SUBJECT' : 'ADD SUBJECT'}</Text>
               </TouchableOpacity>
            </Animated.View>
         </View>
      </Modal>
    </View>
  );

  const hours = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);

  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.title, { color: colors.textDark, fontFamily: fonts.bold }]}>Today's Availability 🕒</Text>
      <Text style={[styles.subtitle, { color: colors.textLight, fontFamily: fonts.medium }]}>Tell the AI when you are free to study TODAY.</Text>
      
      <ScrollView style={{ maxHeight: SCREEN_WIDTH * 0.9 }} showsVerticalScrollIndicator={false}>
        {slots.map((slot, idx) => (
          <Animated.View 
            key={idx} 
            entering={FadeInDown.delay(idx * 50)} 
            layout={Layout.springify()}
            style={[styles.subjectCard, { backgroundColor: colors.surface, borderColor: colors.border, padding: 15 }]}
          >
             <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                   <Ionicons name="time-outline" size={20} color={colors.primary} />
                   <Text style={[styles.subName, { color: colors.textDark, fontFamily: fonts.bold }]}>Session {idx + 1}</Text>
                </View>
                
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                   <Text style={{ color: colors.textDark, fontFamily: fonts.bold, fontSize: 14 }}>{slot.startTime} - {slot.endTime}</Text>
                   <View style={{ flexDirection: 'row', gap: 5 }}>
                      <TouchableOpacity onPress={() => editSlot(idx)} style={{ padding: 5 }}>
                         <Ionicons name="pencil" size={18} color={colors.textLight} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => removeSlot(idx)} style={{ padding: 5 }}>
                         <Ionicons name="trash-outline" size={18} color="#FF5252" />
                      </TouchableOpacity>
                   </View>
                </View>
             </View>
          </Animated.View>
        ))}
      </ScrollView>

      <TouchableOpacity 
         style={styles.fabContainer} 
         onPress={() => {
           setNewSlot({ startTime: '17:00', endTime: '18:00' });
           setEditingSlotIndex(null);
           setShowAddSlotModal(true);
         }}
      >
         <LinearGradient
            colors={[colors.primary, '#8575F3']}
            style={styles.fab}
         >
            <Ionicons name="add" size={32} color="#FFF" />
         </LinearGradient>
         <Text style={[styles.fabText, { color: colors.primary, fontFamily: fonts.bold }]}>ADD TIME BLOCK</Text>
      </TouchableOpacity>

      <Modal visible={showAddSlotModal} transparent animationType="fade">
         <View style={styles.modalOverlay}>
            <Animated.View 
              entering={FadeInDown.springify()} 
              style={[styles.modalContent, { backgroundColor: colors.surface }]}
            >
               <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>
                     {editingSlotIndex !== null ? 'Edit Time Block' : 'New Time Block'}
                  </Text>
                  <TouchableOpacity onPress={() => { setShowAddSlotModal(false); setEditingSlotIndex(null); }}>
                     <Ionicons name="close" size={24} color={colors.textLight} />
                  </TouchableOpacity>
               </View>

               <View style={styles.modalRow}>
                  <View style={{ flex: 1 }}>
                     <Text style={[styles.miniLabel, { color: colors.textLight, fontFamily: fonts.bold }]}>START TIME</Text>
                     <TouchableOpacity 
                        style={[styles.modalInputBox, { backgroundColor: colors.cardAlt }]}
                        onPress={() => { setActiveSlotField('startTime'); setShowHourPicker(true); }}
                     >
                        <Text style={{ color: colors.textDark, fontFamily: fonts.bold }}>{newSlot.startTime}</Text>
                     </TouchableOpacity>
                  </View>
                  <View style={{ flex: 1, marginLeft: 15 }}>
                     <Text style={[styles.miniLabel, { color: colors.textLight, fontFamily: fonts.bold }]}>END TIME</Text>
                     <TouchableOpacity 
                        style={[styles.modalInputBox, { backgroundColor: colors.cardAlt }]}
                        onPress={() => { setActiveSlotField('endTime'); setShowHourPicker(true); }}
                     >
                        <Text style={{ color: colors.textDark, fontFamily: fonts.bold }}>{newSlot.endTime}</Text>
                     </TouchableOpacity>
                  </View>
               </View>

               <TouchableOpacity style={[styles.mainBtn, { marginTop: 10, backgroundColor: colors.primary }]} onPress={saveSlot}>
                  <Text style={{ color: '#FFF', fontFamily: fonts.bold }}>{editingSlotIndex !== null ? 'UPDATE BLOCK' : 'ADD BLOCK'}</Text>
               </TouchableOpacity>
            </Animated.View>
         </View>
      </Modal>

      <Modal visible={showHourPicker} transparent animationType="fade">
         <View style={styles.modalOverlay}>
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
                        <Text style={{ fontFamily: fonts.medium, fontSize: 16 }}>{h}</Text>
                     </TouchableOpacity>
                  ))}
               </ScrollView>
               <TouchableOpacity 
                  style={{ marginTop: 15, padding: 15, backgroundColor: colors.border, borderRadius: 10, alignItems: 'center' }}
                  onPress={() => setShowHourPicker(false)}
               >
                  <Text style={{ fontFamily: fonts.bold }}>Cancel</Text>
               </TouchableOpacity>
            </View>
         </View>
      </Modal>
    </View>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.topBar}>
         <View style={styles.progLineBg}>
            <View style={[styles.progLineFill, { backgroundColor: colors.primary, width: `${(step / 3) * 100}%` }]} />
         </View>
         <Text style={[styles.stepLabel, { color: colors.textLight, fontFamily: fonts.bold }]}>PHASE 0{step}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
         {step === 1 && renderStep1()}
         {step === 2 && renderStep2()}
         {step === 3 && renderStep3()}
      </ScrollView>

      <View style={styles.bottomActions}>
         {step > 1 && (
           <TouchableOpacity style={[styles.navBtn, { borderColor: colors.border, borderWidth: 1 }]} onPress={() => setStep(step - 1)}>
             <Text style={[styles.navBtnText, { color: colors.textLight, fontFamily: fonts.bold }]}>Back</Text>
           </TouchableOpacity>
         )}
         <TouchableOpacity style={[styles.mainBtn, { flex: 1, backgroundColor: colors.primary }]} onPress={nextStep} disabled={isSubmitting}>
            <Text style={[styles.mainBtnText, { color: '#FFF', fontFamily: fonts.bold }]}>
               {step === 3 ? (isSubmitting ? 'GENERATING...' : 'START MY PLAN') : 'CONTINUE'}
            </Text>
            {!isSubmitting && <Ionicons name="chevron-forward" size={20} color="#FFF" />}
         </TouchableOpacity>
      </View>

      <Modal visible={isSubmitting} transparent>
         <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
            <LinearGradient colors={[colors.primary, '#8575F3']} style={styles.pulseCircle}>
               <MaterialCommunityIcons name="brain" size={60} color="#FFF" />
            </LinearGradient>
            <Text style={[styles.title, { color: colors.textDark, fontFamily: fonts.bold, marginTop: 40, textAlign: 'center' }]}>Crafting Your AI Plan</Text>
            <Text style={[styles.subtitle, { color: colors.textLight, fontFamily: fonts.medium, textAlign: 'center' }]}>The AI Advisor is analyzing your data to create the optimal study flow...</Text>
         </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 25, paddingTop: 60 },
  topBar: { marginBottom: 40 },
  progLineBg: { height: 4, width: '100%', backgroundColor: '#F0F0FF', borderRadius: 2, marginBottom: 15 },
  progLineFill: { height: '100%', borderRadius: 2 },
  stepLabel: { fontSize: 11, letterSpacing: 2 },
  stepContainer: { flex: 1 },
  title: { fontSize: 30, marginBottom: 12 },
  subtitle: { fontSize: 16, lineHeight: 24, marginBottom: 40, opacity: 0.8 },
  inputGroup: { padding: 20, borderRadius: 24, marginBottom: 20 },
  inputHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  label: { fontSize: 12, letterSpacing: 1 },
  input: { fontSize: 20, paddingLeft: 30 },
  subjectCard: { padding: 22, borderRadius: 24, borderWidth: 1, marginBottom: 18, elevation: 2, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 10 },
  subHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  subIconRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  subName: { fontSize: 18 },
  cardSettingsRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  tag: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, flexDirection: 'row', alignItems: 'center' },
  tagText: { fontSize: 10 },
  fabContainer: { alignItems: 'center', marginVertical: 30 },
  fab: { width: 66, height: 66, borderRadius: 33, justifyContent: 'center', alignItems: 'center', marginBottom: 12, elevation: 10, shadowColor: '#6B5CE7', shadowOpacity: 0.4, shadowRadius: 15 },
  fabText: { fontSize: 12, letterSpacing: 1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '90%', maxWidth: 500, padding: 25, borderRadius: 32, elevation: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  modalTitle: { fontSize: 22 },
  miniLabel: { fontSize: 10, letterSpacing: 1, marginBottom: 10, opacity: 0.7 },
  modalInputBox: { height: 60, borderRadius: 18, paddingHorizontal: 20, marginBottom: 20, justifyContent: 'center' },
  modalInput: { fontSize: 16, width: '100%', outlineStyle: 'none' },
  modalRow: { flexDirection: 'row', marginBottom: 20 },
  priorityGrid: { flexDirection: 'row', gap: 10 },
  prioSelect: { flex: 1, height: 40, borderRadius: 12, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  diffBarRow: { flexDirection: 'row', gap: 5, marginTop: 10 },
  diffBit: { flex: 1, height: 8, borderRadius: 4 },
  timeBtn: { height: 40, width: 70, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  bottomActions: { flexDirection: 'row', gap: 15, paddingBottom: 40, paddingTop: 20 },
  navBtn: { height: 64, width: 100, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  navBtnText: { fontSize: 16 },
  mainBtn: { height: 64, borderRadius: 20, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, elevation: 8, shadowColor: '#6B5CE7', shadowOpacity: 0.3, shadowRadius: 15 },
  mainBtnText: { fontSize: 16, letterSpacing: 1 },
  pulseCircle: { width: 140, height: 140, borderRadius: 70, justifyContent: 'center', alignItems: 'center', elevation: 15, shadowColor: '#6B5CE7', shadowOpacity: 0.4, shadowRadius: 20 },
  metaInfo: { flexDirection: 'row', gap: 18, padding: 25, borderRadius: 28, marginTop: 50 },
  metaInfoText: { flex: 1, fontSize: 13, lineHeight: 20, opacity: 0.8 }
});
