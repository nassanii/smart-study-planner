import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTheme } from '../theme/theme';
import { useAI } from '../context/ai_context';
import { useAuth } from '../context/auth_context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { analyticsApi } from '../services/api';
import { showAlert } from '../services/dialogs';

export const DashboardScreen = () => {
  const { colors, fonts } = useTheme();
  const { user } = useAuth();
  const { userData, behavioralLogs, tasks, subjects, latestSchedule, generateSchedule, completeTask, snoozeTask } = useAI();
  const [insights, setInsights] = useState(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    analyticsApi.insights().then(setInsights).catch(() => {});
  }, []);

  const completedCount = insights?.completedTasks ?? tasks.filter(t => t.status === 'done').length;
  const isColdStart = completedCount < 40;
  const burnoutScore = latestSchedule?.analysisResults?.burnout_score
    ?? (insights?.latestBurnout != null ? Number(insights.latestBurnout) : null);
  const burnoutPct = burnoutScore != null ? Math.round(burnoutScore * 100) : null;
  const aiMessage = latestSchedule?.aiSchedule?.ai_message
    || latestSchedule?.errorMessage
    || (latestSchedule == null ? 'Generate today\'s AI plan to see your strategic summary.' : null);
  const dayStreak = insights?.dayStreak ?? 0;
  const avgFocus = insights?.avgFocusRating ?? null;

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const result = await generateSchedule();
      const refreshedInsights = await analyticsApi.insights().catch(() => null);
      if (refreshedInsights) setInsights(refreshedInsights);
      if (result.hasError) {
        showAlert('AI returned an error', result.errorMessage || 'Could not generate a schedule.');
      }
    } catch (err) {
      showAlert('Generation failed', err.response?.data?.title || err.message);
    } finally {
      setGenerating(false);
    }
  };

  const todaysTasks = tasks.filter(t => t.status !== 'done').slice(0, 3);

  const initial = (user?.name || userData.name || 'U').slice(0, 1).toUpperCase();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 12, paddingBottom: 100 }}
    >
      <View style={styles.header}>
        <View>
          <Text style={[styles.greeting, { color: colors.textLight, fontFamily: fonts.medium }]}>Hello 👋</Text>
          <Text style={[styles.userName, { color: colors.textDark, fontFamily: fonts.bold }]}>{user?.name || 'Student'}</Text>
        </View>
        <View style={styles.headerRight}>
          <LinearGradient colors={[colors.primary, '#A29BFE']} style={styles.avatar}>
             <Text style={[styles.avatarText, { fontFamily: fonts.bold }]}>{initial}</Text>
          </LinearGradient>
        </View>
      </View>

      <LinearGradient
        colors={['#E0DBFF', '#F2F0FF']}
        style={[styles.aiCard, { borderColor: 'rgba(107, 92, 231, 0.2)', borderWidth: 1 }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.aiCardHeader}>
          <View style={styles.aiIconRow}>
             <MaterialCommunityIcons name="robot" size={24} color={colors.primary} />
             <Text style={[styles.aiTitle, { color: colors.primary, fontFamily: fonts.bold }]}>
               {latestSchedule ? 'AI Strategic Summary' : 'No plan yet'}
             </Text>
          </View>
        </View>
        {aiMessage && (
          <Text style={[styles.aiMessage, { color: colors.textDark, fontFamily: fonts.medium }]}>
            {aiMessage}
          </Text>
        )}
        <TouchableOpacity onPress={handleGenerate} disabled={generating} style={[styles.generateBtn, { backgroundColor: colors.primary }]}>
          {generating
            ? <ActivityIndicator color="#FFF" />
            : <Text style={[styles.generateBtnText, { fontFamily: fonts.bold }]}>{latestSchedule ? 'Regenerate Plan' : 'Generate AI Plan'}</Text>}
        </TouchableOpacity>
      </LinearGradient>

      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.statTop}>
             <Ionicons name="flame" size={20} color="#FF7675" />
             <Text style={[styles.statVal, { color: colors.textDark, fontFamily: fonts.bold }]}>{dayStreak}</Text>
          </View>
          <Text style={[styles.statLab, { color: colors.textLight, fontFamily: fonts.medium }]}>DAY STREAK</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.statTop}>
             <Text style={[styles.statVal, { color: colors.textDark, fontFamily: fonts.bold }]}>
               {avgFocus != null ? Number(avgFocus).toFixed(1) : '—'}
             </Text>
             <Ionicons name="star" size={20} color="#FDCB6E" />
          </View>
          <Text style={[styles.statLab, { color: colors.textLight, fontFamily: fonts.medium }]}>AVG RATING</Text>
        </View>
      </View>

      <View style={[styles.wellnessCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
           <Text style={[styles.sectionTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>Wellness Status</Text>
           {burnoutPct != null && (
             <View style={[styles.statusBadge, { backgroundColor: burnoutPct < 40 ? '#DCFCE7' : burnoutPct < 75 ? '#FFF3CD' : '#FED7D7' }]}>
                <Ionicons name={burnoutPct < 40 ? 'checkmark-circle' : 'warning'} size={14} color={burnoutPct < 40 ? '#059669' : burnoutPct < 75 ? '#B45309' : '#B91C1C'} />
                <Text style={[styles.statusText, { color: burnoutPct < 40 ? '#059669' : burnoutPct < 75 ? '#B45309' : '#B91C1C', fontFamily: fonts.bold }]}>
                  {burnoutPct < 40 ? 'Balanced' : burnoutPct < 75 ? 'Watch' : 'Exhausted'}
                </Text>
             </View>
           )}
        </View>

        <View style={styles.progressRow}>
           <View style={styles.progressItem}>
              <View style={styles.progLabelRow}>
                 <MaterialCommunityIcons name="waves" size={14} color={colors.accent.science} />
                 <Text style={[styles.progLabel, { color: colors.textLight, fontFamily: fonts.semiBold }]}>Study Today</Text>
              </View>
              <View style={[styles.progBarBg, { backgroundColor: colors.cardAlt }]}>
                 <View style={[styles.progBarFill, { backgroundColor: colors.accent.science, width: `${Math.min(100, Math.round((behavioralLogs.study_hours_today / (userData.max_hours_per_day || 6)) * 100))}%` }]} />
              </View>
              <Text style={[styles.progHint, { color: colors.textLight, fontFamily: fonts.medium }]}>{behavioralLogs.study_hours_today.toFixed(1)}h logged</Text>
           </View>
           <View style={styles.progressItem}>
              <View style={styles.progLabelRow}>
                 <Ionicons name="flame" size={14} color={colors.accent.exam} />
                 <Text style={[styles.progLabel, { color: colors.textLight, fontFamily: fonts.semiBold }]}>Burnout</Text>
              </View>
              <View style={[styles.progBarBg, { backgroundColor: colors.cardAlt }]}>
                 <View style={[styles.progBarFill, { backgroundColor: colors.accent.exam, width: `${burnoutPct ?? 0}%` }]} />
              </View>
              <Text style={[styles.progHint, { color: colors.textLight, fontFamily: fonts.medium }]}>{burnoutPct != null ? `${burnoutPct}%` : 'No data'}</Text>
           </View>
        </View>
      </View>

      <View style={styles.tasksHeader}>
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 10}}>
           <Text style={[styles.sectionTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>Today's Tasks</Text>
           {isColdStart && (
             <View style={[styles.coldStartBadge, { backgroundColor: '#FFF9E6' }]}>
                <Text style={[styles.coldStartText, { color: '#D97706', fontFamily: fonts.bold }]}>COLD START</Text>
             </View>
           )}
        </View>
      </View>

      <View style={styles.taskList}>
        {todaysTasks.length === 0 && (
          <Text style={{ color: colors.textLight, fontFamily: fonts.medium, paddingVertical: 20 }}>
            No upcoming tasks. Add one from the Tasks tab.
          </Text>
        )}
        {todaysTasks.map((task) => (
          <View key={task.id} style={[styles.taskItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.taskIndicator, { backgroundColor: task.priority === 1 ? colors.accent.exam : task.priority === 2 ? '#FFD166' : colors.accent.science }]} />
            <View style={styles.taskInfo}>
              <Text style={[styles.taskSubject, { color: colors.textDark, fontFamily: fonts.bold }]}>{task.subject}</Text>
              <View style={styles.taskMeta}>
                 <MaterialCommunityIcons name="account-school-outline" size={14} color={colors.textLight} />
                 <Text style={[styles.taskMetaText, { color: colors.textLight, fontFamily: fonts.medium }]}> D{task.difficulty_rating}/10 · ~{task.estimated_minutes}m</Text>
              </View>
            </View>
            <View style={styles.taskAction}>
               <TouchableOpacity onPress={() => snoozeTask(task.id, 'dashboard snooze').catch(() => {})}>
                 <View style={[styles.snoozeBadge, { backgroundColor: '#FFF3E0' }]}>
                    <MaterialCommunityIcons name="clock-outline" size={12} color="#E67E22" />
                    <Text style={[styles.snoozeText, { color: '#E67E22', fontFamily: fonts.bold }]}>Snooze</Text>
                 </View>
               </TouchableOpacity>
               <TouchableOpacity onPress={() => completeTask(task.id, task.estimated_minutes || 50).catch(() => {})}>
                 <View style={[styles.checkCircle, { borderColor: colors.primary, backgroundColor: 'transparent' }]} />
               </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.tasksHeader}>
        <Text style={[styles.sectionTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>Subjects</Text>
      </View>

      <View style={[styles.progressCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
         {subjects.length === 0 && (
           <Text style={{ color: colors.textLight, fontFamily: fonts.medium }}>No subjects yet.</Text>
         )}
         {subjects.map((s) => {
           const subTasks = tasks.filter(t => t.subject_id === s.id);
           const doneCount = subTasks.filter(t => t.status === 'done').length;
           const pct = subTasks.length === 0 ? 0 : Math.round((doneCount / subTasks.length) * 100);
           return (
             <View key={s.id} style={styles.progressItemLine}>
                <View style={[styles.subIcon, { backgroundColor: colors.cardAlt }]}>
                   <MaterialCommunityIcons name="book-outline" size={18} color={colors.primary} />
                </View>
                <View style={{flex: 1}}>
                   <View style={styles.progLineHeader}>
                      <Text style={[styles.progSubName, { color: colors.textDark, fontFamily: fonts.bold }]}>{s.name}</Text>
                      <Text style={[styles.progPerc, { color: colors.textLight, fontFamily: fonts.medium }]}>{pct}%</Text>
                   </View>
                   <View style={[styles.progLineBg, { backgroundColor: colors.cardAlt }]}>
                      <View style={[styles.progLineFill, { backgroundColor: colors.primary, width: `${pct}%` }]} />
                   </View>
                </View>
             </View>
           );
         })}
      </View>

    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  greeting: { fontSize: 13, marginBottom: 4 },
  userName: { fontSize: 24 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  avatar: { width: 46, height: 46, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#FFF', fontSize: 16 },
  aiCard: { padding: 22, borderRadius: 28, marginBottom: 35 },
  aiCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  aiIconRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  aiTitle: { fontSize: 16 },
  aiMessage: { fontSize: 14, lineHeight: 22, opacity: 0.9, marginBottom: 16 },
  generateBtn: { paddingVertical: 12, borderRadius: 14, alignItems: 'center' },
  generateBtnText: { color: '#FFF', fontSize: 14 },
  statsRow: { flexDirection: 'row', gap: 15, marginBottom: 35 },
  statCard: { flex: 1, padding: 20, borderRadius: 24, borderWidth: 1 },
  statTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  statVal: { fontSize: 24 },
  statLab: { fontSize: 10, letterSpacing: 1 },
  wellnessCard: { padding: 22, borderRadius: 28, borderWidth: 1, marginBottom: 40 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  sectionTitle: { fontSize: 18 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  statusText: { fontSize: 11 },
  progressRow: { flexDirection: 'row', gap: 20 },
  progressItem: { flex: 1 },
  progLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  progLabel: { fontSize: 13, opacity: 0.7 },
  progBarBg: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progBarFill: { height: '100%', borderRadius: 3 },
  progHint: { fontSize: 10, marginTop: 8, opacity: 0.5 },
  tasksHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  coldStartBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  coldStartText: { fontSize: 9 },
  taskList: { gap: 16, marginBottom: 40 },
  taskItem: { flexDirection: 'row', padding: 18, borderRadius: 24, borderWidth: 1, alignItems: 'center' },
  taskIndicator: { width: 4, height: 36, borderRadius: 2, marginRight: 15 },
  taskInfo: { flex: 1 },
  taskSubject: { fontSize: 16, marginBottom: 4 },
  taskMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  taskMetaText: { fontSize: 11, opacity: 0.6 },
  taskAction: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  snoozeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  snoozeText: { fontSize: 11 },
  checkCircle: { width: 24, height: 24, borderRadius: 12, borderWidth: 2 },
  progressCard: { padding: 22, borderRadius: 28, borderWidth: 1 },
  progressItemLine: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 14 },
  subIcon: { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  progLineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 },
  progSubName: { fontSize: 15 },
  progPerc: { fontSize: 12, opacity: 0.6 },
  progLineBg: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progLineFill: { height: '100%', borderRadius: 3 }
});
