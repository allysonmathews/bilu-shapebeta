import React, { createContext, useContext, ReactNode } from 'react';
import { OnboardingData, FourWeekPlan, WeeklyPlan, Meal, WorkoutDay, DayOfWeek } from '../types';
import { mockFoods, mockExercises, findSimilarFood, MealTime, MuscleGroup } from '../data/mockDatabase';
import { fetchCompletePlanFromApi } from '../lib/aiPlannerApi';
import type { AIPlannerWeek, AIPlannerExercise } from '../lib/aiPlannerApi';
import { mapDietToFourWeekPlan } from '../lib/dietApi';

/*
 * REMOVIDO (simplificação pela API unificada):
 * - calculateWorkoutStructure, getSplitConfig, violatesSynergy, getRepsForExercise (workoutGenerator)
 * - Toda a lógica manual de geração de exercícios (generateWorkouts ~450 linhas):
 *   mapeamento de lesões, filtros de segurança, seleção por split/agonista-sinergista,
 *   verificação de sinergia, pool de exercícios por local, regra 10 min/exercício.
 * O treino agora vem diretamente do workout_plan retornado pela IA.
 */

interface PlanContextType {
  /** Gera plano completo (dieta + treino via API unificada). Assíncrono. */
  generatePlanAsync: (data: OnboardingData, accessToken?: string | null) => Promise<FourWeekPlan>;
  swapFoodItem: (plan: FourWeekPlan, weekIndex: number, dayOfWeek: DayOfWeek, mealIndex: number, currentFoodId: string) => FourWeekPlan;
  swapExercise: (plan: FourWeekPlan, weekIndex: number, dayIndex: number, exerciseIndex: number, currentExerciseId: string) => FourWeekPlan;
}

const PlanContext = createContext<PlanContextType | undefined>(undefined);

let exportedRegenerateAllPlansAsync: ((profile: OnboardingData, accessToken?: string | null) => Promise<FourWeekPlan>) | null = null;

/** Mapeia nomes de grupos musculares (PT/EN) para o formato interno. */
function normalizeMuscleGroup(name: string): MuscleGroup {
  const n = name.toLowerCase().trim();
  const map: Record<string, MuscleGroup> = {
    peito: 'chest', chest: 'chest',
    costas: 'back', back: 'back',
    ombros: 'shoulders', shoulders: 'shoulders',
    bíceps: 'biceps', biceps: 'biceps',
    tríceps: 'triceps', triceps: 'triceps',
    antebraço: 'forearms', forearms: 'forearms',
    abdômen: 'abs', abdominal: 'abs', abs: 'abs',
    lombar: 'lower_back', 'lower back': 'lower_back', lower_back: 'lower_back',
    glúteos: 'glutes', glutes: 'glutes',
    quadríceps: 'quads', quads: 'quads', coxa: 'quads',
    posterior: 'hamstrings', hamstrings: 'hamstrings', isquiotibiais: 'hamstrings',
    panturrilha: 'calves', calves: 'calves', gastrocnêmio: 'calves',
  };
  return (map[n] ?? 'chest') as MuscleGroup;
}

/** Mapeia dayName para número do dia da semana (1=Segunda). */
function dayNameToNumber(dayName: string): number {
  const n = dayName.toLowerCase();
  if (n.includes('segunda') || n.includes('monday')) return 1;
  if (n.includes('terça') || n.includes('tuesday')) return 2;
  if (n.includes('quarta') || n.includes('wednesday')) return 3;
  if (n.includes('quinta') || n.includes('thursday')) return 4;
  if (n.includes('sexta') || n.includes('friday')) return 5;
  if (n.includes('sábado') || n.includes('saturday')) return 6;
  if (n.includes('domingo') || n.includes('sunday')) return 7;
  return 1;
}

/**
 * Converte workout_plan da IA em WorkoutDay[].
 * Cada exercício recebe ID único (exerciseId + week + day + index) para evitar chaves duplicadas no React.
 * Se objetivo for weight_loss, garante bloco de cardio como último item com id cardio-final-{week}-{day}.
 */
function mapWorkoutPlanToWorkoutDays(
  workoutPlan: AIPlannerWeek[],
  defaultDuration: number,
  objective?: OnboardingData['goals']['primary']
): WorkoutDay[] {
  const workouts: WorkoutDay[] = [];
  const addCardio = objective === 'weight_loss';
  for (const weekData of workoutPlan) {
    const weekNum = weekData.week ?? workouts.length + 1;
    for (let dayIdx = 0; dayIdx < weekData.workoutDays.length; dayIdx++) {
      const wd = weekData.workoutDays[dayIdx];
      const dayOfWeek = dayNameToNumber(wd.dayName);
      const dayNumber = (weekNum - 1) * 7 + dayOfWeek;
      const primaryMuscle = wd.muscleGroups?.[0] ? normalizeMuscleGroup(wd.muscleGroups[0]) : 'chest';

      const baseExercises = (wd.exercises ?? []).map((ex: AIPlannerExercise, exIdx: number) => {
        const slug = ex.name.replace(/\s+/g, '-').toLowerCase().slice(0, 30);
        const uniqueSuffix = `${weekNum}-${dayIdx}-${exIdx}`;
        const mock = mockExercises.find(
          (m) => m.name.toLowerCase().trim() === ex.name.toLowerCase().trim()
        );
        const baseId = mock ? mock.id : `ai-${slug}`;
        const uniqueId = `${baseId}-${uniqueSuffix}`;
        if (mock) {
          return {
            id: uniqueId,
            name: mock.name,
            sets: ex.sets ?? 3,
            reps: ex.reps ?? 10,
            weight: undefined,
            muscleGroup: mock.muscleGroup,
            equipment: mock.equipment,
            videoUrl: mock.videoUrl,
          };
        }
        return {
          id: uniqueId,
          name: ex.name,
          sets: ex.sets ?? 3,
          reps: ex.reps ?? 10,
          weight: undefined,
          muscleGroup: primaryMuscle,
          equipment: 'gym',
          videoUrl: undefined,
        };
      });

      let exercises = baseExercises;
      const hasCardioAsLast = baseExercises.length > 0 &&
        /cardio|esteira|corrida|corda/i.test(baseExercises[baseExercises.length - 1].name);
      if (addCardio && !hasCardioAsLast) {
        const cardioId = `cardio-final-${weekNum}-${dayIdx}`;
        exercises = [
          ...baseExercises,
          {
            id: cardioId,
            name: 'Cardio (Esteira/Corda/Corrida)',
            sets: 1,
            reps: 25,
            weight: undefined,
            muscleGroup: 'calves' as MuscleGroup,
            equipment: 'gym',
            videoUrl: undefined,
          },
        ];
      }

      const duration =
        exercises.length > 0
          ? Math.round(exercises.length * 9)
          : defaultDuration;
      workouts.push({
        id: `workout-${weekNum}-${dayOfWeek}`,
        day: dayNumber,
        week: weekNum,
        exercises,
        duration: Math.min(
          Math.max(duration, defaultDuration - 15),
          defaultDuration + 20
        ),
        completed: false,
      });
    }
  }
  return workouts;
}

export const PlanProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  /** Plano padrão quando a API retorna incompleto ou ocorre erro de processamento. */
  const getDefaultFourWeekPlan = (): FourWeekPlan => ({
    weeks: Array.from({ length: 4 }, (_, i) => ({
      week: i + 1,
      meals: [],
      dailyMeals: {
        monday: [],
        tuesday: [],
        wednesday: [],
        thursday: [],
        friday: [],
        saturday: [],
        sunday: [],
      },
      workouts: [],
      totalCalories: 0,
      totalProtein: 0,
      totalCarbs: 0,
      totalFat: 0,
    })),
    startDate: new Date().toISOString(),
  });

  /** Gera plano completo via API unificada (dieta + treino). Assíncrono. */
  const generatePlanAsync = async (data: OnboardingData, accessToken?: string | null): Promise<FourWeekPlan> => {
    const stableDuration = Number(data?.preferences?.workoutDuration) || 100;
    const objective = data?.goals?.primary;
    console.log('Payload enviado:', data);
    const result = await fetchCompletePlanFromApi(data, accessToken);

    if (!result.ok) {
      throw new Error(result.error);
    }

    try {
      const hasValidDiet =
        result.diet?.refeicoes && Array.isArray(result.diet.refeicoes);
      const hasValidWorkout =
        result.workout_plan && Array.isArray(result.workout_plan);

      if (!hasValidDiet) {
        return getDefaultFourWeekPlan();
      }

      const plan = mapDietToFourWeekPlan(result.diet);
      const workoutDays = hasValidWorkout
        ? mapWorkoutPlanToWorkoutDays(result.workout_plan, stableDuration, objective)
        : [];

      const weeks: WeeklyPlan[] = plan.weeks.map((w, i) => ({
        ...w,
        workouts: workoutDays.filter((wk) => wk.week === i + 1),
      }));

      return {
        weeks,
        startDate: plan.startDate,
        dietaApi: plan.dietaApi,
      };
    } catch (e) {
      console.warn('Erro ao processar resposta da API, usando plano padrão:', e);
      return getDefaultFourWeekPlan();
    }
  };

  // swapFoodItem e swapExercise mantidos - funcionam com dados da dieta/treino (IA ou mock)

  // Função global para trocar um alimento no plano
  const swapFoodItem = (
    plan: FourWeekPlan,
    weekIndex: number,
    dayOfWeek: DayOfWeek,
    mealIndex: number,
    currentFoodId: string
  ): FourWeekPlan => {
    const updatedPlan = { ...plan };
    const week = updatedPlan.weeks[weekIndex];
    
    if (!week || !week.dailyMeals) {
      return plan; // Retorna plano original se estrutura inválida
    }

    const dayMeals = week.dailyMeals[dayOfWeek];
    if (!dayMeals || mealIndex >= dayMeals.length) {
      return plan; // Retorna plano original se índice inválido
    }

    const meal = dayMeals[mealIndex];
    const foodIndex = meal.foods.findIndex(f => f.id === currentFoodId);
    
    if (foodIndex === -1) {
      return plan; // Retorna plano original se alimento não encontrado
    }

    const currentFood = meal.foods[foodIndex];
    
    // Encontrar alimento original no mockDatabase (ou usar dados da IA se id começar com ai-)
    const originalFood = mockFoods.find(f => f.id === currentFoodId);
    
    if (!originalFood) {
      return plan; // Retorna plano original se não encontrar no database
    }

    // Mapear nome da refeição para MealTime
    const getMealTime = (mealName: string): MealTime => {
      if (mealName === 'Desjejum') return 'desjejum';
      if (mealName === 'Café da Manhã') return 'cafe';
      if (mealName === 'Almoço') return 'almoco';
      if (mealName === 'Lanche da Tarde' || mealName === 'Lanche da Tarde I' || mealName === 'Lanche da Tarde II') return 'lanche_tarde';
      if (mealName === 'Pré-Treino') return 'lanche_tarde';
      if (mealName === 'Pós-Treino') return 'pos_treino';
      if (mealName === 'Janta' || mealName === 'Jantar') return 'janta';
      if (mealName === 'Ceia') return 'ceia';
      return 'almoco'; // fallback
    };

    const targetMeal = getMealTime(meal.name);

    // Encontrar alimento similar, respeitando o horário da refeição
    const similarFood = findSimilarFood(originalFood, currentFoodId, targetMeal);
    
    if (!similarFood) {
      return plan; // Retorna plano original se não encontrar similar
    }

    // Criar cópia profunda do plano para atualizar
    const newDailyMeals = { ...week.dailyMeals };
    const newDayMeals = [...dayMeals];
    const newMeal = { ...meal };
    const newFoods = [...meal.foods];

    const oldQuantity = currentFood.quantity || 1;
    const newQuantity = oldQuantity;

    newFoods[foodIndex] = {
      id: similarFood.id,
      name: similarFood.name,
      quantity: newQuantity,
      calories: similarFood.calories * newQuantity,
      protein: similarFood.protein * newQuantity,
      carbs: similarFood.carbs * newQuantity,
      fat: similarFood.fat * newQuantity,
    };

    const newTotalCalories = newFoods.reduce((sum, f) => sum + f.calories, 0);
    const newTotalProtein = newFoods.reduce((sum, f) => sum + f.protein, 0);
    const newTotalCarbs = newFoods.reduce((sum, f) => sum + f.carbs, 0);
    const newTotalFat = newFoods.reduce((sum, f) => sum + f.fat, 0);

    newMeal.foods = newFoods;
    newMeal.totalCalories = Math.round(newTotalCalories);
    newMeal.totalProtein = Math.round(newTotalProtein);
    newMeal.totalCarbs = Math.round(newTotalCarbs);
    newMeal.totalFat = Math.round(newTotalFat);

    newDayMeals[mealIndex] = newMeal;
    newDailyMeals[dayOfWeek] = newDayMeals;

    const newMeals: Meal[] = [
      ...newDailyMeals.monday,
      ...newDailyMeals.tuesday,
      ...newDailyMeals.wednesday,
      ...newDailyMeals.thursday,
      ...newDailyMeals.friday,
      ...newDailyMeals.saturday,
      ...newDailyMeals.sunday,
    ];

    const mondayMeals = newDailyMeals.monday;
    const newTotalCaloriesWeek = mondayMeals.reduce((sum, m) => sum + m.totalCalories, 0);
    const newTotalProteinWeek = mondayMeals.reduce((sum, m) => sum + m.totalProtein, 0);
    const newTotalCarbsWeek = mondayMeals.reduce((sum, m) => sum + m.totalCarbs, 0);
    const newTotalFatWeek = mondayMeals.reduce((sum, m) => sum + m.totalFat, 0);

    const newWeeks = [...updatedPlan.weeks];
    newWeeks[weekIndex] = {
      ...week,
      meals: newMeals,
      dailyMeals: newDailyMeals,
      totalCalories: Math.round(newTotalCaloriesWeek),
      totalProtein: Math.round(newTotalProteinWeek),
      totalCarbs: Math.round(newTotalCarbsWeek),
      totalFat: Math.round(newTotalFatWeek),
    };

    return {
      ...updatedPlan,
      weeks: newWeeks,
    };
  };

  // Trocar exercício por outro do mesmo grupo muscular (SUBSTITUIÇÃO CIRÚRGICA)
  const swapExercise = (
    plan: FourWeekPlan,
    weekIndex: number,
    dayIndex: number,
    exerciseIndex: number,
    currentExerciseId: string
  ): FourWeekPlan => {
    // 1. PROTEÇÃO DE REFERÊNCIA (IMUTABILIDADE): Deep Copy do plano
    const newPlan = JSON.parse(JSON.stringify(plan)) as FourWeekPlan;

    // Validações de segurança
    if (!newPlan.weeks || weekIndex < 0 || weekIndex >= newPlan.weeks.length) {
      return plan; // Retorna original se inválido
    }

    const week = newPlan.weeks[weekIndex];
    if (!week || !week.workouts || dayIndex < 0 || dayIndex >= week.workouts.length) {
      return plan; // Retorna original se inválido
    }

    const workout = week.workouts[dayIndex];
    if (!workout || !workout.exercises || exerciseIndex < 0 || exerciseIndex >= workout.exercises.length) {
      return plan; // Retorna original se inválido
    }

    // 2. LOCALIZAR O EXERCÍCIO NO ÍNDICE EXATO
    const currentExercise = workout.exercises[exerciseIndex];
    if (!currentExercise || currentExercise.id !== currentExerciseId) {
      return plan; // Retorna original se não encontrar o exercício esperado
    }

    // 3. IDENTIFICAR GRUPO MUSCULAR DO EXERCÍCIO ATUAL
    const targetMuscleGroup = currentExercise.muscleGroup as MuscleGroup;

    // 4. FILTRO DE UNICIDADE (ANTI-REPETIÇÃO):
    // a) Excluir o exercício que está sendo removido
    // b) Excluir QUALQUER exercício que já esteja presente na lista do dia
    const existingExerciseIds = new Set<string>(
      workout.exercises.map(ex => ex.id).filter(id => id !== currentExerciseId)
    );

    // 5. BUSCAR SUBSTITUTO NO BANCO DE DADOS
    // Filtrar por mesmo grupo muscular e excluir duplicatas
    const candidates = mockExercises.filter(
      (e) =>
        e.muscleGroup === targetMuscleGroup && // Mesmo grupo muscular
        e.id !== currentExerciseId && // Não é o exercício sendo removido
        !existingExerciseIds.has(e.id) // Não está na lista do dia
    );

    // Se não houver candidatos, retornar plano original
    if (candidates.length === 0) {
      return plan;
    }

    // Selecionar substituto aleatório
    const replacement = candidates[Math.floor(Math.random() * candidates.length)];

    // 6. SUBSTITUIÇÃO CIRÚRGICA: manter ID único do exercício atual para evitar chaves duplicadas
    const newExercises = [...workout.exercises];
    newExercises[exerciseIndex] = {
      ...currentExercise,
      id: currentExercise.id,
      name: replacement.name,
      muscleGroup: replacement.muscleGroup,
      equipment: replacement.equipment,
      videoUrl: replacement.videoUrl,
    };

    // 7. ATUALIZAR O PLANO COM A CÓPIA MODIFICADA
    const newWorkout = { ...workout, exercises: newExercises };
    const newWorkouts = [...week.workouts];
    newWorkouts[dayIndex] = newWorkout;

    const newWeeks = [...newPlan.weeks];
    newWeeks[weekIndex] = { ...week, workouts: newWorkouts };

    return {
      ...newPlan,
      weeks: newWeeks,
    };
  };

  exportedRegenerateAllPlansAsync = generatePlanAsync;

  return (
    <PlanContext.Provider value={{ generatePlanAsync, swapFoodItem, swapExercise }}>
      {children}
    </PlanContext.Provider>
  );
};

export const usePlan = () => {
  const context = useContext(PlanContext);
  if (!context) {
    throw new Error('usePlan must be used within PlanProvider');
  }
  return context;
};

// Regenerar todos os planos (dieta via IA + treino)
export const regenerateAllPlansAsync = async (profile: OnboardingData, accessToken?: string | null): Promise<FourWeekPlan> => {
  if (!exportedRegenerateAllPlansAsync) {
    throw new Error('PlanProvider não foi inicializado.');
  }
  return exportedRegenerateAllPlansAsync(profile, accessToken);
};
