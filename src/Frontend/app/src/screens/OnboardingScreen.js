import { extractErrorMessage } from '../services/errors';
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Dimensions, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { useTheme } from '../theme/theme';
import { useAI } from '../context/ai_context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { showError, showToast } from '../services/dialogs';
import Animated, { FadeInDown } from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const OnboardingScreen = () => {
  const { colors, fonts } = useTheme();
  const { completeOnboarding, userData } = useAI();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Basic setup only
  const [name, setName] = useState(userData?.name || '');
  const [deadline, setDeadline] = useState(userData?.deadline || '');

  useEffect(() => {
    if (userData?.name && !name) setName(userData.name);
    if (userData?.deadline && !deadline) setDeadline(userData.deadline);
  }, [userData]);

  const handleComplete = async () => {
    if (!name.trim()) return showToast("Please enter your name", true);
    if (!deadline) return showToast("Please select your final exam deadline", true);

    setIsSubmitting(true);
    try {
      // Send empty subjects and slots as per user request to move them post-onboarding
      await completeOnboarding({ 
        name, 
        deadline, 
        subjects: [], 
        slots: [] 
      });
    } catch (err) {
      setIsSubmitting(false);
      const detail = extractErrorMessage(err);
      showError("Submission Failed", detail);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.topBar}>
         <View style={styles.progLineBg}>
            <View style={[styles.progLineFill, { backgroundColor: colors.primary, width: '100%' }]} />
         </View>
         <Text style={[styles.stepLabel, { color: colors.textLight, fontFamily: fonts.bold }]}>PROFILE SETUP</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.stepContainer}>
          <Text style={[styles.title, { color: colors.textDark, fontFamily: fonts.bold }]}>Welcome! 🎓</Text>
          <Text style={[styles.subtitle, { color: colors.textLight, fontFamily: fonts.medium }]}>
            Let's start with the basics. You can add your subjects and study times later in the app.
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
               <Text style={[styles.label, { color: colors.textLight, fontFamily: fonts.bold }]}>FINAL EXAM DEADLINE</Text>
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

          <View style={[styles.metaInfo, { backgroundColor: 'rgba(107, 92, 231, 0.05)', borderColor: colors.primaryLight, borderWidth: 1, marginTop: 20 }]}>
             <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
             <Text style={[styles.metaInfoText, { color: colors.textDark, fontFamily: fonts.medium }]}>
               After this, you can go to the "Subjects" tab to add what you're studying.
             </Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.bottomActions}>
         <TouchableOpacity style={[styles.mainBtn, { flex: 1, backgroundColor: colors.primary }]} onPress={handleComplete} disabled={isSubmitting}>
            <Text style={[styles.mainBtnText, { color: '#FFF', fontFamily: fonts.bold }]}>
               {isSubmitting ? 'SETTING UP...' : 'ENTER APP'}
            </Text>
            {!isSubmitting && <Ionicons name="chevron-forward" size={20} color="#FFF" />}
         </TouchableOpacity>
      </View>

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
  stepContainer: { flex: 1 },
  title: { fontSize: 30, marginBottom: 12 },
  subtitle: { fontSize: 16, lineHeight: 24, marginBottom: 40, opacity: 0.8 },
  inputGroup: { padding: 20, borderRadius: 24, marginBottom: 20 },
  inputHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  label: { fontSize: 12, letterSpacing: 1 },
  input: { fontSize: 20, paddingLeft: 10 },
  bottomActions: { flexDirection: 'row', gap: 15, paddingBottom: 40, paddingTop: 20 },
  mainBtn: { height: 64, borderRadius: 20, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, elevation: 8, shadowColor: '#6B5CE7', shadowOpacity: 0.3, shadowRadius: 15 },
  mainBtnText: { fontSize: 16, letterSpacing: 1 },
  pulseCircle: { width: 140, height: 140, borderRadius: 70, justifyContent: 'center', alignItems: 'center', elevation: 15, shadowColor: '#6B5CE7', shadowOpacity: 0.4, shadowRadius: 20 },
  metaInfo: { flexDirection: 'row', gap: 18, padding: 25, borderRadius: 28, marginTop: 50 },
  metaInfoText: { flex: 1, fontSize: 13, lineHeight: 20, opacity: 0.8 }
});
