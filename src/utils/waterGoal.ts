/** Nível de atividade física para ajuste da meta de água */
export type ActivityLevel = 'low' | 'medium' | 'high';

const ML_PER_KG_BASE = 35;
const GLASS_ML = 250;

/**
 * Calcula a meta diária de água (ml) com base no perfil do usuário.
 * Base: 35 ml por kg; ajuste para mais se o nível de atividade for alto.
 * @param weightKg - Peso em kg
 * @param activityLevel - Nível de atividade (low / medium / high)
 * @param _age - Idade (reservado para futuros ajustes, ex.: idosos)
 * @returns Meta em ml (arredondada para múltiplo de 250 para exibição em copos)
 */
export function calculateWaterGoal(
  weightKg: number,
  activityLevel: ActivityLevel,
  _age?: number
): number {
  if (!Number.isFinite(weightKg) || weightKg <= 0) {
    return 2000; // fallback padrão
  }
  let baseMl = weightKg * ML_PER_KG_BASE;
  switch (activityLevel) {
    case 'high':
      baseMl *= 1.2; // +20% para atividade alta
      break;
    case 'medium':
      baseMl *= 1.1; // +10% para atividade média
      break;
    default:
      break;
  }
  // Arredondar para o múltiplo de 250 mais próximo (facilita exibição em copos)
  const rounded = Math.round(baseMl / GLASS_ML) * GLASS_ML;
  return Math.max(GLASS_ML, rounded);
}

/**
 * Deriva o nível de atividade a partir das preferências de treino.
 */
export function getActivityLevelFromPreferences(
  workoutDaysPerWeek: number,
  workoutDurationMinutes: number
): ActivityLevel {
  const days = Number(workoutDaysPerWeek) || 0;
  const duration = Number(workoutDurationMinutes) || 0;
  if (days >= 5 || (days >= 4 && duration >= 45)) return 'high';
  if (days >= 3 || duration >= 30) return 'medium';
  return 'low';
}

/** Converte ml em quantidade de copos de 250ml. */
export function mlToGlasses(ml: number): number {
  return Math.round(ml / GLASS_ML);
}

const MINUTES_PER_DAY = 24 * 60;

/**
 * Converte "HH:mm" em minutos desde meia-noite.
 * Retorna 0 se inválido.
 */
export function parseTimeToMinutes(hhmm: string | undefined): number {
  if (!hhmm || typeof hhmm !== 'string') return 0;
  const parts = hhmm.trim().split(/[:\s]/);
  const h = parseInt(parts[0], 10);
  const m = parts[1] ? parseInt(parts[1], 10) : 0;
  if (!Number.isFinite(h) || h < 0 || h > 23) return 0;
  return Math.min(MINUTES_PER_DAY, h * 60 + (Number.isFinite(m) ? m : 0));
}

/**
 * Ritmo ideal de água (ml) que o usuário deveria ter consumido até agora.
 * Fórmula: (Meta Total / Total de horas acordado) * Horas que já se passaram desde que acordou.
 * @param goalMl - Meta diária em ml
 * @param wakeTimeHHmm - Horário de acordar (ex: "07:00")
 * @param sleepTimeHHmm - Horário de dormir (ex: "23:00")
 * @param now - Data/hora atual (default: agora)
 */
export function getIdealWaterPaceMl(
  goalMl: number,
  wakeTimeHHmm: string | undefined,
  sleepTimeHHmm: string | undefined,
  now: Date = new Date()
): number {
  const wakeMin = parseTimeToMinutes(wakeTimeHHmm);
  const sleepMin = parseTimeToMinutes(sleepTimeHHmm);
  const currentMin = now.getHours() * 60 + now.getMinutes();

  let totalAwakeMinutes: number;
  if (wakeMin <= sleepMin) {
    totalAwakeMinutes = sleepMin - wakeMin;
  } else {
    totalAwakeMinutes = MINUTES_PER_DAY - wakeMin + sleepMin;
  }

  if (totalAwakeMinutes <= 0) return 0;

  let minutesSinceWake: number;
  if (currentMin >= wakeMin && currentMin <= sleepMin) {
    minutesSinceWake = currentMin - wakeMin;
  } else if (currentMin < wakeMin) {
    minutesSinceWake = 0;
  } else {
    minutesSinceWake = totalAwakeMinutes;
  }

  const totalAwakeHours = totalAwakeMinutes / 60;
  const hoursSinceWake = minutesSinceWake / 60;
  const idealMl = (goalMl / totalAwakeHours) * hoursSinceWake;
  return Math.round(Math.max(0, Math.min(goalMl, idealMl)));
}

export { GLASS_ML };
