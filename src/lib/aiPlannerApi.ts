/**
 * aiPlannerApi.ts
 *
 * Nova integração unificada para o Bilu Shape.
 * Esta API consolida dieta e treino em uma única chamada,
 * recebendo o perfil completo de onboarding e retornando
 * um plano alimentar e de treinos para 4 semanas.
 */

import type {
  OnboardingData,
  DietApiResponse,
  Biometrics,
  Restrictions,
  Goals,
  Preferences,
} from '../types';

// =============================================================================
// Payload da API
// =============================================================================

/**
 * Payload completo enviado para a API unificada.
 * Inclui todos os dados de OnboardingData necessários para
 * gerar dieta e treino personalizados.
 */
export interface AICompletePlanPayload {
  /** Peso em kg */
  weight: number;
  /** Altura em cm */
  height: number;
  /** Idade em anos */
  age: number;
  /** Objetivo principal (weight_loss, hypertrophy, endurance, etc.) */
  objective: Goals['primary'];
  /** Nível/experiência do usuário (opcional) */
  level?: string;
  /** Local de treino (gym, home, park, mixed) */
  workoutLocation: Preferences['location'];
  /** Frequência de treino: dias por semana */
  workoutDaysPerWeek: number;
  /** Duração do treino em minutos */
  workoutDuration: number;
  /** % gordura corporal (opcional) */
  bodyFat?: number;
  /** Gênero (male, female, other) */
  gender?: Biometrics['gender'];
  /** Biotipo (ectomorph, mesomorph, endomorph) */
  biotype?: Biometrics['biotype'];
  /** Refeições por dia */
  mealsPerDay?: number;
  /** Horário de acordar (HH:mm) */
  wakeTime?: string;
  /** Horário preferido para treino (HH:mm) */
  workoutTime?: string;
  /** Horário de dormir (HH:mm) */
  sleepTime?: string;
  /** Lista de alergias alimentares */
  allergies?: string[];
  /** Lesões e restrições físicas */
  injuries?: Restrictions['injuries'];
  /** Exige Pré-Treino (30–60 min antes) e Pós-Treino (logo após) nas refeições */
  requirePrePostWorkout?: boolean;
}

/**
 * Converte OnboardingData no payload da API unificada.
 */
export function onboardingToPayload(data: OnboardingData): AICompletePlanPayload {
  const { biometrics, restrictions, goals, preferences } = data;
  return {
    weight: biometrics.weight,
    height: biometrics.height,
    age: biometrics.age,
    objective: goals.primary,
    level: biometrics.biotype,
    workoutLocation: preferences.location,
    workoutDaysPerWeek: preferences.workoutDaysPerWeek,
    workoutDuration: preferences.workoutDuration,
    bodyFat: biometrics.bodyFat,
    gender: biometrics.gender,
    biotype: biometrics.biotype,
    mealsPerDay: preferences.mealsPerDay,
    wakeTime: preferences.wakeTime,
    workoutTime: preferences.workoutTime,
    sleepTime: preferences.sleepTime,
    allergies: restrictions.allergies,
    injuries: restrictions.injuries,
    requirePrePostWorkout: true,
  };
}

// =============================================================================
// Resposta da API
// =============================================================================

/** Exercício dentro de um dia de treino. */
export interface AIPlannerExercise {
  name: string;
  sets: number;
  reps: number;
  rest: number; // segundos
  instructions: string;
}

/** Dia de treino na estrutura da API. */
export interface AIPlannerWorkoutDay {
  dayName: string;
  muscleGroups: string[];
  exercises: AIPlannerExercise[];
}

/** Semana de treinos (4 semanas no total). */
export interface AIPlannerWeek {
  week: number;
  workoutDays: AIPlannerWorkoutDay[];
}

/**
 * Resposta da API unificada do Bilu Shape.
 * Contém dieta (formato DietApiResponse) e plano de treino para 4 semanas.
 */
export interface AICompletePlanResponse {
  /** Plano alimentar no formato da API de dieta */
  diet: DietApiResponse;
  /** Plano de treino estruturado em 4 semanas */
  workout_plan: AIPlannerWeek[];
}

// =============================================================================
// Função principal
// =============================================================================

/** URL da API unificada. Fallback para /api/diet quando a rota completa ainda não existe. */
const AI_PLANNER_API_URL =
  (import.meta.env.VITE_AI_PLANNER_API_URL as string | undefined) ||
  (import.meta.env.VITE_DIET_API_URL as string | undefined) ||
  '/api/diet';

/** Converte AICompletePlanPayload para o formato esperado pela API antiga /api/diet. */
function toDietProfilePayload(payload: AICompletePlanPayload): Record<string, unknown> {
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
    weight: payload.weight,
    height: payload.height,
    age: payload.age,
    gender: payload.gender === 'female' ? 'feminino' : 'masculino',
    biotype: bioMap[payload.biotype ?? 'mesomorph'] ?? 'mesomorfo',
    objective: objMap[payload.objective] ?? 'hipertrofia',
    workout_time: payload.workoutTime,
    workout_duration: payload.workoutDuration,
    wake_up_time: payload.wakeTime,
    sleep_time: payload.sleepTime,
    meals_per_day: payload.mealsPerDay,
    allergies: payload.allergies ?? [],
    require_pre_post_workout: true,
    pre_workout_minutes_before: 45,
    post_workout_required: true,
  };
}

/** Exercícios por grupo muscular e local (para failover). Base: ~8–10 min/exercício. */
const FAILOVER_EXERCISES: Record<string, Record<string, Omit<AIPlannerExercise, 'sets' | 'reps'>[]>> = {
  chest: {
    gym: [
      { name: 'Supino Reto', rest: 90, instructions: 'Deite no banco, empurre a barra com controle.' },
      { name: 'Supino Inclinado', rest: 90, instructions: 'Banco inclinado 45°, empurre a barra.' },
      { name: 'Crucifixo com Halteres', rest: 60, instructions: 'Abra os braços com halteres.' },
      { name: 'Flexão de Braço', rest: 60, instructions: 'Mãos na largura dos ombros.' },
      { name: 'Supino Declinado', rest: 90, instructions: 'Banco declinado, empurre a barra.' },
      { name: 'Crucifixo na Polia', rest: 60, instructions: 'Abra os braços na polia baixa.' },
      { name: 'Crossover', rest: 60, instructions: 'Cruze os cabos na frente do peito.' },
      { name: 'Supino com Halteres', rest: 90, instructions: 'Empurre os halteres no banco plano.' },
      { name: 'Pull-over', rest: 60, instructions: 'Haltere atrás da cabeça, desça e suba.' },
      { name: 'Flexão Diamante', rest: 60, instructions: 'Mãos juntas sob o peitoral.' },
    ],
    home: [
      { name: 'Flexão de Braço', rest: 60, instructions: 'Mãos na largura dos ombros.' },
      { name: 'Flexão Inclinada', rest: 60, instructions: 'Mãos no banco, pés no chão.' },
      { name: 'Flexão Declinada', rest: 60, instructions: 'Pés elevados, mãos no chão.' },
      { name: 'Flexão com Apoio nos Joelhos', rest: 60, instructions: 'Versão facilitada.' },
      { name: 'Flexão Explosiva', rest: 60, instructions: 'Empurre forte e troque mãos no ar.' },
    ],
    park: [
      { name: 'Flexão de Braço', rest: 60, instructions: 'Mãos na largura dos ombros.' },
      { name: 'Paralelas', rest: 90, instructions: 'Apoie nas barras, desça com controle.' },
      { name: 'Flexão Inclinada', rest: 60, instructions: 'Mãos no banco do parque.' },
      { name: 'Flexão com Pés Elevados', rest: 60, instructions: 'Pés no banco.' },
    ],
  },
  back: {
    gym: [
      { name: 'Remada Curvada', rest: 90, instructions: 'Puxe a barra até o abdômen.' },
      { name: 'Puxada Frontal', rest: 90, instructions: 'Puxe a barra até o peito na polia.' },
      { name: 'Remada Unilateral', rest: 60, instructions: 'Um braço por vez, puxe o halter.' },
      { name: 'Barra Fixa', rest: 90, instructions: 'Puxe o corpo até o queixo passar da barra.' },
      { name: 'Puxada Atrás', rest: 90, instructions: 'Puxe a barra atrás da nuca.' },
      { name: 'Remada no Smith', rest: 90, instructions: 'Remada com barra no Smith.' },
      { name: 'Remada Cavalinho', rest: 60, instructions: 'Tronco inclinado, puxe halteres.' },
      { name: 'Puxada Triângulo', rest: 90, instructions: 'Puxada com pegada em triângulo.' },
      { name: 'Remada Baixa', rest: 90, instructions: 'Puxe a barra na polia baixa.' },
      { name: 'Puxada Unilateral', rest: 60, instructions: 'Um braço por vez na polia.' },
    ],
    home: [
      { name: 'Puxada com Elástico', rest: 60, instructions: 'Prenda elástico, puxe em direção ao peito.' },
      { name: 'Remada com Elástico', rest: 60, instructions: 'Pés no elástico, puxe com os braços.' },
      { name: 'Superman', rest: 45, instructions: 'Deite de bruços, eleve braços e pernas.' },
      { name: 'Remada Invertida', rest: 60, instructions: 'Deitado, puxe o corpo na mesa.' },
    ],
    park: [
      { name: 'Barra Fixa', rest: 90, instructions: 'Puxe o corpo até o queixo passar da barra.' },
      { name: 'Remada com Elástico', rest: 60, instructions: 'Prenda elástico na barra.' },
      { name: 'Puxada com Elástico', rest: 60, instructions: 'Elástico preso em ponto alto.' },
    ],
  },
  legs: {
    gym: [
      { name: 'Agachamento Livre', rest: 90, instructions: 'Desça até coxas paralelas ao chão.' },
      { name: 'Leg Press', rest: 90, instructions: 'Empurre a plataforma com as pernas.' },
      { name: 'Flexão de Pernas', rest: 60, instructions: 'Flexione as pernas na máquina.' },
      { name: 'Panturrilha em Pé', rest: 45, instructions: 'Eleve o corpo na ponta dos pés.' },
    ],
    home: [
      { name: 'Agachamento com Peso Corporal', rest: 60, instructions: 'Desça até coxas paralelas.' },
      { name: 'Lunges', rest: 60, instructions: 'Alternando pernas, dê um passo à frente.' },
    ],
    park: [
      { name: 'Agachamento com Peso Corporal', rest: 60, instructions: 'Desça até coxas paralelas.' },
      { name: 'Lunges', rest: 60, instructions: 'Alternando pernas.' },
    ],
  },
  /** Pernas foco quadríceps (Dia C do split A-E). */
  legs_quad: {
    gym: [
      { name: 'Agachamento Livre', rest: 90, instructions: 'Desça até coxas paralelas ao chão.' },
      { name: 'Leg Press', rest: 90, instructions: 'Empurre a plataforma com as pernas.' },
      { name: 'Cadeira Extensora', rest: 60, instructions: 'Estenda as pernas na máquina.' },
      { name: 'Agachamento Búlgaro', rest: 60, instructions: 'Perna posterior no banco, desça.' },
      { name: 'Panturrilha em Pé', rest: 45, instructions: 'Eleve o corpo na ponta dos pés.' },
      { name: 'Panturrilha Sentado', rest: 45, instructions: 'Eleve na máquina sentado.' },
      { name: 'Hack Squat', rest: 90, instructions: 'Agachamento na máquina inclinada.' },
      { name: 'Afundo com Barra', rest: 60, instructions: 'Passo à frente, desça o joelho traseiro.' },
      { name: 'Leg Press Unilateral', rest: 60, instructions: 'Uma perna por vez na plataforma.' },
      { name: 'Cadeira Extensora Unilateral', rest: 60, instructions: 'Estenda uma perna por vez.' },
    ],
    home: [
      { name: 'Agachamento com Peso Corporal', rest: 60, instructions: 'Desça até coxas paralelas.' },
      { name: 'Lunges', rest: 60, instructions: 'Alternando pernas, dê um passo à frente.' },
      { name: 'Agachamento Búlgaro', rest: 60, instructions: 'Perna posterior elevada.' },
      { name: 'Panturrilha em Pé', rest: 45, instructions: 'Eleve na ponta dos pés.' },
      { name: 'Agachamento Sumo', rest: 60, instructions: 'Pés largos, desça com controle.' },
      { name: 'Subida em Step', rest: 60, instructions: 'Subida alternada em banco ou step.' },
    ],
    park: [
      { name: 'Agachamento com Peso Corporal', rest: 60, instructions: 'Desça até coxas paralelas.' },
      { name: 'Lunges', rest: 60, instructions: 'Alternando pernas.' },
      { name: 'Agachamento Búlgaro', rest: 60, instructions: 'Perna posterior no banco.' },
      { name: 'Panturrilha em Pé', rest: 45, instructions: 'Eleve na ponta dos pés.' },
      { name: 'Agachamento Sumo', rest: 60, instructions: 'Pés largos, desça com controle.' },
    ],
  },
  /** Pernas foco isquiotibiais + braços (Dia E do split A-E). */
  legs_hamstring_arms: {
    gym: [
      { name: 'Flexão de Pernas (Máquina)', rest: 60, instructions: 'Flexione as pernas na máquina (isquiotibiais).' },
      { name: 'Stiff', rest: 90, instructions: 'Mantenha pernas quase retas, desça o tronco.' },
      { name: 'Cadeira Flexora', rest: 60, instructions: 'Flexione as pernas sentado.' },
      { name: 'Rosca Direta', rest: 60, instructions: 'Flexione os cotovelos, levante a barra.' },
      { name: 'Rosca Martelo', rest: 60, instructions: 'Halteres com pegada neutra.' },
      { name: 'Tríceps Pulley', rest: 60, instructions: 'Estenda os braços na polia.' },
      { name: 'Tríceps Banco', rest: 45, instructions: 'Apoie mãos no banco, desça o corpo.' },
      { name: 'Rosca Concentrada', rest: 60, instructions: 'Cotovelo apoiado na coxa, flexione o braço.' },
      { name: 'Tríceps Francês', rest: 60, instructions: 'Haltere atrás da cabeça, estenda os braços.' },
      { name: 'Flexão de Pernas em Pé', rest: 60, instructions: 'Uma perna por vez na máquina.' },
      { name: 'Rosca Scott', rest: 60, instructions: 'Braços apoiados no banco Scott.' },
      { name: 'Tríceps Corda', rest: 60, instructions: 'Estenda os braços na polia com corda.' },
    ],
    home: [
      { name: 'Stiff com Halteres', rest: 60, instructions: 'Desça o tronco mantendo pernas levemente flexionadas.' },
      { name: 'Good Morning', rest: 60, instructions: 'Incline o tronco à frente com quadril estável.' },
      { name: 'Tríceps Banco', rest: 45, instructions: 'Apoie mãos no banco, desça o corpo.' },
      { name: 'Rosca com Elástico', rest: 60, instructions: 'Flexione cotovelos puxando o elástico.' },
      { name: 'Perna Curta com Elástico', rest: 60, instructions: 'Flexione o joelho puxando o elástico.' },
      { name: 'Rosca 21', rest: 60, instructions: 'Rosca em três amplitudes (7+7+7).' },
    ],
    park: [
      { name: 'Good Morning', rest: 60, instructions: 'Incline o tronco à frente.' },
      { name: 'Tríceps Banco', rest: 45, instructions: 'Apoie mãos no banco, desça o corpo.' },
      { name: 'Rosca com Elástico', rest: 60, instructions: 'Flexione cotovelos puxando o elástico.' },
      { name: 'Stiff com Peso Corporal', rest: 60, instructions: 'Incline o tronco mantendo pernas levemente flexionadas.' },
      { name: 'Tríceps Mergulho', rest: 45, instructions: 'Apoie nas barras paralelas, desça o corpo.' },
    ],
  },
  shoulders: {
    gym: [
      { name: 'Desenvolvimento com Halteres', rest: 60, instructions: 'Empurre halteres acima da cabeça.' },
      { name: 'Elevação Lateral', rest: 60, instructions: 'Levante halteres lateralmente.' },
      { name: 'Encolhimento com Halteres', rest: 45, instructions: 'Eleve os ombros (trapézio).' },
      { name: 'Remada Alta', rest: 60, instructions: 'Puxe a barra até o queixo (ombros e trapézio).' },
      { name: 'Elevação Frontal', rest: 60, instructions: 'Levante halteres à frente do corpo.' },
      { name: 'Desenvolvimento Militar', rest: 90, instructions: 'Barra acima da cabeça, em pé ou sentado.' },
      { name: 'Elevação Lateral na Polia', rest: 60, instructions: 'Levante o cabo lateralmente.' },
      { name: 'Encolhimento com Barra', rest: 45, instructions: 'Barra atrás do corpo, eleve os ombros.' },
      { name: 'Face Pull', rest: 60, instructions: 'Puxe a corda em direção ao rosto.' },
      { name: 'Desenvolvimento Arnold', rest: 60, instructions: 'Halteres com rotação durante o movimento.' },
      { name: 'Elevação Inclinada', rest: 60, instructions: 'Tronco inclinado, eleve halteres lateralmente.' },
      { name: 'Remada Alta com Halteres', rest: 60, instructions: 'Halteres até o queixo.' },
    ],
    home: [
      { name: 'Pike Push-up', rest: 60, instructions: 'Flexão com quadril elevado em V.' },
      { name: 'Encolhimento com Peso', rest: 45, instructions: 'Eleve os ombros segurando peso.' },
      { name: 'Elevação Lateral com Elástico', rest: 60, instructions: 'Pise no elástico, levante os braços.' },
      { name: 'Desenvolvimento com Garrafa', rest: 60, instructions: 'Empurre garrafas ou peso acima da cabeça.' },
      { name: 'Y raise', rest: 60, instructions: 'De bruços, eleve os braços em Y.' },
    ],
    park: [
      { name: 'Pike Push-up', rest: 60, instructions: 'Flexão com quadril elevado em V.' },
      { name: 'Encolhimento com Peso', rest: 45, instructions: 'Eleve os ombros.' },
      { name: 'Elevação Lateral com Elástico', rest: 60, instructions: 'Elástico preso, levante os braços.' },
    ],
  },
  arms: {
    gym: [
      { name: 'Rosca Direta', rest: 60, instructions: 'Flexione os cotovelos, levante a barra.' },
      { name: 'Rosca Martelo', rest: 60, instructions: 'Halteres com pegada neutra.' },
      { name: 'Tríceps Pulley', rest: 60, instructions: 'Estenda os braços na polia.' },
      { name: 'Tríceps Banco', rest: 45, instructions: 'Apoie mãos no banco, desça o corpo.' },
    ],
    home: [
      { name: 'Tríceps Banco', rest: 45, instructions: 'Apoie mãos no banco, desça o corpo.' },
    ],
    park: [
      { name: 'Tríceps Banco', rest: 45, instructions: 'Apoie mãos no banco, desça o corpo.' },
    ],
  },
};

/** Split por dia: A–E para 5 dias (Peito, Costas, Pernas, Ombros, Braços); rotação para outros. */
const SPLIT_BY_DAYS: Record<number, { muscleGroups: string[]; key: string }[]> = {
  3: [
    { muscleGroups: ['Peito', 'Ombros', 'Tríceps'], key: 'chest' },
    { muscleGroups: ['Costas', 'Bíceps'], key: 'back' },
    { muscleGroups: ['Pernas'], key: 'legs' },
  ],
  4: [
    { muscleGroups: ['Peito', 'Tríceps'], key: 'chest' },
    { muscleGroups: ['Costas', 'Bíceps'], key: 'back' },
    { muscleGroups: ['Pernas'], key: 'legs' },
    { muscleGroups: ['Ombros'], key: 'shoulders' },
  ],
  /** Split A-E: 5 dias DIFERENTES, sem repetir grupo muscular em dias seguidos. */
  5: [
    { muscleGroups: ['Peito', 'Tríceps'], key: 'chest' },           // Dia A
    { muscleGroups: ['Costas', 'Bíceps'], key: 'back' },            // Dia B
    { muscleGroups: ['Pernas', 'Foco Quadríceps'], key: 'legs_quad' }, // Dia C
    { muscleGroups: ['Ombros', 'Trapézio'], key: 'shoulders' },     // Dia D
    { muscleGroups: ['Pernas', 'Foco Isquiotibiais', 'Braços'], key: 'legs_hamstring_arms' }, // Dia E
  ],
  6: [
    { muscleGroups: ['Peito', 'Tríceps'], key: 'chest' },
    { muscleGroups: ['Costas', 'Bíceps'], key: 'back' },
    { muscleGroups: ['Pernas'], key: 'legs' },
    { muscleGroups: ['Peito', 'Ombros'], key: 'chest' },
    { muscleGroups: ['Costas', 'Braços'], key: 'back' },
    { muscleGroups: ['Pernas'], key: 'legs' },
  ],
  7: [
    { muscleGroups: ['Peito'], key: 'chest' },
    { muscleGroups: ['Costas'], key: 'back' },
    { muscleGroups: ['Pernas'], key: 'legs' },
    { muscleGroups: ['Ombros'], key: 'shoulders' },
    { muscleGroups: ['Braços'], key: 'arms' },
    { muscleGroups: ['Peito', 'Costas'], key: 'chest' },
    { muscleGroups: ['Pernas'], key: 'legs' },
  ],
};

/** Volume real: minutos/9 exercícios por dia; para 100 min obrigatoriamente entre 10 e 12. */
function exercisesPerDayFromDuration(minutes: number): number {
  const raw = Math.floor(minutes / 9);
  if (minutes >= 90) return Math.min(12, Math.max(10, raw));
  return Math.min(15, Math.max(3, raw));
}

/** Treino de failover: volume real (min/9), split A–E sem repetição, cardio 25 min se weight_loss, progressão (Semana 2 > Semana 1). */
function createFailoverWorkoutPlan(payload: AICompletePlanPayload): AIPlannerWeek[] {
  const days = Math.min(7, Math.max(1, payload.workoutDaysPerWeek || 3));
  const duration = Math.max(30, payload.workoutDuration || 60);
  const location = payload.workoutLocation || 'gym';
  const objective = payload.objective || 'hypertrophy';
  const loc = location === 'home' ? 'home' : location === 'park' ? 'park' : 'gym';

  const addCardio = objective === 'weight_loss';
  const CARDIO_MINUTES = 25;
  const cardioExercise: AIPlannerExercise = {
    name: 'Cardio (Esteira/Corda/Corrida)',
    sets: 1,
    reps: CARDIO_MINUTES,
    rest: 0,
    instructions: `Cardio em ritmo moderado por ${CARDIO_MINUTES} minutos.`,
  };

  const exercisesPerDay = exercisesPerDayFromDuration(duration);
  const splits = SPLIT_BY_DAYS[days] ?? SPLIT_BY_DAYS[3];

  const getExercisesForSplit = (
    splitKey: string,
    count: number,
    baseSets: number,
    baseReps: number
  ): AIPlannerExercise[] => {
    let pool = FAILOVER_EXERCISES[splitKey]?.[loc] ?? FAILOVER_EXERCISES.chest[loc];
    if (pool.length < count && (splitKey === 'chest' || splitKey === 'back')) {
      const extra = splitKey === 'chest'
        ? (FAILOVER_EXERCISES.arms?.[loc] ?? []).filter((e) => e.name.includes('Tríceps'))
        : (FAILOVER_EXERCISES.arms?.[loc] ?? []).filter((e) => e.name.includes('Rosca') || e.name.includes('Bíceps'));
      pool = [...pool, ...extra];
    }
    while (pool.length < count) pool = [...pool, ...pool];
    const selected = pool.slice(0, count);
    return selected.map((e) => ({
      ...e,
      sets: baseSets,
      reps: baseReps,
    }));
  };

  const dayNames = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'];

  return [1, 2, 3, 4].map((week) => {
    const baseSets = week === 1 ? 3 : week === 2 ? 4 : week === 3 ? 4 : 3;
    const baseReps = week === 4 ? 12 : objective === 'weight_loss' ? 15 : 10;

    const workoutDays = Array.from({ length: days }, (_, i) => {
      const split = splits[i % splits.length];
      const key = split.key;
      const exercises: AIPlannerExercise[] = getExercisesForSplit(
        key,
        exercisesPerDay,
        baseSets,
        baseReps
      );
      if (addCardio) exercises.push(cardioExercise);
      return {
        dayName: dayNames[i % 7],
        muscleGroups: 'muscleGroups' in split ? split.muscleGroups : ['Full Body'],
        exercises,
      };
    });

    return { week, workoutDays };
  });
}

/** Soma minutos a um horário "HH:mm" (aceita delta negativo para Pré-Treino). */
function addMinutesToTime(time: string, deltaMinutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + deltaMinutes;
  const nh = (Math.floor(total / 60) + 24) % 24;
  const nm = ((total % 60) + 60) % 60;
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
}

/** Dieta de failover: 5 refeições base + Pré-Treino (1h antes do workout_time) e Pós-Treino (logo após). */
function createFailoverDiet(payload: AICompletePlanPayload): DietApiResponse {
  const wakeTime = payload.wakeTime ?? '07:00';
  const workoutTime = payload.workoutTime ?? '18:00';
  const sleepTime = payload.sleepTime ?? '23:00';
  const duration = payload.workoutDuration ?? 60;
  const preTime = addMinutesToTime(workoutTime, -60);
  const postTime = addMinutesToTime(workoutTime, duration);

  const baseRefeicoes: Array<{ horario: string; titulo_refeicao: string }> = [
    { horario: wakeTime, titulo_refeicao: 'Café da Manhã' },
    { horario: '12:00', titulo_refeicao: 'Almoço' },
    { horario: '15:00', titulo_refeicao: 'Lanche' },
    { horario: '20:00', titulo_refeicao: 'Jantar' },
    { horario: sleepTime, titulo_refeicao: 'Ceia' },
    { horario: preTime, titulo_refeicao: 'Pré-Treino' },
    { horario: postTime, titulo_refeicao: 'Pós-Treino' },
  ];
  const refeicoes = baseRefeicoes.map((r) => ({
    horario: r.horario,
    titulo_refeicao: r.titulo_refeicao,
    lista_alimentos_com_quantidade: [
      { alimento: 'Exemplo (personalize com a API)', quantidade: '1 porção', calorias: 200, proteina: 10, carboidratos: 20, gorduras: 8 },
    ],
    macros_da_ref: { calorias: 200, proteina: 10, carboidratos: 20, gorduras: 8 },
  }));

  const tdee = 2000;
  const meta = { calorias: 1800, proteina: 120, carboidratos: 180, gorduras: 60 };
  return {
    resumo_metabolico: {
      tdee,
      meta_calorias: meta.calorias,
      meta_proteina: meta.proteina,
      meta_carboidratos: meta.carboidratos,
      meta_gorduras: meta.gorduras,
    },
    refeicoes,
    lista_compras: [{ item: 'Lista gerada pela API quando disponível', quantidade: '-' }],
  };
}

/** Indica se estamos usando o fallback para a API antiga (/api/diet). */
const isDietFallback =
  !(import.meta.env.VITE_AI_PLANNER_API_URL as string | undefined);

/**
 * Busca o plano completo (dieta + treino) da API unificada.
 * Envia o perfil completo do usuário e retorna ambos os planos.
 * Em caso de falha da API, retorna plano mock (dieta + treino) para o usuário
 * ver volume real, divisão A-E e refeições com Pré/Pós-Treino.
 *
 * @param profile - Perfil completo (AICompletePlanPayload ou OnboardingData)
 * @param accessToken - Token de autenticação (opcional)
 */
export async function fetchCompletePlanFromApi(
  profile: AICompletePlanPayload | OnboardingData,
  accessToken?: string | null
): Promise<
  | { ok: true; diet: DietApiResponse; workout_plan: AIPlannerWeek[] }
  | { ok: false; error: string }
> {
  const payload: AICompletePlanPayload =
    'biometrics' in profile ? onboardingToPayload(profile) : profile;

  const returnFailoverPlan = (): { ok: true; diet: DietApiResponse; workout_plan: AIPlannerWeek[] } => ({
    ok: true,
    diet: createFailoverDiet(payload),
    workout_plan: createFailoverWorkoutPlan(payload),
  });

  try {
    const body = isDietFallback
      ? { profile: toDietProfilePayload(payload) }
      : { profile: payload };

    const res = await fetch(AI_PLANNER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
      },
      body: JSON.stringify(body),
    });

    const contentType = res.headers.get('content-type') ?? '';
    const text = await res.text();

    const isJsonContentType = contentType.toLowerCase().includes('application/json');
    const looksLikeHtml = text.trim().startsWith('<');

    if (!isJsonContentType || looksLikeHtml) {
      return returnFailoverPlan();
    }

    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      return returnFailoverPlan();
    }

    if (!res.ok) {
      return returnFailoverPlan();
    }

    const response = data as Record<string, unknown>;

    if (
      !response?.diet ||
      typeof response.diet !== 'object' ||
      !Array.isArray((response.diet as DietApiResponse).refeicoes)
    ) {
      return returnFailoverPlan();
    }

    const diet = response.diet as DietApiResponse;
    const hasWorkoutPlan =
      Array.isArray(response.workout_plan) && response.workout_plan.length > 0;

    const workout_plan: AIPlannerWeek[] = hasWorkoutPlan
      ? (response.workout_plan as AIPlannerWeek[])
      : createFailoverWorkoutPlan(payload);

    return {
      ok: true,
      diet,
      workout_plan,
    };
  } catch {
    return returnFailoverPlan();
  }
}
