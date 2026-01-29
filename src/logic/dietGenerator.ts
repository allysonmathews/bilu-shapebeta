import type { Meal } from '../types';

/** Converte HH:mm em minutos desde 00:00. */
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Retorna a faixa de horário para nomenclatura (05-10 café, 11-14 almoço, 15-18 lanche, 19-22 jantar, 23-04 ceia). */
function getHourBand(time: string): string {
  const hour = parseInt(time.slice(0, 2), 10);
  if (hour >= 23 || hour <= 4) return 'ceia';
  if (hour >= 5 && hour <= 10) return 'cafe';
  if (hour >= 11 && hour <= 14) return 'almoco';
  if (hour >= 15 && hour <= 18) return 'lanche_tarde';
  if (hour >= 19 && hour <= 22) return 'jantar';
  return 'lanche_tarde';
}

const BAND_LABELS: Record<string, string> = {
  ceia: 'Ceia',
  cafe: 'Café da Manhã',
  almoco: 'Almoço',
  lanche_tarde: 'Lanche da Tarde',
  jantar: 'Jantar',
};

/**
 * Ordena refeições estritamente pela hora (HH:mm).
 * Não altera macros nem alimentos.
 */
export function sortMealsByTime(meals: Meal[]): Meal[] {
  return [...meals].sort((a, b) => a.time.localeCompare(b.time));
}

/**
 * Atribui nomes às refeições por faixa de horário e sequência (sem repetição).
 * 05h-10h: Café da Manhã | 11h-14h: Almoço | 15h-18h: Lanche da Tarde (I/II se houver dois)
 * 19h-22h: Jantar | 23h-04h: Ceia.
 * A refeição imediatamente ANTES da hora de treino → Pré-Treino.
 * A refeição imediatamente APÓS o fim do treino → Pós-Treino.
 * Não altera macros nem alimentos.
 */
export function assignMealNames(
  meals: Meal[],
  workoutTime?: string,
  workoutDurationMinutes?: number
): Meal[] {
  if (meals.length === 0) return meals;

  const workoutMin = workoutTime ? timeToMinutes(workoutTime) : null;
  const workoutEndMin =
    workoutMin != null && workoutDurationMinutes != null
      ? workoutMin + workoutDurationMinutes
      : null;

  // Contar quantas refeições por faixa (para Lanche da Tarde I/II)
  const bandCounts: Record<string, number> = {};
  for (const m of meals) {
    const band = getHourBand(m.time);
    bandCounts[band] = (bandCounts[band] ?? 0) + 1;
  }

  let lancheTardeIndex = 0;
  const withBaseNames = meals.map((meal) => {
    const band = getHourBand(meal.time);
    let name = BAND_LABELS[band];
    if (band === 'lanche_tarde' && bandCounts[band] > 1) {
      const idx = lancheTardeIndex++;
      name = idx === 0 ? 'Lanche da Tarde I' : 'Lanche da Tarde II';
    }
    return { ...meal, name };
  });

  if (workoutMin == null || workoutEndMin == null) return withBaseNames;

  const mealMinutes = withBaseNames.map((m) => timeToMinutes(m.time));

  let preIndex = -1;
  let bestPre = -1;
  for (let i = 0; i < mealMinutes.length; i++) {
    if (mealMinutes[i] < workoutMin && (bestPre === -1 || mealMinutes[i] > mealMinutes[bestPre])) {
      bestPre = i;
    }
  }
  if (bestPre >= 0) preIndex = bestPre;

  let postIndex = -1;
  let bestPost = -1;
  for (let i = 0; i < mealMinutes.length; i++) {
    if (mealMinutes[i] > workoutEndMin && (bestPost === -1 || mealMinutes[i] < mealMinutes[bestPost])) {
      bestPost = i;
    }
  }
  if (bestPost >= 0) postIndex = bestPost;

  return withBaseNames.map((meal, i) => {
    if (i === preIndex) return { ...meal, name: 'Pré-Treino' };
    if (i === postIndex) return { ...meal, name: 'Pós-Treino' };
    return meal;
  });
}

/**
 * Ordena refeições por hora e aplica nomenclatura (faixa + Pré/Pós-Treino).
 * Não altera macros nem alimentos.
 */
export function processMealsForDay(
  meals: Meal[],
  workoutTime?: string,
  workoutDurationMinutes?: number
): Meal[] {
  const sorted = sortMealsByTime(meals);
  return assignMealNames(sorted, workoutTime, workoutDurationMinutes);
}
