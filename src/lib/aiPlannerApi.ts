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
  };
}

/** Treino básico de failover quando o backend retorna apenas dieta (API antiga). */
function createFailoverWorkoutPlan(payload: AICompletePlanPayload): AIPlannerWeek[] {
  const days = payload.workoutDaysPerWeek || 3;
  const location = payload.workoutLocation || 'gym';

  const homeExercises: AIPlannerExercise[] = [
    { name: 'Flexão de Braço', sets: 3, reps: 12, rest: 60, instructions: 'Mãos na largura dos ombros, desça até o peito quase tocar o chão.' },
    { name: 'Agachamento com Peso Corporal', sets: 3, reps: 15, rest: 60, instructions: 'Pés na largura dos ombros, desça até as coxas ficarem paralelas ao chão.' },
    { name: 'Prancha', sets: 3, reps: 30, rest: 45, instructions: 'Mantenha a posição de flexão com o corpo alinhado por 30 segundos.' },
    { name: 'Lunges', sets: 3, reps: 12, rest: 60, instructions: 'Alternando pernas, dê um passo à frente e desça o joelho traseiro.' },
    { name: 'Abdominal Crunch', sets: 3, reps: 15, rest: 45, instructions: 'Deite, flexione o tronco em direção aos joelhos.' },
  ];

  const gymExercises: AIPlannerExercise[] = [
    { name: 'Supino Reto', sets: 3, reps: 10, rest: 90, instructions: 'Deite no banco, empurre a barra com controle.' },
    { name: 'Remada Curvada', sets: 3, reps: 10, rest: 90, instructions: 'Incline o tronco, puxe a barra até o abdômen.' },
    { name: 'Agachamento Livre', sets: 3, reps: 10, rest: 90, instructions: 'Desça até coxas paralelas ao chão.' },
    { name: 'Desenvolvimento com Halteres', sets: 3, reps: 10, rest: 60, instructions: 'Empurre os halteres acima da cabeça.' },
    { name: 'Prancha', sets: 2, reps: 45, rest: 45, instructions: 'Mantenha a posição alinhada por 45 segundos.' },
  ];

  const parkExercises: AIPlannerExercise[] = [
    { name: 'Barra Fixa', sets: 3, reps: 8, rest: 90, instructions: 'Puxe o corpo até o queixo passar da barra.' },
    { name: 'Paralelas', sets: 3, reps: 10, rest: 90, instructions: 'Apoie nas barras, desça o corpo com controle.' },
    { name: 'Agachamento com Peso Corporal', sets: 3, reps: 15, rest: 60, instructions: 'Agache até as coxas ficarem paralelas.' },
    { name: 'Flexão de Braço', sets: 3, reps: 12, rest: 60, instructions: 'Mãos na largura dos ombros.' },
    { name: 'Corrida', sets: 1, reps: 10, rest: 0, instructions: 'Corra em ritmo moderado por 10 minutos.' },
  ];

  const exercises =
    location === 'home' ? homeExercises
    : location === 'park' ? parkExercises
    : gymExercises;

  const dayNames = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'];

  return [1, 2, 3, 4].map((week) => ({
    week,
    workoutDays: Array.from({ length: days }, (_, i) => ({
      dayName: dayNames[i % 7],
      muscleGroups: ['Full Body'],
      exercises: [...exercises],
    })),
  }));
}

/** Indica se estamos usando o fallback para a API antiga (/api/diet). */
const isDietFallback =
  !(import.meta.env.VITE_AI_PLANNER_API_URL as string | undefined);

/**
 * Busca o plano completo (dieta + treino) da API unificada.
 * Envia o perfil completo do usuário e retorna ambos os planos.
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
  try {
    const payload: AICompletePlanPayload =
      'biometrics' in profile ? onboardingToPayload(profile) : profile;

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
      return {
        ok: false,
        error:
          'O servidor de IA ainda não está configurado para o novo formato de treino e dieta.',
      };
    }

    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      return {
        ok: false,
        error:
          'O servidor de IA ainda não está configurado para o novo formato de treino e dieta.',
      };
    }

    if (!res.ok) {
      const msg =
        (data && typeof data === 'object' && 'error' in data
          ? (data as { error?: string }).error
          : null) ?? `Erro ${res.status}`;
      return { ok: false, error: String(msg) };
    }

    const response = data as Record<string, unknown>;

    if (
      !response?.diet ||
      typeof response.diet !== 'object' ||
      !Array.isArray((response.diet as DietApiResponse).refeicoes)
    ) {
      return { ok: false, error: 'Resposta inválida: dieta ausente ou malformada.' };
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
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : 'Erro ao conectar com a API do Bilu Shape.';
    return { ok: false, error: msg };
  }
}
