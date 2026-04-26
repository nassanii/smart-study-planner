import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { useTheme } from '../theme/theme';
import { useAI } from '../context/ai_context';
import { Ionicons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { analyticsApi } from '../services/api';

const screenWidth = Dimensions.get('window').width;

export const AnalyticsScreen = () => {
  const { colors, fonts } = useTheme();
  const { userData } = useAI();
  const [insights, setInsights] = useState(null);

  useEffect(() => {
    analyticsApi.insights().then(setInsights).catch(() => {});
  }, []);

  const chartConfig = {
    backgroundGradientFrom: colors.surface,
    backgroundGradientTo: colors.surface,
    color: (opacity = 1) => `rgba(107, 92, 231, ${opacity})`,
    labelColor: (opacity = 1) => colors.textLight,
    barPercentage: 0.6,
    propsForDots: { r: "4", strokeWidth: "2", stroke: colors.primary }
  };

  const planningFallacyData = {
    labels: ["Math", "Physics", "Bio", "Hist"],
    datasets: [
       { data: [60, 45, 90, 30], color: (opacity = 1) => `rgba(107, 92, 231, 0.4)` }, // Estimated
       { data: [75, 52, 85, 35], color: (opacity = 1) => colors.primary } // Actual
    ],
    legend: ["Est", "Act"]
  };

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: colors.background }]} 
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 12, paddingBottom: 100 }}
    >
      <View style={styles.header}>
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 10}}>
           <Text style={[styles.headerTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>AI Insights</Text>
           <MaterialCommunityIcons name="google-analytics" size={26} color={colors.primary} />
        </View>
        <View style={[styles.timeBadge, { backgroundColor: colors.primaryLight }]}>
           <Text style={[styles.timeBadgeText, { color: colors.primary, fontFamily: fonts.bold }]}>Weekly Report</Text>
        </View>
      </View>

      <View style={styles.statsGrid}>
         {[
           { l: 'Day Streak', v: insights ? `${insights.dayStreak}` : '—', i: 'fire', t: 'Consecutive', c: colors.accent.science },
           { l: 'Planning Error', v: insights ? `${insights.planningErrorMinutes >= 0 ? '+' : ''}${insights.planningErrorMinutes}m` : '—', i: 'trending-up', t: 'Avg Fallacy', c: colors.accent.exam },
           { l: 'Target GPA', v: insights?.gpa != null ? Number(insights.gpa).toFixed(2) : '—', i: 'graduation-cap', t: 'Configured', c: '#FFD166' },
           { l: 'Snooze Rate', v: insights ? Number(insights.snoozeRatePerDay).toFixed(1) : '—', i: 'bell', t: 'Per Day', c: colors.primary }
         ].map((s, i) => (
           <View key={i} style={[styles.statItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.iconCircle, { backgroundColor: colors.cardAlt }]}>
                 <FontAwesome5 name={s.i} size={15} color={colors.textDark} />
              </View>
              <Text style={[styles.statValue, { color: s.c, fontFamily: fonts.bold }]}>{s.v}</Text>
              <Text style={[styles.statLabel, { color: colors.textLight, fontFamily: fonts.bold }]}>{s.l.toUpperCase()}</Text>
              <Text style={[styles.trendText, { color: colors.textLight, fontFamily: fonts.medium }]}>{s.t}</Text>
           </View>
         ))}
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
         <Text style={[styles.cardTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>Planning Fallacy Analysis</Text>
         <Text style={[styles.cardSub, { color: colors.textLight, fontFamily: fonts.medium }]}>Estimated vs. Actual Study Duration (Minutes)</Text>
         <BarChart
            data={planningFallacyData}
            width={screenWidth - 84}
            height={220}
            chartConfig={chartConfig}
            style={{ borderRadius: 16, marginTop: 20, marginLeft: -10 }}
            yAxisLabel=""
            yAxisSuffix="m"
            fromZero
            showBarTops={false}
         />
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
         <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>Peak Power Hours ⚡</Text>
            <View style={[styles.miniBadge, { backgroundColor: colors.primaryLight }]}>
               <Text style={[styles.miniBadgeText, { color: colors.primary, fontFamily: fonts.bold }]}>K-Means</Text>
            </View>
         </View>
         <LineChart
            data={{
               labels: ["6am", "10am", "2pm", "6pm", "10pm"],
               datasets: [{ data: [15, 95, 45, 75, 30] }]
            }}
            width={screenWidth - 84}
            height={180}
            chartConfig={chartConfig}
            bezier
            style={{ marginTop: 20, marginLeft: -10 }}
            withInnerLines={false}
         />
         <Text style={[styles.insightText, { color: colors.textDark, fontFamily: fonts.medium }]}>
            The AI detected your absolute peak focus window between **10:00 AM** and **12:30 PM**.
         </Text>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
         <Text style={[styles.cardTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>Academic Achievements</Text>
         <View style={styles.achieveRack}>
            {[
              { n: 'ML Pioneer', i: 'brain', c: colors.primary },
              { n: 'Fallacy Killer', i: 'bolt', c: colors.accent.exam },
              { n: 'No Snooze', i: 'check-circle', c: colors.accent.science },
              { n: 'Focus Master', i: 'fire', c: '#FF4757' }
            ].map((a, i) => (
              <View key={i} style={styles.achieveBox}>
                 <View style={[styles.achieveBadge, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <FontAwesome5 name={a.i} size={18} color={a.c} />
                 </View>
                 <Text style={[styles.achieveName, { color: colors.textLight, fontFamily: fonts.bold }]}>{a.n}</Text>
              </View>
            ))}
         </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  headerTitle: { fontSize: 28 },
  timeBadge: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20 },
  timeBadgeText: { fontSize: 12 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 35 },
  statItem: { width: '47.4%', padding: 22, borderRadius: 28, borderWidth: 1, elevation: 4, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 10 },
  iconCircle: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  statValue: { fontSize: 24, marginBottom: 4 },
  statLabel: { fontSize: 10, letterSpacing: 1, marginBottom: 8 },
  trendText: { fontSize: 11 },
  card: { padding: 25, borderRadius: 32, borderWidth: 1, marginBottom: 35, elevation: 6, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 15 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 18 },
  cardSub: { fontSize: 12, marginTop: 4, opacity: 0.6 },
  miniBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  miniBadgeText: { fontSize: 10 },
  insightText: { fontSize: 13, lineHeight: 22, marginTop: 20, textAlign: 'center', paddingHorizontal: 10 },
  achieveRack: { flexDirection: 'row', flexWrap: 'wrap', gap: 15, justifyContent: 'center', marginTop: 25 },
  achieveBox: { width: 70, alignItems: 'center' },
  achieveBadge: { width: 56, height: 56, borderRadius: 18, borderWidth: 1, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  achieveName: { fontSize: 9, textAlign: 'center' }
});
