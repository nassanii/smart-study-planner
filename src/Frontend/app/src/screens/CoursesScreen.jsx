import { extractErrorMessage } from '../services/errors';
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, ActivityIndicator } from 'react-native';
import { useTheme } from '../theme/theme';
import { useAI } from '../context/ai_context';
import { useAppNavigation } from '../context/navigation_context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { showAlert, showConfirm } from '../services/dialogs';
import { DatePickerModal } from '../components/DatePickerModal';

const formatDateDisplay = (s) => {
  if (!s) return '';
  const d = String(s).split('T')[0];
  const parts = d.split('-');
  if (parts.length !== 3) return d;
  const [y, m, dd] = parts;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(m, 10) - 1] || m} ${parseInt(dd, 10)}, ${y}`;
};

export const CoursesScreen = () => {
  const { colors, fonts } = useTheme();
  const { subjects, tasks, addSubject, updateSubject, removeSubject, reloadAll } = useAI();
  const { navigate } = useAppNavigation();

  const visibleSubjects = useMemo(() => {
    return subjects.filter((s) => s.name?.trim().toLowerCase() !== 'general tasks');
  }, [subjects]);

  const [showCourseModal, setShowCourseModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  const [courseForm, setCourseForm] = useState({ name: '', difficulty: 5, priority: 2, midtermDate: '', finalDate: '' });
  const [busy, setBusy] = useState(false);
  const [showCourseMidtermPicker, setShowCourseMidtermPicker] = useState(false);
  const [showCourseFinalPicker, setShowCourseFinalPicker] = useState(false);
  const [showSemesterModal, setShowSemesterModal] = useState(false);
  const [showSemMidPicker, setShowSemMidPicker] = useState(false);
  const [showSemFinPicker, setShowSemFinPicker] = useState(false);
  const [semesterMidterm, setSemesterMidterm] = useState('');
  const [semesterFinal, setSemesterFinal] = useState('');
  const [savingSemester, setSavingSemester] = useState(false);

  const openSemesterModal = () => {
    // Pre-fill with most common existing dates so the user can edit them
    const mid = subjects.map((s) => s.midtermDate).find(Boolean) || '';
    const fin = subjects.map((s) => s.finalDate || s.examDate).find(Boolean) || '';
    setSemesterMidterm(mid);
    setSemesterFinal(fin);
    setShowSemesterModal(true);
  };

  const saveSemesterDates = async () => {
    setSavingSemester(true);
    try {
      for (const s of subjects) {
        await updateSubject(s.id, {
          midtermDate: semesterMidterm || null,
          finalDate: semesterFinal || null,
          examDate: semesterFinal || semesterMidterm || null,
        });
      }
      setShowSemesterModal(false);
    } catch (err) {
      showAlert('Error', extractErrorMessage(err));
    } finally {
      setSavingSemester(false);
    }
  };

  const totals = useMemo(() => {
    const done = tasks.filter((t) => t.status === 'done').length;
    const open = tasks.filter((t) => t.status !== 'done').length;
    return { done, open };
  }, [tasks]);

  useEffect(() => {
    reloadAll().catch(() => {});
  }, [reloadAll]);

  const openCourseModal = (course = null) => {
    setEditingCourse(course);
    setCourseForm(course
      ? {
        name: course.name || '',
        difficulty: course.difficulty || 5,
        priority: course.priority || 2,
        midtermDate: course.midtermDate || '',
        finalDate: course.finalDate || course.examDate || '',
      }
      : { name: '', difficulty: 5, priority: 2, midtermDate: '', finalDate: '' });
    setShowCourseModal(true);
  };

  const handleSaveCourse = async () => {
    if (!courseForm.name.trim()) return showAlert('Required', 'Please enter a course name.');
    setBusy(true);
    try {
      const payload = {
        ...courseForm,
        name: courseForm.name.trim(),
        difficulty: Number(courseForm.difficulty) || 5,
        priority: Number(courseForm.priority) || 2,
        midtermDate: courseForm.midtermDate || null,
        finalDate: courseForm.finalDate || null,
        examDate: courseForm.finalDate || courseForm.midtermDate || null,
      };
      if (editingCourse) {
        await updateSubject(editingCourse.id, payload);
      } else {
        await addSubject(payload);
      }
      setShowCourseModal(false);
      setEditingCourse(null);
    } catch (err) {
      showAlert('Error', extractErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteCourse = (course) => {
    showConfirm({
      title: 'Delete Course',
      message: `Delete "${course.name}"? This will remove its tasks and study history.`,
      confirmText: 'Delete',
      destructive: true,
      onConfirm: () => removeSubject(course.id),
    });
  };

  const getPrioColor = (p) => p === 1 ? '#F43F5E' : p === 2 ? '#F59E0B' : '#10B981';
  const getPrioLabel = (p) => p === 1 ? 'High' : p === 2 ? 'Medium' : 'Low';

  const courseStats = (course) => {
    const courseTasks = tasks.filter((t) => t.subject_id === course.id);
    const done = courseTasks.filter((t) => t.status === 'done').length;
    const open = courseTasks.length - done;
    const minutes = courseTasks.reduce((sum, t) => sum + Number(t.actual_minutes || 0), 0);
    const progress = courseTasks.length === 0 ? 0 : Math.round((done / courseTasks.length) * 100);
    const nextDue = courseTasks
      .filter((t) => t.status !== 'done' && t.deadline)
      .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))[0]?.deadline;
    return { done, open, minutes, progress, nextDue };
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <TouchableOpacity style={[styles.backBtn, { backgroundColor: colors.surface }]} onPress={() => navigate('profile')}>
            <Ionicons name="chevron-back" size={22} color={colors.textDark} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>Courses</Text>
            <Text style={[styles.headerSub, { color: colors.textLight, fontFamily: fonts.medium }]}>
              Track progress, tasks, and what needs attention.
            </Text>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.summaryValue, { color: colors.textDark, fontFamily: fonts.bold }]}>{visibleSubjects.length}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textLight, fontFamily: fonts.bold }]}>COURSES</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.summaryValue, { color: colors.textDark, fontFamily: fonts.bold }]}>{totals.open}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textLight, fontFamily: fonts.bold }]}>OPEN TASKS</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.summaryValue, { color: colors.textDark, fontFamily: fonts.bold }]}>{totals.done}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textLight, fontFamily: fonts.bold }]}>DONE</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.semesterBtn, { backgroundColor: colors.surface, borderColor: colors.primary }]}
          onPress={openSemesterModal}
        >
          <Ionicons name="calendar-outline" size={18} color={colors.primary} />
          <Text style={[styles.semesterBtnText, { color: colors.primary, fontFamily: fonts.bold }]}>Edit Semester Dates</Text>
        </TouchableOpacity>

        {visibleSubjects.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="library-outline" size={36} color="#CBD5E1" />
            <Text style={[styles.emptyTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>Add your first course</Text>
            <Text style={[styles.emptyText, { color: colors.textLight, fontFamily: fonts.medium }]}>
              Start with Calculus, Physics, Biology, or any course you want to track.
            </Text>
            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.primary }]} onPress={() => openCourseModal()}>
              <Text style={[styles.primaryBtnText, { fontFamily: fonts.bold }]}>Add Course</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.courseList}>
            {visibleSubjects.map((course) => {
              const stats = courseStats(course);
              return (
                <TouchableOpacity
                  key={course.id}
                  activeOpacity={0.85}
                  style={[styles.courseCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => navigate('course_detail', { courseId: course.id })}
                >
                  <View style={[styles.indicator, { backgroundColor: getPrioColor(course.priority) }]} />
                  <View style={styles.courseBody}>
                    <View style={styles.courseTopRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.courseName, { color: colors.textDark, fontFamily: fonts.bold }]} numberOfLines={1}>
                          {course.name}
                        </Text>
                        <Text style={[styles.courseMeta, { color: colors.textLight, fontFamily: fonts.medium }]}>
                          {formatCourseExams(course)} | Diff {course.difficulty}/10
                        </Text>
                      </View>
                      <View style={[styles.prioTag, { backgroundColor: getPrioColor(course.priority) + '15' }]}>
                        <Text style={[styles.prioTagText, { color: getPrioColor(course.priority), fontFamily: fonts.bold }]}>
                          {getPrioLabel(course.priority)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.progressRow}>
                      <View style={[styles.progressBg, { backgroundColor: colors.cardAlt }]}>
                        <View style={[styles.progressFill, { width: `${stats.progress}%`, backgroundColor: getPrioColor(course.priority) }]} />
                      </View>
                      <Text style={[styles.progressText, { color: colors.textLight, fontFamily: fonts.bold }]}>{stats.progress}%</Text>
                    </View>

                    <View style={styles.courseFooter}>
                      <Text style={[styles.footerText, { color: colors.textLight, fontFamily: fonts.medium }]}>
                        {stats.open} open | {stats.done} done | {Math.round(stats.minutes / 60)}h studied
                      </Text>
                      <View style={styles.controls}>
                        <TouchableOpacity style={[styles.controlBtn, { backgroundColor: colors.cardAlt }]} onPress={(e) => { e.stopPropagation(); openCourseModal(course); }}>
                          <Ionicons name="pencil" size={15} color={colors.textDark} />
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.controlBtn, { backgroundColor: colors.cardAlt }]} onPress={(e) => { e.stopPropagation(); handleDeleteCourse(course); }}>
                          <Ionicons name="trash" size={15} color={colors.textDark} />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {stats.nextDue && (
                      <View style={[styles.insightPill, { backgroundColor: colors.cardAlt }]}>
                        <Ionicons name="calendar-outline" size={14} color={colors.primary} />
                        <Text style={[styles.insightText, { color: colors.textDark, fontFamily: fonts.medium }]}>
                          Next task due {new Date(stats.nextDue).toLocaleDateString()}
                        </Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      <TouchableOpacity style={styles.fab} activeOpacity={0.85} onPress={() => openCourseModal()}>
        <LinearGradient colors={[colors.primary, '#9F8FFF']} style={styles.fabInner}>
          <Ionicons name="add" size={32} color="#FFF" />
        </LinearGradient>
      </TouchableOpacity>

      <Modal visible={showCourseModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>
              {editingCourse ? 'Edit Course' : 'New Course'}
            </Text>

            <View style={[styles.inputGroup, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.miniLabel, { color: colors.textLight, fontFamily: fonts.bold }]}>COURSE NAME</Text>
              <TextInput
                style={[styles.inputBoxText, { color: colors.textDark, fontFamily: fonts.bold }]}
                value={courseForm.name}
                onChangeText={(v) => setCourseForm({ ...courseForm, name: v })}
                placeholder="e.g. Calculus"
                placeholderTextColor={colors.textLight}
              />
            </View>

            <View style={styles.dateGrid}>
              <TouchableOpacity
                style={[styles.inputGroup, styles.dateInputGroup, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => setShowCourseMidtermPicker(true)}
                activeOpacity={0.7}
              >
                <Text style={[styles.miniLabel, { color: colors.textLight, fontFamily: fonts.bold }]}>MIDTERM DATE</Text>
                <Text style={[styles.inputBoxText, {
                  color: courseForm.midtermDate ? colors.textDark : colors.textLight,
                  fontFamily: fonts.bold,
                }]}>
                  {courseForm.midtermDate ? formatDateDisplay(courseForm.midtermDate) : 'Tap to set'}
                </Text>
                {courseForm.midtermDate ? (
                  <TouchableOpacity style={[styles.clearDateBtn, { backgroundColor: colors.cardAlt }]} onPress={() => setCourseForm({ ...courseForm, midtermDate: '' })}>
                    <Text style={[styles.clearDateText, { color: colors.textLight, fontFamily: fonts.bold }]}>No midterm</Text>
                  </TouchableOpacity>
                ) : null}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.inputGroup, styles.dateInputGroup, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => setShowCourseFinalPicker(true)}
                activeOpacity={0.7}
              >
                <Text style={[styles.miniLabel, { color: colors.textLight, fontFamily: fonts.bold }]}>FINAL DATE</Text>
                <Text style={[styles.inputBoxText, {
                  color: courseForm.finalDate ? colors.textDark : colors.textLight,
                  fontFamily: fonts.bold,
                }]}>
                  {courseForm.finalDate ? formatDateDisplay(courseForm.finalDate) : 'Tap to set'}
                </Text>
                {courseForm.finalDate ? (
                  <TouchableOpacity style={[styles.clearDateBtn, { backgroundColor: colors.cardAlt }]} onPress={() => setCourseForm({ ...courseForm, finalDate: '' })}>
                    <Text style={[styles.clearDateText, { color: colors.textLight, fontFamily: fonts.bold }]}>No final</Text>
                  </TouchableOpacity>
                ) : null}
              </TouchableOpacity>
            </View>

            <Text style={[styles.miniLabel, { color: colors.textLight, fontFamily: fonts.bold }]}>PRIORITY</Text>
            <View style={styles.segmentRow}>
              {[1, 2, 3].map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.segmentBtn, { borderColor: courseForm.priority === p ? colors.primary : colors.border, backgroundColor: courseForm.priority === p ? colors.primary + '12' : 'transparent' }]}
                  onPress={() => setCourseForm({ ...courseForm, priority: p })}
                >
                  <Text style={{ color: courseForm.priority === p ? colors.primary : colors.textLight, fontFamily: fonts.bold }}>
                    {p === 1 ? 'High' : p === 2 ? 'Medium' : 'Low'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.miniLabel, { color: colors.textLight, fontFamily: fonts.bold, marginTop: 22 }]}>
              DIFFICULTY: {courseForm.difficulty}/10
            </Text>
            <View style={styles.diffBarRow}>
              {[...Array(10)].map((_, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.diffBit, { backgroundColor: courseForm.difficulty > i ? colors.primary : colors.cardAlt }]}
                  onPress={() => setCourseForm({ ...courseForm, difficulty: i + 1 })}
                />
              ))}
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={[styles.actionBtn, { borderColor: colors.border, borderWidth: 1 }]} onPress={() => setShowCourseModal(false)}>
                <Text style={[styles.actionBtnText, { color: colors.textLight, fontFamily: fonts.bold }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary }]} onPress={handleSaveCourse} disabled={busy}>
                {busy ? <ActivityIndicator color="#FFF" /> : <Text style={[styles.actionBtnText, { color: '#FFF', fontFamily: fonts.bold }]}>Save Course</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <DatePickerModal
        visible={showCourseMidtermPicker}
        onClose={() => setShowCourseMidtermPicker(false)}
        selectedDate={courseForm.midtermDate}
        onSelect={(d) => setCourseForm({ ...courseForm, midtermDate: d || '' })}
      />

      <DatePickerModal
        visible={showCourseFinalPicker}
        onClose={() => setShowCourseFinalPicker(false)}
        selectedDate={courseForm.finalDate}
        onSelect={(d) => setCourseForm({ ...courseForm, finalDate: d || '' })}
      />

      <Modal visible={showSemesterModal} transparent animationType="slide" onRequestClose={() => setShowSemesterModal(false)}>
        <View style={styles.semesterOverlay}>
          <View style={[styles.semesterSheet, { backgroundColor: colors.surface }]}>
            <View style={styles.semesterHeader}>
              <View style={[styles.semesterIcon, { backgroundColor: colors.primary + '18' }]}>
                <Ionicons name="calendar" size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.semesterTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>Semester Dates</Text>
                <Text style={[styles.semesterSub, { color: colors.textLight, fontFamily: fonts.medium }]}>
                  Optional, applied to every course at once.
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowSemesterModal(false)} style={styles.semesterClose}>
                <Ionicons name="close" size={22} color={colors.textDark} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.semesterField, { backgroundColor: colors.cardAlt, borderColor: semesterMidterm ? colors.primary : colors.border }]}
              onPress={() => setShowSemMidPicker(true)}
              activeOpacity={0.85}
            >
              <View style={[styles.semesterFieldIcon, { backgroundColor: '#F59E0B22' }]}>
                <Ionicons name="flag" size={18} color="#F59E0B" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.semesterFieldLabel, { color: colors.textLight, fontFamily: fonts.bold }]}>MIDTERM OPTIONAL</Text>
                <Text style={[styles.semesterFieldValue, {
                  color: semesterMidterm ? colors.textDark : colors.textLight,
                  fontFamily: fonts.bold,
                }]}>
                  {semesterMidterm ? formatDateDisplay(semesterMidterm) : 'Tap to choose'}
                </Text>
              </View>
              {semesterMidterm ? (
                <TouchableOpacity onPress={() => setSemesterMidterm('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close-circle" size={20} color={colors.textLight} />
                </TouchableOpacity>
              ) : (
                <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.semesterField, { backgroundColor: colors.cardAlt, borderColor: semesterFinal ? colors.primary : colors.border }]}
              onPress={() => setShowSemFinPicker(true)}
              activeOpacity={0.85}
            >
              <View style={[styles.semesterFieldIcon, { backgroundColor: '#EF444422' }]}>
                <Ionicons name="trophy" size={18} color="#EF4444" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.semesterFieldLabel, { color: colors.textLight, fontFamily: fonts.bold }]}>FINAL OPTIONAL</Text>
                <Text style={[styles.semesterFieldValue, {
                  color: semesterFinal ? colors.textDark : colors.textLight,
                  fontFamily: fonts.bold,
                }]}>
                  {semesterFinal ? formatDateDisplay(semesterFinal) : 'Tap to choose'}
                </Text>
              </View>
              {semesterFinal ? (
                <TouchableOpacity onPress={() => setSemesterFinal('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close-circle" size={20} color={colors.textLight} />
                </TouchableOpacity>
              ) : (
                <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
              )}
            </TouchableOpacity>

            <View style={styles.semesterActions}>
              <TouchableOpacity style={[styles.semesterBtnCancel, { borderColor: colors.border }]} onPress={() => setShowSemesterModal(false)}>
                <Text style={[styles.semesterBtnCancelText, { color: colors.textDark, fontFamily: fonts.bold }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.semesterBtnSave, { backgroundColor: colors.primary, opacity: savingSemester ? 0.7 : 1 }]}
                onPress={saveSemesterDates}
                disabled={savingSemester}
              >
                {savingSemester
                  ? <ActivityIndicator color="#FFF" />
                  : (
                    <>
                      <Ionicons name="checkmark" size={18} color="#FFF" />
                      <Text style={[styles.semesterBtnSaveText, { color: '#FFF', fontFamily: fonts.bold }]}>Apply to All</Text>
                    </>
                  )}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <DatePickerModal
          visible={showSemMidPicker}
          onClose={() => setShowSemMidPicker(false)}
          selectedDate={semesterMidterm}
          onSelect={(d) => setSemesterMidterm(d || '')}
        />
        <DatePickerModal
          visible={showSemFinPicker}
          onClose={() => setShowSemFinPicker(false)}
          selectedDate={semesterFinal}
          onSelect={(d) => setSemesterFinal(d || '')}
        />
      </Modal>
    </View>
  );
};

const formatCourseExams = (course) => {
  const parts = [];
  if (course.midtermDate) parts.push(`Midterm ${new Date(course.midtermDate).toLocaleDateString()}`);
  if (course.finalDate) parts.push(`Final ${new Date(course.finalDate).toLocaleDateString()}`);
  if (parts.length === 0 && course.examDate) parts.push(`Exam ${new Date(course.examDate).toLocaleDateString()}`);
  return parts.length ? parts.join(' | ') : 'No midterm/final';
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 110 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 },
  backBtn: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 28 },
  headerSub: { fontSize: 13, marginTop: 4, maxWidth: 260 },
  headerAddBtn: { width: 42, height: 42, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  summaryCard: { flex: 1, borderRadius: 18, paddingVertical: 16, alignItems: 'center' },
  semesterBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 16, borderWidth: 1.5, marginBottom: 18 },
  semesterBtnText: { fontSize: 14 },
  semesterOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  semesterSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 32 },
  semesterHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 22 },
  semesterIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  semesterTitle: { fontSize: 20 },
  semesterSub: { fontSize: 12, marginTop: 2 },
  semesterClose: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  semesterField: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 14, borderRadius: 16, borderWidth: 1.5, marginBottom: 12 },
  semesterFieldIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  semesterFieldLabel: { fontSize: 10, letterSpacing: 1.2, marginBottom: 4 },
  semesterFieldValue: { fontSize: 15 },
  semesterActions: { flexDirection: 'row', gap: 10, marginTop: 22 },
  semesterBtnCancel: { flex: 1, height: 50, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  semesterBtnCancelText: { fontSize: 14 },
  semesterBtnSave: { flex: 1.4, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  semesterBtnSaveText: { fontSize: 14 },
  summaryValue: { fontSize: 22 },
  summaryLabel: { fontSize: 10, marginTop: 4, letterSpacing: 0.5 },
  emptyCard: { borderWidth: 1, borderRadius: 24, padding: 28, alignItems: 'center' },
  emptyTitle: { fontSize: 20, marginTop: 14, marginBottom: 6 },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 18 },
  primaryBtn: { paddingHorizontal: 22, height: 48, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  primaryBtnText: { color: '#FFF', fontSize: 15 },
  courseList: { gap: 14 },
  courseCard: { borderWidth: 1, borderRadius: 22, padding: 16, flexDirection: 'row' },
  indicator: { width: 5, borderRadius: 4, marginRight: 14 },
  courseBody: { flex: 1 },
  courseTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  courseName: { fontSize: 18 },
  courseMeta: { fontSize: 12, marginTop: 5 },
  prioTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  prioTagText: { fontSize: 10, letterSpacing: 0.4 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  progressBg: { flex: 1, height: 8, borderRadius: 8, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 8 },
  progressText: { fontSize: 11, minWidth: 34, textAlign: 'right' },
  courseFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 },
  footerText: { fontSize: 12 },
  controls: { flexDirection: 'row', gap: 6 },
  controlBtn: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  insightPill: { marginTop: 12, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12 },
  insightText: { fontSize: 12 },
  fab: { position: 'absolute', bottom: 30, right: 30, width: 66, height: 66, borderRadius: 33, elevation: 10, shadowColor: '#6B5CE7', shadowOpacity: 0.4, shadowRadius: 15 },
  fabInner: { flex: 1, borderRadius: 33, justifyContent: 'center', alignItems: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: { padding: 26, borderTopLeftRadius: 32, borderTopRightRadius: 32, elevation: 20 },
  modalTitle: { fontSize: 24, marginBottom: 22 },
  inputGroup: { padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 14 },
  dateGrid: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  dateInputGroup: { flex: 1 },
  miniLabel: { fontSize: 10, letterSpacing: 1, marginBottom: 8, opacity: 0.75 },
  inputBoxText: { fontSize: 18, paddingVertical: 4 },
  clearDateBtn: { alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 6, borderRadius: 10, marginTop: 7 },
  clearDateText: { fontSize: 10 },
  segmentRow: { flexDirection: 'row', gap: 10 },
  segmentBtn: { flex: 1, height: 42, borderRadius: 12, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  diffBarRow: { flexDirection: 'row', gap: 5, marginTop: 4, marginBottom: 24 },
  diffBit: { flex: 1, height: 9, borderRadius: 6 },
  modalFooter: { flexDirection: 'row', gap: 12, paddingBottom: 10 },
  actionBtn: { flex: 1, height: 50, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  actionBtnText: { fontSize: 16 },
});
