import { extractErrorMessage } from '../services/errors';
import React, { useState, useEffect } from 'react';
import { DatePickerModal } from '../components/DatePickerModal';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Dimensions, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { useTheme } from '../theme/theme';
import { useAI } from '../context/ai_context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { showError, showToast } from '../services/dialogs';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const OnboardingScreen = () => {
  const { colors, fonts } = useTheme();
  const { completeOnboarding, userData } = useAI();
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Step 1 (display name + global deadline) is skipped — name comes from registration,
  // deadline is derived from the course's final/midterm date.
  const [step, setStep] = useState(2);

  const [name, setName] = useState(userData?.name || '');
  const [deadline, setDeadline] = useState(userData?.deadline || '');
  const [courseName, setCourseName] = useState('');
  const [courseDifficulty, setCourseDifficulty] = useState(5);
  const [coursePriority, setCoursePriority] = useState(2);
  const [addedCourses, setAddedCourses] = useState([]);
  // Semester-wide dates applied to all courses
  const [semesterMidterm, setSemesterMidterm] = useState('');
  const [semesterFinal, setSemesterFinal] = useState('');
  const [showMidtermPicker, setShowMidtermPicker] = useState(false);
  const [showFinalPicker, setShowFinalPicker] = useState(false);

  const formatDateDisplay = (s) => {
    if (!s) return '';
    const d = String(s).split('T')[0];
    const parts = d.split('-');
    if (parts.length !== 3) return d;
    const [y, m, dd] = parts;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[parseInt(m, 10) - 1] || m} ${parseInt(dd, 10)}, ${y}`;
  };

  const resetCourseForm = () => {
    setCourseName('');
    setCourseDifficulty(5);
    setCoursePriority(2);
  };

  const addCurrentCourse = () => {
    if (!courseName.trim()) {
      showToast("Enter a course name first", true);
      return false;
    }
    setAddedCourses((prev) => [...prev, {
      name: courseName.trim(),
      difficulty: courseDifficulty,
      priority: coursePriority,
    }]);
    resetCourseForm();
    return true;
  };

  const removeAddedCourse = (idx) => {
    setAddedCourses((prev) => prev.filter((_, i) => i !== idx));
  };

  const getLocalToday = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const todayStr = getLocalToday();
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [slots, setSlots] = useState([]);

  useEffect(() => {
    if (userData?.name && !name) setName(userData.name);
    if (userData?.deadline && !deadline) setDeadline(userData.deadline);
  }, [userData]);

  const handleNext = () => {
    if (step === 1) {
      if (!name.trim()) return showToast("Please enter your name", true);
      if (!deadline) return showToast("Please select your semester or final deadline", true);
      setStep(2);
      return;
    }
    if (step === 2) {
      let courses = addedCourses;
      if (courseName.trim()) {
        courses = [...addedCourses, {
          name: courseName.trim(),
          difficulty: courseDifficulty,
          priority: coursePriority,
        }];
      }
      if (courses.length === 0) {
        return showToast("Add at least one course", true);
      }
      if (!semesterMidterm && !semesterFinal) {
        return showToast("Pick a midterm or final date for the semester", true);
      }
      handleComplete(courses);
    }
  };

  const handleAddSlot = () => {
    setSlots([...slots, { date: selectedDate, startTime: '17:00', endTime: '19:00' }]);
  };

  const handleUpdateSlot = (index, field, value) => {
    const newSlots = [...slots];
    newSlots[index][field] = value;
    setSlots(newSlots);
  };

  const handleRemoveSlot = (index) => {
    setSlots(slots.filter((_, i) => i !== index));
  };

  const handleComplete = async (coursesList) => {
    const courses = coursesList || addedCourses;
    if (courses.length === 0) {
      showToast("Add at least one course", true);
      return;
    }
    setIsSubmitting(true);
    try {
      const resolvedName = (name && name.trim()) || userData?.name || 'Student';
      // One midterm + final for the whole semester — applied to every course
      const resolvedDeadline = deadline || semesterFinal || semesterMidterm || (() => {
        const d = new Date();
        d.setMonth(d.getMonth() + 6);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      })();
      await completeOnboarding({
        name: resolvedName,
        deadline: resolvedDeadline,
        subjects: courses.map((c) => ({
          name: c.name,
          difficulty: c.difficulty,
          priority: c.priority,
          examDate: semesterFinal || semesterMidterm || null,
          midtermDate: semesterMidterm || null,
          finalDate: semesterFinal || null,
        })),
        slots
      });
    } catch (err) {
      setIsSubmitting(false);
      const detail = extractErrorMessage(err);
      showError("Submission Failed", detail);
    }
  };

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.title, { color: colors.textDark, fontFamily: fonts.bold }]}>Welcome! 🎓</Text>
      <Text style={[styles.subtitle, { color: colors.textLight, fontFamily: fonts.medium }]}>
        Let's set the semester goal first. Then we will add your first course.
      </Text>
      
      <View style={[styles.inputGroup, { backgroundColor: colors.cardAlt }]}>
        <View style={styles.inputHeader}>
           <Ionicons name="person-circle-outline" size={20} color={colors.primary} />
           <Text style={[styles.label, { color: colors.textLight, fontFamily: fonts.bold }]}>DISPLAY NAME</Text>
        </View>
        <TextInput 
          style={[styles.input, { color: colors.textDark, fontFamily: fonts.bold, outlineStyle: 'none' }]} 
          value={name}
          onChangeText={setName}
          placeholder="Enter your name"
          placeholderTextColor={colors.textLight}
        />
      </View>

      <View style={[styles.inputGroup, { backgroundColor: colors.cardAlt }]}>
        <View style={styles.inputHeader}>
           <Ionicons name="calendar-outline" size={20} color={colors.accent.exam} />
           <Text style={[styles.label, { color: colors.textLight, fontFamily: fonts.bold }]}>SEMESTER / FINAL DEADLINE</Text>
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
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.title, { color: colors.textDark, fontFamily: fonts.bold }]}>Your Courses</Text>
      <Text style={[styles.subtitle, { color: colors.textLight, fontFamily: fonts.medium }]}>
        Add one or more courses. Tap "+ Add another" to chain them — finish setup when you're done.
      </Text>

      {addedCourses.length > 0 && (
        <View style={{ marginBottom: 18 }}>
          {addedCourses.map((c, idx) => (
            <View
              key={idx}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                padding: 14,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                marginBottom: 8,
              }}
            >
              <Ionicons name="library" size={20} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textDark, fontFamily: fonts.bold, fontSize: 15 }} numberOfLines={1}>{c.name}</Text>
                <Text style={{ color: colors.textLight, fontFamily: fonts.medium, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                  Diff {c.difficulty}/10 · {c.priority === 1 ? 'High' : c.priority === 2 ? 'Medium' : 'Low'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => removeAddedCourse(idx)}>
                <Ionicons name="close-circle" size={22} color={colors.textLight} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      <View style={[styles.inputGroup, { backgroundColor: colors.cardAlt }]}>
        <View style={styles.inputHeader}>
           <Ionicons name="library-outline" size={20} color={colors.primary} />
           <Text style={[styles.label, { color: colors.textLight, fontFamily: fonts.bold }]}>COURSE</Text>
        </View>
        <TextInput
          style={[styles.input, { color: colors.textDark, fontFamily: fonts.bold, outlineStyle: 'none' }]}
          value={courseName}
          onChangeText={setCourseName}
          placeholder="e.g. Calculus"
          placeholderTextColor={colors.textLight}
        />
      </View>


      <Text style={[styles.slotsTitle, { color: colors.textDark, fontFamily: fonts.bold, marginBottom: 12 }]}>How hard does it feel?</Text>
      <View style={styles.diffBarRow}>
        {[...Array(10)].map((_, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.diffBit, { backgroundColor: courseDifficulty > i ? colors.primary : colors.cardAlt }]}
            onPress={() => setCourseDifficulty(i + 1)}
          />
        ))}
      </View>

      <Text style={[styles.slotsTitle, { color: colors.textDark, fontFamily: fonts.bold, marginTop: 22, marginBottom: 12 }]}>Priority</Text>
      <View style={styles.prioRow}>
        {[1, 2, 3].map((p) => (
          <TouchableOpacity
            key={p}
            style={[styles.prioBtn, { borderColor: coursePriority === p ? colors.primary : colors.border, backgroundColor: coursePriority === p ? colors.primaryLight : colors.surface }]}
            onPress={() => setCoursePriority(p)}
          >
            <Text style={{ color: coursePriority === p ? colors.primary : colors.textDark, fontFamily: fonts.bold }}>
              {p === 1 ? 'High' : p === 2 ? 'Medium' : 'Low'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        onPress={addCurrentCourse}
        style={{
          marginTop: 20,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: 14,
          borderRadius: 14,
          borderWidth: 1.5,
          borderColor: colors.primary,
          borderStyle: 'dashed',
        }}
      >
        <Ionicons name="add" size={18} color={colors.primary} />
        <Text style={{ color: colors.primary, fontFamily: fonts.bold, fontSize: 14 }}>Add another course</Text>
      </TouchableOpacity>

      <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 26 }} />

      <Text style={[styles.title, { color: colors.textDark, fontFamily: fonts.bold, fontSize: 22 }]}>Semester Dates</Text>
      <Text style={[styles.subtitle, { color: colors.textLight, fontFamily: fonts.medium }]}>
        Set once — applies to all your courses.
      </Text>

      <TouchableOpacity
        style={[styles.inputGroup, { backgroundColor: colors.cardAlt }]}
        onPress={() => setShowMidtermPicker(true)}
        activeOpacity={0.7}
      >
        <View style={styles.inputHeader}>
           <Ionicons name="flag-outline" size={20} color={colors.accent.exam} />
           <Text style={[styles.label, { color: colors.textLight, fontFamily: fonts.bold }]}>MIDTERM DATE</Text>
        </View>
        <Text
          style={[styles.input, {
            color: semesterMidterm ? colors.textDark : colors.textLight,
            fontFamily: fonts.bold,
          }]}
        >
          {semesterMidterm ? formatDateDisplay(semesterMidterm) : 'Tap to choose'}
        </Text>
        {!!semesterMidterm && (
          <TouchableOpacity style={styles.clearDateBtn} onPress={() => setSemesterMidterm('')}>
            <Text style={[styles.clearDateText, { color: colors.primary, fontFamily: fonts.bold }]}>Clear</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.inputGroup, { backgroundColor: colors.cardAlt }]}
        onPress={() => setShowFinalPicker(true)}
        activeOpacity={0.7}
      >
        <View style={styles.inputHeader}>
           <Ionicons name="trophy-outline" size={20} color={colors.accent.exam} />
           <Text style={[styles.label, { color: colors.textLight, fontFamily: fonts.bold }]}>FINAL DATE</Text>
        </View>
        <Text
          style={[styles.input, {
            color: semesterFinal ? colors.textDark : colors.textLight,
            fontFamily: fonts.bold,
          }]}
        >
          {semesterFinal ? formatDateDisplay(semesterFinal) : 'Tap to choose'}
        </Text>
        {!!semesterFinal && (
          <TouchableOpacity style={styles.clearDateBtn} onPress={() => setSemesterFinal('')}>
            <Text style={[styles.clearDateText, { color: colors.primary, fontFamily: fonts.bold }]}>Clear</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.title, { color: colors.textDark, fontFamily: fonts.bold }]}>Study Availability 🕒</Text>
      <Text style={[styles.subtitle, { color: colors.textLight, fontFamily: fonts.medium }]}>
        Choose dates and add your available study times. The AI will build schedules for these dates.
      </Text>

      <View style={[styles.inputGroup, { backgroundColor: colors.cardAlt }]}>
        <View style={styles.inputHeader}>
           <Ionicons name="calendar" size={20} color={colors.primary} />
           <Text style={[styles.label, { color: colors.textLight, fontFamily: fonts.bold }]}>SELECT DATE</Text>
        </View>
        {Platform.OS === 'web' ? (
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{
              fontSize: 20,
              fontFamily: 'Outfit_700Bold',
              color: colors.textDark,
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
              width: '100%',
              paddingLeft: 10,
              marginTop: 5,
              cursor: 'pointer'
            }}
          />
        ) : (
          <TextInput 
            style={[styles.input, { color: colors.textDark, fontFamily: fonts.bold, outlineStyle: 'none' }]} 
            value={selectedDate}
            onChangeText={setSelectedDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textLight}
          />
        )}
      </View>

      <View style={styles.slotsHeader}>
        <Text style={[styles.slotsTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>Time Slots for {selectedDate}</Text>
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={handleAddSlot}>
          <Ionicons name="add" size={18} color="#FFF" />
          <Text style={{ color: '#FFF', fontFamily: fonts.bold, fontSize: 12 }}>ADD SLOT</Text>
        </TouchableOpacity>
      </View>

      {slots.filter(s => s.date === selectedDate).length === 0 && (
        <Text style={{ color: colors.textLight, fontFamily: fonts.medium, textAlign: 'center', marginTop: 20 }}>No slots added for this date yet.</Text>
      )}

      {slots.map((s, i) => {
        if (s.date !== selectedDate) return null;
        return (
          <View key={i} style={[styles.slotItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={{ flex: 1, flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <TextInput 
                style={[styles.timeInput, { color: colors.textDark, fontFamily: fonts.bold, backgroundColor: colors.cardAlt, outlineStyle: 'none' }]}
                value={s.startTime}
                onChangeText={(v) => handleUpdateSlot(i, 'startTime', v)}
                placeholder="00:00"
              />
              <Text style={{ color: colors.textLight, fontFamily: fonts.medium }}>to</Text>
              <TextInput 
                style={[styles.timeInput, { color: colors.textDark, fontFamily: fonts.bold, backgroundColor: colors.cardAlt, outlineStyle: 'none' }]}
                value={s.endTime}
                onChangeText={(v) => handleUpdateSlot(i, 'endTime', v)}
                placeholder="23:59"
              />
            </View>
            <TouchableOpacity onPress={() => handleRemoveSlot(i)} style={styles.removeSlotBtn}>
              <Ionicons name="trash-outline" size={20} color="#FF7675" />
            </TouchableOpacity>
          </View>
        );
      })}

      {slots.length > 0 && (
        <View style={{ marginTop: 30 }}>
            <Text style={{ color: colors.textDark, fontFamily: fonts.bold, marginBottom: 10 }}>All Configured Dates:</Text>
            {Array.from(new Set(slots.map(s => s.date))).map(d => (
                <View key={d} style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 10, backgroundColor: colors.surface, borderRadius: 10, marginBottom: 5 }}>
                    <Text style={{ color: colors.textDark, fontFamily: fonts.medium }}>{d}</Text>
                    <Text style={{ color: colors.textLight, fontFamily: fonts.medium }}>{slots.filter(s => s.date === d).length} slots</Text>
                </View>
            ))}
        </View>
      )}
    </View>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.topBar}>
         <View style={styles.progLineBg}>
            <View style={[styles.progLineFill, { backgroundColor: colors.primary, width: '100%' }]} />
         </View>
         <Text style={[styles.stepLabel, { color: colors.textLight, fontFamily: fonts.bold }]}>ADD YOUR FIRST COURSE</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {renderStep2()}
      </ScrollView>

      <View style={styles.bottomActions}>
         <TouchableOpacity style={[styles.mainBtn, { flex: 1, backgroundColor: colors.primary }]} onPress={handleNext} disabled={isSubmitting}>
            <Text style={[styles.mainBtnText, { color: '#FFF', fontFamily: fonts.bold }]}>
               {isSubmitting ? 'SETTING UP...' : 'FINISH SETUP'}
            </Text>
            {!isSubmitting && <Ionicons name="chevron-forward" size={20} color="#FFF" />}
         </TouchableOpacity>
      </View>

      <DatePickerModal
        visible={showMidtermPicker}
        onClose={() => setShowMidtermPicker(false)}
        selectedDate={semesterMidterm}
        onSelect={(d) => setSemesterMidterm(d)}
      />

      <DatePickerModal
        visible={showFinalPicker}
        onClose={() => setShowFinalPicker(false)}
        selectedDate={semesterFinal}
        onSelect={(d) => setSemesterFinal(d)}
      />

      <Modal visible={isSubmitting} transparent>
         <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
            <LinearGradient colors={[colors.primary, '#8575F3']} style={styles.pulseCircle}>
               <MaterialCommunityIcons name="account-check" size={60} color="#FFF" />
            </LinearGradient>
            <Text style={[styles.title, { color: colors.textDark, fontFamily: fonts.bold, marginTop: 40, textAlign: 'center' }]}>Setting Up Your Profile</Text>
            <Text style={[styles.subtitle, { color: colors.textLight, fontFamily: fonts.medium, textAlign: 'center' }]}>Almost ready...</Text>
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
  stepContainer: { flex: 1, paddingBottom: 40 },
  title: { fontSize: 30, marginBottom: 12 },
  subtitle: { fontSize: 16, lineHeight: 24, marginBottom: 40, opacity: 0.8 },
  inputGroup: { padding: 20, borderRadius: 24, marginBottom: 20 },
  inputHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  label: { fontSize: 12, letterSpacing: 1 },
  input: { fontSize: 20, paddingLeft: 10 },
  clearDateBtn: { alignSelf: 'flex-start', marginTop: 12, paddingVertical: 6, paddingHorizontal: 10 },
  clearDateText: { fontSize: 12 },
  slotsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, marginTop: 10 },
  slotsTitle: { fontSize: 16 },
  prioRow: { flexDirection: 'row', gap: 10 },
  prioBtn: { flex: 1, height: 44, borderRadius: 14, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  durationRow: { flexDirection: 'row', gap: 8, marginTop: -6 },
  durationBtn: { flex: 1, height: 42, borderRadius: 13, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  diffBarRow: { flexDirection: 'row', gap: 5 },
  diffBit: { flex: 1, height: 10, borderRadius: 6 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  slotItem: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 20, borderWidth: 1, marginBottom: 12, gap: 15 },
  timeInput: { flex: 1, fontSize: 16, padding: 12, borderRadius: 12, textAlign: 'center' },
  removeSlotBtn: { padding: 10 },
  bottomActions: { flexDirection: 'row', gap: 15, paddingBottom: 40, paddingTop: 20 },
  mainBtn: { height: 64, borderRadius: 20, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, elevation: 8, shadowColor: '#6B5CE7', shadowOpacity: 0.3, shadowRadius: 15 },
  mainBtnText: { fontSize: 16, letterSpacing: 1 },
  secondaryBtn: { height: 64, paddingHorizontal: 30, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  secondaryBtnText: { fontSize: 16, letterSpacing: 1 },
  pulseCircle: { width: 140, height: 140, borderRadius: 70, justifyContent: 'center', alignItems: 'center', elevation: 15, shadowColor: '#6B5CE7', shadowOpacity: 0.4, shadowRadius: 20 },
});
