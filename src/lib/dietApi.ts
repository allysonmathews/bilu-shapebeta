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

/** Converte refeicoes da API para Meal[] no formato interno. Usa titulo (ou titulo_refeicao) e alimentos (ou lista_alimentos_com_quantidade). */
function mapDietResponseToMeals(diet: DietApiResponse): Meal[] {
  const meals = (diet.refeicoes ?? []).map((r, idx) => {
    const titulo = r.titulo ?? r.titulo_refeicao ?? 'Refeição';
    const alimentosRaw = r.alimentos ?? (r.lista_alimentos_com_quantidade ?? []).map((a) => ({
      nome: (a as { alimento?: string; nome?: string }).alimento ?? (a as { alimento?: string; nome?: string }).nome ?? '',
      quantidade: a.quantidade,
      calorias: a.calorias,
      proteina: a.proteina,
      carboidratos: a.carboidratos,
      gorduras: a.gorduras,
    }));
    const foods = alimentosRaw.map((a, foodIdx) => ({
      id: `ai-${idx}-${foodIdx}-${(a.nome || '').replace(/\s/g, '-').toLowerCase().slice(0, 30)}`,
      name: a.nome ? `${a.nome} (${a.quantidade})` : a.quantidade,
      quantity: 1,
      calories: a.calorias ?? 0,
      protein: a.proteina ?? 0,
      carbs: a.carboidratos ?? 0,
      fat: a.gorduras ?? 0,
    }));
    const macros = r.macros_da_ref ?? { calorias: 0, proteina: 0, carboidratos: 0, gorduras: 0 };
    const totalCalories = foods.reduce((s, f) => s + f.calories, 0) || macros.calorias;
    const totalProtein = foods.reduce((s, f) => s + f.protein, 0) || macros.proteina;
    const totalCarbs = foods.reduce((s, f) => s + f.carbs, 0) || macros.carboidratos;
    const totalFat = foods.reduce((s, f) => s + f.fat, 0) || macros.gorduras;
    return {
      id: `meal-ai-${idx}-${(r.horario || '').replace(':', '')}`,
      name: titulo,
      time: r.horario ?? '--:--',
      foods,
      totalCalories,
      totalProtein,
      totalCarbs,
      totalFat,
    };
  });
  return meals;
}

/** Converte DietApiResponse em FourWeekPlan (1 dia repetido para 7 dias x 4 semanas). Usa refeicao.titulo -> name, refeicao.alimentos -> foods. */
export function mapDietToFourWeekPlan(diet: DietApiResponse): FourWeekPlan {
  const meals = mapDietResponseToMeals(diet);
  const meta = diet.resumo_metabolico ?? { meta_calorias: 0, meta_proteina: 0, meta_carboidratos: 0, meta_gorduras: 0 };

  if (typeof console !== 'undefined' && console.table && meals.length > 0) {
    console.table(meals.map((m) => ({ refeicao: m.name, horario: m.time, alimentos: m.foods?.length ?? 0, nomes: m.foods?.map((f) => f.name).join('; ') ?? '' })));
  }

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
      lista_compras: diet.lista_compras ?? [],
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
