import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, OnboardingData, FourWeekPlan, ProgressEntry, ExerciseProgress } from '../types';
import { usePlan } from './PlanContext';

// Estrutura para rastrear refeições completadas por data
interface CompletedMeals {
  [date: string]: Set<string>; // date format: YYYY-MM-DD, Set de meal IDs
}

interface UserContextType {
  user: User;
  onboardingData: OnboardingData | null;
  plan: FourWeekPlan | null;
  progress: ProgressEntry[];
  exerciseProgress: ExerciseProgress[];
  completedMeals: CompletedMeals;
  setUser: (user: User) => void;
  setOnboardingData: (data: OnboardingData) => void;
  setPlan: (plan: FourWeekPlan) => void;
  addProgressEntry: (entry: ProgressEntry) => void;
  updateExerciseProgress: (exerciseId: string, exerciseName: string, date: string, sets: number, reps: number, weight: number) => void;
  toggleMealCompletion: (date: string, mealId: string) => void;
  login: () => void;
  logout: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUserState] = useState<User>(() => {
    const stored = localStorage.getItem('bilu_user');
    return stored ? JSON.parse(stored) : { isAuthenticated: false, onboardingCompleted: false };
  });

  const [onboardingData, setOnboardingDataState] = useState<OnboardingData | null>(() => {
    const stored = localStorage.getItem('bilu_onboarding');
    return stored ? JSON.parse(stored) : null;
  });

  const [plan, setPlanState] = useState<FourWeekPlan | null>(() => {
    const stored = localStorage.getItem('bilu_plan');
    return stored ? JSON.parse(stored) : null;
  });

  const [progress, setProgress] = useState<ProgressEntry[]>(() => {
    const stored = localStorage.getItem('bilu_progress');
    return stored ? JSON.parse(stored) : [];
  });

  const [exerciseProgress, setExerciseProgress] = useState<ExerciseProgress[]>(() => {
    const stored = localStorage.getItem('bilu_exercise_progress');
    return stored ? JSON.parse(stored) : [];
  });

  const [completedMeals, setCompletedMeals] = useState<CompletedMeals>(() => {
    const stored = localStorage.getItem('bilu_completed_meals');
    if (stored) {
      const parsed = JSON.parse(stored);
      // Converter arrays de volta para Sets
      const result: CompletedMeals = {};
      Object.keys(parsed).forEach(date => {
        result[date] = new Set(parsed[date]);
      });
      return result;
    }
    return {};
  });

  // Persistir no localStorage
  useEffect(() => {
    localStorage.setItem('bilu_user', JSON.stringify(user));
  }, [user]);

  useEffect(() => {
    if (onboardingData) {
      localStorage.setItem('bilu_onboarding', JSON.stringify(onboardingData));
    }
  }, [onboardingData]);

  useEffect(() => {
    if (plan) {
      localStorage.setItem('bilu_plan', JSON.stringify(plan));
    }
  }, [plan]);

  useEffect(() => {
    localStorage.setItem('bilu_progress', JSON.stringify(progress));
  }, [progress]);

  useEffect(() => {
    localStorage.setItem('bilu_exercise_progress', JSON.stringify(exerciseProgress));
  }, [exerciseProgress]);

  useEffect(() => {
    // Converter Sets para arrays para salvar no localStorage
    const toSave: { [date: string]: string[] } = {};
    Object.keys(completedMeals).forEach(date => {
      toSave[date] = Array.from(completedMeals[date]);
    });
    localStorage.setItem('bilu_completed_meals', JSON.stringify(toSave));
  }, [completedMeals]);

  const setUser = (newUser: User) => {
    setUserState(newUser);
  };

  const setOnboardingData = (data: OnboardingData) => {
    setOnboardingDataState(data);
    setUserState(prev => ({ ...prev, onboardingCompleted: true }));
  };

  const setPlan = (newPlan: FourWeekPlan) => {
    setPlanState(newPlan);
  };

  const addProgressEntry = (entry: ProgressEntry) => {
    setProgress(prev => [...prev, entry].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
  };

  const updateExerciseProgress = (exerciseId: string, exerciseName: string, date: string, sets: number, reps: number, weight: number) => {
    setExerciseProgress(prev => {
      const existing = prev.find(p => p.exerciseId === exerciseId);
      if (existing) {
        // Verificar se já existe um registro para esta data
        const historyIndex = existing.history.findIndex(h => h.date === date);
        
        if (historyIndex >= 0) {
          // Atualizar registro existente (UPSERT)
          return prev.map(p => 
            p.exerciseId === exerciseId
              ? { 
                  ...p, 
                  exerciseName, 
                  history: p.history.map((h, idx) => 
                    idx === historyIndex 
                      ? { date, sets, reps, weight } // Atualizar
                      : h
                  )
                }
              : p
          );
        } else {
          // Adicionar novo registro ao histórico
          return prev.map(p => 
            p.exerciseId === exerciseId
              ? { ...p, exerciseName, history: [...p.history, { date, sets, reps, weight }] }
              : p
          );
        }
      } else {
        // Criar novo exercício com histórico
        return [...prev, { exerciseId, exerciseName, history: [{ date, sets, reps, weight }] }];
      }
    });
  };

  const toggleMealCompletion = (date: string, mealId: string) => {
    setCompletedMeals(prev => {
      const newCompleted = { ...prev };
      if (!newCompleted[date]) {
        newCompleted[date] = new Set();
      } else {
        newCompleted[date] = new Set(newCompleted[date]);
      }
      
      if (newCompleted[date].has(mealId)) {
        newCompleted[date].delete(mealId);
      } else {
        newCompleted[date].add(mealId);
      }
      
      return newCompleted;
    });
  };

  const login = () => {
    setUserState({ isAuthenticated: true, onboardingCompleted: user.onboardingCompleted });
  };

  const logout = () => {
    setUserState({ isAuthenticated: false, onboardingCompleted: false });
    setOnboardingDataState(null);
    setPlanState(null);
    setProgress([]);
    setExerciseProgress([]);
    setCompletedMeals({});
    localStorage.clear();
  };

  return (
    <UserContext.Provider
      value={{
        user,
        onboardingData,
        plan,
        progress,
        exerciseProgress,
        completedMeals,
        setUser,
        setOnboardingData,
        setPlan,
        addProgressEntry,
        updateExerciseProgress,
        toggleMealCompletion,
        login,
        logout,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within UserProvider');
  }
  return context;
};
