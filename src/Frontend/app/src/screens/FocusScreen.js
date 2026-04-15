import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Modal } from 'react-native';
import { useTheme } from '../theme/theme';
import { useAI } from '../context/ai_context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const FocusScreen = () => {
  const { colors, fonts } = useTheme();
  const { behavioralLogs } = useAI();
  const [mode, setMode] = useState('Focus'); 
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  
  const [showSnoozeModal, setShowSnoozeModal] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [focusRating, setFocusRating] = useState(0);

  useEffect(() => {
    let interval = null;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsActive(false);
      setShowRatingModal(true);
      if (interval) clearInterval(interval);
    } else {
      if (interval) clearInterval(interval);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [isActive, timeLeft]);

  const toggleTimer = () => setIsActive(!isActive);
  
  const handleSnooze = () => {
    setIsActive(false);
    setShowSnoozeModal(true);
  };

  const selectSnoozeReason = (reason) => {
    console.log(`Snooze reason: ${reason}`);
    setShowSnoozeModal(false);
    // Logic to update behavioral logs would go here
  };

  const submitRating = (rating) => {
    setFocusRating(rating);
    setTimeout(() => {
      setShowRatingModal(false);
      resetTimer();
    }, 500);
  };

  const resetTimer = () => {
    setIsActive(false);
    if (mode === 'Focus') setTimeLeft(25 * 60);
    else if (mode === 'Short') setTimeLeft(5 * 60);
    else setTimeLeft(15 * 60);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
           <Text style={[styles.headerTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>Focus</Text>
           <MaterialCommunityIcons name="clock-fast" size={28} color={colors.textDark} />
        </View>
        <View style={{flex: 1}} />
        <View style={[styles.sessionBadge, { backgroundColor: 'rgba(107, 92, 231, 0.12)' }]}>
           <Text style={[styles.sessionBadgeText, { color: colors.primary, fontFamily: fonts.bold }]}>Session 3/4</Text>
        </View>
      </View>

      <View style={[styles.taskCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
         <View style={[styles.taskIndicator, { backgroundColor: colors.accent.math }]} />
         <View style={styles.taskContent}>
            <Text style={[styles.taskTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>Linear Algebra Ch.5</Text>
            <View style={styles.taskSubRow}>
               <MaterialCommunityIcons name="compass-outline" size={16} color={colors.textLight} />
               <Text style={[styles.taskSubText, { color: colors.textLight, fontFamily: fonts.medium }]}> 2.5 Credits • Math</Text>
            </View>
         </View>
      </View>
      
      <View style={[styles.modeSelector, { backgroundColor: colors.cardAlt }]}>
         {['Focus', 'Short', 'Long'].map(m => {
           const isSel = mode === m;
           return (
             <TouchableOpacity key={m} style={[styles.modeBtn, isSel && { backgroundColor:colors.surface }]} onPress={() => { setMode(m); resetTimer(); }}>
                <Text style={[styles.modeText, { color: isSel ? colors.primary : colors.textLight, fontFamily: isSel ? fonts.bold : fonts.medium }]}>{m}</Text>
             </TouchableOpacity>
           );
         })}
      </View>

      <View style={[styles.timerCircle, { borderColor: 'rgba(107, 92, 231, 0.08)' }]}>
        <LinearGradient colors={isActive ? ['rgba(107, 92, 231, 0.03)', 'transparent'] : ['transparent', 'transparent']} style={styles.circleInner}>
           <Text style={[styles.timerText, { color: colors.textDark, fontFamily: fonts.bold }]}>{formatTime(timeLeft)}</Text>
           <Text style={[styles.timerSubtitle, { color: colors.textLight, fontFamily: fonts.medium }]}>Focus Session</Text>
        </LinearGradient>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity style={[styles.smallBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={resetTimer}>
          <MaterialCommunityIcons name="reload" size={24} color={colors.textDark} />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.playButton} onPress={toggleTimer} activeOpacity={0.8}>
          <LinearGradient colors={[colors.primary, '#8575F3']} style={styles.playGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <Ionicons name={isActive ? "pause" : "play"} size={36} color="#FFF" style={{ marginLeft: isActive ? 0 : 4 }} />
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.smallBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={handleSnooze}>
          <MaterialCommunityIcons name="bell-sleep-outline" size={26} color={colors.textDark} />
        </TouchableOpacity>
      </View>

      <View style={styles.dotsRow}>
         <View style={[styles.dot, { backgroundColor: 'rgba(107, 92, 231, 0.3)' }]} />
         <View style={[styles.dot, { backgroundColor: 'rgba(107, 92, 231, 0.3)' }]} />
         <View style={[styles.dot, { backgroundColor: colors.primary }]} />
      </View>

      <View style={[styles.statsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
         <View style={styles.statCol}>
            <Text style={[styles.statBig, { color: colors.primary, fontFamily: fonts.bold }]}>2h 15m</Text>
            <Text style={[styles.statSmall, { color: colors.textLight, fontFamily: fonts.bold }]}>Study</Text>
         </View>
         <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
         <View style={styles.statCol}>
            <Text style={[styles.statBig, { color: colors.accent.science, fontFamily: fonts.bold }]}>6</Text>
            <Text style={[styles.statSmall, { color: colors.textLight, fontFamily: fonts.bold }]}>Tasks</Text>
         </View>
         <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
         <View style={styles.statCol}>
            <View style={styles.fireRow}>
               <Ionicons name="flame" size={18} color={colors.accent.exam} />
               <Text style={[styles.statBig, { color: colors.accent.exam, marginLeft: 4, fontFamily: fonts.bold }]}>12</Text>
            </View>
            <Text style={[styles.statSmall, { color: colors.textLight, fontFamily: fonts.bold }]}>Streak</Text>
         </View>
      </View>

      {/* Snooze Modal */}
      <Modal visible={showSnoozeModal} transparent animationType="fade">
         <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
               <Text style={[styles.modalTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>Why snooze? 😴</Text>
               <Text style={[styles.modalSub, { color: colors.textLight, fontFamily: fonts.medium }]}>The AI uses this to prevent your future burnout.</Text>
               
               {['Feeling Fatigued', 'Too Difficult', 'External Distraction', 'Emergency'].map((r) => (
                  <TouchableOpacity key={r} style={[styles.reasonBtn, { backgroundColor: colors.cardAlt }]} onPress={() => selectSnoozeReason(r)}>
                     <Text style={[styles.reasonText, { color: colors.textDark, fontFamily: fonts.semiBold }]}>{r}</Text>
                     <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
                  </TouchableOpacity>
               ))}
               
               <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowSnoozeModal(false)}>
                  <Text style={[styles.cancelText, { color: colors.textLight, fontFamily: fonts.bold }]}>Continue Session</Text>
               </TouchableOpacity>
            </View>
         </View>
      </Modal>

      {/* Post-Session Rating Modal */}
      <Modal visible={showRatingModal} transparent animationType="slide">
         <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface, alignItems: 'center' }]}>
               <View style={styles.congratsIcon}>
                  <MaterialCommunityIcons name="party-popper" size={48} color={colors.primary} />
               </View>
               <Text style={[styles.modalTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>Great Session!</Text>
               <Text style={[styles.modalSub, { color: colors.textLight, fontFamily: fonts.medium, textAlign: 'center' }]}>How was your focus during this block?</Text>
               
               <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((s) => (
                     <TouchableOpacity key={s} onPress={() => setFocusRating(s)}>
                        <Ionicons name={focusRating >= s ? "star" : "star-outline"} size={40} color={focusRating >= s ? "#FFD93D" : colors.border} />
                     </TouchableOpacity>
                  ))}
               </View>

               <TouchableOpacity style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: focusRating === 0 ? 0.5 : 1 }]} disabled={focusRating === 0} onPress={() => submitRating(focusRating)}>
                  <Text style={{ color: '#FFF', fontFamily: fonts.bold }}>Submit to AI Advisor</Text>
               </TouchableOpacity>
            </View>
         </View>
      </Modal>

    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 22, paddingTop: 12, alignItems: 'center' },
  header: { flexDirection: 'row', width: '100%', alignItems: 'center', marginBottom: 35 },
  headerTitle: { fontSize: 26 },
  sessionBadge: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20 },
  sessionBadgeText: { fontSize: 12 },
  taskCard: { flexDirection: 'row', width: '100%', padding: 20, borderRadius: 24, borderWidth: 1, marginBottom: 40, elevation: 2, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 10 },
  taskIndicator: { width: 4, height: '100%', borderRadius: 2, marginRight: 18 },
  taskContent: { justifyContent: 'center' },
  taskTitle: { fontSize: 18, marginBottom: 4 },
  taskSubRow: { flexDirection: 'row', alignItems: 'center' },
  taskSubText: { fontSize: 13 },
  modeSelector: { flexDirection: 'row', borderRadius: 24, padding: 5, marginBottom: 50, width: '100%' },
  modeBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 18 },
  modeText: { fontSize: 14 },
  timerCircle: { width: SCREEN_WIDTH * 0.75, height: SCREEN_WIDTH * 0.75, borderRadius: (SCREEN_WIDTH * 0.75) / 2, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center', marginBottom: 55 },
  circleInner: { width: '100%', height: '100%', borderRadius: (SCREEN_WIDTH * 0.75) / 2, justifyContent: 'center', alignItems: 'center' },
  timerText: { fontSize: 84, letterSpacing: -2, marginBottom: 4 },
  timerSubtitle: { fontSize: 18, opacity: 0.6 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 30, marginBottom: 45 },
  playButton: { width: 88, height: 88, borderRadius: 44, elevation: 10, shadowColor: '#6B5CE7', shadowOpacity: 0.35, shadowRadius: 15, shadowOffset: { width: 0, height: 10 } },
  playGradient: { flex: 1, borderRadius: 44, justifyContent: 'center', alignItems: 'center' },
  smallBtn: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', borderWidth: 1, elevation: 3, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10 },
  dotsRow: { flexDirection: 'row', gap: 12, marginBottom: 45 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  statsCard: { flexDirection: 'row', width: '100%', justifyContent: 'space-between', padding: 24, borderRadius: 24, borderWidth: 1, elevation: 4, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 12 },
  dividerLine: { width: 1, height: '60%', alignSelf: 'center' },
  statCol: { alignItems: 'center', flex: 1 },
  statBig: { fontSize: 22, marginBottom: 6 },
  statSmall: { fontSize: 12, opacity: 0.5 },
  fireRow: { flexDirection: 'row', alignItems: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 25 },
  modalContent: { padding: 30, borderRadius: 32 },
  modalTitle: { fontSize: 24, marginBottom: 10 },
  modalSub: { fontSize: 15, marginBottom: 30 },
  reasonBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderRadius: 16, marginBottom: 12 },
  reasonText: { fontSize: 16 },
  cancelBtn: { marginTop: 20, alignSelf: 'center' },
  cancelText: { fontSize: 14 },
  congratsIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(107, 92, 231, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  starsRow: { flexDirection: 'row', gap: 10, marginBottom: 40, marginTop: 20 },
  submitBtn: { height: 58, width: '100%', borderRadius: 18, justifyContent: 'center', alignItems: 'center' }
});
