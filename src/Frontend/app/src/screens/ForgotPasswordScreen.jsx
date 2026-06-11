import React, { useMemo, useRef, useState } from 'react';
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

const normalizeCode = (value) => value.replace(/\D/g, '').slice(0, 5);
const stepOrder = ['email', 'code', 'password'];

export const ForgotPasswordScreen = () => {
  const { colors, fonts } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams();
  const codeInputRef = useRef(null);

  const initialEmail = useMemo(() => {
    const raw = Array.isArray(params.email) ? params.email[0] : params.email;
    return raw || '';
  }, [params.email]);

  const initialCode = useMemo(() => {
    const raw = Array.isArray(params.code) ? params.code[0] : params.code;
    return normalizeCode(raw || '');
  }, [params.code]);

  const [step, setStep] = useState(initialEmail ? 'code' : 'email');
  const [email, setEmail] = useState(initialEmail);
  const [resetCode, setResetCode] = useState(initialCode);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState(initialEmail ? 'Enter the 5-digit code from your email.' : '');

  const passwordIsStrong = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(newPassword);
  const codeIsValid = /^\d{5}$/.test(resetCode);

  const setScreenMessage = (type, message) => {
    setErrorMsg(type === 'error' ? message : '');
    setSuccessMsg(type === 'success' ? message : '');
  };

  const handleBack = () => {
    if (step === 'password') {
      setStep('code');
      return;
    }

    if (step === 'code' && !initialEmail) {
      setStep('email');
      return;
    }

    router.replace('/login');
  };

  const handleSendCode = async () => {
    if (submitting) return;

    setScreenMessage('', '');
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setScreenMessage('error', 'Enter your email address.');
      return;
    }

    setSubmitting(true);
    try {
      await authApi.forgotPassword({ email: trimmedEmail });
      setEmail(trimmedEmail);
      setResetCode('');
      setStep('code');
      setScreenMessage('success', 'If this email exists, a 5-digit code has been sent.');
      setTimeout(() => codeInputRef.current?.focus(), 250);
    } catch (err) {
      setScreenMessage('error', extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyCode = async () => {
    if (submitting) return;

    setScreenMessage('', '');
    if (!email.trim()) {
      setStep('email');
      setScreenMessage('error', 'Enter your email address first.');
      return;
    }

    if (!codeIsValid) {
      setScreenMessage('error', 'Enter the 5-digit reset code.');
      return;
    }

    setSubmitting(true);
    try {
      await authApi.verifyResetCode({ email: email.trim(), code: resetCode });
      setStep('password');
      setScreenMessage('success', 'Code verified. Choose a new password.');
    } catch (err) {
      setScreenMessage('error', extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async () => {
    if (submitting) return;

    setScreenMessage('', '');
    if (!codeIsValid) {
      setStep('code');
      setScreenMessage('error', 'Verify the 5-digit code first.');
      return;
    }

    if (!passwordIsStrong) {
      setScreenMessage('error', 'Password must include uppercase, lowercase, a number, a special character, and be at least 8 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setScreenMessage('error', 'Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await authApi.resetPassword({
        email: email.trim(),
        code: resetCode,
        newPassword,
      });

      setScreenMessage('success', 'Password reset successfully. You can log in now.');
      Toast.show({
        type: 'success',
        text1: 'Password Reset',
        text2: 'Log in with your new password.',
      });

      setTimeout(() => router.replace('/login'), 1200);
    } catch (err) {
      setScreenMessage('error', extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const renderMessage = () => (
    <>
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
    </>
  );

  const renderStepIndicator = () => {
    const activeIndex = stepOrder.indexOf(step);
    return (
      <View style={styles.stepRow}>
        {stepOrder.map((item, index) => (
          <React.Fragment key={item}>
            <View
              style={[
                styles.stepDot,
                { backgroundColor: index <= activeIndex ? colors.primary : '#D9D3FA' },
              ]}
            />
            {index < stepOrder.length - 1 ? (
              <View
                style={[
                  styles.stepLine,
                  { backgroundColor: index < activeIndex ? colors.primary : colors.border },
                ]}
              />
            ) : null}
          </React.Fragment>
        ))}
      </View>
    );
  };

  const renderCodeBoxes = () => (
    <TouchableOpacity
      style={styles.codeBoxes}
      activeOpacity={0.85}
      onPress={() => codeInputRef.current?.focus()}
    >
      {[0, 1, 2, 3, 4].map((index) => {
        const value = resetCode[index] || '';
        const isActive = resetCode.length === index || (index === 4 && resetCode.length === 5);
        return (
          <View
            key={index}
            style={[
              styles.codeBox,
              {
                backgroundColor: colors.cardAlt,
                borderColor: isActive ? colors.primary : 'transparent',
              },
            ]}
          >
            <Text style={[styles.codeBoxText, { color: colors.textDark, fontFamily: fonts.bold }]}>
              {value}
            </Text>
          </View>
        );
      })}
      <TextInput
        ref={codeInputRef}
        value={resetCode}
        onChangeText={(value) => setResetCode(normalizeCode(value))}
        keyboardType="number-pad"
        maxLength={5}
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        style={styles.hiddenCodeInput}
      />
    </TouchableOpacity>
  );

  const title = step === 'email' ? 'Forgot Password' : step === 'code' ? 'Verify Code' : 'New Password';
  const subtitle = step === 'email'
    ? 'Enter your account email and we will send a 5-digit reset code.'
    : step === 'code'
      ? 'Enter the 5-digit code from your email.'
      : 'Choose a new password for your Smart Study account.';

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: colors.cardAlt }]} onPress={handleBack}>
          <Ionicons name="chevron-back" size={22} color={colors.textDark} />
        </TouchableOpacity>

        <LinearGradient colors={[colors.primary, '#8575F3']} style={styles.iconContainer}>
          <MaterialCommunityIcons name={step === 'email' ? 'email-fast' : step === 'code' ? 'form-textbox-password' : 'shield-key'} size={34} color="#FFF" />
        </LinearGradient>

        <Text style={[styles.title, { color: colors.textDark, fontFamily: fonts.bold }]}>{title}</Text>
        <Text style={[styles.subtitle, { color: colors.textLight, fontFamily: fonts.medium }]}>{subtitle}</Text>

        {renderStepIndicator()}

        <View style={styles.form}>
          {step === 'email' ? (
            <>
              <Text style={[styles.label, { color: colors.textDark, fontFamily: fonts.semiBold }]}>EMAIL ADDRESS</Text>
              <View style={[styles.inputContainer, { backgroundColor: colors.cardAlt }]}>
                <Ionicons name="mail" size={20} color={colors.primary} />
                <TextInput
                  style={[styles.input, { color: colors.textDark, fontFamily: fonts.medium }]}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="yourname@gmail.com"
                  placeholderTextColor={colors.textLight}
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect={false}
                  keyboardType="email-address"
                />
              </View>
              {renderMessage()}
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: submitting ? 0.7 : 1 }]}
                onPress={handleSendCode}
                disabled={submitting}
                activeOpacity={0.85}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Text style={[styles.primaryBtnText, { fontFamily: fonts.bold }]}>Send Code</Text>
                    <Ionicons name="arrow-forward" size={18} color="#FFF" />
                  </>
                )}
              </TouchableOpacity>
            </>
          ) : null}

          {step === 'code' ? (
            <>
              <Text style={[styles.label, { color: colors.textDark, fontFamily: fonts.semiBold }]}>5-DIGIT CODE</Text>
              {renderCodeBoxes()}
              <TouchableOpacity style={styles.linkRow} onPress={handleSendCode} disabled={submitting}>
                <Text style={[styles.linkText, { color: colors.primary, fontFamily: fonts.bold }]}>Resend code</Text>
              </TouchableOpacity>
              {renderMessage()}
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: submitting ? 0.7 : 1 }]}
                onPress={handleVerifyCode}
                disabled={submitting}
                activeOpacity={0.85}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Text style={[styles.primaryBtnText, { fontFamily: fonts.bold }]}>Verify Code</Text>
                    <Ionicons name="arrow-forward" size={18} color="#FFF" />
                  </>
                )}
              </TouchableOpacity>
            </>
          ) : null}

          {step === 'password' ? (
            <>
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
              {renderMessage()}
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
            </>
          ) : null}
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
  subtitle: { fontSize: 17, lineHeight: 25, marginBottom: 24 },
  stepRow: { flexDirection: 'row', alignItems: 'center', width: 104, marginBottom: 30 },
  stepDot: { width: 12, height: 12, borderRadius: 6 },
  stepLine: { flex: 1, height: 2, marginHorizontal: 8 },
  form: { width: '100%' },
  label: { fontSize: 14, marginBottom: 10, marginLeft: 4, letterSpacing: 0.5 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, minHeight: 64, borderRadius: 20, marginBottom: 22, gap: 14 },
  input: { flex: 1, fontSize: 17, outlineStyle: 'none' },
  codeBoxes: { flexDirection: 'row', gap: 10, marginBottom: 16, position: 'relative' },
  codeBox: { flex: 1, aspectRatio: 1, borderRadius: 16, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  codeBoxText: { fontSize: 24 },
  hiddenCodeInput: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  linkRow: { alignSelf: 'flex-end', marginBottom: 22, padding: 6 },
  linkText: { fontSize: 14 },
  messageBox: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 18 },
  messageText: { fontSize: 13, flex: 1, lineHeight: 18 },
  primaryBtn: { height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10 },
  primaryBtnText: { color: '#FFF', fontSize: 17 },
});
