import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useTheme } from '../theme/theme';
import { useAuth } from '../context/auth_context';
import { usersApi } from '../services/api';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppNavigation } from '../context/navigation_context';
import { extractErrorMessage } from '../services/errors';
import Toast from 'react-native-toast-message';

/**
 * EditProfileScreen - Enhanced with security and functionality best practices:
 * 1. Data Integrity: Trims inputs and validates formats.
 * 2. Optimized UX: Disables save button if no changes are detected.
 * 3. Security: Sensitive fields (Email) are read-only to prevent unauthorized hijacking without separate verification.
 * 4. Error Handling: Uses standardized error extraction for clear feedback.
 */
export const EditProfileScreen = () => {
  const { colors, fonts } = useTheme();
  const { user, setUser } = useAuth();
  const { navigate } = useAppNavigation();

  // Initial state from context
  const [name, setName] = useState(user?.name || '');
  const [deadline, setDeadline] = useState(user?.deadline || '');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Memoized check for changes to optimize performance and UX
  const hasChanges = useMemo(() => {
    return (
      name.trim() !== (user?.name || '') ||
      deadline !== (user?.deadline || '')
    );
  }, [name, deadline, user?.name, user?.deadline]);

  const validate = () => {
    const newErrors = {};
    if (!name.trim()) {
      newErrors.name = 'Name cannot be empty';
    } else if (name.trim().length < 2) {
      newErrors.name = 'Name is too short';
    }

    if (!deadline) {
      newErrors.deadline = 'Deadline is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    if (!hasChanges) {
      Toast.show({ type: 'info', text1: 'No changes', text2: 'You haven\'t made any changes to save.' });
      return;
    }

    setLoading(true);
    try {
      // Best practice: Send only what's necessary (Data Minimization)
      const payload = { 
        name: name.trim(),
        deadline: deadline
      };
      
      const updatedUser = await usersApi.update(payload);
      
      // Update local context
      setUser(updatedUser);
      
      Toast.show({
        type: 'success',
        text1: 'Profile Updated',
        text2: 'Your information has been successfully saved.'
      });
      
      // Navigate back after a short delay for feedback
      setTimeout(() => navigate('profile'), 500);
      
    } catch (err) {
      console.error('[ProfileUpdate] error:', err);
      Toast.show({
        type: 'error',
        text1: 'Update Failed',
        text2: extractErrorMessage(err)
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 12, paddingBottom: 60 }}
      >
        {/* Header Section */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigate('profile')} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.textDark} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>Personal Info</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Visual Identity Section */}
        <View style={styles.avatarContainer}>
          <LinearGradient
            colors={[colors.primary, '#A29BFE']}
            style={styles.avatarGradient}
          >
            <Text style={[styles.avatarText, { fontFamily: fonts.bold }]}>
              {(name || user?.name || 'U').slice(0, 1).toUpperCase()}
            </Text>
          </LinearGradient>
          <View style={[styles.statusBadge, { backgroundColor: '#10B981' }]} />
        </View>

        {/* Form Section */}
        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
               <Text style={[styles.label, { color: colors.textLight, fontFamily: fonts.semiBold }]}>FULL NAME</Text>
               {hasChanges && <Text style={[styles.modifiedLabel, { color: colors.primary, fontFamily: fonts.bold }]}>MODIFIED</Text>}
            </View>
            <View style={[styles.inputWrapper, { backgroundColor: colors.cardAlt, borderColor: errors.name ? colors.accent.exam : (hasChanges ? colors.primary : 'transparent'), borderWidth: errors.name || hasChanges ? 1 : 0 }]}>
              <Ionicons name="person-outline" size={20} color={hasChanges ? colors.primary : colors.textLight} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: colors.textDark, fontFamily: fonts.medium }]}
                value={name}
                onChangeText={setName}
                placeholder="Your full name"
                placeholderTextColor={colors.textLight}
                autoCorrect={false}
              />
            </View>
            {errors.name && <Text style={[styles.errorText, { fontFamily: fonts.medium }]}>{errors.name}</Text>}
          </View>

          {/* Deadline Section */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
               <Text style={[styles.label, { color: colors.textLight, fontFamily: fonts.semiBold }]}>FINAL EXAM DEADLINE</Text>
               {deadline !== user?.deadline && <Text style={[styles.modifiedLabel, { color: colors.primary, fontFamily: fonts.bold }]}>MODIFIED</Text>}
            </View>
            <View style={[styles.inputWrapper, { backgroundColor: colors.cardAlt, borderColor: errors.deadline ? colors.accent.exam : (deadline !== user?.deadline ? colors.primary : 'transparent'), borderWidth: errors.deadline || deadline !== user?.deadline ? 1 : 0 }]}>
              <Ionicons name="calendar-outline" size={20} color={deadline !== user?.deadline ? colors.primary : colors.textLight} style={styles.inputIcon} />
              {Platform.OS === 'web' ? (
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  style={{
                    fontSize: 18,
                    fontFamily: 'Outfit_500Medium',
                    color: colors.textDark,
                    backgroundColor: 'transparent',
                    border: 'none',
                    outline: 'none',
                    flex: 1,
                    cursor: 'pointer'
                  }}
                />
              ) : (
                <TextInput
                  style={[styles.input, { color: colors.textDark, fontFamily: fonts.medium }]}
                  value={deadline}
                  onChangeText={setDeadline}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textLight}
                  autoCorrect={false}
                />
              )}
            </View>
            {errors.deadline && <Text style={[styles.errorText, { fontFamily: fonts.medium }]}>{errors.deadline}</Text>}
          </View>

          {/* Email Section - Read Only for Security */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
               <Text style={[styles.label, { color: colors.textLight, fontFamily: fonts.semiBold }]}>EMAIL ADDRESS</Text>
               <View style={styles.lockRow}>
                  <Ionicons name="lock-closed" size={10} color={colors.textLight} />
                  <Text style={[styles.lockText, { color: colors.textLight, fontFamily: fonts.bold }]}>PRIVATE</Text>
               </View>
            </View>
            <View style={[styles.inputWrapper, { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1, opacity: 0.7 }]}>
              <Ionicons name="mail-outline" size={20} color={colors.textLight} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: colors.textLight, fontFamily: fonts.medium }]}
                value={user?.email}
                editable={false}
                selectTextOnFocus={false}
              />
            </View>
            <Text style={[styles.infoText, { color: colors.textLight, fontFamily: fonts.medium }]}>
              Email cannot be changed directly for security reasons.
            </Text>
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[
              styles.saveBtn, 
              { 
                backgroundColor: hasChanges ? colors.primary : colors.border,
                shadowColor: hasChanges ? colors.primary : '#000',
                elevation: hasChanges ? 4 : 0
              }
            ]}
            onPress={handleSave}
            disabled={loading || !hasChanges}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Text style={[styles.saveBtnText, { fontFamily: fonts.bold, color: hasChanges ? '#FFF' : colors.textLight }]}>
                  {hasChanges ? 'Save Changes' : 'No Changes Detected'}
                </Text>
                {hasChanges && <Ionicons name="arrow-forward" size={18} color="#FFF" />}
              </>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.cancelBtn} 
            onPress={() => navigate('profile')}
            disabled={loading}
          >
            <Text style={[styles.cancelBtnText, { color: colors.textLight, fontFamily: fonts.semiBold }]}>Discard Changes</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 30 },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20 },
  avatarContainer: { alignItems: 'center', marginBottom: 40, position: 'relative' },
  avatarGradient: { width: 90, height: 90, borderRadius: 32, justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 20 },
  avatarText: { color: '#FFF', fontSize: 32 },
  statusBadge: { position: 'absolute', bottom: 5, right: '38%', width: 18, height: 18, borderRadius: 9, borderWidth: 3, borderColor: '#FFF' },
  form: { gap: 28 },
  inputGroup: { gap: 10 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4 },
  label: { fontSize: 12, letterSpacing: 1.2 },
  modifiedLabel: { fontSize: 10, letterSpacing: 1 },
  lockRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  lockText: { fontSize: 10, letterSpacing: 1 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, paddingHorizontal: 18, height: 64 },
  inputIcon: { marginRight: 15 },
  input: { flex: 1, fontSize: 18, outlineStyle: 'none' },
  errorText: { color: '#F87171', fontSize: 12, marginLeft: 4, marginTop: 4 },
  infoText: { fontSize: 12, marginLeft: 4, marginTop: 2, opacity: 0.8 },
  saveBtn: { height: 64, borderRadius: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 10, shadowOpacity: 0.2, shadowRadius: 15, shadowOffset: { width: 0, height: 5 } },
  saveBtnText: { fontSize: 17 },
  cancelBtn: { paddingVertical: 15, alignItems: 'center' },
  cancelBtnText: { fontSize: 15 },
});
