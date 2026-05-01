import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './auth_context';
import {
  tasksApi,
  behavioralLogsApi,
  subjectsApi,
  usersApi,
  focusApi,
  scheduleApi,
} from '../services/api';

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

  const reloadTasks = useCallback(async (filter = 'all') => {
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
    setSubjects(remote);
  }, []);

  const reloadAll = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError(null);
    try {
      const [t, b, s, sched] = await Promise.all([
        tasksApi.list('all'),
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
      setSubjects(s);
      setLatestSchedule(sched);
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
      return;
    }
    if (user?.isOnboarded) {
      reloadAll();
    }
  }, [isAuthenticated, user?.isOnboarded, reloadAll]);

  const updateTaskDifficulty = useCallback(async (id, rating) => {
    const updated = await tasksApi.difficulty(id, rating);
    setTasks(prev => prev.map(t => t.id === id ? mapTaskFromApi(updated) : t));
  }, []);

  const addTask = useCallback(async (payload) => {
    const created = await tasksApi.create(payload);
    setTasks(prev => [...prev, mapTaskFromApi(created)]);
    return created;
  }, []);

  const completeTask = useCallback(async (id, actualMinutes) => {
    const updated = await tasksApi.complete(id, actualMinutes);
    setTasks(prev => prev.map(t => t.id === id ? mapTaskFromApi(updated) : t));
    await reloadBehavioral();
  }, [reloadBehavioral]);

  const snoozeTask = useCallback(async (id, reason) => {
    const updated = await tasksApi.snooze(id, reason);
    setTasks(prev => prev.map(t => t.id === id ? mapTaskFromApi(updated) : t));
    await reloadBehavioral();
  }, [reloadBehavioral]);

  const removeTask = useCallback(async (id) => {
    await tasksApi.remove(id);
    setTasks(prev => prev.filter(t => t.id !== id));
  }, []);

  const addSubject = useCallback(async (payload) => {
    const created = await subjectsApi.create(payload);
    setSubjects(prev => [...prev, created]);
    return created;
  }, []);

  const updateSubject = useCallback(async (id, payload) => {
    const updated = await subjectsApi.update(id, payload);
    setSubjects(prev => prev.map(s => s.id === id ? updated : s));
    return updated;
  }, []);

  const removeSubject = useCallback(async (id) => {
    await subjectsApi.remove(id);
    setSubjects(prev => prev.filter(s => s.id !== id));
  }, []);

  const completeOnboarding = useCallback(async (form) => {
    const subjectsPayload = (form.subjects || []).map(s => ({
      name: s.name,
      difficulty: Number(s.difficulty) || 5,
      examDate: s.examDate || null,
      priority: Number(s.priority) || 2,
      estimatedMinutes: Number(s.estimatedMinutes) || 50,
    }));
    const slotsPayload = (form.slots || []).map(s => ({
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
  }, [refreshUser, reloadAll]);

  const startFocusSession = useCallback(async ({ taskId = null, subjectId, mode }) => {
    const session = await focusApi.start({ taskId, subjectId, mode });
    return session;
  }, []);

  const completeFocusSession = useCallback(async (id, payload) => {
    const session = await focusApi.complete(id, payload);
    await reloadBehavioral();
    await reloadTasks();
    return session;
  }, [reloadBehavioral, reloadTasks]);

  const generateSchedule = useCallback(async (date) => {
    const result = await scheduleApi.generate(date);
    setLatestSchedule({
      ...result,
      generatedAt: result.generatedAt,
      analysisResults: result.analysisResults,
      aiSchedule: result.aiSchedule,
      hasError: result.hasError,
    });
    return result;
  }, []);

  return (
    <AIContext.Provider value={{
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
    }}>
      {children}
    </AIContext.Provider>
  );
};

export const useAI = () => {
  const ctx = useContext(AIContext);
  if (!ctx) throw new Error('useAI must be used inside <AIProvider>');
  return ctx;
};

function mapTaskFromApi(t) {
  return {
    id: t.id,
    subject_id: t.subjectId,
    subject: t.subject,
    priority: t.priority,
    difficulty_rating: t.difficultyRating,
    estimated_minutes: t.estimatedMinutes,
    actual_minutes: t.actualMinutes,
    days_since_last_study: t.daysSinceLastStudy,
    consecutive_days_studied: t.consecutiveDaysStudied,
    status: mapStatus(t.status),
    deadline: t.deadline,
    tag: t.tag,
    completed_at: t.completedAt,
  };
}

function mapStatus(numeric) {
  switch (numeric) {
    case 0: return 'upcoming';
    case 1: return 'in_progress';
    case 2: return 'done';
    case 3: return 'postponed';
    case 4: return 'snoozed';
    default: return 'upcoming';
  }
}
