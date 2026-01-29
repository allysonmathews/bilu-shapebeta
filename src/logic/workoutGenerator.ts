/**
 * Lógica central de geração de treinos.
 * Monitore: Objetivo, Dias por Semana, Duração.
 * Regras: 10 min/exercício, sinergia (Bíceps ≠ dia após Costas, Tríceps ≠ dia após Peito).
 */

import type { MuscleGroup } from '../data/mockDatabase';

export type Goal = 'weight_loss' | 'hypertrophy' | 'endurance' | 'maintenance' | 'strength' | 'muscle_definition';

export type SplitType =
  | 'full_body'
  | 'full_body_focus_a'
  | 'full_body_focus_b'
  | 'full_body_focus_c'
  | 'upper'
  | 'lower'
  | 'push'
  | 'pull'
  | 'legs'
  | 'chest_triceps'
  | 'back_biceps'
  | 'shoulders_traps'
  | 'legs_complete'
  | 'push_ppl'
  | 'pull_ppl'
  | 'legs_ppl'
  | 'chest'
  | 'back'
  | 'shoulders_abs'
  | 'arms';

export interface WorkoutStructure {
  /** Número de séries por exercício */
  sets: number;
  /** Reps mínima */
  repsMin: number;
  /** Reps máxima */
  repsMax: number;
  /** Minutos de cardio ao final (ex.: Perda de Peso = 10) */
  cardioMinutes: number;
  /** Minutos disponíveis para força (após reservar cardio) */
  strengthMinutes: number;
  /** Duração total do treino (min) */
  durationMinutes: number;
  /** Máximo de exercícios de força (regra 10 min/exercício). NUNCA exceder. */
  maxExercises: number;
  /** Objetivo usado */
  goal: Goal;
  /** Dias de treino por semana */
  daysPerWeek: number;
}

const MIN_PER_EXERCISE = 10;

/**
 * Calcula a estrutura do treino a partir de Objetivo, Dias/semana e Duração.
 * - Hipertrofia: 4–5 séries, menos reps (6–10).
 * - Perda de Peso: 12–15 reps, +10 min cardio ao final da duração total.
 * - Regra de capacidade: 10 min/exercício → maxExercises = floor(strengthMinutes / 10).
 */
export function calculateWorkoutStructure(
  goal: Goal,
  daysPerWeek: number,
  durationMinutes: number
): WorkoutStructure {
  let cardioMinutes = 0;
  let strengthMinutes = durationMinutes;

  if (goal === 'weight_loss') {
    cardioMinutes = 10;
    strengthMinutes = Math.max(0, durationMinutes - 10);
  }

  const maxExercises = Math.max(1, Math.floor(strengthMinutes / MIN_PER_EXERCISE));

  let sets: number;
  let repsMin: number;
  let repsMax: number;

  if (goal === 'hypertrophy' || goal === 'strength') {
    sets = 4 + Math.floor(Math.random() * 2); // 4–5
    repsMin = 6;
    repsMax = 10;
  } else if (goal === 'weight_loss' || goal === 'muscle_definition') {
    sets = 3;
    repsMin = 12;
    repsMax = 15;
  } else if (goal === 'endurance') {
    sets = 3;
    repsMin = 15;
    repsMax = 25;
  } else {
    sets = 3;
    repsMin = 10;
    repsMax = 15;
  }

  return {
    sets,
    repsMin,
    repsMax,
    cardioMinutes,
    strengthMinutes,
    durationMinutes,
    maxExercises,
    goal,
    daysPerWeek,
  };
}

export interface SplitConfig {
  split: SplitType[];
  workoutDays: number[]; // 1–7 (Segunda–Domingo)
}

/**
 * Define o split semanal e os dias de treino.
 * 5 dias: A(Peito), B(Costas), C(Pernas), D(Ombros), E(Braços).
 * Sinergia: nunca Bíceps no dia seguinte a Costas, nem Tríceps no dia seguinte a Peito.
 * O split de 5 dias já respeita isso (Braços só após Ombros).
 */
export function getSplitConfig(daysPerWeek: number): SplitConfig {
  let split: SplitType[];
  let workoutDays: number[];

  if (daysPerWeek >= 1 && daysPerWeek <= 2) {
    split = Array(daysPerWeek).fill('full_body') as SplitType[];
    workoutDays = daysPerWeek === 1 ? [1] : [1, 4];
  } else if (daysPerWeek === 3) {
    split = ['push_ppl', 'pull_ppl', 'legs_ppl'];
    workoutDays = [1, 3, 5];
  } else if (daysPerWeek === 4) {
    // Peito+Tríceps, Costas+Bíceps (mesmo dia → sem conflito de sinergia)
    split = ['chest_triceps', 'back_biceps', 'shoulders_traps', 'legs_complete'];
    workoutDays = [1, 2, 3, 4];
  } else if (daysPerWeek === 5) {
    // A(Peito), B(Costas), C(Pernas), D(Ombros), E(Braços) – sem Bíceps após Costas, nem Tríceps após Peito
    split = ['chest', 'back', 'legs', 'shoulders_abs', 'arms'];
    workoutDays = [1, 2, 3, 4, 5];
  } else if (daysPerWeek === 6) {
    split = ['push', 'pull', 'legs', 'push', 'pull', 'legs'];
    workoutDays = [1, 2, 3, 4, 5, 6];
  } else if (daysPerWeek === 7) {
    split = ['push', 'pull', 'legs', 'push', 'pull', 'legs', 'push'];
    workoutDays = [1, 2, 3, 4, 5, 6, 7];
  } else {
    split = ['full_body'];
    workoutDays = [1];
  }

  return { split, workoutDays };
}

/** Grupos que NUNCA devem vir no dia seguinte ao grupo dado (sinergia). */
const SYNERGY_AVOID: Partial<Record<MuscleGroup, MuscleGroup[]>> = {
  back: ['biceps'],
  chest: ['triceps'],
};

/**
 * Verifica se treinar `muscle` no dia `dayIndex` viola sinergia,
 * dado que `previousDayMuscles` foram treinados no dia anterior.
 */
export function violatesSynergy(
  muscle: MuscleGroup,
  previousDayMuscles: MuscleGroup[]
): boolean {
  for (const prev of previousDayMuscles) {
    const avoid = SYNERGY_AVOID[prev];
    if (avoid && avoid.includes(muscle)) return true;
  }
  return false;
}

/**
 * Retorna número de reps dentro do range da estrutura, com leve aleatoriedade por exercício.
 */
export function getRepsForExercise(
  structure: WorkoutStructure,
  isCompound: boolean
): number {
  let { repsMin, repsMax } = structure;
  if (structure.goal === 'hypertrophy' || structure.goal === 'strength') {
    if (isCompound) {
      repsMin = 8;
      repsMax = 12;
    } else {
      repsMin = 10;
      repsMax = 15;
    }
  }
  return repsMin + Math.floor(Math.random() * (repsMax - repsMin + 1));
}
