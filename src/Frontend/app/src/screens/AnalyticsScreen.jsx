import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../theme/theme';
import { useAI } from '../context/ai_context';
import { useAppNavigation } from '../context/navigation_context';
import { analyticsApi } from '../services/api';

export const AnalyticsScreen = () => {
  const { colors, fonts } = useTheme();
  const { tasks, subjects, behavioralLogs } = useAI();
  const { navigate } = useAppNavigation();
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    analyticsApi.insights()
      .then((data) => { if (alive) setInsights(data); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const doneTasks = tasks.filter((t) => t.status === 'done');
  const openTasks = tasks.filter((t) => t.status !== 'done');
  const streak = insights?.dayStreak ?? 0;
  const todayHours = Number(insights?.studyHoursToday ?? behavioralLogs?.study_hours_today ?? 0);
  const avgFocus = Number(insights?.avgFocusRating ?? 0);
  const completedTasks = insights?.completedTasks ?? doneTasks.length;
  const weeklyEntries = Object.entries(insights?.weeklyStudyData || {});
  const maxWeekHours = Math.max(1, ...weeklyEntries.map(([, value]) => Number(value) || 0));
  const nextMilestone = streak >= 30 ? 60 : streak >= 14 ? 30 : streak >= 7 ? 14 : streak >= 3 ? 7 : 3;
  const streakProgress = Math.min(100, Math.round((streak / nextMilestone) * 100));

  const courseMomentum = useMemo(() => subjects.map((course, index) => {
    const courseTasks = tasks.filter((t) => t.subject_id === course.id);
    const done = courseTasks.filter((t) => t.status === 'done').length;
    const open = courseTasks.length - done;
    const progress = courseTasks.length === 0 ? 0 : Math.round((done / courseTasks.length) * 100);
    const colorsList = ['#6366F1', '#10B981', '#F43F5E', '#F59E0B', '#06B6D4'];
    return { ...course, done, open, progress, color: colorsList[index % colorsList.length] };
  }), [subjects, tasks]);

  const achievements = [
    { title: 'First Win', detail: 'Finish any task', icon: 'checkmark-circle-outline', unlocked: completedTasks >= 1 },
    { title: 'Three-Day Spark', detail: 'Reach a 3 day streak', icon: 'flame-outline', unlocked: streak >= 3 },
    { title: 'Course Builder', detail: 'Track 3 courses', icon: 'library-outline', unlocked: subjects.length >= 3 },
    { title: 'Focus Hour', detail: 'Study 1 hour today', icon: 'timer-outline', unlocked: todayHours >= 1 },
  ];

  const headline = streak > 0
    ? `Protect your ${streak} day streak today.`
    : doneTasks.length > 0
      ? 'Finish one task today to start a new streak.'
      : 'Complete your first task to wake up your analytics.';

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: colors.surface }]} onPress={() => navigate('home')}>
          <Ionicons name="chevron-back" size={22} color={colors.textDark} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>Study Pulse</Text>
          <Text style={[styles.headerSub, { color: colors.textLight, fontFamily: fonts.medium }]}>Streaks, wins, and course momentum.</Text>
        </View>
      </View>

      {loading && !insights ? (
        <View style={[styles.loadingCard, { backgroundColor: colors.surface }]}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textLight, fontFamily: fonts.medium }]}>Reading your progress...</Text>
        </View>
      ) : null}

      <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.heroTop}>
          <View>
            <Text style={[styles.heroLabel, { color: colors.primary, fontFamily: fonts.bold }]}>DAILY STREAK</Text>
            <Text style={[styles.heroNumber, { color: colors.textDark, fontFamily: fonts.bold }]}>{streak}</Text>
          </View>
          <View style={[styles.heroIcon, { backgroundColor: colors.primaryLight }]}>
            <Ionicons name="flame" size={30} color={colors.primary} />
          </View>
        </View>
        <Text style={[styles.heroText, { color: colors.textDark, fontFamily: fonts.bold }]}>{headline}</Text>
        <View style={[styles.progressBg, { backgroundColor: colors.cardAlt }]}>
          <View style={[styles.progressFill, { width: `${streakProgress}%`, backgroundColor: colors.primary }]} />
        </View>
        <Text style={[styles.progressHint, { color: colors.textLight, fontFamily: fonts.medium }]}>
          {Math.max(0, nextMilestone - streak)} day{nextMilestone - streak === 1 ? '' : 's'} to the next milestone.
        </Text>
      </View>

      <View style={styles.statsGrid}>
        <MetricCard colors={colors} fonts={fonts} label="DONE TASKS" value={completedTasks} icon="checkbox-outline" />
        <MetricCard colors={colors} fonts={fonts} label="OPEN TASKS" value={openTasks.length} icon="list-outline" />
        <MetricCard colors={colors} fonts={fonts} label="TODAY" value={`${todayHours.toFixed(1)}h`} icon="time-outline" />
        <MetricCard colors={colors} fonts={fonts} label="FOCUS" value={avgFocus ? avgFocus.toFixed(1) : '-'} icon="star-outline" />
      </View>

      <SectionTitle colors={colors} fonts={fonts} title="Weekly Rhythm" icon="bar-chart-outline" />
      <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {weeklyEntries.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textLight, fontFamily: fonts.medium }]}>Study sessions will draw your weekly rhythm here.</Text>
        ) : (
          weeklyEntries.map(([day, value]) => {
            const hours = Number(value) || 0;
            return (
              <View key={day} style={styles.weekRow}>
                <Text style={[styles.weekDay, { color: colors.textLight, fontFamily: fonts.bold }]}>{day}</Text>
                <View style={[styles.weekBarBg, { backgroundColor: colors.cardAlt }]}>
                  <View style={[styles.weekBarFill, { width: `${Math.max(6, Math.round((hours / maxWeekHours) * 100))}%`, backgroundColor: colors.primary }]} />
                </View>
                <Text style={[styles.weekValue, { color: colors.textDark, fontFamily: fonts.bold }]}>{hours.toFixed(1)}h</Text>
              </View>
            );
          })
        )}
      </View>

      <SectionTitle colors={colors} fonts={fonts} title="Achievements" icon="ribbon-outline" />
      <View style={styles.achievementGrid}>
        {achievements.map((item) => (
          <View key={item.title} style={[styles.achievementCard, { backgroundColor: colors.surface, borderColor: item.unlocked ? colors.primary + '55' : colors.border }]}>
            <View style={[styles.achievementIcon, { backgroundColor: item.unlocked ? colors.primaryLight : colors.cardAlt }]}>
              <Ionicons name={item.icon} size={21} color={item.unlocked ? colors.primary : colors.textLight} />
            </View>
            <Text style={[styles.achievementTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>{item.title}</Text>
            <Text style={[styles.achievementDetail, { color: colors.textLight, fontFamily: fonts.medium }]}>{item.unlocked ? 'Unlocked' : item.detail}</Text>
          </View>
        ))}
      </View>

      <SectionTitle colors={colors} fonts={fonts} title="Course Momentum" icon="school-outline" />
      <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {courseMomentum.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textLight, fontFamily: fonts.medium }]}>Add courses and tasks to see course-by-course progress.</Text>
        ) : (
          courseMomentum.map((course) => (
            <View key={course.id} style={styles.courseRow}>
              <View style={[styles.courseIcon, { backgroundColor: course.color + '16' }]}>
                <MaterialCommunityIcons name="book-outline" size={18} color={course.color} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.courseTop}>
                  <Text style={[styles.courseName, { color: colors.textDark, fontFamily: fonts.bold }]} numberOfLines={1}>{course.name}</Text>
                  <Text style={[styles.coursePct, { color: colors.textLight, fontFamily: fonts.bold }]}>{course.progress}%</Text>
                </View>
                <View style={[styles.courseBarBg, { backgroundColor: colors.cardAlt }]}>
                  <View style={[styles.courseBarFill, { width: `${course.progress}%`, backgroundColor: course.color }]} />
                </View>
                <Text style={[styles.courseMeta, { color: colors.textLight, fontFamily: fonts.medium }]}>
                  {course.done} done | {course.open} open
                </Text>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
};

const MetricCard = ({ colors, fonts, label, value, icon }) => (
  <View style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
    <Ionicons name={icon} size={21} color={colors.primary} />
    <Text style={[styles.metricValue, { color: colors.textDark, fontFamily: fonts.bold }]}>{value}</Text>
    <Text style={[styles.metricLabel, { color: colors.textLight, fontFamily: fonts.bold }]}>{label}</Text>
  </View>
);

const SectionTitle = ({ colors, fonts, title, icon }) => (
  <View style={styles.sectionTitleRow}>
    <Text style={[styles.sectionTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>{title}</Text>
    <Ionicons name={icon} size={19} color={colors.primary} />
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 110 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 },
  backBtn: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 28 },
  headerSub: { fontSize: 13, marginTop: 4 },
  loadingCard: { borderRadius: 18, padding: 16, alignItems: 'center', marginBottom: 14 },
  loadingText: { fontSize: 13, marginTop: 8 },
  hero: { borderWidth: 1, borderRadius: 26, padding: 22, marginBottom: 14 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroLabel: { fontSize: 11, letterSpacing: 1 },
  heroNumber: { fontSize: 56, lineHeight: 62, marginTop: 4 },
  heroIcon: { width: 58, height: 58, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  heroText: { fontSize: 18, lineHeight: 24, marginTop: 12 },
  progressBg: { height: 10, borderRadius: 10, overflow: 'hidden', marginTop: 18 },
  progressFill: { height: '100%', borderRadius: 10 },
  progressHint: { fontSize: 12, marginTop: 9 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 22 },
  metricCard: { width: '48%', borderWidth: 1, borderRadius: 20, padding: 16 },
  metricValue: { fontSize: 24, marginTop: 10 },
  metricLabel: { fontSize: 10, letterSpacing: 0.7, marginTop: 5 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, marginTop: 4 },
  sectionTitle: { fontSize: 18 },
  sectionCard: { borderWidth: 1, borderRadius: 22, padding: 16, marginBottom: 22 },
  emptyText: { fontSize: 13, textAlign: 'center', lineHeight: 19, paddingVertical: 12 },
  weekRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  weekDay: { width: 36, fontSize: 11 },
  weekBarBg: { flex: 1, height: 11, borderRadius: 11, overflow: 'hidden' },
  weekBarFill: { height: '100%', borderRadius: 11 },
  weekValue: { width: 42, textAlign: 'right', fontSize: 12 },
  achievementGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 22 },
  achievementCard: { width: '48%', borderWidth: 1, borderRadius: 20, padding: 15 },
  achievementIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  achievementTitle: { fontSize: 14 },
  achievementDetail: { fontSize: 12, marginTop: 4 },
  courseRow: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 16 },
  courseIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  courseTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  courseName: { flex: 1, fontSize: 15 },
  coursePct: { fontSize: 12 },
  courseBarBg: { height: 8, borderRadius: 8, overflow: 'hidden', marginTop: 8 },
  courseBarFill: { height: '100%', borderRadius: 8 },
  courseMeta: { fontSize: 12, marginTop: 5 },
});
