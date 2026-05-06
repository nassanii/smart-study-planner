import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useTheme } from '../theme/theme';
import { useAuth } from '../context/auth_context';
import { authApi } from '../services/api';
import { Ionicons } from '@expo/vector-icons';
import { useAppNavigation } from '../context/navigation_context';
import Toast from 'react-native-toast-message';
import { extractErrorMessage } from '../services/errors';

export const ChangePasswordScreen = () => {
  const { colors, fonts } = useTheme();
  const { logout } = useAuth();
  const { navigate } = useAppNavigation();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const validate = () => {
    const newErrors = {};
    if (!currentPassword) newErrors.current = 'Current password is required';
    
    if (!newPassword) {
      newErrors.new = 'New password is required';
    } else if (newPassword.length < 8) {
      newErrors.new = 'Password must be at least 8 characters';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])/.test(newPassword)) {
      newErrors.new = 'Must include uppercase, lowercase and number';
    }

    if (confirmPassword !== newPassword) {
      newErrors.confirm = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChangePassword = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      await authApi.changePassword({
        currentPassword,
        newPassword
      });
      
      Toast.show({
        type: 'success',
        text1: 'Password Changed',
        text2: 'Please log in again with your new password.'
      });

      // Best practice: Logout after password change to invalidate all sessions
      setTimeout(async () => {
        await logout();
      }, 2000);

    } catch (err) {
      console.error('Change password error:', err);
      Toast.show({
        type: 'error',
        text1: 'Change Failed',
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
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigate('profile')} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.textDark} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>Security</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.contentHeader}>
           <Text style={[styles.title, { color: colors.textDark, fontFamily: fonts.bold }]}>Change Password</Text>
           <Text style={[styles.subtitle, { color: colors.textLight, fontFamily: fonts.medium }]}>
             Create a strong password to protect your account
           </Text>
        </View>

        <View style={styles.form}>
          {/* Current Password */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textLight, fontFamily: fonts.semiBold }]}>CURRENT PASSWORD</Text>
            <View style={[styles.inputWrapper, { backgroundColor: colors.cardAlt, borderColor: errors.current ? colors.accent.exam : 'transparent' }]}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.textLight} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: colors.textDark, fontFamily: fonts.medium }]}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="••••••••"
                placeholderTextColor={colors.textLight}
                secureTextEntry={!showCurrent}
              />
              <TouchableOpacity onPress={() => setShowCurrent(!showCurrent)}>
                <Ionicons name={showCurrent ? "eye-off-outline" : "eye-outline"} size={20} color={colors.textLight} />
              </TouchableOpacity>
            </View>
            {errors.current && <Text style={[styles.errorText, { fontFamily: fonts.medium }]}>{errors.current}</Text>}
          </View>

          {/* New Password */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textLight, fontFamily: fonts.semiBold }]}>NEW PASSWORD</Text>
            <View style={[styles.inputWrapper, { backgroundColor: colors.cardAlt, borderColor: errors.new ? colors.accent.exam : 'transparent' }]}>
              <Ionicons name="shield-checkmark-outline" size={20} color={colors.textLight} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: colors.textDark, fontFamily: fonts.medium }]}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="••••••••"
                placeholderTextColor={colors.textLight}
                secureTextEntry={!showNew}
              />
              <TouchableOpacity onPress={() => setShowNew(!showNew)}>
                <Ionicons name={showNew ? "eye-off-outline" : "eye-outline"} size={20} color={colors.textLight} />
              </TouchableOpacity>
            </View>
            {errors.new && <Text style={[styles.errorText, { fontFamily: fonts.medium }]}>{errors.new}</Text>}
          </View>

          {/* Confirm Password */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textLight, fontFamily: fonts.semiBold }]}>CONFIRM NEW PASSWORD</Text>
            <View style={[styles.inputWrapper, { backgroundColor: colors.cardAlt, borderColor: errors.confirm ? colors.accent.exam : 'transparent' }]}>
              <Ionicons name="checkmark-circle-outline" size={20} color={colors.textLight} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: colors.textDark, fontFamily: fonts.medium }]}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="••••••••"
                placeholderTextColor={colors.textLight}
                secureTextEntry={!showConfirm}
              />
              <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)}>
                <Ionicons name={showConfirm ? "eye-off-outline" : "eye-outline"} size={20} color={colors.textLight} />
              </TouchableOpacity>
            </View>
            {errors.confirm && <Text style={[styles.errorText, { fontFamily: fonts.medium }]}>{errors.confirm}</Text>}
          </View>

          <View style={[styles.guidelines, { backgroundColor: colors.cardAlt }]}>
            <Text style={[styles.guideTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>Password Requirements:</Text>
            <View style={styles.guideRow}>
              <Ionicons name="checkmark-circle" size={14} color={newPassword.length >= 8 ? colors.primary : colors.textLight} />
              <Text style={[styles.guideText, { color: colors.textLight, fontFamily: fonts.medium }]}>Minimum 8 characters</Text>
            </View>
            <View style={styles.guideRow}>
              <Ionicons name="checkmark-circle" size={14} color={/[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword) ? colors.primary : colors.textLight} />
              <Text style={[styles.guideText, { color: colors.textLight, fontFamily: fonts.medium }]}>Uppercase & lowercase letters</Text>
            </View>
            <View style={styles.guideRow}>
              <Ionicons name="checkmark-circle" size={14} color={/[0-9]/.test(newPassword) ? colors.primary : colors.textLight} />
              <Text style={[styles.guideText, { color: colors.textLight, fontFamily: fonts.medium }]}>At least one number</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: colors.accent.exam }]}
            onPress={handleChangePassword}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Text style={[styles.saveBtnText, { fontFamily: fonts.bold }]}>Update Password</Text>
                <Ionicons name="key-outline" size={20} color="#FFF" />
              </>
            )}
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
  contentHeader: { marginBottom: 35 },
  title: { fontSize: 28, marginBottom: 10 },
  subtitle: { fontSize: 15, lineHeight: 22 },
  form: { gap: 24 },
  inputGroup: { gap: 8 },
  label: { fontSize: 12, letterSpacing: 1.2, marginLeft: 4 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, borderWidth: 0, paddingHorizontal: 18, height: 64 },
  inputIcon: { marginRight: 15 },
  input: { flex: 1, fontSize: 18, outlineStyle: 'none' },
  errorText: { color: '#F87171', fontSize: 12, marginLeft: 4 },
  guidelines: { padding: 20, borderRadius: 20, gap: 10, marginTop: 10 },
  guideTitle: { fontSize: 14, marginBottom: 5 },
  guideRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  guideText: { fontSize: 13 },
  saveBtn: { height: 58, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 15, elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 },
  saveBtnText: { color: '#FFF', fontSize: 17 },
});
