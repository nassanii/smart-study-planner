import React, { useEffect, useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/theme';
import { useAI } from '../context/ai_context';
import { showAlert, showConfirm } from '../services/dialogs';

const emptyForm = { id: null, name: '', difficulty: 5, examDate: '' };

export const SubjectsManager = ({ visible, onClose }) => {
  const { colors, fonts } = useTheme();
  const { subjects, addSubject, updateSubject, removeSubject } = useAI();
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      setForm(emptyForm);
      setError('');
    }
  }, [visible]);

  const startEdit = (s) => {
    setForm({ id: s.id, name: s.name, difficulty: s.difficulty, examDate: s.examDate || '' });
    setError('');
  };

  const reset = () => {
    setForm(emptyForm);
    setError('');
  };

  const submit = async () => {
    if (!form.name.trim()) {
      setError('Subject name is required.');
      return;
    }
    if (form.difficulty < 1 || form.difficulty > 10) {
      setError('Difficulty must be between 1 and 10.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const payload = {
        name: form.name.trim(),
        difficulty: Number(form.difficulty),
        examDate: form.examDate ? form.examDate.trim() : null,
      };
      if (form.id) {
        await updateSubject(form.id, payload);
      } else {
        await addSubject(payload);
      }
      reset();
    } catch (err) {
      setError(err.response?.data?.title || err.message || 'Could not save subject.');
    } finally {
      setBusy(false);
    }
  };

  const remove = (s) => {
    showConfirm({
      title: 'Delete subject',
      message: `Delete "${s.name}"? All tasks under this subject will also be removed.`,
      confirmText: 'Delete',
      destructive: true,
      onConfirm: async () => {
        try {
          await removeSubject(s.id);
          if (form.id === s.id) reset();
        } catch (err) {
          showAlert('Failed', err.response?.data?.title || err.message);
        }
      },
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.headerTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>Manage Subjects</Text>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.cardAlt }]}>
              <Ionicons name="close" size={20} color={colors.textDark} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
            <View style={styles.section}>
              <Text style={[styles.label, { color: colors.textLight, fontFamily: fonts.bold }]}>YOUR SUBJECTS</Text>
              {subjects.length === 0 && (
                <Text style={{ color: colors.textLight, fontFamily: fonts.medium, paddingVertical: 12 }}>No subjects yet — add one below.</Text>
              )}
              {subjects.map((s) => (
                <View key={s.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={[styles.subIcon, { backgroundColor: colors.cardAlt }]}>
                    <MaterialCommunityIcons name="book-outline" size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>{s.name}</Text>
                    <Text style={[styles.cardSub, { color: colors.textLight, fontFamily: fonts.medium }]}>D{s.difficulty}/10{s.examDate ? ` · Exam ${s.examDate}` : ''}</Text>
                  </View>
                  <TouchableOpacity onPress={() => startEdit(s)} style={[styles.iconBtn, { backgroundColor: colors.cardAlt }]}>
                    <Ionicons name="pencil" size={16} color={colors.textDark} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => remove(s)} style={[styles.iconBtn, { backgroundColor: '#FEE2E2', marginLeft: 8 }]}>
                    <Ionicons name="trash" size={16} color="#DC2626" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            <View style={[styles.formCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.formTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>{form.id ? 'Edit subject' : 'Add subject'}</Text>

              <Text style={[styles.fieldLabel, { color: colors.textLight, fontFamily: fonts.semiBold }]}>NAME</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.cardAlt, color: colors.textDark, fontFamily: fonts.medium }]}
                placeholder="e.g. Mathematics"
                placeholderTextColor={colors.textLight}
                value={form.name}
                onChangeText={(v) => setForm(f => ({ ...f, name: v }))}
                autoComplete="off"
                autoCorrect={false}
              />

              <Text style={[styles.fieldLabel, { color: colors.textLight, fontFamily: fonts.semiBold }]}>DIFFICULTY: {form.difficulty}/10</Text>
              <View style={styles.diffRow}>
                {[...Array(10)].map((_, i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => setForm(f => ({ ...f, difficulty: i + 1 }))}
                    style={[styles.diffBit, { backgroundColor: form.difficulty > i ? colors.primary : colors.cardAlt }]}
                  />
                ))}
              </View>

              <Text style={[styles.fieldLabel, { color: colors.textLight, fontFamily: fonts.semiBold }]}>EXAM DATE (optional, YYYY-MM-DD)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.cardAlt, color: colors.textDark, fontFamily: fonts.medium }]}
                placeholder="2026-06-10"
                placeholderTextColor={colors.textLight}
                value={form.examDate}
                onChangeText={(v) => setForm(f => ({ ...f, examDate: v }))}
                autoComplete="off"
                autoCorrect={false}
              />

              {error ? (
                <View style={[styles.errorBox, { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' }]}>
                  <Ionicons name="alert-circle" size={16} color="#DC2626" />
                  <Text style={[styles.errorText, { color: '#B91C1C', fontFamily: fonts.medium }]}>{error}</Text>
                </View>
              ) : null}

              <View style={styles.formActions}>
                {form.id ? (
                  <TouchableOpacity style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={reset} disabled={busy}>
                    <Text style={[styles.cancelText, { color: colors.textDark, fontFamily: fonts.bold }]}>Cancel edit</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity style={[styles.saveBtn, { overflow: 'hidden' }]} onPress={submit} disabled={busy} activeOpacity={0.8}>
                  <LinearGradient colors={[colors.primary, '#8575F3']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.saveBtnInner}>
                    {busy ? <ActivityIndicator color="#FFF" /> : (
                      <Text style={[styles.saveText, { color: '#FFF', fontFamily: fonts.bold }]}>{form.id ? 'Save changes' : 'Add subject'}</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15, 11, 36, 0.5)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '90%', borderTopLeftRadius: 32, borderTopRightRadius: 32, borderWidth: 1, paddingHorizontal: 22, paddingTop: 14 },
  header: { flexDirection: 'row', alignItems: 'center', paddingBottom: 16, marginBottom: 18, borderBottomWidth: 1 },
  headerTitle: { flex: 1, fontSize: 20 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  section: { marginBottom: 24 },
  label: { fontSize: 11, letterSpacing: 1, marginBottom: 12, opacity: 0.7 },
  card: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 18, borderWidth: 1, marginBottom: 10 },
  subIcon: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  cardTitle: { fontSize: 15, marginBottom: 2 },
  cardSub: { fontSize: 12, opacity: 0.7 },
  iconBtn: { width: 34, height: 34, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  formCard: { padding: 20, borderRadius: 24, borderWidth: 1 },
  formTitle: { fontSize: 17, marginBottom: 18 },
  fieldLabel: { fontSize: 11, letterSpacing: 1, marginBottom: 10, opacity: 0.65, marginTop: 6 },
  input: { height: 52, borderRadius: 14, paddingHorizontal: 16, marginBottom: 16, fontSize: 15 },
  diffRow: { flexDirection: 'row', gap: 5, marginBottom: 16 },
  diffBit: { flex: 1, height: 8, borderRadius: 4 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 14 },
  errorText: { fontSize: 12, flex: 1 },
  formActions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  cancelBtn: { flex: 1, height: 50, borderRadius: 14, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  cancelText: { fontSize: 14 },
  saveBtn: { flex: 1, height: 50, borderRadius: 14 },
  saveBtnInner: { flex: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 14 },
  saveText: { fontSize: 14 }
});
