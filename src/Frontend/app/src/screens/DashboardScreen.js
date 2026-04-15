import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useTheme } from '../theme/theme';
import { useAI } from '../context/ai_context';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export const DashboardScreen = () => {
  const { colors, fonts } = useTheme();
  const { userData, behavioralLogs, tasks } = useAI();
  const [showAIInsight, setShowAIInsight] = useState(true);

  const completedCount = tasks.filter(t => t.status === 'done').length;
  const isColdStart = completedCount < 40;
  
  const burnoutRisk = 0.45;
  const burnoutColor = burnoutRisk < 0.4 ? colors.accent.science : burnoutRisk < 0.75 ? '#FFD166' : colors.accent.exam;

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: colors.background }]} 
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 12, paddingBottom: 100 }}
    >
      <View style={styles.header}>
        <View>
          <Text style={[styles.greeting, { color: colors.textLight, fontFamily: fonts.medium }]}>Good morning ☀️</Text>
          <Text style={[styles.userName, { color: colors.textDark, fontFamily: fonts.bold }]}>{userData.name || 'Ibrahim Hilvani'}</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="notifications" size={22} color={colors.textDark} />
            <View style={styles.notifBadge} />
          </TouchableOpacity>
          <LinearGradient colors={[colors.primary, '#A29BFE']} style={styles.avatar}>
             <Text style={[styles.avatarText, { fontFamily: fonts.bold }]}>IH</Text>
          </LinearGradient>
        </View>
      </View>

      {showAIInsight && (
        <LinearGradient
          colors={['#E0DBFF', '#F2F0FF']}
          style={[styles.aiCard, { borderColor: 'rgba(107, 92, 231, 0.2)', borderWidth: 1 }]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.aiCardHeader}>
            <View style={styles.aiIconRow}>
               <MaterialCommunityIcons name="robot" size={24} color={colors.primary} />
               <Text style={[styles.aiTitle, { color: colors.primary, fontFamily: fonts.bold }]}>AI Optimized!</Text>
            </View>
            <TouchableOpacity onPress={() => setShowAIInsight(false)}>
               <Ionicons name="close" size={20} color={colors.textLight} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.aiMessage, { color: colors.textDark, fontFamily: fonts.medium }]}>
             Your schedule was adjusted based on your energy patterns.
          </Text>
        </LinearGradient>
      )}

      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.statTop}>
             <Ionicons name="flame" size={20} color="#FF7675" />
             <Text style={[styles.statVal, { color: colors.textDark, fontFamily: fonts.bold }]}>12</Text>
          </View>
          <Text style={[styles.statLab, { color: colors.textLight, fontFamily: fonts.medium }]}>DAY STREAK</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.statTop}>
             <Text style={[styles.statVal, { color: colors.textDark, fontFamily: fonts.bold }]}>4.8</Text>
             <Ionicons name="star" size={20} color="#FDCB6E" />
          </View>
          <Text style={[styles.statLab, { color: colors.textLight, fontFamily: fonts.medium }]}>AVG RATING</Text>
        </View>
      </View>

      <View style={[styles.wellnessCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
           <Text style={[styles.sectionTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>Wellness Status</Text>
           <View style={[styles.statusBadge, { backgroundColor: '#DCFCE7' }]}>
              <Ionicons name="checkmark-circle" size={14} color="#059669" />
              <Text style={[styles.statusText, { color: '#059669', fontFamily: fonts.bold }]}>Balanced</Text>
           </View>
        </View>
        
        <View style={styles.progressRow}>
           <View style={styles.progressItem}>
              <View style={styles.progLabelRow}>
                 <MaterialCommunityIcons name="waves" size={14} color={colors.accent.science} />
                 <Text style={[styles.progLabel, { color: colors.textLight, fontFamily: fonts.semiBold }]}>Flow State</Text>
              </View>
              <View style={[styles.progBarBg, { backgroundColor: colors.cardAlt }]}>
                 <View style={[styles.progBarFill, { backgroundColor: colors.accent.science, width: '78%' }]} />
              </View>
              <Text style={[styles.progHint, { color: colors.textLight, fontFamily: fonts.medium }]}>78% — Great focus!</Text>
           </View>
           <View style={styles.progressItem}>
              <View style={styles.progLabelRow}>
                 <Ionicons name="flame" size={14} color={colors.accent.exam} />
                 <Text style={[styles.progLabel, { color: colors.textLight, fontFamily: fonts.semiBold }]}>Burnout Risk</Text>
              </View>
              <View style={[styles.progBarBg, { backgroundColor: colors.cardAlt }]}>
                 <View style={[styles.progBarFill, { backgroundColor: colors.accent.exam, width: '25%' }]} />
              </View>
              <Text style={[styles.progHint, { color: colors.textLight, fontFamily: fonts.medium }]}>25% — Low risk</Text>
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
        <TouchableOpacity>
           <Text style={[styles.viewAll, { color: colors.primary, fontFamily: fonts.bold }]}>View All</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.taskList}>
        {tasks.slice(0, 3).map((task, idx) => (
          <View key={idx} style={[styles.taskItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.taskIndicator, { backgroundColor: idx === 0 ? colors.primary : idx === 1 ? colors.accent.science : colors.accent.exam }]} />
            <View style={styles.taskInfo}>
              <Text style={[styles.taskSubject, { color: colors.textDark, fontFamily: fonts.bold }]}>{task.subject}</Text>
              <View style={styles.taskMeta}>
                 <MaterialCommunityIcons name="account-school-outline" size={14} color={colors.textLight} />
                 <Text style={[styles.taskMetaText, { color: colors.textLight, fontFamily: fonts.medium }]}> {task.subject.split(' ')[0]} • Due 2:00 PM</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.taskAction}>
               <View style={[styles.snoozeBadge, { backgroundColor: '#FFF3E0' }]}>
                  <MaterialCommunityIcons name="clock-outline" size={12} color="#E67E22" />
                  <Text style={[styles.snoozeText, { color: '#E67E22', fontFamily: fonts.bold }]}>Snooze</Text>
               </View>
               <View style={[styles.checkCircle, { borderColor: colors.border }]} />
            </TouchableOpacity>
          </View>
        ))}
      </View>

      <View style={styles.tasksHeader}>
        <Text style={[styles.sectionTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>Subject Progress</Text>
        <TouchableOpacity style={styles.editTimelineBtn}>
           <Text style={[styles.editTimelineText, { color: colors.primary, fontFamily: fonts.bold }]}>Edit Timeline</Text>
           <Ionicons name="chevron-forward" size={16} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={[styles.progressCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
         {['Mathematics', 'Science', 'Literature', 'History'].map((s, i) => (
           <View key={i} style={styles.progressItemLine}>
              <View style={[styles.subIcon, { backgroundColor: colors.cardAlt }]}>
                 <MaterialCommunityIcons name={i % 2 === 0 ? 'calculator' : 'microscope'} size={18} color={colors.primary} />
              </View>
              <View style={{flex: 1}}>
                 <View style={styles.progLineHeader}>
                    <Text style={[styles.progSubName, { color: colors.textDark, fontFamily: fonts.bold }]}>{s}</Text>
                    <Text style={[styles.progPerc, { color: colors.textLight, fontFamily: fonts.medium }]}>{72 - i * 15}%</Text>
                 </View>
                 <View style={[styles.progLineBg, { backgroundColor: colors.cardAlt }]}>
                    <View style={[styles.progLineFill, { backgroundColor: colors.primary, width: `${72 - i * 15}%` }]} />
                 </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.border} style={{ marginLeft: 15 }} />
           </View>
         ))}
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
  iconButton: { width: 46, height: 46, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  notifBadge: { position: 'absolute', top: 12, right: 12, width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF4757', borderWidth: 1.5, borderColor: '#FFF' },
  avatar: { width: 46, height: 46, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#FFF', fontSize: 16 },
  aiCard: { padding: 22, borderRadius: 28, marginBottom: 35 },
  aiCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  aiIconRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  aiTitle: { fontSize: 18 },
  aiMessage: { fontSize: 14, lineHeight: 22, opacity: 0.8 },
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
  viewAll: { fontSize: 13 },
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
  editTimelineBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editTimelineText: { fontSize: 13 },
  progressCard: { padding: 22, borderRadius: 28, borderWidth: 1 },
  progressItemLine: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 14 },
  subIcon: { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  progLineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 },
  progSubName: { fontSize: 15 },
  progPerc: { fontSize: 12, opacity: 0.6 },
  progLineBg: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progLineFill: { height: '100%', borderRadius: 3 }
});
