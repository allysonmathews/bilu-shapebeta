import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { User, OnboardingData, FourWeekPlan, ProgressEntry, ExerciseProgress } from '../types';
import { supabase, getProfileByUserId, getPreCadastroProfile, type ProfileRow, type PreCadastroProfileRow } from '../lib/supabase';

// localStorage: bilu_user, bilu_onboarding, bilu_plan, bilu_progress, bilu_exercise_progress, bilu_completed_meals
// Estrutura para rastrear refeições completadas por data
interface CompletedMeals {
  [date: string]: Set<string>; // date format: YYYY-MM-DD, Set de meal IDs
}

interface UserContextType {
  user: User;
  authLoading: boolean;
  /** Enquanto true, está verificando na tabela profiles se o usuário já tem perfil (evitar repetir onboarding). */
  profileCheckLoading: boolean;
  /** Perfil encontrado no Supabase (null = não tem ou incompleto; undefined = ainda não verificou). */
  profileCheckResult: ProfileRow | null | undefined;
  clearProfileCheckResult: () => void;
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
  /** Recarrega o perfil do Supabase (ex.: após pre-cadastro via chat). Se onReady for passado, será chamado com os dados para que o plano seja gerado fora. */
  refreshProfileFromSupabase: (onReady?: (data: OnboardingData) => void) => Promise<void>;
  logout: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

// Chaves do localStorage que pertencem APENAS ao UserContext.
// Não usar localStorage.clear() no logout para não apagar dados do ProgressContext.
const USER_STORAGE_KEYS = [
  'bilu_user',
  'bilu_onboarding',
  'bilu_plan',
  'bilu_progress',
  'bilu_exercise_progress',
  'bilu_completed_meals',
] as const;

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [authLoading, setAuthLoading] = useState(true);
  const [profileCheckLoading, setProfileCheckLoading] = useState(false);
  const [profileCheckResult, setProfileCheckResult] = useState<ProfileRow | null | undefined>(undefined);
  const profileCheckDoneRef = useRef(false);

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

  const clearProfileCheckResult = useCallback(() => {
    setProfileCheckResult(undefined);
    profileCheckDoneRef.current = true;
  }, []);

  const refreshProfileFromSupabase = useCallback(async (onReady?: (data: OnboardingData) => void) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) return;

    const profile: PreCadastroProfileRow | null = await getPreCadastroProfile(session.user.id);
    if (!profile) return;

    const goalRaw = profile.goal ?? profile.objective ?? 'hypertrophy';
    const goalMap: Record<string, OnboardingData['goals']['primary']> = {
      Hipertrofia: 'hypertrophy',
      'Perda de peso': 'weight_loss',
      'Ganho de massa': 'hypertrophy',
      Força: 'strength',
      Resistência: 'endurance',
      Manutenção: 'maintenance',
      'Definição Muscular': 'muscle_definition',
      hypertrophy: 'hypertrophy',
      weight_loss: 'weight_loss',
      strength: 'strength',
      endurance: 'endurance',
      maintenance: 'maintenance',
      muscle_definition: 'muscle_definition',
    };
    const goal = goalMap[goalRaw] ?? 'hypertrophy';
    const biotypeMap: Record<string, OnboardingData['biometrics']['biotype']> = {
      Ectomorfo: 'ectomorph',
      Mesomorfo: 'mesomorph',
      Endomorfo: 'endomorph',
      ectomorph: 'ectomorph',
      mesomorph: 'mesomorph',
      endomorph: 'endomorph',
    };
    const locationMap: Record<string, OnboardingData['preferences']['location']> = {
      Academia: 'gym',
      Casa: 'home',
      Parque: 'park',
      Misto: 'mixed',
      gym: 'gym',
      home: 'home',
      park: 'park',
      mixed: 'mixed',
    };
    const biotype = biotypeMap[profile.biotype ?? ''] ?? 'mesomorph';
    const location = locationMap[profile.workout_location ?? ''] ?? 'gym';

    // Horários: colunas do banco em snake_case (API) ou camelCase (migrações antigas)
    const wakeTime = (profile.wake_up_time ?? profile.wakeTime ?? '').trim() || undefined;
    const sleepTime = (profile.sleep_time ?? profile.sleepTime ?? '').trim() || undefined;
    const workoutTime = (profile.workout_time ?? profile.workoutTime ?? '').trim() || undefined;

    const genderFromProfile = profile.gender;
    const gender =
      genderFromProfile === 'female'
        ? 'female'
        : genderFromProfile === 'other'
          ? 'other'
          : 'male';

    const minimal: OnboardingData = {
      biometrics: {
        weight: profile.weight ?? 0,
        height: profile.height ?? 0,
        age: profile.age ?? 0,
        bodyFat: 0,
        gender,
        biotype,
      },
      restrictions: {
        allergies: [],
        injuries: (profile.injuries ?? []).map((loc) => ({ location: loc, severity: 'mild' as const })),
      },
      goals: { primary: goal, secondary: [] },
      preferences: {
        workoutDaysPerWeek: profile.days_per_week ?? 3,
        workoutDuration: 60,
        location,
        mealsPerDay: profile.meals_per_day ?? 4,
        wakeTime,
        workoutTime,
        sleepTime,
      },
    };

    setOnboardingDataState(minimal);
    setUserState((prev) => ({ ...prev, onboardingCompleted: true, displayName: (profile.name ?? '').trim() || 'Bilu' }));
    onReady?.(minimal);
  }, []);

  const clearUserData = useCallback(() => {
    setUserState({ isAuthenticated: false, onboardingCompleted: false });
    setOnboardingDataState(null);
    setPlanState(null);
    setProgress([]);
    setExerciseProgress([]);
    setCompletedMeals({});
    setProfileCheckResult(undefined);
    setProfileCheckLoading(false);
    profileCheckDoneRef.current = false;
    USER_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    clearUserData();
  }, [clearUserData]);

  // Supabase Auth: sessão inicial + listener
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;
      if (session) {
        setUserState((prev) => ({ ...prev, isAuthenticated: true }));
      } else {
        setUserState((prev) => ({ ...prev, isAuthenticated: false }));
      }
      setAuthLoading(false);
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (session) {
        setUserState((prev) => ({ ...prev, isAuthenticated: true }));
      } else {
        clearUserData();
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [clearUserData]);

  // Assim que o login for detectado: buscar perfil na tabela profiles e atualizar estado (perfil completo = pular onboarding).
  // Se existir perfil no banco, carrega os dados do Supabase antes de usar qualquer dado do localStorage.
  useEffect(() => {
    if (authLoading || !user.isAuthenticated || profileCheckDoneRef.current) {
      return;
    }
    let cancelled = false;
    setProfileCheckLoading(true);
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled || !session) {
        setProfileCheckLoading(false);
        return;
      }
      const profile = await getProfileByUserId(session.user.id);
      if (cancelled) return;
      profileCheckDoneRef.current = true;
      setProfileCheckResult(profile ?? null);
      setProfileCheckLoading(false);
      // Se existir perfil no banco, buscar dados completos e preencher onboardingData do Supabase (não usar localStorage).
      if (profile) {
        await refreshProfileFromSupabase();
      } else {
        setUserState((prev) => ({ ...prev, onboardingCompleted: false }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user.isAuthenticated, refreshProfileFromSupabase]);

  return (
    <UserContext.Provider
      value={{
        user,
        authLoading,
        profileCheckLoading,
        profileCheckResult,
        clearProfileCheckResult,
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
        refreshProfileFromSupabase,
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
