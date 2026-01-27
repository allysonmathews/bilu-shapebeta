import React, { useState, useMemo } from 'react';
import { useUser } from '../context/UserContext';
import { Card } from '../components/ui/Card';
import { Check, Droplet, Utensils, Dumbbell } from 'lucide-react';
import { DayOfWeek, Meal, WorkoutDay } from '../types';
import { translateMuscleGroup } from '../utils/muscleGroupTranslations';

// Helper para mapear getDay() para DayOfWeek
// getDay() retorna: 0 = Domingo, 1 = Segunda, 2 = Terça, ..., 6 = Sábado
const getCurrentDayOfWeek = (): DayOfWeek => {
  const dayIndex = new Date().getDay();
  const dayMap: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return dayMap[dayIndex];
};

// Helper para obter o nome do dia em português
const getDayName = (dayOfWeek: DayOfWeek): string => {
  const dayNames: Record<DayOfWeek, string> = {
    monday: 'Segunda-feira',
    tuesday: 'Terça-feira',
    wednesday: 'Quarta-feira',
    thursday: 'Quinta-feira',
    friday: 'Sexta-feira',
    saturday: 'Sábado',
    sunday: 'Domingo',
  };
  return dayNames[dayOfWeek];
};

// Helper para calcular qual semana estamos (baseado na startDate)
const getCurrentWeekIndex = (planStartDate: string): number => {
  const start = new Date(planStartDate);
  const today = new Date();
  
  // Resetar horas para comparar apenas datas
  start.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  
  const diffTime = today.getTime() - start.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const weekIndex = Math.floor(diffDays / 7);
  
  // Garantir que está entre 0 e 3 (4 semanas)
  return Math.max(0, Math.min(3, weekIndex));
};

// Helper para obter a data atual no formato YYYY-MM-DD
const getTodayDateString = (): string => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

export const DailyJournal: React.FC = () => {
  const { plan, onboardingData, completedMeals, toggleMealCompletion } = useUser();
  const [waterGlasses, setWaterGlasses] = useState(0);
  const [completedWorkout, setCompletedWorkout] = useState(false);

  // Calcular dados do dia atual
  const todayData = useMemo(() => {
    if (!plan) return null;

    const currentDayOfWeek = getCurrentDayOfWeek();
    const currentWeekIndex = getCurrentWeekIndex(plan.startDate);
    const currentWeek = plan.weeks[currentWeekIndex];
    
    if (!currentWeek || !currentWeek.dailyMeals) {
      return null;
    }

    const todayMeals = currentWeek.dailyMeals[currentDayOfWeek] || [];
    
    // Encontrar treino do dia atual (se houver)
    // Calcular qual dia absoluto estamos (desde o início do plano)
    const startDate = new Date(plan.startDate);
    const today = new Date();
    startDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - startDate.getTime();
    const currentDay = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 porque day começa em 1
    
    // Procurar treino que corresponde ao dia atual em todas as semanas
    let todayWorkout: WorkoutDay | undefined;
    for (const week of plan.weeks) {
      const workout = week.workouts.find(w => w.day === currentDay);
      if (workout) {
        todayWorkout = workout;
        break;
      }
    }

    return {
      dayOfWeek: currentDayOfWeek,
      dayName: getDayName(currentDayOfWeek),
      meals: todayMeals,
      workout: todayWorkout,
      weekIndex: currentWeekIndex,
      totalCalories: currentWeek.totalCalories,
    };
  }, [plan]);

  if (!plan || !onboardingData || !todayData) {
    return (
      <div className="p-4 text-center text-gray-400">
        <p>Carregando seu plano...</p>
      </div>
    );
  }

  const { dayOfWeek, dayName, meals: todayMeals, workout: todayWorkout, totalCalories: targetCalories } = todayData;
  const todayDateString = getTodayDateString();
  const todayCompletedMeals = completedMeals[todayDateString] || new Set<string>();

  const toggleMeal = (mealId: string) => {
    toggleMealCompletion(todayDateString, mealId);
  };

  const toggleWorkout = () => {
    setCompletedWorkout(prev => !prev);
  };

  const addWater = () => {
    setWaterGlasses(prev => prev + 1);
  };

  const removeWater = () => {
    setWaterGlasses(prev => Math.max(0, prev - 1));
  };

  // Calcular calorias consumidas apenas das refeições completadas do dia atual
  const totalCalories = todayMeals.reduce((sum, meal) => {
    if (todayCompletedMeals.has(meal.id)) {
      return sum + meal.totalCalories;
    }
    return sum;
  }, 0);

  return (
    <div className="p-4 pb-24 space-y-4">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-alien-green mb-2">Seu Diário</h1>
        <p className="text-gray-400">{dayName}</p>
      </div>

      {/* Calorie Progress */}
      <Card>
        <div className="flex justify-between items-center mb-2">
          <span className="text-gray-400">Calorias</span>
          <span className="text-alien-green font-bold">{totalCalories} / {targetCalories} kcal</span>
        </div>
        <div className="w-full bg-card-bg h-3 rounded-full overflow-hidden">
          <div
            className="h-full bg-alien-green transition-all duration-300"
            style={{ width: `${Math.min(100, (totalCalories / targetCalories) * 100)}%` }}
          />
        </div>
      </Card>

      {/* Water Tracker */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Droplet className="text-blue-400" size={24} />
            <span className="text-white font-medium">Água</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={removeWater}
              className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-white"
            >
              −
            </button>
            <span className="text-alien-green font-bold text-xl w-12 text-center">{waterGlasses}</span>
            <button
              onClick={addWater}
              className="w-8 h-8 rounded-full bg-blue-500 hover:bg-blue-600 flex items-center justify-center text-white"
            >
              +
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">Copos de 250ml</p>
      </Card>

      {/* Meals Timeline */}
      <div>
        <h2 className="text-xl font-bold text-alien-green mb-3 flex items-center gap-2">
          <Utensils size={20} />
          Refeições
        </h2>
        <div className="space-y-3">
          {todayMeals.length > 0 ? (
            todayMeals.map((meal) => {
              const isCompleted = todayCompletedMeals.has(meal.id);
              return (
                <Card
                  key={meal.id}
                  onClick={() => toggleMeal(meal.id)}
                  className={`cursor-pointer transition-all ${isCompleted ? 'border-alien-green opacity-75' : 'hover:border-gray-600'}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-bilu-purple font-bold">{meal.time}</span>
                        <span className="text-white font-medium">{meal.name}</span>
                      </div>
                      <div className="text-sm text-gray-400 space-y-1">
                        <p>{meal.foods.map(f => f.name).join(', ')}</p>
                        <p className="text-alien-green">
                          {meal.totalCalories} kcal • P: {meal.totalProtein}g • C: {meal.totalCarbs}g • F: {meal.totalFat}g
                        </p>
                      </div>
                    </div>
                    <div className={`ml-4 w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                      isCompleted
                        ? 'bg-alien-green border-alien-green'
                        : 'border-gray-600 hover:border-alien-green'
                    }`}>
                      {isCompleted && <Check size={16} className="text-deep-bg" />}
                    </div>
                  </div>
                </Card>
              );
            })
          ) : (
            <Card>
              <p className="text-gray-400 text-center py-4">Nenhuma refeição planejada para hoje</p>
            </Card>
          )}
        </div>
      </div>

      {/* Workout */}
      {todayWorkout && (
        <div>
          <h2 className="text-xl font-bold text-alien-green mb-3 flex items-center gap-2">
            <Dumbbell size={20} />
            Treino
          </h2>
          <Card onClick={toggleWorkout} className={completedWorkout ? 'border-alien-green opacity-75' : ''}>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-white font-medium">Treino de Hoje</span>
                </div>
                <div className="text-sm text-gray-400">
                  <p>{todayWorkout.exercises.length} exercícios • {todayWorkout.duration} min</p>
                  <p className="text-bilu-purple mt-1">
                    {todayWorkout.exercises.map(e => e.muscleGroup).filter((v, i, a) => a.indexOf(v) === i).map(translateMuscleGroup).join(', ')}
                  </p>
                </div>
              </div>
              <div className={`ml-4 w-6 h-6 rounded border-2 flex items-center justify-center ${
                completedWorkout
                  ? 'bg-alien-green border-alien-green'
                  : 'border-gray-600'
              }`}>
                {completedWorkout && <Check size={16} className="text-deep-bg" />}
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
