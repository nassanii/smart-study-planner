import React, { createContext, useContext, useState } from 'react';

const AIContext = createContext();

export const AIProvider = ({ children }) => {
  const [userData, setUserData] = useState({
    user_id: 1,
    deadline: '2026-06-15',
    isOnboarded: false,
  });

  const [behavioralLogs, setBehavioralLogs] = useState({
    snooze_count_today: 0,
    last_focus_ratings: [4, 5, 3],
    study_hours_today: 2.5,
  });

  const [tasks, setTasks] = useState([
    { id: 1, subject: 'Math', priority: 1, difficulty_rating: 8, days_since_last_study: 1, consecutive_days_studied: 3, status: 'upcoming' },
    { id: 2, subject: 'Science', priority: 2, difficulty_rating: 6, days_since_last_study: 0, consecutive_days_studied: 4, status: 'upcoming' },
  ]);

  const updateTaskDifficulty = (id, rating) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, difficulty_rating: rating } : t));
  };

  const addTask = (task) => {
    setTasks(prev => [...prev, { ...task, id: Date.now() }]);
  };

  const completeOnboarding = (data) => {
    setUserData(prev => ({ ...prev, ...data, isOnboarded: true }));
  };

  return (
    <AIContext.Provider value={{
      userData,
      behavioralLogs,
      tasks,
      updateTaskDifficulty,
      addTask,
      completeOnboarding
    }}>
      {children}
    </AIContext.Provider>
  );
};

export const useAI = () => useContext(AIContext);
