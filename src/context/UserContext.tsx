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

  const lastUserJsonRef = useRef<string | null>(null);
  const lastOnboardingJsonRef = useRef<string | null>(null);
  const lastPlanJsonRef = useRef<string | null>(null);
  const lastProgressJsonRef = useRef<string | null>(null);
  const lastExerciseProgressJsonRef = useRef<string | null>(null);
  const lastCompletedMealsJsonRef = useRef<string | null>(null);

  // Persistir no localStorage apenas quando os dados mudarem (igualdade profunda via JSON)
  useEffect(() => {
    const json = JSON.stringify(user);
    if (lastUserJsonRef.current === json) return;
    lastUserJsonRef.current = json;
    localStorage.setItem('bilu_user', json);
  }, [user]);

  useEffect(() => {
    if (!onboardingData) return;
    const json = JSON.stringify(onboardingData);
    if (lastOnboardingJsonRef.current === json) return;
    lastOnboardingJsonRef.current = json;
    localStorage.setItem('bilu_onboarding', json);
  }, [onboardingData]);

  useEffect(() => {
    if (!plan) return;
    const json = JSON.stringify(plan);
    if (lastPlanJsonRef.current === json) return;
    lastPlanJsonRef.current = json;
    localStorage.setItem('bilu_plan', json);
  }, [plan]);

  useEffect(() => {
    const json = JSON.stringify(progress);
    if (lastProgressJsonRef.current === json) return;
    lastProgressJsonRef.current = json;
    localStorage.setItem('bilu_progress', json);
  }, [progress]);

  useEffect(() => {
    const json = JSON.stringify(exerciseProgress);
    if (lastExerciseProgressJsonRef.current === json) return;
    lastExerciseProgressJsonRef.current = json;
    localStorage.setItem('bilu_exercise_progress', json);
  }, [exerciseProgress]);

  useEffect(() => {
    const toSave: { [date: string]: string[] } = {};
    Object.keys(completedMeals).forEach(date => {
      toSave[date] = Array.from(completedMeals[date]);
    });
    const json = JSON.stringify(toSave);
    if (lastCompletedMealsJsonRef.current === json) return;
    lastCompletedMealsJsonRef.current = json;
    localStorage.setItem('bilu_completed_meals', json);
  }, [completedMeals]);

  const setUser = useCallback((newUser: User) => {
    setUserState(newUser);
  }, []);

  const setOnboardingData = useCallback((data: OnboardingData) => {
    setOnboardingDataState(data);
    setUserState(prev => ({ ...prev, onboardingCompleted: true }));
  }, []);

  const setPlan = useCallback((newPlan: FourWeekPlan) => {
    setPlanState(newPlan);
  }, []);

  const addProgressEntry = useCallback((entry: ProgressEntry) => {
    setProgress(prev => [...prev, entry].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
  }, []);

  const updateExerciseProgress = useCallback((exerciseId: string, exerciseName: string, date: string, sets: number, reps: number, weight: number) => {
    setExerciseProgress(prev => {
      const existing = prev.find(p => p.exerciseId === exerciseId);
      if (existing) {
        const historyIndex = existing.history.findIndex(h => h.date === date);
        if (historyIndex >= 0) {
          return prev.map(p =>
            p.exerciseId === exerciseId
              ? { ...p, exerciseName, history: p.history.map((h, idx) => idx === historyIndex ? { date, sets, reps, weight } : h) }
              : p
          );
        }
        return prev.map(p =>
          p.exerciseId === exerciseId
            ? { ...p, exerciseName, history: [...p.history, { date, sets, reps, weight }] }
            : p
        );
      }
      return [...prev, { exerciseId, exerciseName, history: [{ date, sets, reps, weight }] }];
    });
  }, []);

  const toggleMealCompletion = useCallback((date: string, mealId: string) => {
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
  }, []);

  const clearProfileCheckResult = useCallback(() => {
    setProfileCheckResult(undefined);
    profileCheckDoneRef.current = true;
  }, []);

  const refreshProfileFromSupabase = useCallback(async (onReady?: (data: OnboardingData) => void) => {
    try {
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

      // Sanitização: converter para Number (banco pode retornar string) antes de usar na UI
      const weight = Number(profile.weight);
      const height = Number(profile.height);
      const age = Number(profile.age);
      const daysPerWeek = Number(profile.days_per_week);
      const workoutDuration = Number(profile.workout_duration);
      const mealsPerDay = Number(profile.meals_per_day);
      const allergies = Array.isArray(profile.allergies) ? profile.allergies : [];
      const injuriesRaw = Array.isArray(profile.injuries) ? profile.injuries : [];
      const injuries = injuriesRaw.map((loc) => ({
        location: typeof loc === 'string' ? loc : String(loc),
        severity: 'mild' as const,
      }));

      const minimal: OnboardingData = {
        biometrics: {
          weight: Number.isFinite(weight) ? weight : 0,
          height: Number.isFinite(height) ? height : 0,
          age: Number.isFinite(age) ? age : 0,
          bodyFat: 0,
          gender,
          biotype,
        },
        restrictions: { allergies, injuries },
        goals: { primary: goal, secondary: [] },
        preferences: {
          workoutDaysPerWeek: Number.isFinite(daysPerWeek) && daysPerWeek >= 1 && daysPerWeek <= 7 ? daysPerWeek : 3,
          workoutDuration: Number.isFinite(workoutDuration) && workoutDuration > 0 ? workoutDuration : 60,
          location,
          mealsPerDay: Number.isFinite(mealsPerDay) && mealsPerDay >= 1 ? mealsPerDay : 4,
          wakeTime,
          workoutTime,
          sleepTime,
        },
      };

      setOnboardingDataState(minimal);
      setUserState((prev) => ({ ...prev, onboardingCompleted: true, displayName: (profile.name ?? '').trim() || 'Bilu' }));
      onReady?.(minimal);
    } catch (e) {
      console.error('[UserContext] Erro ao carregar perfil do Supabase:', e);
      if (e instanceof Error) {
        console.error('[UserContext] Mensagem:', e.message, 'Stack:', e.stack);
      }
    }
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
