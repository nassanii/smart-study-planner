import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import Toast from "react-native-toast-message";
import { useAuth } from "./auth_context";
import { tasksApi, behavioralLogsApi, subjectsApi, usersApi, focusApi, scheduleApi, eventsApi } from "../services/api";
import { pushNotification } from "../services/notifications_bus";

const TASK_CREATED_TITLES = ["Mission Accepted", "Fresh Quest", "Game On, Scholar", "New Challenge"];
const TASK_CREATED_BODIES = [
   "'{0}' just landed. {1} min of focus power required. Let's crush it!",
   "Locked in: '{0}' ({1} min). Channel that focus energy!",
   "'{0}' is on the board, {1} min ahead. Bring it on!",
   "Boom! '{0}' is live. {1} min of laser focus await."
];
const SUBJECT_ADDED_TITLES = ["Course Added", "New Course", "Course Locked", "Welcome Aboard"];
const SUBJECT_ADDED_BODIES = [
   "'{0}' added to your courses. Ready to master it!",
   "Welcome '{0}' to your course lineup!",
   "'{0}' is now part of your plan.",
   "Course '{0}' added. Your next study block starts here."
];
const PLAN_READY_TITLES = ["Plan Is Ready", "Roadmap Unlocked", "Schedule Live", "Time to Study"];
const PLAN_READY_BODIES = [
   "Your personalized study plan is ready!",
   "Fresh schedule generated. Let's make today productive!",
   "Your study slots are mapped out.",
   "AI just optimized your day."
];
const FOCUS_DONE_TITLES = ["Session Complete", "Great Job!", "Focus Achieved", "Round Done"];
const FOCUS_DONE_BODIES = [
   "Time to take a break and rate your focus!",
   "Excellent! Step back and reward yourself.",
   "You crushed it. Time for a quick reset.",
   "Wrapped up — log your focus rating."
];

const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];
const fmt = (tpl, ...args) => args.reduce((s, a, i) => s.replace(`{${i}}`, a), tpl);

const showInAppNotification = (title, body) => {
   pushNotification(title, body);
   Toast.show({
      type: 'success',
      text1: title,
      text2: body,
      position: 'top',
      visibilityTime: 5000,
      topOffset: 60,
   });
};

// --- Data Mappers (placed at top for hoisting & safety) ---

function mapStatus(numeric) {
   switch (numeric) {
      case 0: return "upcoming";
      case 1: return "in_progress";
      case 2: return "done";
      case 3: return "postponed";
      case 4: return "snoozed";
      default: return "upcoming";
   }
}

function mapTaskFromApi(t) {
   if (!t) return null;
   return {
      id: t.id,
      subject_id: t.subject_id || t.subjectId,
      subject: t.subject,
      title: t.title,
      priority: t.priority,
      difficulty_rating: t.difficulty_rating || t.difficultyRating,
      estimated_minutes: t.estimated_minutes || t.estimatedMinutes,
      actual_minutes: t.actual_minutes || t.actualMinutes,
      days_since_last_study: t.days_since_last_study || t.daysSinceLastStudy,
      consecutive_days_studied: t.consecutive_days_studied || t.consecutiveDaysStudied,
      status: mapStatus(t.status),
      deadline: t.deadline,
      start_time: t.start_time || t.startTime || null,
      task_type: t.task_type ?? t.taskType ?? 0, // 0 = Study, 1 = Personal
      is_manual: t.is_manual ?? t.isManual ?? true,
      tag: t.tag,
      completed_at: t.completed_at || t.completedAt,
   };
}

function mapSubjectFromApi(s) {
   if (!s) return null;
   return {
      ...s,
      id: s.id !== undefined ? s.id : s.Id,
      name: s.name || s.Name,
      difficulty: s.difficulty || s.Difficulty,
      priority: s.priority || s.Priority,
      examDate: s.examDate || s.exam_date || s.ExamDate,
      midtermDate: s.midtermDate || s.midterm_date || s.MidtermDate,
      finalDate: s.finalDate || s.final_date || s.FinalDate,
   };
}

function mapScheduleFromApi(s) {
   if (!s) return null;
   return {
      ...s,
      generatedAt: s.generated_at || s.generatedAt,
      analysisResults: s.analysis_results || s.analysisResults,
      aiSchedule: s.ai_schedule || s.aiSchedule,
      hasError: s.has_error || s.hasError,
      slotStatuses: s.slot_statuses || s.slotStatuses,
   };
}

function mapEventFromApi(e) {
   if (!e) return null;
   return {
      id: e.id,
      title: e.title,
      description: e.description,
      date: e.date,
      start_time: e.startTime || e.start_time,
      estimated_minutes: e.estimatedMinutes || e.estimated_minutes,
      priority: e.priority,
      is_completed: e.isCompleted || e.is_completed,
   };
}

// --- Provider ---

const AIContext = createContext(null);

const emptyBehavioral = {
   snooze_count_today: 0,
   last_focus_ratings: [],
   study_hours_today: 0,
};

export const AIProvider = ({ children }) => {
   const { user, isAuthenticated, refreshUser } = useAuth();

   const [tasks, setTasks] = useState([]);
   const [events, setEvents] = useState([]);
   const [subjects, setSubjects] = useState([]);
   const [behavioralLogs, setBehavioralLogs] = useState(emptyBehavioral);
   const [latestSchedule, setLatestSchedule] = useState(null);
   const [loading, setLoading] = useState(false);
   const [error, setError] = useState(null);

   const didLoadInitial = useRef(false);

   const userData = user
      ? {
         user_id: user.userId,
         name: user.name,
         email: user.email,
         target_gpa: user.targetGpa,
         max_hours_per_day: user.maxHoursPerDay,
         deadline: user.deadline,
         isOnboarded: user.isOnboarded,
      }
      : { user_id: null, deadline: null, isOnboarded: false };

   const reloadTasks = useCallback(async (filter = "all") => {
      const remote = await tasksApi.list(filter);
      setTasks(remote.map(mapTaskFromApi));
   }, []);

   const reloadBehavioral = useCallback(async () => {
      const log = await behavioralLogsApi.today();
      setBehavioralLogs({
         snooze_count_today: log.snoozeCount,
         last_focus_ratings: log.lastFocusRatings,
         study_hours_today: Number(log.studyHours),
      });
   }, []);

   const reloadSubjects = useCallback(async () => {
      const remote = await subjectsApi.list();
      setSubjects(remote.map(mapSubjectFromApi));
   }, []);

   const reloadEvents = useCallback(async () => {
      const remote = await eventsApi.list();
      setEvents(remote.map(mapEventFromApi));
   }, []);

   const reloadAll = useCallback(async () => {
      if (!isAuthenticated) return;
      setLoading(true);
      setError(null);
      try {
         const [t, b, s, sched, ev] = await Promise.all([
            tasksApi.list("all"),
            behavioralLogsApi.today(),
            subjectsApi.list(),
            scheduleApi.today().catch(() => null),
            eventsApi.list(),
         ]);
         setTasks(t.map(mapTaskFromApi));
         setBehavioralLogs({
            snooze_count_today: b.snoozeCount,
            last_focus_ratings: b.lastFocusRatings,
            study_hours_today: Number(b.studyHours),
         });
         setSubjects(s.map(mapSubjectFromApi));
         setLatestSchedule(sched ? mapScheduleFromApi(sched) : null);
         setEvents(ev.map(mapEventFromApi));
      } catch (err) {
         setError(err.response?.data?.title || err.message);
      } finally {
         setLoading(false);
      }
   }, [isAuthenticated]);

   useEffect(() => {
      if (!isAuthenticated) {
         setTasks([]);
         setEvents([]);
         setSubjects([]);
         setBehavioralLogs(emptyBehavioral);
         setLatestSchedule(null);
         didLoadInitial.current = false;
         return;
      }
      if (user?.isOnboarded && !didLoadInitial.current) {
         didLoadInitial.current = true;
         reloadAll();
      }
   }, [isAuthenticated, user?.isOnboarded, reloadAll]);

   const updateTaskDifficulty = useCallback(async (id, rating) => {
      const updated = await tasksApi.difficulty(id, rating);
      setTasks((prev) => prev.map((t) => (t.id === id ? mapTaskFromApi(updated) : t)));
   }, []);

   const addTask = useCallback(async (payload) => {
      const created = await tasksApi.create(payload);
      setTasks((prev) => [...prev, mapTaskFromApi(created)]);
      showInAppNotification(
         pickRandom(TASK_CREATED_TITLES),
         fmt(pickRandom(TASK_CREATED_BODIES), created.title || payload.title, created.estimatedMinutes || payload.estimatedMinutes)
      );
      return created;
   }, []);

   const completeTask = useCallback(
      async (id, actualMinutes) => {
         const updated = await tasksApi.complete(id, actualMinutes);
         setTasks((prev) => prev.map((t) => (t.id === id ? mapTaskFromApi(updated) : t)));
         await reloadBehavioral();
      },
      [reloadBehavioral],
   );

   const snoozeTask = useCallback(
      async (id, reason) => {
         const updated = await tasksApi.snooze(id, reason);
         setTasks((prev) => prev.map((t) => (t.id === id ? mapTaskFromApi(updated) : t)));
         await reloadBehavioral();
      },
      [reloadBehavioral],
   );

   const removeTask = useCallback(async (id) => {
      await tasksApi.remove(id);
      setTasks((prev) => prev.filter((t) => t.id !== id));
   }, []);

   const updateTask = useCallback(async (id, payload) => {
      const updated = await tasksApi.update(id, payload);
      setTasks((prev) => prev.map((t) => (t.id === id ? mapTaskFromApi(updated) : t)));
      return updated;
   }, []);

   const addEvent = useCallback(async (payload) => {
      const created = await eventsApi.create(payload);
      setEvents((prev) => [...prev, mapEventFromApi(created)]);
      return created;
   }, []);

   const updateEvent = useCallback(async (id, payload) => {
      const updated = await eventsApi.update(id, payload);
      setEvents((prev) => prev.map((e) => (e.id === id ? mapEventFromApi(updated) : e)));
      return updated;
   }, []);

   const removeEvent = useCallback(async (id) => {
      await eventsApi.remove(id);
      setEvents((prev) => prev.filter((e) => e.id !== id));
   }, []);

   const addSubject = useCallback(async (payload) => {
      try {
         const created = await subjectsApi.create(payload);
         const mapped = mapSubjectFromApi(created);
         setSubjects((prev) => {
            const withoutExisting = prev.filter((s) => s.id !== mapped.id);
            return [...withoutExisting, mapped];
         });
         showInAppNotification(
            pickRandom(SUBJECT_ADDED_TITLES),
            fmt(pickRandom(SUBJECT_ADDED_BODIES), created.name || payload.name)
         );
         return created;
      } catch (err) {
         if (err.response?.status === 409) {
            const remote = await subjectsApi.list();
            const mapped = remote.map(mapSubjectFromApi);
            setSubjects(mapped);
            const existing = mapped.find((s) => s.name?.trim().toLowerCase() === payload.name?.trim().toLowerCase());
            showInAppNotification(
               "Course Already Exists",
               existing ? `'${existing.name}' is already in your courses. I refreshed the list.` : "I refreshed your course list."
            );
            if (existing) return existing;
         }
         throw err;
      }
   }, []);

   const updateSubject = useCallback(async (id, payload) => {
      const updated = await subjectsApi.update(id, payload);
      setSubjects((prev) => prev.map((s) => (s.id === id ? mapSubjectFromApi(updated) : s)));
      return updated;
   }, []);

   const removeSubject = useCallback(async (id) => {
      await subjectsApi.remove(id);
      setSubjects((prev) => prev.filter((s) => s.id !== id));
   }, []);

   const completeOnboarding = useCallback(
      async (form) => {
         const subjectsPayload = (form.subjects || []).map((s) => ({
            name: s.name,
            initialTaskTitle: s.initialTaskTitle,
            difficulty: Number(s.difficulty) || 5,
            examDate: s.examDate || s.finalDate || s.midtermDate || null,
            midtermDate: s.midtermDate || null,
            finalDate: s.finalDate || null,
            priority: Number(s.priority) || 2,
            estimatedMinutes: Number(s.estimatedMinutes) || 50,
         }));
         const slotsPayload = (form.slots || []).map((s) => ({
            dayOfWeek: s.dayOfWeek != null ? Number(s.dayOfWeek) : null,
            date: s.date || null,
            startTime: (s.startTime || '').split(':').length === 2 ? s.startTime + ':00' : s.startTime,
            endTime: (s.endTime || '').split(':').length === 2 ? s.endTime + ':00' : s.endTime,
         }));
         await usersApi.onboard({
            name: form.name,
            deadline: form.deadline,
            subjects: subjectsPayload,
            availableSlots: slotsPayload,
         });
         await refreshUser();
         await reloadAll();
      },
      [refreshUser, reloadAll],
   );

   const startFocusSession = useCallback(async ({ taskId = null, subjectId, mode }) => {
      const session = await focusApi.start({ taskId, subjectId, mode });
      return session;
   }, []);

   const completeFocusSession = useCallback(
      async (id, payload) => {
         const session = await focusApi.complete(id, payload);
         await reloadAll();
         showInAppNotification(pickRandom(FOCUS_DONE_TITLES), pickRandom(FOCUS_DONE_BODIES));
         return session;
      },
      [reloadAll],
   );

   const generateSchedule = useCallback(async (date, options = {}) => {
      const result = await scheduleApi.generate(date, !!options.useAi);
      const mapped = mapScheduleFromApi(result);
      setLatestSchedule(mapped);
      if (!result?.hasError) {
         showInAppNotification(pickRandom(PLAN_READY_TITLES), pickRandom(PLAN_READY_BODIES));
      }
      return mapped;
   }, []);

   return (
      <AIContext.Provider
         value={{
            userData,
            tasks,
            events,
            subjects,
            behavioralLogs,
            latestSchedule,
            loading,
            error,
            reloadAll,
            reloadTasks,
            reloadEvents,
            reloadBehavioral,
            reloadSubjects,
            updateTaskDifficulty,
            addTask,
            completeTask,
            snoozeTask,
            removeTask,
            updateTask,
            addEvent,
            updateEvent,
            removeEvent,
            completeOnboarding,
            startFocusSession,
            completeFocusSession,
            removeSubject,
            addSubject,
            updateSubject,
            generateSchedule,
         }}
      >
         {children}
      </AIContext.Provider>
   );
};

// --- Hook ---

export const useAI = () => {
   const ctx = useContext(AIContext);
   if (!ctx) throw new Error("useAI must be used inside <AIProvider>");
   return ctx;
};
