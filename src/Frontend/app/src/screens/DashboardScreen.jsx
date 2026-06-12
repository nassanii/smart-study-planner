import React, { useEffect, useState, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions, Modal, FlatList, Pressable } from "react-native";
import { useTheme } from "../theme/theme";
import { useAI } from "../context/ai_context";
import { useAuth } from "../context/auth_context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BarChart, PieChart } from "react-native-chart-kit";
import { analyticsApi, focusApi } from "../services/api";
import { useFocus } from "../context/focus_context";
import { useAppNavigation } from "../context/navigation_context";
import { subscribeNotifications, markAllRead, clearNotifications } from "../services/notifications_bus";
import { DailyCheckinModal } from "../components/DailyCheckinModal";

const FOCUS_COLORS = ["#6B5CE7", "#10B981", "#F43F5E", "#F59E0B", "#3B82F6"];

const formatLocalDateKey = (date) =>
   `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export const DashboardScreen = () => {
   const { colors, fonts } = useTheme();
   const { user } = useAuth();
   const { userData, behavioralLogs, tasks, subjects, latestSchedule, reloadAll, loading } = useAI();
   const { sessionElapsedSeconds, slotStatuses: liveSlotStatuses, activeSession, mode, selectedSubjectId } = useFocus();
   const { navigate } = useAppNavigation();
   const [insights, setInsights] = useState(null);
   const [showAiAlert, setShowAiAlert] = useState(true);
   const [showNotifs, setShowNotifs] = useState(false);
   const [showPlanWizard, setShowPlanWizard] = useState(false);
   const [notifs, setNotifs] = useState([]);
   const [unread, setUnread] = useState(0);
   const [focusSessions, setFocusSessions] = useState([]);
   const didLoad = useRef(false);
   const didBootstrapData = useRef(false);

   useEffect(() => {
      return subscribeNotifications(({ items, unreadCount }) => {
         setNotifs(items);
         setUnread(unreadCount);
      });
   }, []);

   const openNotifs = () => {
      setShowNotifs(true);
      markAllRead();
   };

   const formatRelativeTime = (iso) => {
      const diff = Date.now() - new Date(iso).getTime();
      const m = Math.floor(diff / 60000);
      if (m < 1) return "just now";
      if (m < 60) return `${m}m ago`;
      const h = Math.floor(m / 60);
      if (h < 24) return `${h}h ago`;
      return `${Math.floor(h / 24)}d ago`;
   };

   const loadRecentFocusSessions = () => {
      const today = new Date();
      const from = new Date(today);
      from.setDate(today.getDate() - 6);
      return focusApi
         .list({ from: formatLocalDateKey(from), to: formatLocalDateKey(today) })
         .then((data) => setFocusSessions(Array.isArray(data) ? data : []))
         .catch(() => {});
   };

   useEffect(() => {
      if (didLoad.current) return;
      didLoad.current = true;
      analyticsApi
         .insights()
         .then(setInsights)
         .catch(() => {});
      loadRecentFocusSessions();
   }, []);

   useEffect(() => {
      if (didBootstrapData.current) return;
      if (!userData?.isOnboarded || loading) return;
      if (subjects.length > 0 || tasks.length > 0 || latestSchedule) return;
      didBootstrapData.current = true;
      reloadAll().catch(() => {});
   }, [userData?.isOnboarded, loading, subjects.length, tasks.length, latestSchedule, reloadAll]);

   useEffect(() => {
      if (!userData?.isOnboarded) return;
      loadRecentFocusSessions();
   }, [userData?.isOnboarded, behavioralLogs?.study_hours_today, tasks.length]);

   const burnoutScore = latestSchedule?.analysisResults?.burnout_score ?? (insights?.latestBurnout != null ? Number(insights.latestBurnout) : 0);
   const burnoutPct = Math.round(burnoutScore * 100);
   const liveStudyHoursToday = (Number(behavioralLogs?.study_hours_today) || 0) + (sessionElapsedSeconds / 3600);
   const insightStudyHoursToday = Number(insights?.studyHoursToday) || 0;
   const displayStudyHoursToday = Math.max(liveStudyHoursToday, insightStudyHoursToday);
   const liveSessionCount = (behavioralLogs?.last_focus_ratings?.length || 0) + (activeSession && mode === "Focus" ? 1 : 0);
   const flowPct = Math.min(100, Math.round((displayStudyHoursToday / (userData?.max_hours_per_day || 6)) * 100));

   const dayStreak = insights?.dayStreak ?? 0;
   const avgFocus = insights?.avgFocusRating ?? 0;

   const getGreeting = () => {
      const hour = new Date().getHours();
      if (hour >= 5 && hour < 12) return "Good morning ☀️";
      if (hour >= 12 && hour < 17) return "Good afternoon 🌤️";
      if (hour >= 17 && hour < 21) return "Good evening 🌙";
      return "Good night 😴";
   };

   const initial = (user?.name || userData.name || "IH").slice(0, 2).toUpperCase();
   const scheduleSlots = latestSchedule?.aiSchedule?.scheduled_slots || [];
   const persistedSlotStatuses = latestSchedule?.slot_statuses || latestSchedule?.slotStatuses || {};
   // Merge persisted (server) with live (in-memory) so status updates show immediately
   const slotStatuses = { ...persistedSlotStatuses, ...(liveSlotStatuses || {}) };
   const nextSlot = scheduleSlots.find((_, idx) => !['completed', 'snoozed'].includes(slotStatuses[idx]?.status));
   const activeTaskCount = tasks.filter((t) => t.status !== "done").length;
   const homeAction = subjects.length === 0
      ? { label: "Add first course", icon: "library-outline", target: "courses" }
      : scheduleSlots.length === 0
         ? { label: "Create today's plan", icon: "calendar-outline", target: "calendar" }
         : { label: "Open next session", icon: "play-circle-outline", target: "calendar" };

   const formatDuration = (totalHours) => {
      const totalSeconds = Math.round(totalHours * 3600);
      const h = Math.floor(totalSeconds / 3600);
      const m = Math.floor((totalSeconds % 3600) / 60);
      const s = totalSeconds % 60;
      return `${h}:${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`;
   };

   const focusDistribution = subjects
      .map((subject, index) => {
         const sessionSeconds = focusSessions
            .filter((session) => Number(session.subjectId ?? session.subject_id) === Number(subject.id))
            .reduce((sum, session) => sum + (Number(session.durationSeconds ?? session.duration_seconds) || 0), 0);
         const liveSeconds =
            activeSession && mode === "Focus" && Number(selectedSubjectId) === Number(subject.id)
               ? sessionElapsedSeconds
               : 0;
         const taskSeconds = tasks
            .filter((task) => Number(task.subject_id ?? task.subjectId) === Number(subject.id))
            .reduce((sum, task) => sum + ((Number(task.actual_minutes ?? task.actualMinutes) || 0) * 60), 0);
         const seconds = Math.max(sessionSeconds + liveSeconds, taskSeconds);
         return {
            name: subject.name,
            population: Math.max(0, Math.round(seconds)),
            color: FOCUS_COLORS[index % FOCUS_COLORS.length],
            legendFontColor: colors.textLight,
            legendFontSize: 11,
         };
      })
      .filter((item) => item.population > 0);
   const focusTotalSeconds = focusDistribution.reduce((sum, item) => sum + item.population, 0);

   return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
         style={styles.container}
         showsVerticalScrollIndicator={false}
         contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 12, paddingBottom: 100 }}
      >
         {/* Header */}
         <View style={styles.header}>
            <View>
               <Text style={[styles.greeting, { color: colors.textLight, fontFamily: fonts.medium }]}>{getGreeting()}</Text>
               <Text style={[styles.userName, { color: colors.textDark, fontFamily: fonts.bold }]}>{user?.name || "Student"}</Text>
            </View>
            <View style={styles.headerRight}>
               <TouchableOpacity style={styles.iconBtn} onPress={() => navigate("analytics")}>
                  <Ionicons name="analytics-outline" size={22} color={colors.textDark} />
               </TouchableOpacity>
               <TouchableOpacity style={styles.iconBtn} onPress={openNotifs}>
                  <Ionicons name="notifications" size={22} color={colors.textDark} />
                  {unread > 0 && (
                     <View style={styles.notifBadge}>
                        <Text style={styles.notifBadgeText}>{unread > 9 ? "9+" : unread}</Text>
                     </View>
                  )}
               </TouchableOpacity>
               <LinearGradient colors={[colors.primary, "#8575F3"]} style={styles.avatar}>
                  <Text style={[styles.avatarText, { fontFamily: fonts.bold }]}>{initial}</Text>
               </LinearGradient>
            </View>
         </View>

         <View style={[styles.todayCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.todayTop}>
               <View style={{ flex: 1 }}>
                  <Text style={[styles.todayEyebrow, { color: colors.primary, fontFamily: fonts.bold }]}>TODAY</Text>
                  <Text style={[styles.todayTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>
                     {nextSlot ? nextSlot.subject : subjects.length === 0 ? "Set up your first course" : "Build a plan that fits today"}
                  </Text>
                  <Text style={[styles.todayMeta, { color: colors.textLight, fontFamily: fonts.medium }]}>
                     {nextSlot
                        ? `${nextSlot.time_slot} · ${nextSlot.adjusted_duration_minutes || 25} min`
                        : `${subjects.length} courses · ${activeTaskCount} open tasks`}
                  </Text>
               </View>
               <TouchableOpacity style={[styles.todayAction, { backgroundColor: colors.primary }]} onPress={() => navigate(homeAction.target)}>
                  <Ionicons name={homeAction.icon} size={20} color="#FFF" />
                  <Text style={[styles.todayActionText, { fontFamily: fonts.bold }]}>{homeAction.label}</Text>
               </TouchableOpacity>
            </View>
            <View style={[styles.nudgeRow, { backgroundColor: colors.cardAlt }]}>
               <Ionicons name="sparkles-outline" size={16} color={colors.primary} />
               <Text style={[styles.nudgeText, { color: colors.textDark, fontFamily: fonts.medium }]}>
                  {activeTaskCount > 0
                     ? "Each course's progress is the percentage of its tasks you've marked done."
                     : "Add tasks inside each course so the app can tell what you are really finishing."}
               </Text>
            </View>
         </View>

         {/* Today's Daily Program */}
         {scheduleSlots.length > 0 && (
            <View style={[styles.sectionCard, { backgroundColor: colors.surface }]}>
               <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>Today's Daily Program</Text>
                  <TouchableOpacity onPress={() => navigate("calendar")}>
                     <Text style={[styles.dashLink, { color: colors.primary, fontFamily: fonts.bold }]}>View all</Text>
                  </TouchableOpacity>
               </View>
               <Text style={[styles.dashSectionMeta, { color: colors.textLight, fontFamily: fonts.medium }]}>
                  {(() => {
                     const total = scheduleSlots.length;
                     const done = Object.values(slotStatuses).filter((s) => s?.status === "completed").length;
                     return `${total} blocks · ${done} completed`;
                  })()}
               </Text>
               <View style={{ gap: 8, marginTop: 14 }}>
                  {scheduleSlots.map((slot, idx) => {
                     const isBreak = slot.activity_type === "break";
                     const status = slotStatuses[idx] || { status: "pending" };
                     const isDone = status.status === "completed";
                     const accent = isBreak ? colors.textLight : colors.primary;
                     return (
                        <View
                           key={idx}
                           style={[styles.dashSlot, {
                              backgroundColor: colors.cardAlt,
                              borderLeftColor: accent,
                              opacity: isDone ? 0.6 : 1,
                           }]}
                        >
                           <Text style={[styles.dashSlotTime, { color: colors.textLight, fontFamily: fonts.bold }]}>{slot.time_slot}</Text>
                           <View style={{ flex: 1, marginLeft: 4 }}>
                              <Text
                                 style={[styles.dashSlotTitle, {
                                    color: isBreak ? colors.textLight : accent,
                                    fontFamily: fonts.bold,
                                    textDecorationLine: isDone ? "line-through" : "none",
                                 }]}
                                 numberOfLines={1}
                              >
                                 {slot.subject}
                              </Text>
                              <Text style={[styles.dashSlotMeta, { color: colors.textLight, fontFamily: fonts.medium }]} numberOfLines={1}>
                                 {isBreak
                                    ? "Break — Time to recharge"
                                    : `${slot.adjusted_duration_minutes} min · ${slot.activity_type === "review" ? "Revision" : "Study"}`}
                              </Text>
                           </View>
                           {status.status === "completed" && <Ionicons name="checkmark-circle" size={20} color="#10B981" />}
                           {status.status === "in_progress" && <Ionicons name="play-circle" size={20} color={colors.primary} />}
                           {status.status === "snoozed" && <Ionicons name="time" size={20} color="#F59E0B" />}
                           {status.status === "pending" && (
                              <Text style={[styles.dashSlotStatusText, { color: colors.textLight, fontFamily: fonts.bold }]}>Not started</Text>
                           )}
                        </View>
                     );
                  })}
               </View>
            </View>
         )}

         {/* AI Alert Card */}
         {showAiAlert && latestSchedule && new Date(latestSchedule.generatedAt).toDateString() === new Date().toDateString() && (
            <LinearGradient colors={[colors.primaryLight, colors.primaryLight]} style={[styles.aiCard, { borderColor: colors.border }]}>
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
               <View style={[styles.balancedBadge, { backgroundColor: burnoutPct < 35 ? "#DCFCE7" : burnoutPct < 70 ? "#FEF3C7" : "#FEE2E2" }]}>
                  <Ionicons
                     name={burnoutPct < 35 ? "checkmark" : burnoutPct < 70 ? "warning-outline" : "alert-circle-outline"}
                     size={12}
                     color={burnoutPct < 35 ? "#10B981" : burnoutPct < 70 ? "#D97706" : "#EF4444"}
                  />
                  <Text
                     style={[
                        styles.balancedText,
                        {
                           color: burnoutPct < 35 ? "#059669" : burnoutPct < 70 ? "#B45309" : "#B91C1C",
                           fontFamily: fonts.bold,
                        },
                     ]}
                  >
                     {burnoutPct < 35 ? "Balanced" : burnoutPct < 70 ? "Caution" : "High Risk"}
                  </Text>
               </View>
            </View>
            <View style={styles.wellnessGrids}>
               <View style={styles.wellnessItem}>
                  <View style={styles.wellnessIconRow}>
                     <MaterialCommunityIcons name="waves" size={18} color="#06B6D4" />
                     <Text style={[styles.wellnessLabel, { fontFamily: fonts.medium }]}>Flow State</Text>
                  </View>
                  <View style={[styles.progBg, { backgroundColor: colors.cardAlt }]}>
                     <View style={[styles.progFill, { backgroundColor: "#22D3EE", width: `${flowPct}%` }]} />
                  </View>
                  <Text style={[styles.wellnessHint, { color: colors.textLight, fontFamily: fonts.medium }]}>
                     {flowPct}% —{" "}
                     {liveSessionCount > 0
                        ? `${liveSessionCount} session${liveSessionCount === 1 ? "" : "s"} today`
                        : avgFocus > 4.2 ? "Great focus!" : avgFocus > 3.5 ? "Good focus" : avgFocus > 2.5 ? "Moderate focus" : "Needs focus"}
                  </Text>
               </View>

               <View style={styles.wellnessItem}>
                  <View style={styles.wellnessIconRow}>
                     <Ionicons name="flame" size={18} color="#F87171" />
                     <Text style={[styles.wellnessLabel, { fontFamily: fonts.medium }]}>Burnout Risk</Text>
                  </View>
                  <View style={[styles.progBg, { backgroundColor: colors.cardAlt }]}>
                     <View style={[styles.progFill, { backgroundColor: "#FB7185", width: `${burnoutPct}%` }]} />
                  </View>
                  <Text style={[styles.wellnessHint, { color: colors.textLight, fontFamily: fonts.medium }]}>{burnoutPct}% — Low risk</Text>
               </View>
            </View>
         </View>

         {/* AI Insights Section */}
         <View style={[styles.sectionCard, { backgroundColor: colors.surface }]}>
            <View style={styles.sectionHeader}>
               <Text style={[styles.sectionTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>AI Insights</Text>
               <MaterialCommunityIcons name="lightning-bolt" size={20} color={colors.primary} />
            </View>

            <View style={styles.insightsGrid}>
               <View style={[styles.insightBox, { backgroundColor: colors.cardAlt }]}>
                  <Text style={[styles.insightVal, { color: colors.accent.exam, fontFamily: fonts.bold }]}>
                     {insights?.planningErrorMinutes >= 0 ? "+" : ""}
                     {insights?.planningErrorMinutes || 0}m
                  </Text>
                  <Text style={[styles.insightLab, { color: colors.textLight, fontFamily: fonts.bold }]}>AVG FALLACY</Text>
               </View>
               <View style={[styles.insightBox, { backgroundColor: colors.cardAlt }]}>
                  <Text style={[styles.insightVal, { color: "#FFD166", fontFamily: fonts.bold }]}>
                     {formatDuration(displayStudyHoursToday)}
                  </Text>
                  <Text style={[styles.insightLab, { color: colors.textLight, fontFamily: fonts.bold }]}>STUDY TODAY</Text>
               </View>
            </View>

            <View style={styles.peakHourCard}>
               <Ionicons name="flash" size={16} color={colors.primary} />
               <Text style={[styles.peakText, { color: colors.textDark, fontFamily: fonts.medium }]}>
                  {insights?.peakHourBuckets?.length > 0
                     ? `Peak focus around ${insights.peakHourBuckets[0]}:00.`
                     : "AI is learning your peak focus hours..."}
               </Text>
            </View>
         </View>

         {/* Weekly Activity Chart */}
         <View style={[styles.sectionCard, { backgroundColor: colors.surface }]}>
            <View style={styles.sectionHeader}>
               <Text style={[styles.sectionTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>Weekly Activity</Text>
               <Ionicons name="bar-chart" size={20} color={colors.primary} />
            </View>
            
            {insights?.weeklyStudyData ? (
               <BarChart
                  data={{
                     labels: Object.keys(insights.weeklyStudyData),
                     datasets: [{ data: Object.values(insights.weeklyStudyData) }]
                  }}
                  width={Dimensions.get("window").width - 80}
                  height={180}
                  yAxisLabel=""
                  yAxisSuffix="h"
                  chartConfig={{
                     backgroundColor: colors.surface,
                     backgroundGradientFrom: colors.surface,
                     backgroundGradientTo: colors.surface,
                     decimalPlaces: 1,
                     color: (opacity = 1) => `rgba(107, 92, 231, ${opacity})`,
                     labelColor: (opacity = 1) => colors.textLight,
                     style: { borderRadius: 16 },
                     propsForDots: { r: "6", strokeWidth: "2", stroke: colors.primary }
                  }}
                  verticalLabelRotation={0}
                  style={{ marginVertical: 8, borderRadius: 16, marginLeft: -10 }}
                  fromZero
                  showValuesOnTopOfBars
               />
            ) : (
               <View style={{ height: 180, justifyContent: "center", alignItems: "center" }}>
                  <ActivityIndicator size="small" color={colors.primary} />
               </View>
            )}
         </View>

         {/* Course Distribution Chart */}
         <View style={[styles.sectionCard, { backgroundColor: colors.surface }]}>
            <View style={styles.sectionHeader}>
               <Text style={[styles.sectionTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>Focus Distribution</Text>
               <MaterialCommunityIcons name="chart-pie" size={20} color={colors.primary} />
            </View>
            
            {focusDistribution.length > 0 ? (
               <View>
                  {focusDistribution.length > 1 && (
                     <PieChart
                        data={focusDistribution.map((item) => ({
                           ...item,
                           name: item.name.length > 10 ? item.name.slice(0, 8) + ".." : item.name,
                        }))}
                        width={Dimensions.get("window").width - 50}
                        height={180}
                        chartConfig={{
                           color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                        }}
                        accessor={"population"}
                        backgroundColor={"transparent"}
                        paddingLeft={"15"}
                        absolute
                     />
                  )}
                  <View style={[styles.focusDistributionList, { marginTop: focusDistribution.length > 1 ? 8 : 0 }]}>
                     {focusDistribution.map((item) => {
                        const pct = focusTotalSeconds ? Math.round((item.population / focusTotalSeconds) * 100) : 0;
                        return (
                           <View key={item.name} style={styles.focusDistributionRow}>
                              <View style={[styles.focusDot, { backgroundColor: item.color }]} />
                              <View style={{ flex: 1, minWidth: 0 }}>
                                 <View style={styles.focusDistributionHeader}>
                                    <Text
                                       style={[styles.focusDistributionName, { color: colors.textDark, fontFamily: fonts.bold }]}
                                       numberOfLines={1}
                                    >
                                       {item.name}
                                    </Text>
                                    <Text style={[styles.focusDistributionMeta, { color: colors.textLight, fontFamily: fonts.bold }]}>
                                       {formatDuration(item.population / 3600)} · {pct}%
                                    </Text>
                                 </View>
                                 <View style={[styles.focusDistributionTrack, { backgroundColor: colors.cardAlt }]}>
                                    <View style={[styles.focusDistributionFill, { backgroundColor: item.color, width: `${pct}%` }]} />
                                 </View>
                              </View>
                           </View>
                        );
                     })}
                  </View>
               </View>
            ) : subjects.length > 0 ? (
               <View style={{ height: 100, justifyContent: "center", alignItems: "center" }}>
                  <Text style={{ color: colors.textLight, fontFamily: fonts.medium, textAlign: "center" }}>
                     Start or finish a focus session to see distribution
                  </Text>
               </View>
            ) : (
               <View style={{ height: 100, justifyContent: "center", alignItems: "center" }}>
                  <Text style={{ color: colors.textLight, fontFamily: fonts.medium }}>Add courses to see distribution</Text>
               </View>
            )}
         </View>

         {/* Course Progress */}
         <Text style={[styles.sectionTitle, { color: colors.textDark, fontFamily: fonts.bold, marginBottom: 15 }]}>Course Progress</Text>
         <View style={[styles.subjectCard, { backgroundColor: colors.surface }]}>
            {subjects.length === 0 ? (
               <View style={{ alignItems: "center", paddingVertical: 20 }}>
                  <MaterialCommunityIcons name="book-plus-outline" size={40} color={colors.textLight} />
                  <Text style={{ color: colors.textLight, fontFamily: fonts.medium, marginTop: 10, textAlign: "center" }}>
                     No courses yet. Add your first course to start seeing real progress.
                  </Text>
               </View>
            ) : (
               subjects.map((s, idx) => {
                  const subTasks = tasks.filter((t) => t.subject_id === s.id);
                  const doneCount = subTasks.filter((t) => t.status === "done").length;
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
                              <View style={[styles.subProgBg, { backgroundColor: colors.cardAlt }]}>
                                 <View style={[styles.subProgFill, { backgroundColor: subColor, width: `${pct}%` }]} />
                              </View>
                              <Text style={[styles.subPct, { color: colors.textLight, fontFamily: fonts.medium }]}>{pct}%</Text>
                           </View>
                        </View>
                     </View>
                  );
               })
            )}
         </View>

         <Modal visible={showNotifs} animationType="slide" transparent onRequestClose={() => setShowNotifs(false)}>
            <Pressable style={styles.modalBackdrop} onPress={() => setShowNotifs(false)}>
               <Pressable style={[styles.modalSheet, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
                  <View style={styles.modalHeader}>
                     <Text style={[styles.modalTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>Notifications</Text>
                     <View style={{ flexDirection: "row", gap: 12 }}>
                        {notifs.length > 0 && (
                           <TouchableOpacity onPress={() => clearNotifications()}>
                              <Text style={{ color: colors.primary, fontFamily: fonts.medium }}>Clear</Text>
                           </TouchableOpacity>
                        )}
                        <TouchableOpacity onPress={() => setShowNotifs(false)}>
                           <Ionicons name="close" size={22} color={colors.textDark} />
                        </TouchableOpacity>
                     </View>
                  </View>
                  {notifs.length === 0 ? (
                     <View style={{ alignItems: "center", paddingVertical: 60 }}>
                        <Ionicons name="notifications-off-outline" size={48} color={colors.textLight} />
                        <Text style={{ color: colors.textLight, fontFamily: fonts.medium, marginTop: 12 }}>No notifications yet</Text>
                     </View>
                  ) : (
                     <FlatList
                        data={notifs}
                        keyExtractor={(item) => item.id}
                        style={{ maxHeight: 480 }}
                        renderItem={({ item }) => (
                           <View style={[styles.notifItem, { borderBottomColor: colors.border }]}>
                              <View style={[styles.notifIcon, { backgroundColor: colors.primaryLight }]}>
                                 <Ionicons name="notifications" size={18} color={colors.primary} />
                              </View>
                              <View style={{ flex: 1 }}>
                                 <Text style={[styles.notifTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>{item.title}</Text>
                                 <Text style={[styles.notifBody, { color: colors.textLight, fontFamily: fonts.medium }]}>{item.body}</Text>
                                 <Text style={[styles.notifTime, { color: colors.textLight, fontFamily: fonts.medium }]}>{formatRelativeTime(item.createdAt)}</Text>
                              </View>
                           </View>
                        )}
                     />
                  )}
               </Pressable>
            </Pressable>
         </Modal>
      </ScrollView>

      <DailyCheckinModal
         visible={showPlanWizard}
         onClose={() => setShowPlanWizard(false)}
      />

      <TouchableOpacity
         style={styles.magicFab}
         activeOpacity={0.85}
         onPress={() => setShowPlanWizard(true)}
      >
         <LinearGradient colors={['#6366F1', '#8B5CF6']} style={styles.magicFabInner}>
            <MaterialCommunityIcons name="brain" size={36} color="#FFF" />
         </LinearGradient>
      </TouchableOpacity>
      </View>
   );
};

const styles = StyleSheet.create({
   container: { flex: 1 },
   header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 25 },
   greeting: { fontSize: 14, marginBottom: 4 },
   userName: { fontSize: 26 },
   headerRight: { flexDirection: "row", alignItems: "center", gap: 15 },
   iconBtn: {
      width: 44,
      height: 44,
      borderRadius: 14,
      justifyContent: "center",
      alignItems: "center",
      shadowColor: "#000",
      shadowOpacity: 0.05,
      shadowRadius: 10,
      elevation: 2,
   },
   notifDot: {
      position: "absolute",
      top: 12,
      right: 12,
      width: 8,
      height: 8,
      backgroundColor: "#F43F5E",
      borderRadius: 4,
      borderWidth: 2,
      borderColor: "#FFF",
   },
   notifBadge: {
      position: "absolute",
      top: 6,
      right: 6,
      minWidth: 18,
      height: 18,
      paddingHorizontal: 4,
      backgroundColor: "#F43F5E",
      borderRadius: 9,
      borderWidth: 2,
      borderColor: "#FFF",
      justifyContent: "center",
      alignItems: "center",
   },
   notifBadgeText: { color: "#FFF", fontSize: 10, fontWeight: "bold" },
   modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
   modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36, maxHeight: "75%" },
   modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#EEE" },
   modalTitle: { fontSize: 18 },
   notifItem: { flexDirection: "row", paddingVertical: 12, borderBottomWidth: 1, gap: 12 },
   notifIcon: { width: 36, height: 36, borderRadius: 12, justifyContent: "center", alignItems: "center" },
   notifTitle: { fontSize: 14, marginBottom: 4 },
   notifBody: { fontSize: 13, lineHeight: 18 },
   notifTime: { fontSize: 11, marginTop: 4 },
   avatar: { width: 44, height: 44, borderRadius: 14, justifyContent: "center", alignItems: "center" },
   avatarText: { color: "#FFF", fontSize: 16 },
   todayCard: { borderWidth: 1, borderRadius: 26, padding: 18, marginBottom: 22 },
   todayTop: { flexDirection: "row", alignItems: "center", gap: 14 },
   todayEyebrow: { fontSize: 10, letterSpacing: 1 },
   todayTitle: { fontSize: 20, marginTop: 4 },
   todayMeta: { fontSize: 13, marginTop: 5 },
   todayAction: { minWidth: 118, height: 48, borderRadius: 15, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 12 },
   todayActionText: { color: "#FFF", fontSize: 12 },
   nudgeRow: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 16, marginTop: 14 },
   nudgeText: { flex: 1, fontSize: 12, lineHeight: 17 },
   aiCard: { flexDirection: "row", padding: 18, borderRadius: 20, marginBottom: 30, alignItems: "center", borderWidth: 1 },
   aiIcon: { marginRight: 15 },
   aiTextContainer: { flex: 1 },
   aiMessage: { fontSize: 13, lineHeight: 20 },
   statsRow: { flexDirection: "row", gap: 15, marginBottom: 30 },
   statCard: {
      flex: 1,
      padding: 20,
      borderRadius: 24,
      alignItems: "center",
      shadowColor: "#000",
      shadowOpacity: 0.04,
      shadowRadius: 12,
      elevation: 2,
   },
   statVal: { fontSize: 32, marginBottom: 4 },
   statLab: { fontSize: 10, letterSpacing: 1 },
   ratingRow: { flexDirection: "row", alignItems: "center", gap: 5 },

   sectionCard: { padding: 22, borderRadius: 28, marginBottom: 35, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 15, elevation: 2 },
   sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
   sectionTitle: { fontSize: 18 },
   focusDistributionList: { gap: 12 },
   focusDistributionRow: { flexDirection: "row", alignItems: "center", gap: 10 },
   focusDot: { width: 10, height: 10, borderRadius: 5 },
   focusDistributionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 6 },
   focusDistributionName: { flex: 1, fontSize: 13 },
   focusDistributionMeta: { fontSize: 11 },
   focusDistributionTrack: { height: 7, borderRadius: 4, overflow: "hidden" },
   focusDistributionFill: { height: "100%", borderRadius: 4 },
   dashLink: { fontSize: 13 },
   dashSectionMeta: { fontSize: 12, marginTop: 4 },
   dashSlot: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, borderLeftWidth: 4 },
   dashSlotTime: { width: 48, fontSize: 12 },
   dashSlotTitle: { fontSize: 14 },
   dashSlotMeta: { fontSize: 11, marginTop: 2 },
   dashSlotStatusText: { fontSize: 11, letterSpacing: 0.4 },
   balancedBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: "#DCFCE7",
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 20,
   },
   balancedText: { fontSize: 11, color: "#059669" },
   wellnessGrids: { flexDirection: "row", gap: 20 },
   wellnessItem: { flex: 1 },
   wellnessIconRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
   wellnessLabel: { fontSize: 13 },
   progBg: { height: 6, borderRadius: 3, overflow: "hidden" },
   progFill: { height: "100%", borderRadius: 3 },
   wellnessHint: { fontSize: 10, marginTop: 8 },

   subjectCard: { padding: 22, borderRadius: 28, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 15, elevation: 2 },
   subjectItem: { flexDirection: "row", alignItems: "center", gap: 15, marginBottom: 20 },
   subIconBox: { width: 44, height: 44, borderRadius: 14, justifyContent: "center", alignItems: "center" },
   subName: { fontSize: 15, marginBottom: 6 },
   subProgRow: { flexDirection: "row", alignItems: "center", gap: 12 },
   subProgBg: { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
   subProgFill: { height: "100%", borderRadius: 3 },
   subPct: { fontSize: 12, width: 30 },
  insightsGrid: { flexDirection: 'row', gap: 15, marginBottom: 15 },
  insightBox: { flex: 1, padding: 15, borderRadius: 20, alignItems: 'center' },
  insightVal: { fontSize: 20, marginBottom: 4 },
  insightLab: { fontSize: 8, letterSpacing: 0.5 },
  peakHourCard: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.02)' },
  peakText: { fontSize: 12 },
  magicFab: {
    position: 'absolute',
    bottom: 30,
    right: 24,
    width: 76,
    height: 76,
    borderRadius: 38,
    elevation: 12,
    shadowColor: '#6366F1',
    shadowOpacity: 0.5,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
  },
  magicFabInner: {
    flex: 1,
    borderRadius: 38,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
