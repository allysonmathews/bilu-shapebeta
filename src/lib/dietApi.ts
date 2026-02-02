import type { DietApiResponse } from '../types';
import type { FourWeekPlan, Meal, DailyMeals } from '../types';

const DIET_API_URL =
  (import.meta.env.VITE_DIET_API_URL as string | undefined) ?? '/api/diet';

/** Payload enviado para a API de dieta. */
export interface DietProfilePayload {
  weight: number;
  height: number;
  age: number;
  gender?: string;
  biotype?: string;
  objective?: string;
  workout_time?: string;
  workout_duration?: number;
  wake_up_time?: string;
  sleep_time?: string;
  meals_per_day?: number;
  allergies?: string[];
}

/** Converte refeicoes da API para Meal[] no formato interno. */
function mapDietResponseToMeals(diet: DietApiResponse): Meal[] {
  return diet.refeicoes.map((r, idx) => {
    const foods = r.lista_alimentos_com_quantidade.map((a, foodIdx) => ({
      id: `ai-${idx}-${foodIdx}-${a.alimento.replace(/\s/g, '-').toLowerCase()}`,
      name: `${a.alimento} (${a.quantidade})`,
      quantity: 1,
      calories: a.calorias,
      protein: a.proteina,
      carbs: a.carboidratos,
      fat: a.gorduras,
    }));

    const macros = r.macros_da_ref;

    return {
      id: `meal-ai-${idx}-${r.horario.replace(':', '')}`,
      name: r.titulo_refeicao,
      time: r.horario,
      foods,
      totalCalories: macros.calorias,
      totalProtein: macros.proteina,
      totalCarbs: macros.carboidratos,
      totalFat: macros.gorduras,
    };
  });
}

/** Converte DietApiResponse em FourWeekPlan (1 dia repetido para 7 dias x 4 semanas). */
export function mapDietToFourWeekPlan(diet: DietApiResponse): FourWeekPlan {
  const meals = mapDietResponseToMeals(diet);
  const meta = diet.resumo_metabolico;

  const dailyMeals: DailyMeals = {
    monday: meals,
    tuesday: meals,
    wednesday: meals,
    thursday: meals,
    friday: meals,
    saturday: meals,
    sunday: meals,
  };

  const allMeals: Meal[] = [...meals];
  const totalCalories = meta.meta_calorias;
  const totalProtein = meta.meta_proteina;
  const totalCarbs = meta.meta_carboidratos;
  const totalFat = meta.meta_gorduras;

  const weeks = Array.from({ length: 4 }, (_, i) => ({
    week: i + 1,
    meals: allMeals,
    dailyMeals,
    workouts: [],
    totalCalories,
    totalProtein,
    totalCarbs,
    totalFat,
  }));

  return {
    weeks,
    startDate: new Date().toISOString(),
    dietaApi: {
      resumo_metabolico: diet.resumo_metabolico,
      lista_compras: diet.lista_compras,
    },
  };
}

/** Chama a API de dieta e retorna FourWeekPlan (sem treinos). */
export async function fetchDietFromApi(
  profile: DietProfilePayload,
  accessToken?: string | null
): Promise<{ ok: true; plan: FourWeekPlan } | { ok: false; error: string }> {
  try {
    const res = await fetch(DIET_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
      },
      body: JSON.stringify({ profile }),
    });

    const data = await res.json();

    if (!res.ok) {
      const msg = (data?.error as string) ?? `Erro ${res.status}`;
      return { ok: false, error: msg };
    }

    const diet = data.diet as DietApiResponse;

    if (!diet?.refeicoes || !Array.isArray(diet.refeicoes)) {
      return { ok: false, error: 'Resposta inválida da API de dieta.' };
    }

    const plan = mapDietToFourWeekPlan(diet);
    return { ok: true, plan };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro ao conectar com a API de dieta.';
    return { ok: false, error: msg };
  }
}
