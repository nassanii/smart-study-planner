import { extractErrorMessage } from '../services/errors';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator
} from 'react-native';
import { useTheme } from '../theme/theme';
import { useAuth } from '../context/auth_context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const showAlert = (title, message) => {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.alert) window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
};

export const LoginScreen = () => {
  const { colors, fonts } = useTheme();
  const { login, register } = useAuth();
  const [activeTab, setActiveTab] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleForgot = () => {
    showAlert('Reset Password', 'A password reset link has been sent to your email.');
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setErrorMsg('');
    if (!email || !password) {
      setErrorMsg('Email and password are required.');
      return;
    }
    if (activeTab === 'signup' && !name.trim()) {
      setErrorMsg('Please enter your display name.');
      return;
    }
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (activeTab === 'signup' && !passwordRegex.test(password)) {
      setErrorMsg('Password must be at least 8 characters long and include uppercase, lowercase, a number, and a special character.');
      return;
    }
    if (activeTab === 'signup' && password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      if (activeTab === 'login') {
        await login(email.trim(), password);
      } else {
        await register(name.trim(), email.trim(), password);
      }
    } catch (err) {
      const status = err.response?.status;
      const data = err.response?.data;
      let detail = data?.title || data?.detail || err.message || 'Unknown error';
      if (status === 409) detail = 'This email is already registered. Try logging in.';
      else if (status === 401) detail = 'Invalid email or password.';
      else if (!err.response) detail = `Cannot reach the server. Check your network. (${err.message})`;
      console.warn('[auth-error]', status, detail);
      setErrorMsg(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={[colors.primary, '#9F8FFF']}
          style={styles.iconContainer}
        >
           <MaterialCommunityIcons name="lightning-bolt" size={30} color="#FFF" />
        </LinearGradient>
        <Text style={[styles.brand, { color: colors.textDark, fontFamily: fonts.bold }]}>
          Smart<Text style={{ color: colors.primary }}>Study</Text>
        </Text>

        <View style={styles.topSection}>
          <Text style={[styles.welcomeText, { color: colors.textDark, fontFamily: fonts.bold }]}>
            {activeTab === 'login' ? 'Welcome back 👋' : 'Create Account ✨'}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textLight, fontFamily: fonts.medium }]}>
            {activeTab === 'login'
              ? 'Sign in to continue your personalized study plan'
              : 'Join thousands of students optimizing their grades'}
          </Text>
        </View>

        <View style={[styles.tabContainer, { backgroundColor: colors.cardAlt }]}>
           <TouchableOpacity
             style={[styles.tab, activeTab === 'login' && { backgroundColor: colors.surface }]}
             onPress={() => setActiveTab('login')}
           >
              <Text style={[
                styles.tabText,
                {
                  color: activeTab === 'login' ? colors.primary : colors.textLight,
                  fontFamily: activeTab === 'login' ? fonts.bold : fonts.medium
                }
              ]}>Log in</Text>
           </TouchableOpacity>
           <TouchableOpacity
             style={[styles.tab, activeTab === 'signup' && { backgroundColor: colors.surface }]}
             onPress={() => setActiveTab('signup')}
           >
              <Text style={[
                styles.tabText,
                {
                  color: activeTab === 'signup' ? colors.primary : colors.textLight,
                  fontFamily: activeTab === 'signup' ? fonts.bold : fonts.medium
                }
              ]}>Sign up</Text>
           </TouchableOpacity>
        </View>

        <View style={styles.form}>
           {activeTab === 'signup' && (
             <>
               <Text style={[styles.label, { color: colors.textDark, fontFamily: fonts.semiBold }]}>Display Name</Text>
               <View style={[styles.inputContainer, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}>
                  <Ionicons name="person" size={20} color={colors.primary} />
                  <TextInput
                     style={[styles.input, { color: colors.textDark, fontFamily: fonts.medium }]}
                     placeholder="Your full name"
                     placeholderTextColor={colors.textLight}
                     value={name}
                     onChangeText={setName}
                     autoComplete="off"
                     autoCorrect={false}
                  />
               </View>
             </>
           )}
           <Text style={[styles.label, { color: colors.textDark, fontFamily: fonts.semiBold }]}>Email Address</Text>
           <View style={[styles.inputContainer, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}>
              <Ionicons name="mail" size={20} color={colors.primary} />
              <TextInput
                 style={[styles.input, { color: colors.textDark, fontFamily: fonts.medium }]}
                 placeholder="yourname@gmail.com"
                 placeholderTextColor={colors.textLight}
                 value={email}
                 onChangeText={setEmail}
                 autoCapitalize="none"
                 autoComplete="off"
                 autoCorrect={false}
                 textContentType="oneTimeCode"
                 keyboardType="email-address"
              />
           </View>

           <Text style={[styles.label, { color: colors.textDark, fontFamily: fonts.semiBold }]}>Password</Text>
           <View style={[styles.inputContainer, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}>
              <Ionicons name="lock-closed" size={20} color={colors.primary} />
              <TextInput
                 style={[styles.input, { color: colors.textDark, fontFamily: fonts.medium }]}
                 placeholder="••••••••"
                 placeholderTextColor={colors.textLight}
                 secureTextEntry={!showPassword}
                 value={password}
                 onChangeText={setPassword}
                 autoComplete="off"
                 autoCorrect={false}
                 textContentType="oneTimeCode"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                 <Ionicons name={showPassword ? "eye-off" : "eye"} size={22} color={colors.textLight} />
              </TouchableOpacity>
           </View>

           {activeTab === 'signup' && (
             <>
               <Text style={[styles.label, { color: colors.textDark, fontFamily: fonts.semiBold }]}>Confirm Password</Text>
               <View style={[styles.inputContainer, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}>
                  <MaterialCommunityIcons name="lock-check" size={20} color={colors.primary} />
                  <TextInput
                     style={[styles.input, { color: colors.textDark, fontFamily: fonts.medium }]}
                     placeholder="••••••••"
                     placeholderTextColor={colors.textLight}
                     secureTextEntry={!showConfirmPassword}
                     value={confirmPassword}
                     onChangeText={setConfirmPassword}
                     autoComplete="off"
                     autoCorrect={false}
                     textContentType="oneTimeCode"
                  />
                  <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeIcon}>
                     <Ionicons name={showConfirmPassword ? "eye-off" : "eye"} size={22} color={colors.textLight} />
                  </TouchableOpacity>
               </View>
             </>
           )}

           {activeTab === 'login' && (
             <View style={styles.row}>
                <TouchableOpacity
                   style={styles.checkRow}
                   activeOpacity={0.7}
                   onPress={() => setRememberMe(!rememberMe)}
                >
                    <View style={[styles.checkbox, { backgroundColor: rememberMe ? colors.primary : colors.cardAlt, borderColor: colors.border, borderWidth: 1 }]}>
                       {rememberMe && <Ionicons name="checkmark" size={14} color="#FFF" />}
                    </View>
                    <Text style={[styles.checkText, { color: colors.textLight, fontFamily: fonts.medium }]}>Remember me</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleForgot}>
                   <Text style={[styles.forgotText, { color: colors.primary, fontFamily: fonts.bold }]}>Forgot?</Text>
                </TouchableOpacity>
             </View>
           )}

           {errorMsg ? (
             <View style={[styles.errorBox, { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' }]}>
                <Ionicons name="alert-circle" size={18} color="#DC2626" />
                <Text style={[styles.errorText, { color: '#B91C1C', fontFamily: fonts.medium }]}>{errorMsg}</Text>
             </View>
           ) : null}

           <TouchableOpacity
              style={[styles.loginBtn, { backgroundColor: colors.primary }]}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.8}
           >
              <LinearGradient
                colors={[colors.primary, '#8575F3']}
                style={styles.gradientBtn}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Text style={[styles.loginBtnText, { fontFamily: fonts.bold }]}>
                       {activeTab === 'login' ? 'Log in' : 'Create Account'}
                    </Text>
                    <Ionicons name="arrow-forward" size={18} color="#FFF" style={{ marginLeft: 10 }} />
                  </>
                )}
              </LinearGradient>
           </TouchableOpacity>

           <View style={styles.dividerRow}>
              <View style={[styles.line, { backgroundColor: colors.border }]} />
              <Text style={[styles.dividerText, { color: colors.textLight, fontFamily: fonts.bold }]}> OR </Text>
              <View style={[styles.line, { backgroundColor: colors.border }]} />
           </View>

           <View style={styles.socialRow}>
              {['logo-google', 'logo-apple'].map(icon => (
                <TouchableOpacity key={icon} style={[styles.socialBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                   <Ionicons name={icon} size={24} color={colors.textDark} />
                   <Text style={[styles.socialText, { color: colors.textDark, fontFamily: fonts.bold }]}>
                      {icon === 'logo-google' ? 'Google' : 'Apple ID'}
                   </Text>
                </TouchableOpacity>
              ))}
           </View>

           <View style={styles.footer}>
              <Text style={[styles.footerText, { color: colors.textLight, fontFamily: fonts.medium }]}>
                {activeTab === 'login' ? "New here? " : "Joined already? "}
                <Text
                  style={{ color: colors.primary, fontFamily: fonts.bold }}
                  onPress={() => setActiveTab(activeTab === 'login' ? 'signup' : 'login')}
                >
                  {activeTab === 'login' ? 'Create an account' : 'Sign in here'}
                </Text>
              </Text>
           </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 25, paddingTop: 60, alignItems: 'center' },
  iconContainer: { width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  brand: { fontSize: 28, marginBottom: 45 },
  topSection: { alignSelf: 'flex-start', marginBottom: 35, width: '100%' },
  welcomeText: { fontSize: 36, marginBottom: 10 },
  subtitle: { fontSize: 18, lineHeight: 26 },
  tabContainer: { flexDirection: 'row', width: '100%', borderRadius: 20, padding: 6, marginBottom: 35 },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 16 },
  tabText: { fontSize: 16 },
  form: { width: '100%' },
  label: { fontSize: 15, marginBottom: 12, marginLeft: 4, letterSpacing: 0.5 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, height: 64, borderRadius: 20, borderWidth: 0, marginBottom: 25, gap: 15 },
  input: { flex: 1, fontSize: 18, outlineStyle: 'none' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 35, paddingHorizontal: 4 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: { width: 22, height: 22, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  checkText: { fontSize: 14 },
  forgotText: { fontSize: 14 },
  loginBtn: { height: 64, borderRadius: 20, overflow: 'hidden', marginBottom: 35, elevation: 8, shadowColor: '#6B5CE7', shadowOpacity: 0.3, shadowRadius: 15, shadowOffset: { width: 0, height: 8 } },
  gradientBtn: { flex: 1, justifyContent: 'center', alignItems: 'center', flexDirection: 'row' },
  loginBtnText: { color: '#FFF', fontSize: 17 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 30 },
  line: { flex: 1, height: 1.5 },
  dividerText: { fontSize: 12, marginHorizontal: 15, letterSpacing: 1 },
  socialRow: { flexDirection: 'row', justifyContent: 'center', gap: 15, marginBottom: 45 },
  socialBtn: { flex: 1, height: 58, borderRadius: 18, borderWidth: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12 },
  socialText: { fontSize: 15 },
  footer: { alignItems: 'center' },
  footerText: { fontSize: 15 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 18 },
  errorText: { fontSize: 13, flex: 1, lineHeight: 18 },
  eyeIcon: { padding: 5 }
});
