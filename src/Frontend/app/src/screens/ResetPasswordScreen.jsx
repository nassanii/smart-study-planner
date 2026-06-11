import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { useTheme } from '../theme/theme';
import { authApi } from '../services/api';
import { extractErrorMessage } from '../services/errors';

export const ResetPasswordScreen = () => {
  const { colors, fonts } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams();

  const email = useMemo(() => {
    const raw = Array.isArray(params.email) ? params.email[0] : params.email;
    return raw || '';
  }, [params.email]);

  const codeFromLink = useMemo(() => {
    const raw = Array.isArray(params.code) ? params.code[0] : params.code;
    return raw || '';
  }, [params.code]);

  const [resetCode, setResetCode] = useState(codeFromLink.replace(/\D/g, '').slice(0, 5));
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const passwordIsStrong = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(newPassword);
  const emailIsValid = !!email;
  const codeIsValid = /^\d{5}$/.test(resetCode);

  const handleReset = async () => {
    if (submitting) return;

    setErrorMsg('');
    setSuccessMsg('');

    if (!emailIsValid) {
      setErrorMsg('This reset link is missing your email. Request a new reset email.');
      return;
    }

    if (!codeIsValid) {
      setErrorMsg('Enter the 5-digit reset code from your email.');
      return;
    }

    if (!passwordIsStrong) {
      setErrorMsg('Password must include uppercase, lowercase, a number, a special character, and be at least 8 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await authApi.resetPassword({
        email,
        code: resetCode,
        newPassword,
      });

      setSuccessMsg('Password reset successfully. You can log in now.');
      Toast.show({
        type: 'success',
        text1: 'Password Reset',
        text2: 'Log in with your new password.',
      });

      setTimeout(() => router.replace('/login'), 1200);
    } catch (err) {
      setErrorMsg(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: colors.cardAlt }]} onPress={() => router.replace('/login')}>
          <Ionicons name="chevron-back" size={22} color={colors.textDark} />
        </TouchableOpacity>

        <LinearGradient colors={[colors.primary, '#8575F3']} style={styles.iconContainer}>
          <MaterialCommunityIcons name="shield-key" size={34} color="#FFF" />
        </LinearGradient>

        <Text style={[styles.title, { color: colors.textDark, fontFamily: fonts.bold }]}>Reset Password</Text>
        <Text style={[styles.subtitle, { color: colors.textLight, fontFamily: fonts.medium }]}>
          Enter the 5-digit code from your email, then choose a new password.
        </Text>

        <View style={styles.form}>
          <Text style={[styles.label, { color: colors.textDark, fontFamily: fonts.semiBold }]}>EMAIL</Text>
          <View style={[styles.inputContainer, { backgroundColor: colors.cardAlt }]}>
            <Ionicons name="mail" size={20} color={colors.primary} />
            <TextInput
              style={[styles.input, { color: colors.textDark, fontFamily: fonts.medium }]}
              value={email}
              editable={false}
              placeholder="Email from reset link"
              placeholderTextColor={colors.textLight}
            />
          </View>

          <Text style={[styles.label, { color: colors.textDark, fontFamily: fonts.semiBold }]}>RESET CODE</Text>
          <View style={[styles.inputContainer, { backgroundColor: colors.cardAlt }]}>
            <Ionicons name="keypad" size={20} color={colors.primary} />
            <TextInput
              style={[styles.input, styles.codeInput, { color: colors.textDark, fontFamily: fonts.bold }]}
              value={resetCode}
              onChangeText={(value) => setResetCode(value.replace(/\D/g, '').slice(0, 5))}
              placeholder="5-digit code"
              placeholderTextColor={colors.textLight}
              keyboardType="number-pad"
              maxLength={5}
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
            />
          </View>

          <Text style={[styles.label, { color: colors.textDark, fontFamily: fonts.semiBold }]}>NEW PASSWORD</Text>
          <View style={[styles.inputContainer, { backgroundColor: colors.cardAlt }]}>
            <Ionicons name="lock-closed" size={20} color={colors.primary} />
            <TextInput
              style={[styles.input, { color: colors.textDark, fontFamily: fonts.medium }]}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry={!showNewPassword}
              placeholder="New password"
              placeholderTextColor={colors.textLight}
              autoComplete="off"
              autoCorrect={false}
              textContentType="oneTimeCode"
            />
            <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)}>
              <Ionicons name={showNewPassword ? 'eye-off' : 'eye'} size={22} color={colors.textLight} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.label, { color: colors.textDark, fontFamily: fonts.semiBold }]}>CONFIRM PASSWORD</Text>
          <View style={[styles.inputContainer, { backgroundColor: colors.cardAlt }]}>
            <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
            <TextInput
              style={[styles.input, { color: colors.textDark, fontFamily: fonts.medium }]}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
              placeholder="Confirm password"
              placeholderTextColor={colors.textLight}
              autoComplete="off"
              autoCorrect={false}
              textContentType="oneTimeCode"
            />
            <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
              <Ionicons name={showConfirmPassword ? 'eye-off' : 'eye'} size={22} color={colors.textLight} />
            </TouchableOpacity>
          </View>

          {successMsg ? (
            <View style={[styles.messageBox, { backgroundColor: '#DCFCE7', borderColor: '#86EFAC' }]}>
              <Ionicons name="checkmark-circle" size={18} color="#16A34A" />
              <Text style={[styles.messageText, { color: '#166534', fontFamily: fonts.medium }]}>{successMsg}</Text>
            </View>
          ) : null}

          {errorMsg ? (
            <View style={[styles.messageBox, { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' }]}>
              <Ionicons name="alert-circle" size={18} color="#DC2626" />
              <Text style={[styles.messageText, { color: '#B91C1C', fontFamily: fonts.medium }]}>{errorMsg}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: submitting ? 0.7 : 1 }]}
            onPress={handleReset}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Text style={[styles.primaryBtnText, { fontFamily: fonts.bold }]}>Reset Password</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFF" />
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
  content: { padding: 25, paddingTop: 52 },
  backBtn: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 32 },
  iconContainer: { width: 64, height: 64, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 34, marginBottom: 10 },
  subtitle: { fontSize: 17, lineHeight: 25, marginBottom: 34 },
  form: { width: '100%' },
  label: { fontSize: 14, marginBottom: 10, marginLeft: 4, letterSpacing: 0.5 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, minHeight: 64, borderRadius: 20, marginBottom: 22, gap: 14 },
  input: { flex: 1, fontSize: 17, outlineStyle: 'none' },
  codeInput: { letterSpacing: 8 },
  messageBox: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 18 },
  messageText: { fontSize: 13, flex: 1, lineHeight: 18 },
  primaryBtn: { height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10 },
  primaryBtnText: { color: '#FFF', fontSize: 17 },
});
