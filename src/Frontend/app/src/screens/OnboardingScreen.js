import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Dimensions, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { useTheme } from '../theme/theme';
import { useAI } from '../context/ai_context';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const OnboardingScreen = () => {
  const { colors, fonts } = useTheme();
  const { completeOnboarding } = useAI();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Step 1: Goal & Constraints
  const [name, setName] = useState('Ibrahim Hilvani');
  const [deadline, setDeadline] = useState('2026-06-15');

  // Step 2: Subjects
  const [subjects, setSubjects] = useState([
    { name: 'Mathematics', difficulty: 8, examDate: '2026-06-10' },
    { name: 'Physics', difficulty: 7, examDate: '2026-06-12' }
  ]);
  const [newSub, setNewSub] = useState('');

  // Step 3: Slots (Focusing only on Today)
  const [slots, setSlots] = useState([
    { startTime: '17:00', endTime: '19:00' },
    { startTime: '20:00', endTime: '22:00' },
  ]);

  const nextStep = async () => {
    if (step < 3) setStep(step + 1);
    else {
      setIsSubmitting(true);
      try {
        // Send slots for today (dayOfWeek is ignored, backend will use today's date)
        await completeOnboarding({ name, deadline, subjects, slots });
      } catch (err) {
        setIsSubmitting(false);
      }
    }
  };

  const addSubject = () => {
    if (newSub.trim()) {
      setSubjects([...subjects, { name: newSub, difficulty: 5, examDate: '2026-06-20' }]);
      setNewSub('');
    }
  };

  const updateSub = (index, field, val) => {
    const updated = [...subjects];
    updated[index][field] = val;
    setSubjects(updated);
  };

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.title, { color: colors.textDark, fontFamily: fonts.bold }]}>Academic Setup 🎓</Text>
      <Text style={[styles.subtitle, { color: colors.textLight, fontFamily: fonts.medium }]}>The AI Advisor uses these metrics to balance your study-life ratio.</Text>
      
      <View style={[styles.inputGroup, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
        <View style={styles.inputHeader}>
           <Ionicons name="person-circle-outline" size={20} color={colors.primary} />
           <Text style={[styles.label, { color: colors.textLight, fontFamily: fonts.bold }]}>DISPLAY NAME</Text>
        </View>
        <TextInput 
          style={[styles.input, { color: colors.textDark, fontFamily: fonts.bold }]} 
          value={name}
          onChangeText={setName}
          placeholder="Ibrahim"
        />
      </View>

      <View style={[styles.inputGroup, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
        <View style={styles.inputHeader}>
           <Ionicons name="calendar-outline" size={20} color={colors.accent.exam} />
           <Text style={[styles.label, { color: colors.textLight, fontFamily: fonts.bold }]}>FINAL EXAM DEADLINE</Text>
        </View>
        <TextInput 
          style={[styles.input, { color: colors.textDark, fontFamily: fonts.bold }]} 
          value={deadline}
          onChangeText={setDeadline}
          placeholder="YYYY-MM-DD"
        />
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
      <Text style={[styles.subtitle, { color: colors.textLight, fontFamily: fonts.medium }]}>Initial difficulty levels help the AI bypass the cold-start phase faster.</Text>
      
      <ScrollView style={{ maxHeight: SCREEN_WIDTH * 0.9 }} showsVerticalScrollIndicator={false}>
        {subjects.map((sub, idx) => (
          <View key={idx} style={[styles.subjectCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
             <View style={styles.subHeader}>
                <View style={styles.subIconRow}>
                   <MaterialCommunityIcons name="book-outline" size={20} color={colors.primary} />
                   <Text style={[styles.subName, { color: colors.textDark, fontFamily: fonts.bold }]}>{sub.name}</Text>
                </View>
                <TextInput 
                   style={[styles.dateSmall, { color: colors.textLight, fontFamily: fonts.bold }]} 
                   value={sub.examDate}
                   onChangeText={(v) => updateSub(idx, 'examDate', v)}
                />
             </View>
             <View style={styles.difficultyLevel}>
                <Text style={[styles.diffLab, { color: colors.textLight, fontFamily: fonts.semiBold }]}>DIFFICULTY: {sub.difficulty}/10</Text>
                <View style={styles.diffBarRow}>
                   {[...Array(10)].map((_, i) => (
                     <TouchableOpacity 
                       key={i} 
                       style={[styles.diffBit, { backgroundColor: sub.difficulty > i ? colors.primary : colors.cardAlt }]} 
                       onPress={() => updateSub(idx, 'difficulty', i + 1)}
                     />
                   ))}
                </View>
             </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.addSubjectBox}>
         <TextInput 
            style={[styles.addInput, { backgroundColor: colors.cardAlt, color: colors.textDark, fontFamily: fonts.bold }]} 
            placeholder="Add new subject..."
            value={newSub}
            onChangeText={setNewSub}
         />
         <TouchableOpacity style={[styles.addButton, { backgroundColor: colors.primary }]} onPress={addSubject}>
            <Ionicons name="add" size={28} color="#FFF" />
         </TouchableOpacity>
      </View>
    </View>
  );

  const [showPicker, setShowPicker] = useState(false);
  const [activeSlot, setActiveSlot] = useState(null); // { idx, field: 'startTime' | 'endTime' }

  const hours = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);

  const renderStep3 = () => {
    return (
      <View style={styles.stepContainer}>
        <Text style={[styles.title, { color: colors.textDark, fontFamily: fonts.bold }]}>Today's Availability 🕒</Text>
        <Text style={[styles.subtitle, { color: colors.textLight, fontFamily: fonts.medium }]}>Tell the AI when you are free to study TODAY. You can add multiple time blocks.</Text>
        
        <ScrollView style={{ maxHeight: SCREEN_WIDTH * 0.9 }} showsVerticalScrollIndicator={false}>
          {slots.map((slot, idx) => (
            <View key={idx} style={[styles.subjectCard, { backgroundColor: colors.surface, borderColor: colors.border, padding: 15 }]}>
               <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                     <Ionicons name="time-outline" size={20} color={colors.primary} />
                     <Text style={[styles.subName, { color: colors.textDark, fontFamily: fonts.bold }]}>Session {idx + 1}</Text>
                  </View>
                  
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                     <TouchableOpacity 
                        style={[styles.addInput, { width: 70, height: 40, justifyContent: 'center', alignItems: 'center' }]}
                        onPress={() => { setActiveSlot({ idx, field: 'startTime' }); setShowPicker(true); }}
                     >
                        <Text style={{ fontFamily: fonts.bold, fontSize: 13 }}>{slot.startTime}</Text>
                     </TouchableOpacity>
                     
                     <Text style={{ color: colors.textLight }}>-</Text>
                     
                     <TouchableOpacity 
                        style={[styles.addInput, { width: 70, height: 40, justifyContent: 'center', alignItems: 'center' }]}
                        onPress={() => { setActiveSlot({ idx, field: 'endTime' }); setShowPicker(true); }}
                     >
                        <Text style={{ fontFamily: fonts.bold, fontSize: 13 }}>{slot.endTime}</Text>
                     </TouchableOpacity>

                     <TouchableOpacity 
                        onPress={() => setSlots(slots.filter((_, i) => i !== idx))}
                        style={{ marginLeft: 10, padding: 5 }}
                     >
                        <Ionicons name="trash-outline" size={20} color="#FF5252" />
                     </TouchableOpacity>
                  </View>
               </View>
            </View>
          ))}
        </ScrollView>

        <TouchableOpacity 
          style={[styles.addButton, { width: '100%', height: 50, marginTop: 10, flexDirection: 'row', gap: 10 }]} 
          onPress={() => setSlots([...slots, { startTime: '17:00', endTime: '18:00' }])}
        >
          <Ionicons name="add" size={20} color="#FFF" />
          <Text style={{ color: '#FFF', fontFamily: fonts.bold }}>ADD TIME BLOCK</Text>
        </TouchableOpacity>

        {/* Custom Hour Picker Modal */}
        <Modal visible={showPicker} transparent animationType="fade">
           <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
              <View style={{ backgroundColor: colors.surface, width: '80%', borderRadius: 20, padding: 20, maxHeight: '60%' }}>
                 <Text style={{ fontFamily: fonts.bold, fontSize: 18, marginBottom: 15, textAlign: 'center' }}>Select Hour</Text>
                 <ScrollView>
                    {hours.map(h => (
                       <TouchableOpacity 
                          key={h} 
                          style={{ paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: colors.border, alignItems: 'center' }}
                          onPress={() => {
                             const newSlots = [...slots];
                             newSlots[activeSlot.idx][activeSlot.field] = h;
                             setSlots(newSlots);
                             setShowPicker(false);
                          }}
                       >
                          <Text style={{ fontFamily: fonts.medium, fontSize: 16 }}>{h}</Text>
                       </TouchableOpacity>
                    ))}
                 </ScrollView>
                 <TouchableOpacity 
                    style={{ marginTop: 15, padding: 15, backgroundColor: colors.border, borderRadius: 10, alignItems: 'center' }}
                    onPress={() => setShowPicker(false)}
                 >
                    <Text style={{ fontFamily: fonts.bold }}>Cancel</Text>
                 </TouchableOpacity>
              </View>
           </View>
        </Modal>
      </View>
    );
  };

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
         <TouchableOpacity style={[styles.mainBtn, { backgroundColor: colors.primary }]} onPress={nextStep} disabled={isSubmitting}>
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
            <Text style={[styles.subtitle, { color: colors.textLight, fontFamily: fonts.medium, textAlign: 'center' }]}>The AI Advisor is analyzing your subjects and availability to create the optimal study flow...</Text>
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
  label: { fontSize: 10, letterSpacing: 1 },
  input: { fontSize: 18, paddingLeft: 30 },
  splitRow: { flexDirection: 'row', gap: 15 },
  subjectCard: { padding: 22, borderRadius: 24, borderWidth: 1, marginBottom: 18, elevation: 2, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 10 },
  subHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  subIconRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  subName: { fontSize: 18 },
  dateSmall: { fontSize: 12, opacity: 0.5 },
  difficultyLevel: { gap: 12 },
  diffLab: { fontSize: 11, letterSpacing: 0.5 },
  diffBarRow: { flexDirection: 'row', gap: 5 },
  diffBit: { flex: 1, height: 6, borderRadius: 3 },
  addSubjectBox: { flexDirection: 'row', gap: 12, marginTop: 25, paddingBottom: 30 },
  addInput: { flex: 1, height: 60, borderRadius: 18, paddingHorizontal: 20, fontSize: 15 },
  addButton: { width: 60, height: 60, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  pulseContainer: { alignItems: 'center', marginTop: 40, gap: 20 },
  pulseCircle: { width: 140, height: 140, borderRadius: 70, justifyContent: 'center', alignItems: 'center', elevation: 15, shadowColor: '#6B5CE7', shadowOpacity: 0.4, shadowRadius: 20 },
  pulseText: { fontSize: 13, letterSpacing: 2 },
  metaInfo: { flexDirection: 'row', gap: 18, padding: 25, borderRadius: 28, marginTop: 50 },
  metaInfoText: { flex: 1, fontSize: 13, lineHeight: 20, opacity: 0.8 },
  bottomActions: { flexDirection: 'row', gap: 15, paddingBottom: 40, paddingTop: 20 },
  navBtn: { height: 64, width: 100, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  navBtnText: { fontSize: 16 },
  mainBtn: { flex: 1, height: 64, borderRadius: 20, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, elevation: 8, shadowColor: '#6B5CE7', shadowOpacity: 0.3, shadowRadius: 15 },
  mainBtnText: { fontSize: 16, letterSpacing: 1 }
});
