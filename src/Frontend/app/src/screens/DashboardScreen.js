import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTheme } from '../theme/theme';
import { useAI } from '../context/ai_context';
import { useAuth } from '../context/auth_context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { analyticsApi } from '../services/api';
import { DailyCheckinModal } from '../components/DailyCheckinModal';

export const DashboardScreen = () => {
  const { colors, fonts } = useTheme();
  const { user } = useAuth();
  const { userData, behavioralLogs, tasks, subjects, latestSchedule, reloadAll, hydrating } = useAI();
  const [insights, setInsights] = useState(null);
  const [showAiAlert, setShowAiAlert] = useState(true);
  const [showDailyCheckin, setShowDailyCheckin] = useState(false);
  const didLoad = useRef(false);

  useEffect(() => {
    if (didLoad.current) return;
    didLoad.current = true;
    analyticsApi.insights().then(setInsights).catch(() => { });
    reloadAll();
  }, [reloadAll]);

  useEffect(() => {
    if (hydrating) return;
    const now = new Date();
    const isScheduleToday = latestSchedule && new Date(latestSchedule.generatedAt).toDateString() === now.toDateString();
    
    if (!isScheduleToday) {
      setShowDailyCheckin(true);
    }
  }, [hydrating, latestSchedule]);

  const completedCount = insights?.completedTasks ?? tasks.filter(t => t.status === 'done').length;
  const burnoutScore = latestSchedule?.analysisResults?.burnout_score
    ?? (insights?.latestBurnout != null ? Number(insights.latestBurnout) : 0);
  const burnoutPct = Math.round(burnoutScore * 100);
  const flowPct = Math.min(100, Math.round(((behavioralLogs?.study_hours_today || 0) / (userData?.max_hours_per_day || 6)) * 100));
  
  const dayStreak = insights?.dayStreak ?? 0;
  const avgFocus = insights?.avgFocusRating ?? 0;




  const initial = (user?.name || userData.name || 'IH').slice(0, 2).toUpperCase();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 12, paddingBottom: 100 }}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.greeting, { color: colors.textLight, fontFamily: fonts.medium }]}>Good morning ☀️</Text>
          <Text style={[styles.userName, { color: colors.textDark, fontFamily: fonts.bold }]}>{user?.name || 'Student'}</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.iconBtn}>
            <Ionicons name="notifications" size={22} color={colors.textDark} />
            <View style={styles.notifDot} />
          </TouchableOpacity>
          <LinearGradient colors={[colors.primary, '#8575F3']} style={styles.avatar}>
            <Text style={[styles.avatarText, { fontFamily: fonts.bold }]}>{initial}</Text>
          </LinearGradient>
        </View>
      </View>

      {/* AI Alert Card */}
      {showAiAlert && latestSchedule && new Date(latestSchedule.generatedAt).toDateString() === new Date().toDateString() && (
        <LinearGradient
          colors={[colors.primaryLight, colors.primaryLight]}
          style={[styles.aiCard, { borderColor: colors.border }]}
        >
          <MaterialCommunityIcons name="robot" size={28} color={colors.primary} style={styles.aiIcon} />
          <View style={styles.aiTextContainer}>
            <Text style={[styles.aiMessage, { color: colors.primary, fontFamily: fonts.medium }]}>
              <Text style={{ fontFamily: fonts.bold }}>AI Optimized!</Text> Your schedule was adjusted based on your energy patterns.
            </Text>
          </View>
          <TouchableOpacity onPress={() => setShowAiAlert(false)}>
            <Ionicons name="close" size={20} color={colors.textLight} />
          </TouchableOpacity>
        </LinearGradient>
      )}

      {/* Top Stats Row */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
          <Ionicons name="flame" size={24} color="#FF7675" />
          <Text style={[styles.statVal, { color: colors.textDark, fontFamily: fonts.bold }]}>{dayStreak}</Text>
          <Text style={[styles.statLab, { color: colors.textLight, fontFamily: fonts.bold }]}>DAY STREAK</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
          <View style={styles.ratingRow}>
            <Text style={[styles.statVal, { color: colors.textDark, fontFamily: fonts.bold }]}>{avgFocus.toFixed(1)}</Text>
            <Ionicons name="star" size={20} color={colors.textDark} />
          </View>
          <Text style={[styles.statLab, { color: colors.textLight, fontFamily: fonts.bold }]}>AVG RATING</Text>

        </View>
      </View>

      {/* Wellness Status */}
      <View style={[styles.sectionCard, { backgroundColor: colors.surface }]}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>Wellness Status</Text>
          <View style={[
            styles.balancedBadge, 
            { backgroundColor: burnoutPct < 35 ? '#DCFCE7' : burnoutPct < 70 ? '#FEF3C7' : '#FEE2E2' }
          ]}>
            <Ionicons 
              name={burnoutPct < 35 ? "checkmark" : burnoutPct < 70 ? "warning-outline" : "alert-circle-outline"} 
              size={12} 
              color={burnoutPct < 35 ? "#10B981" : burnoutPct < 70 ? "#D97706" : "#EF4444"} 
            />
            <Text style={[
              styles.balancedText, 
              { 
                color: burnoutPct < 35 ? "#059669" : burnoutPct < 70 ? "#B45309" : "#B91C1C",
                fontFamily: fonts.bold 
              }
            ]}>
              {burnoutPct < 35 ? 'Balanced' : burnoutPct < 70 ? 'Caution' : 'High Risk'}
            </Text>
          </View>
        </View>
        <View style={styles.wellnessGrids}>
          <View style={styles.wellnessItem}>
             <View style={styles.wellnessIconRow}>
               <MaterialCommunityIcons name="waves" size={18} color="#06B6D4" />
               <Text style={[styles.wellnessLabel, { fontFamily: fonts.medium }]}>Flow State</Text>
             </View>
             <View style={[styles.progBg, { backgroundColor: colors.cardAlt }]}><View style={[styles.progFill, { backgroundColor: '#22D3EE', width: `${flowPct}%` }]} /></View>
             <Text style={[styles.wellnessHint, { color: colors.textLight, fontFamily: fonts.medium }]}>
               {flowPct}% — {avgFocus > 4.2 ? 'Great focus!' : avgFocus > 3.5 ? 'Good focus' : avgFocus > 2.5 ? 'Moderate focus' : 'Needs focus'}
             </Text>
          </View>

          <View style={styles.wellnessItem}>
             <View style={styles.wellnessIconRow}>
               <Ionicons name="flame" size={18} color="#F87171" />
               <Text style={[styles.wellnessLabel, { fontFamily: fonts.medium }]}>Burnout Risk</Text>
             </View>
             <View style={[styles.progBg, { backgroundColor: colors.cardAlt }]}><View style={[styles.progFill, { backgroundColor: '#FB7185', width: `${burnoutPct}%` }]} /></View>
             <Text style={[styles.wellnessHint, { color: colors.textLight, fontFamily: fonts.medium }]}>{burnoutPct}% — Low risk</Text>
          </View>
        </View>
      </View>



      {/* Subject Progress */}
      <Text style={[styles.sectionTitle, { color: colors.textDark, fontFamily: fonts.bold, marginBottom: 15 }]}>Subject Progress</Text>
      <View style={[styles.subjectCard, { backgroundColor: colors.surface }]}>
        {subjects.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 20 }}>
            <MaterialCommunityIcons name="book-plus-outline" size={40} color={colors.textLight} />
            <Text style={{ color: colors.textLight, fontFamily: fonts.medium, marginTop: 10, textAlign: 'center' }}>
              No subjects yet. Use the Daily Check-in or Subjects tab to add your first one!
            </Text>
          </View>
        ) : subjects.map((s, idx) => {
          const subTasks = tasks.filter(t => t.subject_id === s.id);
          const doneCount = subTasks.filter(t => t.status === 'done').length;
          const pct = subTasks.length === 0 ? 0 : Math.round((doneCount / subTasks.length) * 100);
          const icon = idx === 0 ? "math-compass" : idx === 1 ? "microscope" : idx === 2 ? "book-open-page-variant" : "bank";
          const subColor = idx === 0 ? "#3B82F6" : idx === 1 ? "#10B981" : idx === 2 ? "#F43F5E" : "#F59E0B";
          
          return (
            <View key={s.id} style={styles.subjectItem}>
              <View style={[styles.subIconBox, { backgroundColor: colors.cardAlt }]}>
                <MaterialCommunityIcons name={icon} size={20} color={colors.textDark} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.subName, { color: colors.textDark, fontFamily: fonts.bold }]}>{s.name}</Text>
                <View style={styles.subProgRow}>
                  <View style={[styles.subProgBg, { backgroundColor: colors.cardAlt }]}><View style={[styles.subProgFill, { backgroundColor: subColor, width: `${pct}%` }]} /></View>
                  <Text style={[styles.subPct, { color: colors.textLight, fontFamily: fonts.medium }]}>{pct}%</Text>
                </View>
              </View>
            </View>
          );
        })}
      </View>

      {/* Daily Check-in Modal */}
      <DailyCheckinModal 
        visible={showDailyCheckin} 
        onClose={() => setShowDailyCheckin(false)} 
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  greeting: { fontSize: 14, marginBottom: 4 },
  userName: { fontSize: 26 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  iconBtn: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  notifDot: { position: 'absolute', top: 12, right: 12, width: 8, height: 8, backgroundColor: '#F43F5E', borderRadius: 4, borderWidth: 2, borderColor: '#FFF' },
  avatar: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#FFF', fontSize: 16 },
  aiCard: { flexDirection: 'row', padding: 18, borderRadius: 20, marginBottom: 30, alignItems: 'center', borderWidth: 1 },
  aiIcon: { marginRight: 15 },
  aiTextContainer: { flex: 1 },
  aiMessage: { fontSize: 13, lineHeight: 20 },
  statsRow: { flexDirection: 'row', gap: 15, marginBottom: 30 },
  statCard: { flex: 1, padding: 20, borderRadius: 24, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 12, elevation: 2 },
  statVal: { fontSize: 32, marginBottom: 4 },
  statLab: { fontSize: 10, letterSpacing: 1 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },

  sectionCard: { padding: 22, borderRadius: 28, marginBottom: 35, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 15, elevation: 2 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  sectionTitle: { fontSize: 18 },
  balancedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#DCFCE7', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  balancedText: { fontSize: 11, color: '#059669' },
  wellnessGrids: { flexDirection: 'row', gap: 20 },
  wellnessItem: { flex: 1 },
  wellnessIconRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  wellnessLabel: { fontSize: 13 },
  progBg: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progFill: { height: '100%', borderRadius: 3 },
  wellnessHint: { fontSize: 10, marginTop: 8 },

  subjectCard: { padding: 22, borderRadius: 28, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 15, elevation: 2 },
  subjectItem: { flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: 20 },
  subIconBox: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  subName: { fontSize: 15, marginBottom: 6 },
  subProgRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  subProgBg: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  subProgFill: { height: '100%', borderRadius: 3 },
  subPct: { fontSize: 12, width: 30 },

});
