import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "./auth_context";
import { tasksApi, behavioralLogsApi, subjectsApi, usersApi, focusApi, scheduleApi } from "../services/api";

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

   const reloadAll = useCallback(async () => {
      if (!isAuthenticated) return;
      setLoading(true);
      setError(null);
      try {
         const [t, b, s, sched] = await Promise.all([
            tasksApi.list("all"),
            behavioralLogsApi.today(),
            subjectsApi.list(),
            scheduleApi.today().catch(() => null),
         ]);
         setTasks(t.map(mapTaskFromApi));
         setBehavioralLogs({
            snooze_count_today: b.snoozeCount,
            last_focus_ratings: b.lastFocusRatings,
            study_hours_today: Number(b.studyHours),
         });
         setSubjects(s.map(mapSubjectFromApi));
         setLatestSchedule(sched ? mapScheduleFromApi(sched) : null);
      } catch (err) {
         setError(err.response?.data?.title || err.message);
      } finally {
         setLoading(false);
      }
   }, [isAuthenticated]);

   useEffect(() => {
      if (!isAuthenticated) {
         setTasks([]);
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

   const addSubject = useCallback(async (payload) => {
      const created = await subjectsApi.create(payload);
      setSubjects((prev) => [...prev, mapSubjectFromApi(created)]);
      return created;
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
            examDate: s.examDate || null,
            priority: Number(s.priority) || 2,
            estimatedMinutes: Number(s.estimatedMinutes) || 50,
         }));
         const slotsPayload = (form.slots || []).map((s) => ({
            dayOfWeek: s.dayOfWeek != null ? Number(s.dayOfWeek) : null,
            startTime: s.startTime,
            endTime: s.endTime,
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
         await reloadAll(); // Full reload to sync tasks, logs, and schedule statuses
         return session;
      },
      [reloadAll],
   );

   const generateSchedule = useCallback(async (date) => {
      const result = await scheduleApi.generate(date);
      const mapped = mapScheduleFromApi(result);
      setLatestSchedule(mapped);
      return mapped;
   }, []);

   return (
      <AIContext.Provider
         value={{
            userData,
            tasks,
            subjects,
            behavioralLogs,
            latestSchedule,
            loading,
            error,
            reloadAll,
            reloadTasks,
            reloadBehavioral,
            reloadSubjects,
            updateTaskDifficulty,
            addTask,
            completeTask,
            snoozeTask,
            removeTask,
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
