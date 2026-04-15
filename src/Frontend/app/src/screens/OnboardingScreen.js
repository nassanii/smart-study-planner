import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Dimensions, KeyboardAvoidingView, Platform } from 'react-native';
import { useTheme } from '../theme/theme';
import { useAI } from '../context/ai_context';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const OnboardingScreen = () => {
  const { colors, fonts } = useTheme();
  const { completeOnboarding } = useAI();
  const [step, setStep] = useState(1);
  
  // Step 1: Goal & Constraints
  const [name, setName] = useState('Ibrahim Hilvani');
  const [targetGPA, setTargetGPA] = useState('3.8');
  const [maxHours, setMaxHours] = useState('6');
  const [deadline, setDeadline] = useState('2026-06-15');

  // Step 2: Subjects
  const [subjects, setSubjects] = useState([
    { name: 'Mathematics', difficulty: 8, examDate: '2026-06-10' },
    { name: 'Physics', difficulty: 7, examDate: '2026-06-12' }
  ]);
  const [newSub, setNewSub] = useState('');

  const nextStep = () => {
    if (step < 3) setStep(step + 1);
    else completeOnboarding({ name, targetGPA, maxHours, deadline, subjects });
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

      <View style={styles.splitRow}>
        <View style={[styles.inputGroup, { flex: 1, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
          <View style={styles.inputHeader}>
             <Ionicons name="trophy-outline" size={18} color="#FFD166" />
             <Text style={[styles.label, { color: colors.textLight, fontFamily: fonts.bold }]}>TARGET GPA</Text>
          </View>
          <TextInput 
            style={[styles.input, { color: colors.textDark, fontFamily: fonts.bold }]} 
            value={targetGPA}
            onChangeText={setTargetGPA}
            keyboardType="decimal-pad"
          />
        </View>
        <View style={[styles.inputGroup, { flex: 1, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
          <View style={styles.inputHeader}>
             <Ionicons name="time-outline" size={18} color={colors.accent.science} />
             <Text style={[styles.label, { color: colors.textLight, fontFamily: fonts.bold }]}>MAX HRS/DAY</Text>
          </View>
          <TextInput 
            style={[styles.input, { color: colors.textDark, fontFamily: fonts.bold }]} 
            value={maxHours}
            onChangeText={setMaxHours}
            keyboardType="numeric"
          />
        </View>
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

  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.title, { color: colors.textDark, fontFamily: fonts.bold }]}>AI Initialization ⚡</Text>
      <Text style={[styles.subtitle, { color: colors.textLight, fontFamily: fonts.medium }]}>We're calibrating the Heuristic Engine with your constraints.</Text>
      
      <View style={styles.pulseContainer}>
         <LinearGradient colors={[colors.primary, '#A29BFE']} style={styles.pulseCircle}>
            <MaterialCommunityIcons name="brain" size={60} color="#FFF" />
         </LinearGradient>
         <Text style={[styles.pulseText, { color: colors.primary, fontFamily: fonts.bold }]}>MODELS CALIBRATING</Text>
      </View>

      <View style={[styles.metaInfo, { backgroundColor: 'rgba(107, 92, 231, 0.05)', borderColor: colors.primaryLight, borderWidth: 1 }]}>
         <Ionicons name="shield-checkmark" size={24} color={colors.primary} />
         <Text style={[styles.metaInfoText, { color: colors.textDark, fontFamily: fonts.medium }]}>
           Your privacy is ensured. All focus data is used locally to refine your personalized ML parameters over the next 40 tasks.
         </Text>
      </View>
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
         <TouchableOpacity style={[styles.mainBtn, { backgroundColor: colors.primary }]} onPress={nextStep}>
            <Text style={[styles.mainBtnText, { color: '#FFF', fontFamily: fonts.bold }]}>
               {step === 3 ? 'INITIATE PLAN' : 'CONTINUE'}
            </Text>
            <Ionicons name="chevron-forward" size={20} color="#FFF" />
         </TouchableOpacity>
      </View>
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
