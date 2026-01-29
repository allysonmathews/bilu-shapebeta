import React, { createContext, useContext, ReactNode } from 'react';
import { OnboardingData, FourWeekPlan, WeeklyPlan, Meal, WorkoutDay, DailyMeals, DayOfWeek, Preferences } from '../types';
import { mockFoods, mockExercises, Food, Exercise, findSimilarFood, MealTime, MuscleGroup, JointGroup } from '../data/mockDatabase';
import {
  calculateWorkoutStructure,
  getSplitConfig,
  violatesSynergy,
  getRepsForExercise,
  type SplitType,
  type WorkoutStructure,
  type Goal as WorkoutGoal,
} from '../logic/workoutGenerator';

interface PlanContextType {
  generatePlan: (data: OnboardingData) => FourWeekPlan;
  swapFoodItem: (plan: FourWeekPlan, weekIndex: number, dayOfWeek: DayOfWeek, mealIndex: number, currentFoodId: string) => FourWeekPlan;
  swapExercise: (plan: FourWeekPlan, weekIndex: number, dayIndex: number, exerciseIndex: number, currentExerciseId: string) => FourWeekPlan;
}

const PlanContext = createContext<PlanContextType | undefined>(undefined);

// Referências para as funções exportadas (serão definidas dentro do componente)
let exportedGenerateDietPlan: ((profile: OnboardingData) => { dailyMeals: DailyMeals[]; totals: { calories: number; protein: number; carbs: number; fat: number } }) | null = null;
let exportedGenerateWorkoutPlan: ((profile: OnboardingData) => WorkoutDay[]) | null = null;
let exportedRegenerateAllPlans: ((profile: OnboardingData) => FourWeekPlan) | null = null;

export const PlanProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Calcular TDEE (Total Daily Energy Expenditure)
  const calculateTDEE = (data: OnboardingData): number => {
    const { weight, height, age, gender } = data.biometrics;
    
    // Fórmula de Mifflin-St Jeor (mais precisa)
    let bmr: number;
    if (gender === 'male') {
      bmr = 10 * weight + 6.25 * height - 5 * age + 5;
    } else {
      bmr = 10 * weight + 6.25 * height - 5 * age - 161;
    }

    // Fator de atividade mais conservador
    // Padrão: 1.2 (Sedentário) ou no máximo 1.375 (Levemente ativo)
    // Só usar valores maiores se o usuário treinar muito (5+ dias)
    let activityFactor: number;
    if (data.preferences.workoutDaysPerWeek >= 5) {
      activityFactor = 1.375; // Levemente ativo (máximo conservador)
    } else if (data.preferences.workoutDaysPerWeek >= 3) {
      activityFactor = 1.2; // Sedentário (padrão conservador)
    } else {
      activityFactor = 1.2; // Sedentário (padrão)
    }

    let tdee = bmr * activityFactor;

    // Ajustar baseado no objetivo
    if (data.goals.primary === 'weight_loss') {
      // Déficit de 500 a 750 kcal (usando 750 para ser mais efetivo)
      tdee -= 750;
    } else if (data.goals.primary === 'hypertrophy') {
      tdee += 300; // Superávit de 300kcal
    }

    // Travas de segurança: mínimo absoluto para evitar dietas de fome
    const minCalories = gender === 'male' ? 1800 : 1400;
    if (tdee < minCalories) {
      tdee = minCalories;
    }

    return Math.round(tdee);
  };

  // Funções auxiliares para manipulação de horários
  const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const minutesToTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60) % 24;
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  };

  const addMinutes = (time: string, minutes: number): string => {
    return minutesToTime(timeToMinutes(time) + minutes);
  };

  // Identificar alimentos adequados para pré-treino (carboidratos leves/energéticos)
  const isPreWorkoutFood = (food: Food): boolean => {
    // Carboidratos leves, frutas, snacks energéticos
    return (food.category === 'carb' && (food.name.includes('Batata-doce') || food.name.includes('Aveia') || food.name.includes('Tapioca'))) ||
           (food.category === 'fruit' && food.name === 'Banana') ||
           (food.category === 'carb' && (food.name.includes('Pão') || food.name.includes('Cuscuz')));
  };

  // Identificar alimentos adequados para pós-treino (ricos em proteína)
  const isPostWorkoutFood = (food: Food): boolean => {
    // Proteínas e carboidratos de recuperação
    return food.category === 'protein' ||
           (food.category === 'carb' && food.name.includes('Batata-doce')) ||
           (food.allowedMeals.includes('pos_treino'));
  };

  // Identificar alimentos leves para ceia (slow release)
  const isBedtimeFood = (food: Food): boolean => {
    // Alimentos leves, laticínios, frutas com gordura
    return food.category === 'dairy' ||
           (food.category === 'fruit' && (food.name === 'Abacate')) ||
           (food.allowedMeals.includes('ceia'));
  };

  // Função auxiliar para mapear alergias do usuário para tags de alimentos
  const mapAllergyToTags = (allergy: string): string[] => {
    const allergyLower = allergy.toLowerCase();
    const tags: string[] = [];
    
    if (allergyLower.includes('lactose') || allergyLower.includes('leite')) {
      tags.push('lactose', 'derivado de leite', 'leite');
    }
    if (allergyLower.includes('glúten') || allergyLower.includes('gluten') || allergyLower.includes('trigo')) {
      tags.push('gluten', 'trigo');
    }
    if (allergyLower.includes('ovo') || allergyLower.includes('ovos')) {
      tags.push('ovo');
    }
    if (allergyLower.includes('amendoim')) {
      tags.push('amendoim');
    }
    if (allergyLower.includes('peixe') || allergyLower.includes('frutos do mar') || allergyLower.includes('frutos do mar') || allergyLower.includes('crustáceos') || allergyLower.includes('camarão')) {
      tags.push('peixe', 'frutos do mar', 'crustáceos');
    }
    
    return tags;
  };

  // Função para filtrar alimentos permitidos baseado em alergias
  const filterAllowedFoods = (foods: Food[], allergies: string[]): Food[] => {
    if (allergies.length === 0) return foods;
    
    // Mapear todas as alergias para tags
    const forbiddenTags = new Set<string>();
    allergies.forEach(allergy => {
      const tags = mapAllergyToTags(allergy);
      tags.forEach(tag => forbiddenTags.add(tag.toLowerCase()));
    });
    
    // Filtrar alimentos que não contêm nenhuma tag proibida
    return foods.filter(food => {
      if (!food.tags || food.tags.length === 0) return true; // Alimentos sem tags são permitidos
      
      // Verificar se alguma tag do alimento está na lista de proibidos
      const hasForbiddenTag = food.tags.some(tag => 
        forbiddenTags.has(tag.toLowerCase())
      );
      
      return !hasForbiddenTag;
    });
  };

  // Função para encontrar substituto equivalente nutricional
  const findEquivalentSubstitute = (
    originalFood: Food,
    allowedFoods: Food[],
    targetCategory?: 'protein' | 'carb' | 'fat' | 'vegetable' | 'fruit' | 'dairy'
  ): Food | null => {
    // Filtrar por categoria se especificada
    let candidates = targetCategory 
      ? allowedFoods.filter(f => f.category === targetCategory)
      : allowedFoods.filter(f => f.category === originalFood.category);
    
    if (candidates.length === 0) {
      // Se não houver na mesma categoria, buscar em categorias relacionadas
      if (originalFood.category === 'protein') {
        candidates = allowedFoods.filter(f => f.category === 'protein');
      } else if (originalFood.category === 'carb') {
        candidates = allowedFoods.filter(f => f.category === 'carb' || f.category === 'fruit');
      }
    }
    
    if (candidates.length === 0) return null;
    
    // Calcular diferença nutricional e encontrar o melhor substituto
    const substitutes = candidates.map(food => {
      const proteinDiff = Math.abs(food.protein - originalFood.protein);
      const calorieDiff = Math.abs(food.calories - originalFood.calories);
      const caloriePercentDiff = originalFood.calories > 0 
        ? (calorieDiff / originalFood.calories) * 100 
        : 0;
      
      return {
        food,
        proteinDiff,
        caloriePercentDiff,
        score: proteinDiff + (caloriePercentDiff * 0.1) // Penalizar mais diferença de calorias
      };
    });
    
    // Filtrar por critérios de equivalência: proteína +/- 5g, calorias +/- 15%
    const validSubstitutes = substitutes.filter(sub => 
      sub.proteinDiff <= 5 && sub.caloriePercentDiff <= 15
    );
    
    if (validSubstitutes.length === 0) {
      // Se não houver substituto perfeito, retornar o mais próximo
      substitutes.sort((a, b) => a.score - b.score);
      return substitutes[0]?.food || null;
    }
    
    // Retornar o melhor substituto válido
    validSubstitutes.sort((a, b) => a.score - b.score);
    return validSubstitutes[0].food;
  };

  // Gerar refeições para um dia específico usando Crononutrição Dinâmica
  const generateDayMeals = (
    dailyCalories: number,
    mealsPerDay: number,
    week: number,
    dayIndex: number,
    preferences: Preferences,
    allergies: string[] = []
  ): Meal[] => {
    const meals: Meal[] = [];

    // ============================================
    // FILTRO DE EXCLUSÃO (HARD FILTER) - BASEADO EM ALERGIAS
    // ============================================
    const allowedFoods = filterAllowedFoods(mockFoods, allergies);

    // VALIDAÇÃO: Usar valores reais do perfil (obrigatórios)
    if (!preferences.wakeTime || !preferences.workoutTime || !preferences.sleepTime) {
      // Se não houver valores, usar valores padrão apenas como fallback
      // Mas o ideal é que sempre venham do perfil
      console.warn('Horários não definidos no perfil. Usando valores padrão.');
    }
    
    const wakeTime = preferences.wakeTime || '08:00';
    const workoutTime = preferences.workoutTime || '17:00';
    const sleepTime = preferences.sleepTime || '23:00';
    const workoutDuration = preferences.workoutDuration || 90;

    // ============================================
    // 1. DEFINIR EVENTOS FIXOS (Timeline) - BASEADO NOS DADOS REAIS
    // ============================================
    // Desjejum: EXATAMENTE 30 minutos após acordar
    const breakfastTime = addMinutes(wakeTime, 30);
    
    // Pré-Treino: EXATAMENTE 30 minutos ANTES do início do treino
    const preWorkoutTime = addMinutes(workoutTime, -30);
    
    // Pós-Treino: EXATAMENTE 30 minutos APÓS o fim do treino
    const workoutEnd = addMinutes(workoutTime, workoutDuration);
    const postWorkoutTime = addMinutes(workoutEnd, 30);
    
    // Ceia: EXATAMENTE 30 minutos ANTES de dormir
    const lastMealTime = addMinutes(sleepTime, -30);

    // Converter para minutos para facilitar cálculos
    const breakfastMinutes = timeToMinutes(breakfastTime);
    const preWorkoutMinutes = timeToMinutes(preWorkoutTime);
    const postWorkoutMinutes = timeToMinutes(postWorkoutTime);
    const lastMealMinutes = timeToMinutes(lastMealTime);

    // REGRA: Intervalo mínimo de 2 horas (120 minutos) entre qualquer refeição
    const MIN_INTERVAL_MINUTES = 120;
    
    // Função auxiliar para determinar nome da refeição baseado no horário
    // (Definida aqui para ser acessível em todo o escopo)
    const getMealName = (timeMinutes: number): { name: string; mealTime: MealTime } => {
      const timeStr = minutesToTime(timeMinutes);
      const [hours, minutes] = timeStr.split(':').map(Number);
      const timeInMinutes = hours * 60 + minutes;
      
      // Almoço: entre 11:30 e 13:30
      const lunchStart = 11 * 60 + 30; // 11:30
      const lunchEnd = 13 * 60 + 30;    // 13:30
      
      if (timeInMinutes >= lunchStart && timeInMinutes <= lunchEnd) {
        return { name: 'Almoço', mealTime: 'almoco' };
      }
      
      // Janta: após Pós-Treino e antes da Ceia
      if (timeMinutes > postWorkoutMinutes && timeMinutes < lastMealMinutes) {
        return { name: 'Janta', mealTime: 'janta' };
      }
      
      // Lanche da Tarde: padrão para refeições intermediárias
      return { name: 'Lanche da Tarde', mealTime: 'lanche_tarde' };
    };

    // ============================================
    // 2. DISTRIBUIÇÃO INTELIGENTE COM INTERVALO MÍNIMO DE 2 HORAS
    // ============================================
    // Calcular quantas refeições intermediárias precisamos
    // Total: mealsPerDay principais + 2 extras (Pré + Pós)
    // Fixas: Desjejum, Pré-Treino, Pós-Treino, Ceia = 4
    // Intermediárias necessárias: mealsPerDay - 2 (Desjejum e Ceia já contam)
    const intermediateMealsNeeded = Math.max(0, mealsPerDay - 2);
    
    // Distribuir refeições entre Desjejum e Pré-Treino
    const intermediateMealTimes: Array<{ time: number; name: string; mealTime: MealTime }> = [];
    
    if (intermediateMealsNeeded > 0) {
      const timeBetweenBreakfastAndPreWorkout = preWorkoutMinutes - breakfastMinutes;
      
      // Calcular intervalo ideal respeitando o mínimo de 2 horas
      const idealInterval = timeBetweenBreakfastAndPreWorkout / (intermediateMealsNeeded + 1);
      
      // Se o intervalo ideal for menor que o mínimo, ajustar
      if (idealInterval < MIN_INTERVAL_MINUTES) {
        // Tentar distribuir com intervalo mínimo
        const maxPossibleMeals = Math.floor(timeBetweenBreakfastAndPreWorkout / MIN_INTERVAL_MINUTES);
        
        if (maxPossibleMeals >= intermediateMealsNeeded) {
          // Distribuir com intervalo mínimo de 2 horas
          for (let i = 1; i <= intermediateMealsNeeded; i++) {
            const mealTime = breakfastMinutes + (MIN_INTERVAL_MINUTES * i);
            if (mealTime < preWorkoutMinutes - MIN_INTERVAL_MINUTES) {
              const mealInfo = getMealName(mealTime);
              intermediateMealTimes.push({
                time: mealTime,
                name: mealInfo.name,
                mealTime: mealInfo.mealTime,
              });
            }
          }
        } else {
          // Não há espaço suficiente, distribuir o máximo possível respeitando o mínimo
          for (let i = 1; i <= maxPossibleMeals; i++) {
            const mealTime = breakfastMinutes + (MIN_INTERVAL_MINUTES * i);
            if (mealTime < preWorkoutMinutes - MIN_INTERVAL_MINUTES) {
              const mealInfo = getMealName(mealTime);
              intermediateMealTimes.push({
                time: mealTime,
                name: mealInfo.name,
                mealTime: mealInfo.mealTime,
              });
            }
          }
        }
      } else {
        // Intervalo ideal é suficiente, distribuir uniformemente
        for (let i = 1; i <= intermediateMealsNeeded; i++) {
          const mealTime = breakfastMinutes + idealInterval * i;
          const mealInfo = getMealName(mealTime);
          intermediateMealTimes.push({
            time: mealTime,
            name: mealInfo.name,
            mealTime: mealInfo.mealTime,
          });
        }
      }
    }
    
    // Verificar se há espaço para refeição entre Pós-Treino e Ceia
    const timeBetweenPostWorkoutAndDinner = lastMealMinutes - postWorkoutMinutes;
    if (timeBetweenPostWorkoutAndDinner >= MIN_INTERVAL_MINUTES * 2) {
      // Há espaço para uma refeição (Janta) entre Pós-Treino e Ceia
      const dinnerTime = postWorkoutMinutes + MIN_INTERVAL_MINUTES;
      if (dinnerTime < lastMealMinutes - MIN_INTERVAL_MINUTES) {
        intermediateMealTimes.push({
          time: dinnerTime,
          name: 'Janta',
          mealTime: 'janta',
        });
      }
    }
    
    // Ordenar todos os horários intermediários
    intermediateMealTimes.sort((a, b) => a.time - b.time);

    // ============================================
    // 3. DISTRIBUIÇÃO CALÓRICA (GARANTINDO SOMA EXATA)
    // ============================================
    // Pré-Treino: 10% do total (arredondado)
    const preWorkoutCalories = Math.round(dailyCalories * 0.10);
    
    // Pós-Treino: 15% do total (arredondado)
    const postWorkoutCalories = Math.round(dailyCalories * 0.15);
    
    // Calorias restantes para as refeições principais
    const remainingCalories = dailyCalories - preWorkoutCalories - postWorkoutCalories;
    
    // Dividir igualmente entre as refeições principais (sem arredondar ainda)
    const caloriesPerMainMealFloat = remainingCalories / mealsPerDay;
    
    // Arredondar todas exceto a última para evitar diferenças
    const caloriesPerMainMeal = Math.floor(caloriesPerMainMealFloat);
    
    // Ajuste final para garantir que a soma seja EXATAMENTE dailyCalories
    const totalAllocated = (caloriesPerMainMeal * mealsPerDay) + preWorkoutCalories + postWorkoutCalories;
    const difference = dailyCalories - totalAllocated;
    
    // Ajustar a primeira refeição principal (Desjejum) com a diferença para garantir soma exata
    const adjustedBreakfastCalories = caloriesPerMainMeal + difference;

    // ============================================
    // 4. CRIAR REFEIÇÕES NA ORDEM CRONOLÓGICA CORRETA
    // ============================================
    interface MealEvent {
      time: number;
      name: string;
      type: 'main' | 'pre_workout' | 'post_workout';
      calories: number;
      mealTime: MealTime;
    }

    const mealEvents: MealEvent[] = [];

    // 1. Desjejum (Marco Inamovível) - wakeTime + 30min
    mealEvents.push({
      time: breakfastMinutes,
      name: 'Desjejum',
      type: 'main',
      calories: adjustedBreakfastCalories,
      mealTime: 'desjejum',
    });

    // 2. Refeições intermediárias (com nomes e horários já calculados)
    // Filtrar apenas as que estão entre Desjejum e Pré-Treino
    const mealsBeforePreWorkout = intermediateMealTimes.filter(m => m.time < preWorkoutMinutes);
    mealsBeforePreWorkout.forEach((meal) => {
      mealEvents.push({
        time: meal.time,
        name: meal.name,
        type: 'main',
        calories: caloriesPerMainMeal,
        mealTime: meal.mealTime,
      });
    });

    // 3. Pré-Treino (Marco Inamovível) - workoutTime - 30min
    mealEvents.push({
      time: preWorkoutMinutes,
      name: 'Pré-Treino',
      type: 'pre_workout',
      calories: preWorkoutCalories,
      mealTime: 'lanche_tarde',
    });

    // 4. Pós-Treino (Marco Inamovível) - workoutEnd + 30min
    mealEvents.push({
      time: postWorkoutMinutes,
      name: 'Pós-Treino',
      type: 'post_workout',
      calories: postWorkoutCalories,
      mealTime: 'pos_treino',
    });

    // 5. Refeições intermediárias após Pós-Treino (Janta)
    const mealsAfterPostWorkout = intermediateMealTimes.filter(m => m.time > postWorkoutMinutes);
    mealsAfterPostWorkout.forEach((meal) => {
      mealEvents.push({
        time: meal.time,
        name: meal.name,
        type: 'main',
        calories: caloriesPerMainMeal,
        mealTime: meal.mealTime,
      });
    });

    // 6. Ceia (Marco Inamovível) - sleepTime - 30min
    mealEvents.push({
      time: lastMealMinutes,
      name: 'Ceia',
      type: 'main',
      calories: caloriesPerMainMeal,
      mealTime: 'ceia',
    });

    // Ordenar eventos cronologicamente (garantir ordem correta)
    mealEvents.sort((a, b) => a.time - b.time);
    
    // Validação final: verificar se há refeições muito próximas (menos de 2 horas)
    for (let i = 0; i < mealEvents.length - 1; i++) {
      const currentTime = mealEvents[i].time;
      const nextTime = mealEvents[i + 1].time;
      const interval = nextTime - currentTime;
      
      if (interval < MIN_INTERVAL_MINUTES) {
        // Ajustar a próxima refeição para respeitar o intervalo mínimo
        mealEvents[i + 1].time = currentTime + MIN_INTERVAL_MINUTES;
        
        // Recalcular nome se necessário após ajuste
        if (mealEvents[i + 1].type === 'main') {
          const mealInfo = getMealName(mealEvents[i + 1].time);
          mealEvents[i + 1].name = mealInfo.name;
          mealEvents[i + 1].mealTime = mealInfo.mealTime;
        }
      }
    }

    // ============================================
    // 6. GERAR ALIMENTOS PARA CADA REFEIÇÃO
    // ============================================
    const seed = week * 7 + dayIndex;

    mealEvents.forEach((event, mealIndex) => {
      const caloriesForMeal = event.calories;
      
      // Distribuir macros baseado no tipo de refeição
      let targetProtein: number, targetCarbs: number, targetFat: number;
      
      if (event.type === 'pre_workout') {
        // Pré-treino: foco em carboidratos (60% carbs, 20% protein, 20% fat)
        targetCarbs = Math.round((caloriesForMeal * 0.6) / 4);
        targetProtein = Math.round((caloriesForMeal * 0.2) / 4);
        targetFat = Math.round((caloriesForMeal * 0.2) / 9);
      } else if (event.type === 'post_workout') {
        // Pós-treino: foco em proteína (40% protein, 40% carbs, 20% fat)
        targetProtein = Math.round((caloriesForMeal * 0.4) / 4);
        targetCarbs = Math.round((caloriesForMeal * 0.4) / 4);
        targetFat = Math.round((caloriesForMeal * 0.2) / 9);
      } else if (event.type === 'main' && event.mealTime === 'ceia') {
        // Ceia: mais leve, menos carboidratos
        targetProtein = Math.round((caloriesForMeal * 0.35) / 4);
        targetCarbs = Math.round((caloriesForMeal * 0.25) / 4);
        targetFat = Math.round((caloriesForMeal * 0.4) / 9);
      } else {
        // Refeições principais: balanceado (30% protein, 40% carbs, 30% fat)
        targetProtein = Math.round((caloriesForMeal * 0.3) / 4);
        targetCarbs = Math.round((caloriesForMeal * 0.4) / 4);
        targetFat = Math.round((caloriesForMeal * 0.3) / 9);
      }

      const mealFoods: Meal['foods'] = [];
      let currentCalories = 0;
      let currentProtein = 0;
      let currentCarbs = 0;
      let currentFat = 0;

      // Selecionar alimentos baseado no tipo de refeição (USANDO allowedFoods)
      let availableProteins: Food[];
      let availableCarbs: Food[];
      let availableVegetables: Food[];
      let availableFats: Food[];

      if (event.type === 'pre_workout') {
        // Pré-treino: alimentos energéticos
        availableCarbs = allowedFoods.filter(f => 
          (f.category === 'carb' || f.category === 'fruit') && 
          (isPreWorkoutFood(f) || f.allowedMeals.includes(event.mealTime))
        );
        availableProteins = allowedFoods.filter(f => 
          f.category === 'protein' && 
          f.allowedMeals.includes(event.mealTime) &&
          (f.name.includes('Ovo') || f.name.includes('Presunto'))
        );
        availableVegetables = [];
        availableFats = [];
      } else if (event.type === 'post_workout') {
        // Pós-treino: alimentos ricos em proteína
        availableProteins = allowedFoods.filter(f => 
          f.category === 'protein' && 
          (isPostWorkoutFood(f) || f.allowedMeals.includes(event.mealTime))
        );
        availableCarbs = allowedFoods.filter(f => 
          (f.category === 'carb' || f.category === 'fruit') && 
          (isPostWorkoutFood(f) || f.allowedMeals.includes(event.mealTime))
        );
        availableVegetables = allowedFoods.filter(f => 
          f.category === 'vegetable' && 
          f.allowedMeals.includes(event.mealTime)
        );
        availableFats = allowedFoods.filter(f => 
          f.category === 'fat' && 
          f.allowedMeals.includes(event.mealTime)
        );
      } else if (event.type === 'main' && event.mealTime === 'ceia') {
        // Ceia: alimentos leves
        availableProteins = allowedFoods.filter(f => 
          f.category === 'protein' && 
          (isBedtimeFood(f) || f.allowedMeals.includes(event.mealTime))
        );
        availableCarbs = allowedFoods.filter(f => 
          (f.category === 'carb' || f.category === 'fruit') && 
          (isBedtimeFood(f) || f.allowedMeals.includes(event.mealTime))
        );
        availableVegetables = [];
        availableFats = allowedFoods.filter(f => 
          f.category === 'fat' && 
          f.allowedMeals.includes(event.mealTime)
        );
      } else {
        // Refeições principais normais
        availableProteins = allowedFoods.filter(f => 
          f.category === 'protein' && 
          f.allowedMeals.includes(event.mealTime)
        );
        availableCarbs = allowedFoods.filter(f => 
          f.category === 'carb' && 
          f.allowedMeals.includes(event.mealTime)
        );
        availableVegetables = allowedFoods.filter(f => 
          f.category === 'vegetable' && 
          f.allowedMeals.includes(event.mealTime)
        );
        availableFats = allowedFoods.filter(f => 
          f.category === 'fat' && 
          f.allowedMeals.includes(event.mealTime)
        );
      }

      // ============================================
      // LÓGICA DE SUBSTITUIÇÃO POR EQUIVALÊNCIA
      // ============================================
      // Se um alimento selecionado não estiver disponível (foi bloqueado),
      // buscar substituto equivalente
      const ensureFoodAvailable = (food: Food | undefined, category: 'protein' | 'carb' | 'fat' | 'vegetable' | 'fruit' | 'dairy'): Food | null => {
        if (!food) return null;
        
        // Verificar se o alimento está na lista de permitidos
        const isAllowed = allowedFoods.some(f => f.id === food.id);
        
        if (isAllowed) {
          return food;
        }
        
        // Se não estiver permitido, buscar substituto equivalente
        return findEquivalentSubstitute(food, allowedFoods, category);
      };

      // Adicionar proteína
      if (availableProteins.length > 0 && targetProtein > 0) {
        const proteinIndex = (seed * 3 + mealIndex) % availableProteins.length;
        let protein = availableProteins[proteinIndex];
        
        // Garantir que o alimento está disponível (aplicar substituição se necessário)
        const finalProtein = ensureFoodAvailable(protein, 'protein');
        if (finalProtein) {
          protein = finalProtein;
          const qty = Math.max(1, Math.round(targetProtein / protein.protein));
          mealFoods.push({
            id: protein.id,
            name: protein.name,
            quantity: qty,
            calories: protein.calories * qty,
            protein: protein.protein * qty,
            carbs: protein.carbs * qty,
            fat: protein.fat * qty,
          });
          currentCalories += protein.calories * qty;
          currentProtein += protein.protein * qty;
          currentCarbs += protein.carbs * qty;
          currentFat += protein.fat * qty;
        }
      }

      // Adicionar carboidrato
      if (availableCarbs.length > 0 && targetCarbs > 0) {
        const carbIndex = (seed * 5 + mealIndex * 2) % availableCarbs.length;
        let carb = availableCarbs[carbIndex];
        
        // Garantir que o alimento está disponível (aplicar substituição se necessário)
        const finalCarb = ensureFoodAvailable(carb, 'carb');
        if (finalCarb) {
          carb = finalCarb;
          const qty = Math.max(1, Math.round(targetCarbs / carb.carbs));
          mealFoods.push({
            id: carb.id,
            name: carb.name,
            quantity: qty,
            calories: carb.calories * qty,
            protein: carb.protein * qty,
            carbs: carb.carbs * qty,
            fat: carb.fat * qty,
          });
          currentCalories += carb.calories * qty;
          currentProtein += carb.protein * qty;
          currentCarbs += carb.carbs * qty;
          currentFat += carb.fat * qty;
        }
      }

      // Adicionar vegetal (exceto pré-treino e ceia)
      if (availableVegetables.length > 0 && event.type !== 'pre_workout' && event.mealTime !== 'ceia') {
        const vegIndex = (seed * 7 + mealIndex * 3) % availableVegetables.length;
        let veg = availableVegetables[vegIndex];
        
        // Garantir que o alimento está disponível (aplicar substituição se necessário)
        const finalVeg = ensureFoodAvailable(veg, 'vegetable');
        if (finalVeg) {
          veg = finalVeg;
          mealFoods.push({
            id: veg.id,
            name: veg.name,
            quantity: 1,
            calories: veg.calories,
            protein: veg.protein,
            carbs: veg.carbs,
            fat: veg.fat,
          });
          currentCalories += veg.calories;
          currentProtein += veg.protein;
          currentCarbs += veg.carbs;
          currentFat += veg.fat;
        }
      }

      // Adicionar gordura se necessário
      if (availableFats.length > 0 && currentFat < targetFat * 0.8 && targetFat > 0) {
        const fatIndex = (seed * 11 + mealIndex) % availableFats.length;
        let fat = availableFats[fatIndex];
        
        // Garantir que o alimento está disponível (aplicar substituição se necessário)
        const finalFat = ensureFoodAvailable(fat, 'fat');
        if (finalFat) {
          fat = finalFat;
          mealFoods.push({
            id: fat.id,
            name: fat.name,
            quantity: 1,
            calories: fat.calories,
            protein: fat.protein,
            carbs: fat.carbs,
            fat: fat.fat,
          });
          currentCalories += fat.calories;
          currentProtein += fat.protein;
          currentCarbs += fat.carbs;
          currentFat += fat.fat;
        }
      }

      meals.push({
        id: `meal-${week}-${dayIndex}-${mealIndex}`,
        name: event.name,
        time: minutesToTime(event.time),
        foods: mealFoods,
        totalCalories: Math.round(currentCalories),
        totalProtein: Math.round(currentProtein),
        totalCarbs: Math.round(currentCarbs),
        totalFat: Math.round(currentFat),
      });
    });

    return meals;
  };

  // Gerar refeições para todos os dias da semana
  const generateWeeklyMeals = (dailyCalories: number, mealsPerDay: number, week: number, preferences: Preferences, allergies: string[] = []): DailyMeals => {
    const days: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const dailyMeals: DailyMeals = {
      monday: [],
      tuesday: [],
      wednesday: [],
      thursday: [],
      friday: [],
      saturday: [],
      sunday: [],
    };

    days.forEach((day, dayIndex) => {
      dailyMeals[day] = generateDayMeals(dailyCalories, mealsPerDay, week, dayIndex, preferences, allergies);
    });

    return dailyMeals;
  };

  // Gerar treinos inteligentes baseado em objetivo, frequência e tempo
  // AI Personal Trainer usando: Goal, Frequency, Duration, Location, Injuries
  const generateWorkouts = (data: OnboardingData, week: number): WorkoutDay[] => {
    const workouts: WorkoutDay[] = [];
    const daysPerWeek = data.preferences.workoutDaysPerWeek;
    const timePerWorkout = data.preferences.workoutDuration; // em minutos
    const location = data.preferences.location;
    const goal = data.goals.primary;
    const injuries = data.restrictions.injuries || [];

    // ============================================
    // STEP 1: MAPEAR LESÕES PARA GRUPOS MUSCULARES E ARTICULAÇÕES
    // ============================================
    // Mapear IDs do InjuryMap para MuscleGroup e JointGroup
    const mapInjuryLocationToMuscleGroup = (location: string): MuscleGroup | null => {
      // Mapear IDs de áreas musculares do InjuryMap
      const muscleIdMap: Record<string, MuscleGroup> = {
        'chest-front': 'chest',
        'back-back': 'back',
        'shoulders-front-left': 'shoulders',
        'shoulders-front-right': 'shoulders',
        'shoulders-back-left': 'shoulders',
        'shoulders-back-right': 'shoulders',
        'biceps-front-left': 'biceps',
        'biceps-front-right': 'biceps',
        'biceps-back-left': 'biceps',
        'biceps-back-right': 'biceps',
        'triceps-front-left': 'triceps',
        'triceps-front-right': 'triceps',
        'triceps-back-left': 'triceps',
        'triceps-back-right': 'triceps',
        'forearms-front-left': 'forearms',
        'forearms-front-right': 'forearms',
        'forearms-back-left': 'forearms',
        'forearms-back-right': 'forearms',
        'abs-front': 'abs',
        'lower_back-back': 'lower_back',
        'quads-front-left': 'quads',
        'quads-front-right': 'quads',
        'glutes-back-left': 'glutes',
        'glutes-back-right': 'glutes',
        'hamstrings-back-left': 'hamstrings',
        'hamstrings-back-right': 'hamstrings',
        'calves-front-left': 'calves',
        'calves-front-right': 'calves',
        'calves-back-left': 'calves',
        'calves-back-right': 'calves',
      };
      return muscleIdMap[location] || null;
    };

    const mapInjuryLocationToJointGroup = (location: string): JointGroup | null => {
      // Mapear IDs de articulações do InjuryMap
      const jointIdMap: Record<string, JointGroup> = {
        'shoulder-front-left': 'shoulder_joint',
        'shoulder-front-right': 'shoulder_joint',
        'shoulder-back-left': 'shoulder_joint',
        'shoulder-back-right': 'shoulder_joint',
        'elbow-front-left': 'elbow',
        'elbow-front-right': 'elbow',
        'elbow-back-left': 'elbow',
        'elbow-back-right': 'elbow',
        'wrist-front-left': 'wrist',
        'wrist-front-right': 'wrist',
        'wrist-back-left': 'wrist',
        'wrist-back-right': 'wrist',
        'hip-front-left': 'hip',
        'hip-front-right': 'hip',
        'hip-back-left': 'hip',
        'hip-back-right': 'hip',
        'knee-front-left': 'knee',
        'knee-front-right': 'knee',
        'knee-back-left': 'knee',
        'knee-back-right': 'knee',
        'ankle-front-left': 'ankle',
        'ankle-front-right': 'ankle',
        'ankle-back-left': 'ankle',
        'ankle-back-right': 'ankle',
        'spine-front': 'spine',
        'spine-back': 'spine',
        'scapula-back-left': 'scapula',
        'scapula-back-right': 'scapula',
      };
      return jointIdMap[location] || null;
    };

    // Converter severidade: 'mild' -> 'low', 'moderate' -> 'medium', 'severe' -> 'high'
    const severityMap: Record<'mild' | 'moderate' | 'severe', 'low' | 'medium' | 'high'> = {
      mild: 'low',
      moderate: 'medium',
      severe: 'high',
    };

    // Extrair grupos musculares e articulações lesionados por severidade
    const injuredMuscleGroups = new Set<MuscleGroup>();
    const injuredJoints = new Set<JointGroup>();
    const highSeverityMuscles = new Set<MuscleGroup>();
    const highSeverityJoints = new Set<JointGroup>();
    const mediumSeverityMuscles = new Set<MuscleGroup>();
    const mediumSeverityJoints = new Set<JointGroup>();

    injuries.forEach(injury => {
      const severity = severityMap[injury.severity] || 'low';
      const muscleGroup = mapInjuryLocationToMuscleGroup(injury.location);
      const jointGroup = mapInjuryLocationToJointGroup(injury.location);

      if (muscleGroup) {
        injuredMuscleGroups.add(muscleGroup);
        if (severity === 'high') {
          highSeverityMuscles.add(muscleGroup);
        } else if (severity === 'medium') {
          mediumSeverityMuscles.add(muscleGroup);
        }
      }

      if (jointGroup) {
        injuredJoints.add(jointGroup);
        if (severity === 'high') {
          highSeverityJoints.add(jointGroup);
        } else if (severity === 'medium') {
          mediumSeverityJoints.add(jointGroup);
        }
      }
    });

    // ============================================
    // ESTRUTURA DO TREINO (Objetivo + Dias + Duração)
    // ============================================
    const structure: WorkoutStructure = calculateWorkoutStructure(
      goal as WorkoutGoal,
      daysPerWeek,
      timePerWorkout
    );

    // ============================================
    // STEP 2: DETERMINAR O SPLIT (Frequency Logic)
    // 5 dias: A(Peito), B(Costas), C(Pernas), D(Ombros), E(Braços) – sinergia respeitada
    // ============================================
    const { split, workoutDays } = getSplitConfig(daysPerWeek);

    // ============================================
    // STEP 3: FILTRO DE SEGURANÇA (LESÕES)
    // ============================================
    // Criar pool de exercícios seguros baseado nas lesões
    const getSafeExercises = (baseExercises: Exercise[]): Exercise[] => {
      return baseExercises.filter(exercise => {
        // Severidade ALTA: Excluir TOTALMENTE exercícios que tenham o músculo lesionado como muscleGroup OU a articulação como impactedJoints
        if (highSeverityMuscles.has(exercise.muscleGroup)) {
          return false;
        }
        if (exercise.impactedJoints.some(joint => highSeverityJoints.has(joint))) {
          return false;
        }

        // Severidade MÉDIA: Excluir exercícios livres/pesados (equipment: 'gym' + type: 'strength')
        // Manter apenas máquinas ou peso do corpo
        if (mediumSeverityMuscles.has(exercise.muscleGroup) || 
            exercise.impactedJoints.some(joint => mediumSeverityJoints.has(joint))) {
          if (exercise.equipment === 'gym' && exercise.type === 'strength') {
            return false;
          }
        }

        // Severidade LEVE: Manter o exercício (já passou pelos filtros acima)
        return true;
      });
    };

    // ============================================
    // STEP 4: EXERCISE SELECTION (Location Logic)
    // ============================================
    let availableExercises: Exercise[];

    if (location === 'home') {
      availableExercises = mockExercises.filter(e => 
        e.equipment === 'home' || e.equipment === 'bodyweight'
      );
    } else if (location === 'park') {
      availableExercises = mockExercises.filter(e => 
        e.equipment === 'park' || e.equipment === 'bodyweight' || e.type === 'cardio'
      );
    } else if (location === 'gym') {
      availableExercises = [...mockExercises];
    } else {
      // Mixed: Todos os exercícios
      availableExercises = [...mockExercises];
    }

    // Aplicar filtro de segurança
    const safeExercises = getSafeExercises(availableExercises);

    // ============================================
    // STEP 5: MAPEAR SPLITS PARA GRUPOS MUSCULARES (AGONISTAS E SINERGISTAS)
    // ============================================
    // Estrutura: { agonist: [grupos principais], synergist: [grupos secundários] }
    // Volume: Agonista recebe mais exercícios (3), Sinergista recebe menos (2)
    interface MuscleGroupConfig {
      agonist: MuscleGroup[];
      synergist: MuscleGroup[];
    }

    const muscleGroupMap: Record<SplitType, MuscleGroupConfig | MuscleGroup[]> = {
      full_body: ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'abs', 'quads', 'hamstrings', 'glutes', 'calves'],
      full_body_focus_a: ['chest', 'back', 'quads', 'hamstrings'], // Foco em peito, costas e pernas
      full_body_focus_b: ['shoulders', 'biceps', 'triceps', 'glutes', 'calves'], // Foco em braços e pernas
      full_body_focus_c: ['chest', 'back', 'abs', 'quads', 'calves'], // Foco em core e pernas
      push: ['chest', 'shoulders', 'triceps'],
      pull: ['back', 'biceps'],
      legs: ['quads', 'hamstrings', 'glutes', 'calves'],
      // 4 DIAS: Agonistas e Sinergistas (Fisiologicamente correto)
      chest_triceps: {
        agonist: ['chest'], // 3 exercícios
        synergist: ['triceps'], // 2 exercícios
      },
      back_biceps: {
        agonist: ['back'], // 3 exercícios
        synergist: ['biceps'], // 2 exercícios
      },
      shoulders_traps: {
        agonist: ['shoulders'], // 3 exercícios
        synergist: ['back'], // Trapézio está no grupo 'back', 2 exercícios focados em trapézio
      },
      legs_complete: {
        agonist: ['quads'], // 3 exercícios
        synergist: [], // Hamstrings e calves são tratados separadamente no caso especial
      },
      // 3 DIAS: PPL (Push, Pull, Legs)
      push_ppl: {
        agonist: ['chest', 'shoulders'], // Peito: 2 exercícios, Ombros: 1 exercício (total 3)
        synergist: ['triceps'], // 2 exercícios
      },
      pull_ppl: {
        agonist: ['back'], // 3 exercícios
        synergist: ['biceps', 'forearms'], // 2 exercícios (1 bíceps, 1 antebraço)
      },
      legs_ppl: {
        agonist: ['quads', 'hamstrings', 'glutes', 'calves'], // Pernas completas
        synergist: [],
      },
      // Outros splits (mantidos para compatibilidade)
      upper: ['chest', 'back', 'shoulders', 'biceps', 'triceps'],
      lower: ['quads', 'hamstrings', 'glutes', 'calves', 'abs'],
      // 5 DIAS: A(Peito), B(Costas), C(Pernas), D(Ombros), E(Braços) – sem sinergista no mesmo dia
      chest: ['chest'],
      back: ['back'],
      shoulders_abs: ['shoulders', 'abs'],
      arms: ['biceps', 'triceps'],
    };

    // ============================================
    // STEP 6 & 7: VOLUME E TEMPO (regra 10 min/exercício)
    // structure.maxExercises = limite rígido; nunca exceder.
    // structure.cardioMinutes = 10 para Perda de Peso, 0 caso contrário.
    // ============================================
    const maxExercises = structure.maxExercises;
    const cardioTime = structure.cardioMinutes;

    // ============================================
    // STEP 8: FUNÇÃO PARA SELECIONAR EXERCÍCIOS (COM AGONISTAS E SINERGISTAS)
    // ============================================
    // Rastrear grupos musculares treinados por dia para evitar treinar em dias consecutivos
    const trainedMuscleGroupsByDay: MuscleGroup[][] = [];

    const selectExercisesForMuscleGroup = (
      muscleGroup: MuscleGroup,
      count: number,
      dayIndex: number,
      usedExerciseIds: Set<string>,
      prioritizeCompound: boolean = false
    ): Exercise[] => {
      // Filtrar exercícios que correspondem ao grupo muscular
      let candidates = safeExercises.filter(e => {
        const matchesMuscle = e.muscleGroup === muscleGroup || 
                              (e.secondaryMuscles && e.secondaryMuscles.includes(muscleGroup));
        return matchesMuscle && e.type !== 'cardio' && !usedExerciseIds.has(e.id);
      });

      // Priorizar movimentos compostos se solicitado
      if (prioritizeCompound) {
        candidates.sort((a, b) => (b.isCompound ? 1 : 0) - (a.isCompound ? 1 : 0));
      }

      // Para Hypertrophy/Strength, priorizar movimentos compostos de força
      if (goal === 'hypertrophy' || goal === 'strength') {
        candidates = candidates.filter(e => 
          e.type === 'strength' && 
          (e.goalTags.includes('hypertrophy') || e.goalTags.includes('strength'))
        );
        // Ordenar: compostos primeiro
        candidates.sort((a, b) => (b.isCompound ? 1 : 0) - (a.isCompound ? 1 : 0));
      }

      // Remover duplicatas
      const unique = Array.from(new Map(candidates.map(e => [e.id, e])).values());
      
      // Variar exercícios entre dias usando seed baseado em week e dayIndex
      const seed = (week - 1) * 7 + dayIndex;
      const shuffled = [...unique].sort((a, b) => {
        const hashA = (a.id.charCodeAt(0) + seed) % unique.length;
        const hashB = (b.id.charCodeAt(0) + seed) % unique.length;
        return hashA - hashB;
      });

      return shuffled.slice(0, count);
    };

    const selectExercises = (
      config: MuscleGroupConfig | MuscleGroup[], 
      dayIndex: number,
      usedExerciseIds: Set<string>
    ): Exercise[] => {
      const selectedExercises: Exercise[] = [];
      const currentDayMuscles: MuscleGroup[] = [];

      // Se for configuração de Agonista/Sinergista
      if (Array.isArray(config)) {
        // Split tradicional: distribuir maxExercises entre grupos (regra 10 min/exercício)
        const targetMuscles = config;
        const perGroup = Math.max(1, Math.floor(maxExercises / targetMuscles.length));
        targetMuscles.forEach(muscle => {
          currentDayMuscles.push(muscle);
          const exercises = selectExercisesForMuscleGroup(
            muscle,
            perGroup,
            dayIndex,
            usedExerciseIds,
            split[dayIndex] === 'full_body' || split[dayIndex].startsWith('full_body_focus')
          );
          exercises.forEach(ex => {
            selectedExercises.push(ex);
            usedExerciseIds.add(ex.id);
          });
        });
      } else {
        // Configuração Agonista/Sinergista
        const { agonist, synergist } = config;

        // Selecionar exercícios para AGONISTAS (volume maior: 3 exercícios por grupo)
        // Caso especial para push_ppl: peito recebe 2, ombros recebe 1
        if (split[dayIndex] === 'push_ppl') {
          // Peito: 2 exercícios
          const chestExercises = selectExercisesForMuscleGroup(
            'chest',
            2,
            dayIndex,
            usedExerciseIds,
            true
          );
          chestExercises.forEach(ex => {
            selectedExercises.push(ex);
            usedExerciseIds.add(ex.id);
          });
          currentDayMuscles.push('chest');
          
          // Ombros: 1 exercício
          const shoulderExercises = selectExercisesForMuscleGroup(
            'shoulders',
            1,
            dayIndex,
            usedExerciseIds,
            true
          );
          shoulderExercises.forEach(ex => {
            selectedExercises.push(ex);
            usedExerciseIds.add(ex.id);
          });
          currentDayMuscles.push('shoulders');
        } else {
          // Outros splits: 3 exercícios por grupo agonista
          agonist.forEach(muscle => {
            currentDayMuscles.push(muscle);
            const exercises = selectExercisesForMuscleGroup(
              muscle,
              3, // Volume maior para agonista
              dayIndex,
              usedExerciseIds,
              true // Priorizar compostos para agonistas
            );
            exercises.forEach(ex => {
              selectedExercises.push(ex);
              usedExerciseIds.add(ex.id);
            });
          });
        }

        // Selecionar exercícios para SINERGISTAS (volume menor: 2 exercícios por grupo)
        // Caso especial para pull_ppl: bíceps recebe 1, antebraço recebe 1
        if (split[dayIndex] === 'pull_ppl') {
          // Bíceps: 1 exercício
          const bicepsExercises = selectExercisesForMuscleGroup(
            'biceps',
            1,
            dayIndex,
            usedExerciseIds,
            false
          );
          bicepsExercises.forEach(ex => {
            selectedExercises.push(ex);
            usedExerciseIds.add(ex.id);
          });
          currentDayMuscles.push('biceps');
          
          // Antebraço: 1 exercício (se disponível)
          const forearmExercises = selectExercisesForMuscleGroup(
            'forearms',
            1,
            dayIndex,
            usedExerciseIds,
            false
          );
          forearmExercises.forEach(ex => {
            selectedExercises.push(ex);
            usedExerciseIds.add(ex.id);
          });
          if (forearmExercises.length > 0) {
            currentDayMuscles.push('forearms');
          }
        } else {
          // Outros splits: 2 exercícios por grupo sinergista
          synergist.forEach(muscle => {
            // Pular hamstrings e calves em legs_complete (tratados separadamente)
            if (split[dayIndex] === 'legs_complete' && (muscle === 'hamstrings' || muscle === 'calves')) {
              return;
            }
            currentDayMuscles.push(muscle);
            const exercises = selectExercisesForMuscleGroup(
              muscle,
              2, // Volume menor para sinergista
              dayIndex,
              usedExerciseIds,
              false
            );
            exercises.forEach(ex => {
              selectedExercises.push(ex);
              usedExerciseIds.add(ex.id);
            });
          });
        }

        // Caso especial: legs_complete - ajustar volumes
        // Quadríceps já está em agonist (3 exercícios)
        // Hamstrings: 2 exercícios (sinergista)
        // Panturrilhas: 1 exercício (sinergista)
        if (split[dayIndex] === 'legs_complete') {
          currentDayMuscles.push('hamstrings');
          const hamstringsExercises = selectExercisesForMuscleGroup(
            'hamstrings',
            2,
            dayIndex,
            usedExerciseIds,
            false
          );
          hamstringsExercises.forEach(ex => {
            selectedExercises.push(ex);
            usedExerciseIds.add(ex.id);
          });
          
          currentDayMuscles.push('calves');
          const calvesExercises = selectExercisesForMuscleGroup(
            'calves',
            1,
            dayIndex,
            usedExerciseIds,
            false
          );
          calvesExercises.forEach(ex => {
            selectedExercises.push(ex);
            usedExerciseIds.add(ex.id);
          });
        }

        // Caso especial: shoulders_traps - incluir exercícios de costas focados em trapézio
        if (split[dayIndex] === 'shoulders_traps') {
          // Buscar exercícios de costas que também trabalham trapézio
          const trapExercises = safeExercises.filter(e => 
            e.muscleGroup === 'back' && 
            !usedExerciseIds.has(e.id) &&
            e.type !== 'cardio' &&
            (e.name.toLowerCase().includes('trap') || 
             e.name.toLowerCase().includes('encolhimento') ||
             e.secondaryMuscles?.includes('shoulders'))
          );
          if (trapExercises.length > 0) {
            const seed = (week - 1) * 7 + dayIndex;
            const selected = trapExercises[seed % trapExercises.length];
            selectedExercises.push(selected);
            usedExerciseIds.add(selected.id);
            currentDayMuscles.push('back');
          }
        }
      }

      return selectedExercises;
    };

    // ============================================
    // STEP 9: GERAR TREINOS (GARANTINDO PREENCHIMENTO E RECUPERAÇÃO)
    // ============================================
    // Garantir que EXATAMENTE daysPerWeek treinos sejam criados
    for (let i = 0; i < split.length; i++) {
      const dayOfWeek = workoutDays[i];
      const dayNumber = (week - 1) * 7 + dayOfWeek;
      const currentSplit = split[i];
      const muscleConfig = muscleGroupMap[currentSplit];

      // Verificar se grupos musculares foram treinados no dia anterior (evitar treinar em dias consecutivos)
      const previousDayMuscles = i > 0 ? trainedMuscleGroupsByDay[i - 1] : [];
      
      // Conjunto para evitar repetições no mesmo dia
      const usedExerciseIds = new Set<string>();

      // Selecionar exercícios baseado na configuração (Agonista/Sinergista ou tradicional)
      let selectedExercises = selectExercises(muscleConfig, i, usedExerciseIds);

      // Verificar e remover conflitos: treino no dia anterior + SINERGIA (anti-bug)
      // Nunca Bíceps no dia seguinte a Costas, nem Tríceps no dia seguinte a Peito.
      if (previousDayMuscles.length > 0 && !['push', 'pull', 'legs'].includes(currentSplit)) {
        selectedExercises = selectedExercises.filter(ex => {
          const muscleTrainedYesterday = previousDayMuscles.includes(ex.muscleGroup);
          if (muscleTrainedYesterday) return false;
          // Regra de sinergia: excluir Bíceps se Costas ontem, Tríceps se Peito ontem
          if (violatesSynergy(ex.muscleGroup, previousDayMuscles)) return false;
          return true;
        });
      }

      // Limite rígido: NUNCA exceder maxExercises (regra 10 min/exercício)
      if (selectedExercises.length > maxExercises) {
        selectedExercises = selectedExercises.slice(0, maxExercises);
      }

      // Atualizar grupos treinados com base nos exercícios finais (após filtro/slice)
      trainedMuscleGroupsByDay[i] = [...new Set(selectedExercises.map(e => e.muscleGroup))];

      const isAgonistSynergistSplit = !Array.isArray(muscleConfig);
      const minExercises = Math.min(isAgonistSynergistSplit ? 5 : 6, maxExercises);

      while (selectedExercises.length < minExercises && selectedExercises.length < maxExercises) {
        let foundNew = false;

        // Para pernas completas, garantir que temos todos os grupos
        if (currentSplit === 'legs' || currentSplit === 'lower' || currentSplit === 'legs_complete' || currentSplit === 'legs_ppl') {
          const legGroups: MuscleGroup[] = ['quads', 'hamstrings', 'glutes', 'calves'];
          for (const legGroup of legGroups) {
            if (selectedExercises.some(e => e.muscleGroup === legGroup)) continue;
            
            // Verificar se foi treinado no dia anterior
            if (previousDayMuscles.includes(legGroup)) continue;
            
            const legExercises = safeExercises.filter(e => 
              e.muscleGroup === legGroup && 
              !usedExerciseIds.has(e.id) &&
              e.type !== 'cardio'
            );
            if (legExercises.length > 0 && selectedExercises.length < maxExercises) {
              const seed = (week - 1) * 7 + i;
              const exercise = legExercises[seed % legExercises.length];
              selectedExercises.push(exercise);
              usedExerciseIds.add(exercise.id);
              foundNew = true;
              if (selectedExercises.length >= minExercises) break;
            }
          }
        }

        if (!foundNew && selectedExercises.length < minExercises && selectedExercises.length < maxExercises) {
          // Determinar grupos musculares alvo baseado no split
          let targetMuscles: MuscleGroup[] = [];
          if (Array.isArray(muscleConfig)) {
            targetMuscles = muscleConfig;
          } else {
            targetMuscles = [...muscleConfig.agonist, ...muscleConfig.synergist];
          }

          // Buscar exercícios de grupos musculares relacionados ou secundários
          const relatedExercises = safeExercises.filter(e => {
            const isRelated = targetMuscles.some(m => 
              e.muscleGroup === m || 
              (e.secondaryMuscles && e.secondaryMuscles.includes(m))
            );
            const wasTrainedYesterday = previousDayMuscles.includes(e.muscleGroup);
            return isRelated && 
                   !usedExerciseIds.has(e.id) && 
                   e.type !== 'cardio' &&
                   !selectedExercises.some(se => se.id === e.id) &&
                   !wasTrainedYesterday &&
                   !violatesSynergy(e.muscleGroup, previousDayMuscles);
          });

          if (relatedExercises.length > 0 && selectedExercises.length < maxExercises) {
            const seed = (week - 1) * 7 + i;
            const exercise = relatedExercises[seed % relatedExercises.length];
            selectedExercises.push(exercise);
            usedExerciseIds.add(exercise.id);
            foundNew = true;
          }
        }

        if (!foundNew && selectedExercises.length < minExercises && selectedExercises.length < maxExercises) {
          const availableExercises = safeExercises.filter(e => 
            !usedExerciseIds.has(e.id) && 
            e.type !== 'cardio' &&
            !selectedExercises.some(se => se.id === e.id) &&
            !previousDayMuscles.includes(e.muscleGroup) &&
            !violatesSynergy(e.muscleGroup, previousDayMuscles)
          );

          if (availableExercises.length > 0) {
            const seed = (week - 1) * 7 + i;
            const exercise = availableExercises[seed % availableExercises.length];
            selectedExercises.push(exercise);
            usedExerciseIds.add(exercise.id);
          } else {
            // Se não há mais exercícios disponíveis, parar o loop
            break;
          }
        }

        // Se não encontrou nada novo, parar para evitar loop infinito
        if (!foundNew) break;
      }

      // Criar exercícios com sets e reps da estrutura (Objetivo + Duração)
      type WorkoutExercise = WorkoutDay['exercises'][number];
      const exercises: WorkoutExercise[] = selectedExercises.map((ex) => {
        const sets = structure.sets;
        const reps = getRepsForExercise(structure, ex.isCompound ?? false);
        return {
          id: ex.id,
          name: ex.name,
          sets,
          reps,
          weight: undefined,
          muscleGroup: ex.muscleGroup,
          equipment: ex.equipment,
          videoUrl: ex.videoUrl,
        };
      });

      // Se o plano requer Cardio (ex.: Perda de Peso +10 min ao final), adicionar sessão genérica
      if (cardioTime > 0) {
        exercises.push({
          id: `cardio-session-${week}-${dayOfWeek}`,
          name: location === 'park' ? 'Corrida/Caminhada' : location === 'home' ? 'Corda/Polichinelo' : 'Esteira/Corrida',
          sets: 1,
          reps: cardioTime,
          weight: undefined,
          muscleGroup: 'cardio',
          equipment: location === 'park' ? 'park' : location === 'home' ? 'home' : 'gym',
          videoUrl: undefined,
        });
      }

      workouts.push({
        id: `workout-${week}-${dayOfWeek}`,
        day: dayNumber,
        week,
        exercises,
        duration: structure.durationMinutes,
        completed: false,
      });
    }

    return workouts;
  };

  /** Gera plano do zero. Ao mudar Objetivo/Dias/Duração, o treino é sempre RECALCULADO (reset completo). */
  const generatePlan = (data: OnboardingData): FourWeekPlan => {
    const tdee = calculateTDEE(data);
    const startDate = new Date().toISOString();
    const weeks: WeeklyPlan[] = [];

    for (let week = 1; week <= 4; week++) {
      const dailyMeals = generateWeeklyMeals(tdee, data.preferences.mealsPerDay, week, data.preferences, data.restrictions.allergies || []);
      const workouts = generateWorkouts(data, week);

      // Calculate totals from Monday's meals (all days have same structure)
      const mondayMeals = dailyMeals.monday;
      const totalCalories = mondayMeals.reduce((sum, m) => sum + m.totalCalories, 0);
      const totalProtein = mondayMeals.reduce((sum, m) => sum + m.totalProtein, 0);
      const totalCarbs = mondayMeals.reduce((sum, m) => sum + m.totalCarbs, 0);
      const totalFat = mondayMeals.reduce((sum, m) => sum + m.totalFat, 0);

      // Flatten all meals for backward compatibility
      const allMeals: Meal[] = [
        ...dailyMeals.monday,
        ...dailyMeals.tuesday,
        ...dailyMeals.wednesday,
        ...dailyMeals.thursday,
        ...dailyMeals.friday,
        ...dailyMeals.saturday,
        ...dailyMeals.sunday,
      ];

      weeks.push({
        week,
        meals: allMeals, // Keep for backward compatibility
        dailyMeals, // New structure
        workouts,
        totalCalories: Math.round(totalCalories), // Daily average
        totalProtein: Math.round(totalProtein),
        totalCarbs: Math.round(totalCarbs),
        totalFat: Math.round(totalFat),
      });
    }

    return {
      weeks,
      startDate,
    };
  };

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
    
    // Encontrar alimento original no mockDatabase
    const originalFood = mockFoods.find(f => f.id === currentFoodId);
    
    if (!originalFood) {
      return plan; // Retorna plano original se não encontrar no database
    }

    // Mapear nome da refeição para MealTime
    const getMealTime = (mealName: string): MealTime => {
      if (mealName === 'Desjejum') return 'desjejum';
      if (mealName === 'Café da Manhã') return 'cafe';
      if (mealName === 'Almoço') return 'almoco';
      if (mealName === 'Lanche da Tarde') return 'lanche_tarde';
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

    // Calcular nova quantidade mantendo proporção similar
    const oldQuantity = currentFood.quantity || 1;
    const newQuantity = oldQuantity; // Manter mesma quantidade

    // Atualizar alimento
    newFoods[foodIndex] = {
      id: similarFood.id,
      name: similarFood.name,
      quantity: newQuantity,
      calories: similarFood.calories * newQuantity,
      protein: similarFood.protein * newQuantity,
      carbs: similarFood.carbs * newQuantity,
      fat: similarFood.fat * newQuantity,
    };

    // Recalcular totais da refeição
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

    // Atualizar meals array para backward compatibility
    const newMeals: Meal[] = [
      ...newDailyMeals.monday,
      ...newDailyMeals.tuesday,
      ...newDailyMeals.wednesday,
      ...newDailyMeals.thursday,
      ...newDailyMeals.friday,
      ...newDailyMeals.saturday,
      ...newDailyMeals.sunday,
    ];

    // Recalcular totais da semana (usando segunda-feira como referência)
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

    // 6. SUBSTITUIÇÃO CIRÚRGICA: Usar splice para garantir que o tamanho do array NÃO mude
    const newExercises = [...workout.exercises];
    newExercises[exerciseIndex] = {
      ...currentExercise, // Manter sets, reps, weight do exercício atual
      id: replacement.id,
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

  // Gerar apenas o plano de dieta (refeições)
  const generateDietPlan = (profile: OnboardingData): { dailyMeals: DailyMeals[]; totals: { calories: number; protein: number; carbs: number; fat: number } } => {
    const tdee = calculateTDEE(profile);
    const dailyMeals: DailyMeals[] = [];

    for (let week = 1; week <= 4; week++) {
      const weeklyMeals = generateWeeklyMeals(tdee, profile.preferences.mealsPerDay, week, profile.preferences, profile.restrictions.allergies || []);
      dailyMeals.push(weeklyMeals);
    }

    // Calcular totais usando segunda-feira da primeira semana como referência
    const mondayMeals = dailyMeals[0].monday;
    const totals = {
      calories: Math.round(mondayMeals.reduce((sum, m) => sum + m.totalCalories, 0)),
      protein: Math.round(mondayMeals.reduce((sum, m) => sum + m.totalProtein, 0)),
      carbs: Math.round(mondayMeals.reduce((sum, m) => sum + m.totalCarbs, 0)),
      fat: Math.round(mondayMeals.reduce((sum, m) => sum + m.totalFat, 0)),
    };

    return { dailyMeals, totals };
  };

  // Gerar apenas o plano de treino
  const generateWorkoutPlan = (profile: OnboardingData): WorkoutDay[] => {
    const workouts: WorkoutDay[] = [];

    for (let week = 1; week <= 4; week++) {
      const weeklyWorkouts = generateWorkouts(profile, week);
      workouts.push(...weeklyWorkouts);
    }

    return workouts;
  };

  /** Regenera dieta e treino do zero (Reset Deep Copy). Usar ao mudar Objetivo no perfil. */
  const regenerateAllPlans = (profile: OnboardingData): FourWeekPlan => {
    const dietPlan = generateDietPlan(profile);
    const workoutPlan = generateWorkoutPlan(profile);
    const startDate = new Date().toISOString();
    const weeks: WeeklyPlan[] = [];

    for (let week = 1; week <= 4; week++) {
      const dailyMeals = dietPlan.dailyMeals[week - 1];
      const weekWorkouts = workoutPlan.filter(w => w.week === week);

      // Flatten all meals for backward compatibility
      const allMeals: Meal[] = [
        ...dailyMeals.monday,
        ...dailyMeals.tuesday,
        ...dailyMeals.wednesday,
        ...dailyMeals.thursday,
        ...dailyMeals.friday,
        ...dailyMeals.saturday,
        ...dailyMeals.sunday,
      ];

      weeks.push({
        week,
        meals: allMeals,
        dailyMeals,
        workouts: weekWorkouts,
        totalCalories: dietPlan.totals.calories,
        totalProtein: dietPlan.totals.protein,
        totalCarbs: dietPlan.totals.carbs,
        totalFat: dietPlan.totals.fat,
      });
    }

    return {
      weeks,
      startDate,
    };
  };

  // Atribuir às referências exportadas
  exportedGenerateDietPlan = generateDietPlan;
  exportedGenerateWorkoutPlan = generateWorkoutPlan;
  exportedRegenerateAllPlans = regenerateAllPlans;

  return (
    <PlanContext.Provider value={{ generatePlan, swapFoodItem, swapExercise }}>
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

// Funções exportadas para regenerar planos
// Estas funções podem ser usadas de fora do contexto
// Elas usam a mesma lógica das funções internas do PlanProvider

// Gerar apenas o plano de dieta (refeições)
// Usa dinamicamente profile.mealsPerDay e profile.goal (via TDEE)
export const generateDietPlan = (profile: OnboardingData): { dailyMeals: DailyMeals[]; totals: { calories: number; protein: number; carbs: number; fat: number } } => {
  if (!exportedGenerateDietPlan) {
    throw new Error('PlanProvider não foi inicializado. Certifique-se de que o PlanProvider está montado antes de usar generateDietPlan.');
  }
  return exportedGenerateDietPlan(profile);
};

// Gerar apenas o plano de treino
// Usa dinamicamente profile.daysPerWeek (via profile.preferences.workoutDaysPerWeek)
export const generateWorkoutPlan = (profile: OnboardingData): WorkoutDay[] => {
  if (!exportedGenerateWorkoutPlan) {
    throw new Error('PlanProvider não foi inicializado. Certifique-se de que o PlanProvider está montado antes de usar generateWorkoutPlan.');
  }
  return exportedGenerateWorkoutPlan(profile);
};

// Regenerar todos os planos (dieta + treino)
export const regenerateAllPlans = (profile: OnboardingData): FourWeekPlan => {
  if (!exportedRegenerateAllPlans) {
    throw new Error('PlanProvider não foi inicializado. Certifique-se de que o PlanProvider está montado antes de usar regenerateAllPlans.');
  }
  return exportedRegenerateAllPlans(profile);
};
