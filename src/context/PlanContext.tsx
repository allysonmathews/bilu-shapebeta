import React, { createContext, useContext, ReactNode } from 'react';
import { OnboardingData, FourWeekPlan, WeeklyPlan, Meal, WorkoutDay, DailyMeals, DayOfWeek } from '../types';
import { mockFoods, mockExercises, Exercise, findSimilarFood, MealTime, MuscleGroup, JointGroup } from '../data/mockDatabase';
import {
  calculateWorkoutStructure,
  getSplitConfig,
  violatesSynergy,
  getRepsForExercise,
  type SplitType,
  type WorkoutStructure,
  type Goal as WorkoutGoal,
} from '../logic/workoutGenerator';
import { fetchDietFromApi, type DietProfilePayload } from '../lib/dietApi';

interface PlanContextType {
  /** Gera plano completo (dieta via IA Groq + treino local). Assíncrono. */
  generatePlanAsync: (data: OnboardingData, accessToken?: string | null) => Promise<FourWeekPlan>;
  swapFoodItem: (plan: FourWeekPlan, weekIndex: number, dayOfWeek: DayOfWeek, mealIndex: number, currentFoodId: string) => FourWeekPlan;
  swapExercise: (plan: FourWeekPlan, weekIndex: number, dayIndex: number, exerciseIndex: number, currentExerciseId: string) => FourWeekPlan;
}

const PlanContext = createContext<PlanContextType | undefined>(undefined);

let exportedRegenerateAllPlansAsync: ((profile: OnboardingData, accessToken?: string | null) => Promise<FourWeekPlan>) | null = null;

/** Converte OnboardingData em DietProfilePayload para a API de dieta. */
function onboardingToDietProfile(data: OnboardingData): DietProfilePayload {
  const objMap: Record<string, string> = {
    weight_loss: 'emagrecimento',
    hypertrophy: 'hipertrofia',
    maintenance: 'manutenção',
    strength: 'força',
    endurance: 'resistência',
    muscle_definition: 'definição muscular',
  };
  const bioMap: Record<string, string> = {
    ectomorph: 'ectomorfo',
    mesomorph: 'mesomorfo',
    endomorph: 'endomorfo',
  };
  return {
    weight: data.biometrics.weight,
    height: data.biometrics.height,
    age: data.biometrics.age,
    gender: data.biometrics.gender === 'female' ? 'feminino' : 'masculino',
    biotype: bioMap[data.biometrics.biotype ?? 'mesomorph'] ?? 'mesomorfo',
    objective: objMap[data.goals.primary] ?? 'hipertrofia',
    workout_time: data.preferences.workoutTime,
    workout_duration: data.preferences.workoutDuration,
    wake_up_time: data.preferences.wakeTime,
    sleep_time: data.preferences.sleepTime,
    meals_per_day: data.preferences.mealsPerDay,
    allergies: data.restrictions?.allergies ?? [],
  };
}

export const PlanProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Gerar treinos inteligentes baseado em objetivo, frequência e tempo
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

  /** Gera plano completo (dieta via IA Groq + treino local). Assíncrono. */
  const generatePlanAsync = async (data: OnboardingData, accessToken?: string | null): Promise<FourWeekPlan> => {
    const profile = onboardingToDietProfile(data);
    const result = await fetchDietFromApi(profile, accessToken);

    if (!result.ok) {
      throw new Error(result.error);
    }

    const plan = result.plan;
    const workoutPlan: WorkoutDay[] = [];

    for (let week = 1; week <= 4; week++) {
      workoutPlan.push(...generateWorkouts(data, week));
    }

    const weeks: WeeklyPlan[] = plan.weeks.map((w, i) => ({
      ...w,
      workouts: workoutPlan.filter(wk => wk.week === i + 1),
    }));

    return {
      weeks,
      startDate: plan.startDate,
      dietaApi: plan.dietaApi,
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
