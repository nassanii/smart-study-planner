import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAI } from './ai_context';
import { useAppNavigation } from './navigation_context';
import { scheduleApi } from '../services/api';

const FocusContext = createContext(null);

const MODE_DURATIONS = {
  Focus: 25 * 60,
  Break: 5 * 60,
};

export const FocusProvider = ({ children }) => {
  const { startFocusSession, completeFocusSession, latestSchedule } = useAI();
  const { setLastCompletedSession } = useAppNavigation();

  const [mode, setMode] = useState('Focus');
  const [timeLeft, setTimeLeft] = useState(MODE_DURATIONS.Focus);
  const [initialDuration, setInitialDuration] = useState(MODE_DURATIONS.Focus);
  const [isActive, setIsActive] = useState(false);
  const [activeSession, setActiveSession] = useState(null);
  const sessionStartTime = useRef(null);

  const [selectedSubjectId, setSelectedSubjectId] = useState(null);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [plannedSubjectName, setPlannedSubjectName] = useState(null);
  
  const [scheduleSlots, setScheduleSlots] = useState(null);
  const [currentSlotIndex, setCurrentSlotIndex] = useState(null);
  const [slotStatuses, setSlotStatuses] = useState({});

  // SYNC FROM DB: Sync slot statuses when latestSchedule changes
  useEffect(() => {
    const remoteStatuses = latestSchedule?.slot_statuses || latestSchedule?.slotStatuses;
    if (remoteStatuses) {
      setSlotStatuses(remoteStatuses);
    }
  }, [latestSchedule]);

  // Derive active slot index (first unresolved slot)
  const activeSlotIndex = useMemo(() => {
    if (!scheduleSlots) return 0;
    for (let i = 0; i < scheduleSlots.length; i++) {
      const status = slotStatuses[i]?.status || 'pending';
      if (status !== 'completed' && status !== 'snoozed') {
        return i;
      }
    }
    return scheduleSlots.length;
  }, [scheduleSlots, slotStatuses]);

  const [sessionElapsedSeconds, setSessionElapsedSeconds] = useState(0);

  // Background timer logic
  useEffect(() => {
    let interval = null;
    if (isActive) {
      interval = setInterval(() => {
        setTimeLeft(prev => prev - 1);
        if (mode === 'Focus') {
          setSessionElapsedSeconds(prev => prev + 1);
        }
      }, 1000);
    } else if (interval) {
      clearInterval(interval);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [isActive, mode]);

  const resetTimer = useCallback(() => {
    setIsActive(false);
    setTimeLeft(initialDuration);
    setSessionElapsedSeconds(0);
    
    // Reset the current slot status to pending if it was in_progress
    if (currentSlotIndex !== null) {
      setSlotStatuses(prev => {
        const currentStatus = prev[currentSlotIndex]?.status;
        if (currentStatus === 'in_progress') {
          const newStatuses = { ...prev };
          delete newStatuses[currentSlotIndex];
          
          // Persistent update: Tell the DB it's back to pending
          if (latestSchedule?.id) {
             scheduleApi.updateSlotStatus(latestSchedule.id, currentSlotIndex, { status: 'pending' }).catch(console.warn);
          }
          
          return newStatuses;
        }
        return prev;
      });
    }
    
    // We don't necessarily cancel the backend session here to avoid data loss,
    // but we allow the user to start over.
  }, [initialDuration, currentSlotIndex]);

  const startSession = useCallback(async (params) => {
    const { taskId, subjectId, mode: sessionMode, subjectName, scheduleContext, index } = params;
    const duration = params.duration || params.adjusted_duration_minutes;
    
    // Ensure we are working on the schedule
    if (scheduleContext) {
      setScheduleSlots(scheduleContext.slots);
    }

    const idx = index !== undefined ? index : activeSlotIndex;
    setCurrentSlotIndex(idx);
    
    // Mark as in_progress
    if (idx !== null && idx < (scheduleSlots?.length || (scheduleContext?.slots?.length) || 999)) {
      setSlotStatuses(prev => ({ ...prev, [idx]: { status: 'in_progress' } }));
      
      // Persistent update
      if (latestSchedule?.id) {
         scheduleApi.updateSlotStatus(latestSchedule.id, idx, { status: 'in_progress' }).catch(console.warn);
      }
    }

    const isBreak = subjectName === 'Break' || !subjectId;
    const m = sessionMode || (isBreak ? 'Break' : 'Focus');
    setMode(m);
    setPlannedSubjectName(subjectName || (isBreak ? 'Break' : null));
    
    if (duration) {
      setTimeLeft(duration * 60);
      setInitialDuration(duration * 60);
    } else {
      setTimeLeft(MODE_DURATIONS[m]);
      setInitialDuration(MODE_DURATIONS[m]);
    }

    setSessionElapsedSeconds(0);

    if (!isBreak) {
      setSelectedSubjectId(subjectId);
      setSelectedTaskId(taskId);
      const session = await startFocusSession({
        taskId: taskId || null,
        subjectId: subjectId,
        mode: 0,
      });
      setActiveSession(session);
    } else {
      setSelectedSubjectId(null);
      setSelectedTaskId(null);
      setActiveSession(null);
    }

    sessionStartTime.current = Date.now();
    setIsActive(true);
  }, [startFocusSession, activeSlotIndex, scheduleSlots, latestSchedule]);

  const completeSession = useCallback(async (rating, snoozeReason = null, isTaskFinished = false) => {
    const idx = currentSlotIndex !== null ? currentSlotIndex : activeSlotIndex;
    
    // 1. Handle actual API completion if session was started
    if (activeSession) {
      const elapsedSeconds = Math.max(1, Math.floor((Date.now() - (sessionStartTime.current || Date.now())) / 1000));
      await completeFocusSession(activeSession.id, {
        durationSeconds: elapsedSeconds,
        focusRating: rating || 1,
        snoozeReason: snoozeReason,
        isTaskFinished: isTaskFinished
      });

      if (!snoozeReason) {
        setLastCompletedSession({ subjectId: selectedSubjectId, completedAt: Date.now() });
      }
      setActiveSession(null);
    }

    // 2. Mark the slot as resolved globally
    if (idx !== null) {
      const newStatus = snoozeReason ? 'snoozed' : 'completed';
      setSlotStatuses(prev => ({ ...prev, [idx]: { status: newStatus, reason: snoozeReason } }));
      
      // Persistent update
      if (latestSchedule?.id) {
         try {
           await scheduleApi.updateSlotStatus(latestSchedule.id, idx, { status: newStatus, reason: snoozeReason });
         } catch (err) {
           console.error("Failed to persist slot status:", err);
         }
      }
    }

    // 3. Prepare for the NEXT slot automatically
    sessionStartTime.current = null;
    setIsActive(false);
    setSessionElapsedSeconds(0);

    // We don't call resetTimer() here because we want to look at the NEXT slot
    // The activeSlotIndex will update in the next render cycle because slotStatuses changed.
    // However, to be immediate, we can look at the slots here.
    if (scheduleSlots && idx !== null && idx + 1 < scheduleSlots.length) {
      const nextSlot = scheduleSlots[idx + 1];
      const dur = (nextSlot.adjusted_duration_minutes || 25) * 60;
      setInitialDuration(dur);
      setTimeLeft(dur);
      setPlannedSubjectName(nextSlot.subject);
      setSelectedSubjectId(nextSlot.subject_id);
    } else {
      setTimeLeft(MODE_DURATIONS.Focus);
      setInitialDuration(MODE_DURATIONS.Focus);
      setPlannedSubjectName(null);
      setSelectedSubjectId(null);
    }
  }, [activeSession, completeFocusSession, selectedSubjectId, setLastCompletedSession, currentSlotIndex, activeSlotIndex, scheduleSlots]);

  return (
    <FocusContext.Provider value={{
      mode, setMode,
      timeLeft, setTimeLeft,
      initialDuration, setInitialDuration,
      isActive, setIsActive,
      activeSession, setActiveSession,
      selectedSubjectId, setSelectedSubjectId,
      selectedTaskId, setSelectedTaskId,
      plannedSubjectName, setPlannedSubjectName,
      scheduleSlots, setScheduleSlots,
      currentSlotIndex, setCurrentSlotIndex,
      slotStatuses, setSlotStatuses,
      activeSlotIndex,
      sessionElapsedSeconds,
      startSession,
      completeSession,
      resetTimer,
      MODE_DURATIONS
    }}>
      {children}
    </FocusContext.Provider>
  );
};


export const useFocus = () => {
  const ctx = useContext(FocusContext);
  if (!ctx) throw new Error('useFocus must be used inside <FocusProvider>');
  return ctx;
};
