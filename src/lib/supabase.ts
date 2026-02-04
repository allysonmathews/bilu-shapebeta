import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { SupportedStorage } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('[Supabase] VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY devem estar definidos no .env');
}

/** Opções do cookie de autenticação (compartilhado entre subdomínios de bilushape.com). */
const cookieOptions = {
  domain: '.bilushape.com',
  path: '/',
  maxAge: 60 * 60 * 24 * 7, // 7 dias
  sameSite: 'lax' as const,
  secure: true,
};

function createCookieStorage(opts: typeof cookieOptions): SupportedStorage {
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return {
    getItem: (key: string) => {
      if (typeof document === 'undefined') return null;
      const match = document.cookie.match(new RegExp('(?:^|; )' + escape(key) + '=([^;]*)'));
      return Promise.resolve(match ? decodeURIComponent(match[1]) : null);
    },
    setItem: (key: string, value: string) => {
      if (typeof document === 'undefined') return Promise.resolve();
      const parts = [
        `${key}=${encodeURIComponent(value)}`,
        `path=${opts.path}`,
        `domain=${opts.domain}`,
        `max-age=${opts.maxAge}`,
        `SameSite=${opts.sameSite}`,
      ];
      if (opts.secure) parts.push('Secure');
      document.cookie = parts.join('; ');
      return Promise.resolve();
    },
    removeItem: (key: string) => {
      if (typeof document === 'undefined') return Promise.resolve();
      document.cookie = [
        `${key}=`,
        `path=${opts.path}`,
        `domain=${opts.domain}`,
        'max-age=0',
      ].join('; ');
      return Promise.resolve();
    },
  };
}

const isBilushapeDomain =
  typeof window !== 'undefined' && /\.?bilushape\.com$/i.test(window.location.hostname);

/** Cliente Supabase (anon key para uso no frontend). Em bilushape.com usa cookies com domain .bilushape.com para sessão em todos os subdomínios. */
export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: isBilushapeDomain ? createCookieStorage(cookieOptions) : undefined,
    storageKey: `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/** Dados do perfil para enviar ao Supabase (Nome, E-mail, Biotipo, Objetivo, Calorias). */
export interface ProfilePayload {
  name?: string;
  email?: string;
  biotype: string;
  objective: string;
  calories: number;
}

/** Perfil retornado do Supabase (para verificar se usuário já é aluno). id = UUID do usuário logado (Auth). */
export interface ProfileRow {
  id: string;
  name: string | null;
  email: string | null;
  biotype: string;
  objective: string;
  calories: number;
  created_at?: string;
  updated_at?: string;
}

/**
 * Busca perfil na tabela profiles pelo ID do usuário logado (id = userId do Auth).
 */
export async function getProfileByUserId(userId: string): Promise<ProfileRow | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, email, biotype, objective, calories, created_at, updated_at')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.warn('[Supabase] Erro ao buscar perfil:', error.message);
      return null;
    }
    return data as ProfileRow | null;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn('[Supabase] Exceção ao buscar perfil:', message);
    return null;
  }
}

/**
 * Salva ou atualiza o perfil do usuário no Supabase.
 * Usa o user.id do Auth (UUID) como id do perfil — única forma de identificar o perfil.
 */
export async function saveProfileToSupabase(
  payload: ProfilePayload,
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const now = new Date().toISOString();

    const row = {
      id: userId,
      name: payload.name ?? '',
      email: payload.email ?? '',
      biotype: payload.biotype,
      objective: payload.objective,
      calories: payload.calories,
      updated_at: now,
    };

    const { error } = await supabase.from('profiles').upsert(row, {
      onConflict: 'id',
      ignoreDuplicates: false,
    });

    if (error) {
      console.log('[Supabase] Perfil salvo: erro', error.message);
      return { ok: false, error: error.message };
    }
    console.log('[Supabase] Perfil salvo: sucesso');
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.log('[Supabase] Perfil salvo: erro', message);
    return { ok: false, error: message };
  }
}

/**
 * Salva um log de treino na nuvem (workout_history).
 * Payload: user_id, exercise_name (obrigatório), exercise_id, weight, workout_date.
 */
export async function saveWorkoutLog(
  exerciseName: string,
  weight: number,
  workoutDate: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) {
      return { ok: false, error: 'Usuário não logado' };
    }

    const name = String(exerciseName ?? '').trim() || 'Exercício';
    const row = {
      user_id: session.user.id,
      exercise_name: name,
      exercise_id: name,
      weight,
      workout_date: workoutDate,
    };

    const { error } = await supabase.from('workout_history').insert(row);

    if (error) {
      console.warn('[Supabase] workout_history: erro', error.message);
      return { ok: false, error: error.message };
    }
    console.log('Treino salvo na nuvem!');
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn('[Supabase] workout_history: exceção', message);
    return { ok: false, error: message };
  }
}

/** Uma entrada do diário alimentar (prato salvo). */
export interface DietJournalRow {
  id: string;
  user_id: string;
  log_date: string;
  calorias: number;
  proteina: number;
  carbo: number;
  gordura: number;
  descricao: string | null;
  created_at?: string;
}

/** Payload para salvar uma entrada no diário alimentar. */
export interface DietJournalPayload {
  log_date: string;
  calorias: number;
  proteina: number;
  carbo: number;
  gordura: number;
  descricao?: string;
}

/**
 * Salva uma entrada no diário alimentar (diet_journal) no Supabase.
 * Usado quando o usuário salva um prato analisado pela IA no Diário.
 */
export async function saveDietJournalEntry(
  payload: DietJournalPayload
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) {
      return { ok: false, error: 'Usuário não logado' };
    }

    const row = {
      user_id: session.user.id,
      log_date: payload.log_date,
      calorias: payload.calorias,
      proteina: payload.proteina,
      carbo: payload.carbo,
      gordura: payload.gordura,
      descricao: payload.descricao ?? null,
    };

    const { error } = await supabase.from('diet_journal').insert(row);

    if (error) {
      console.warn('[Supabase] diet_journal: erro', error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn('[Supabase] diet_journal: exceção', message);
    return { ok: false, error: message };
  }
}

/** Perfil retornado pelo pre-cadastro (weight, height, goal, etc.). Inclui colunas de rotina do banco (snake_case ou camelCase). */
export interface PreCadastroProfileRow {
  id: string;
  weight?: number;
  height?: number;
  age?: number;
  biotype?: string;
  goal?: string;
  objective?: string;
  days_per_week?: number;
  workout_location?: string;
  injuries?: string[];
  name?: string | null;
  email?: string | null;
  calories?: number;
  gender?: string | null;
  /** Refeições por dia (coluna meals_per_day no banco). */
  meals_per_day?: number;
  /** Horário que acorda, formato "HH:mm" (coluna wake_up_time no banco; pode vir como wakeTime em migrações antigas). */
  wake_up_time?: string | null;
  sleep_time?: string | null;
  workout_time?: string | null;
  wakeTime?: string | null;
  sleepTime?: string | null;
  workoutTime?: string | null;
  /** Duração do treino em minutos (coluna workout_duration no banco). */
  workout_duration?: number | null;
  /** Alergias ou aversões alimentares (coluna allergies no banco). */
  allergies?: string[] | null;
}

/**
 * Busca perfil completo na tabela profiles (inclui campos do pre-cadastro).
 */
export async function getPreCadastroProfile(userId: string): Promise<PreCadastroProfileRow | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('[Supabase] Erro ao buscar perfil (getPreCadastroProfile):', error.message, 'code:', error.code, 'details:', error.details);
      return null;
    }
    return data as PreCadastroProfileRow | null;
  } catch (e) {
    console.error('[Supabase] Exceção ao buscar perfil (getPreCadastroProfile):', e);
    if (e instanceof Error) {
      console.error('[Supabase] Mensagem:', e.message, 'Stack:', e.stack);
    }
    return null;
  }
}

/**
 * Busca entradas do diário alimentar para um usuário e intervalo de datas.
 * Usado para popular o Diário e para gráficos de consumo.
 */
export async function getDietJournalEntries(
  userId: string,
  dateFrom: string,
  dateTo: string
): Promise<DietJournalRow[]> {
  try {
    const { data, error } = await supabase
      .from('diet_journal')
      .select('id, user_id, log_date, calorias, proteina, carbo, gordura, descricao, created_at')
      .eq('user_id', userId)
      .gte('log_date', dateFrom)
      .lte('log_date', dateTo)
      .order('log_date', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('[Supabase] getDietJournalEntries: erro', error.message);
      return [];
    }
    return (data as DietJournalRow[]) ?? [];
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn('[Supabase] getDietJournalEntries: exceção', message);
    return [];
  }
}

/** Registro de consumo de água do dia (daily_water). */
export interface DailyWaterRow {
  user_id: string;
  log_date: string;
  consumed_ml: number;
  daily_goal_ml?: number;
}

/**
 * Busca o consumed_ml do usuário para a data (hoje). Retorna 0 se não houver registro.
 */
export async function getDailyWaterConsumedMl(userId: string, logDate: string): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('daily_water')
      .select('consumed_ml')
      .eq('user_id', userId)
      .eq('log_date', logDate)
      .maybeSingle();

    if (error) {
      console.warn('[Supabase] getDailyWaterConsumedMl: erro', error.message);
      return 0;
    }
    const row = data as DailyWaterRow | null;
    const ml = row?.consumed_ml;
    return ml != null && Number.isFinite(Number(ml)) ? Math.max(0, Math.round(Number(ml))) : 0;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn('[Supabase] getDailyWaterConsumedMl: exceção', message);
    return 0;
  }
}

/**
 * Upsert do consumed_ml para o usuário na data. Inclui daily_goal_ml para não violar integridade.
 * Dispare em cada clique em '+' ou '-'. updated_at é gerenciado pelo banco.
 */
/** Registro de notificação (tabela notifications). */
export interface NotificationRow {
  id: string;
  user_id: string;
  title: string;
  message: string | null;
  is_read: boolean;
  created_at?: string;
}

/**
 * Busca notificações do usuário logado, ordenadas por data (mais recentes primeiro).
 */
export async function getNotifications(userId: string): Promise<NotificationRow[]> {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('id, user_id, title, message, is_read, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[Supabase] getNotifications: erro', error.message);
      return [];
    }
    return (data as NotificationRow[]) ?? [];
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn('[Supabase] getNotifications: exceção', message);
    return [];
  }
}

/**
 * Marca uma notificação como lida (is_read = true).
 */
export async function markNotificationAsRead(
  notificationId: string,
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .eq('user_id', userId);

    if (error) {
      console.warn('[Supabase] markNotificationAsRead: erro', error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn('[Supabase] markNotificationAsRead: exceção', message);
    return { ok: false, error: message };
  }
}

/** Registro de refeição concluída (tabela completed_meals). */
export interface CompletedMealRow {
  user_id: string;
  log_date: string;
  meal_time: string;
  meal_id?: string | null;
  completed_at?: string;
}

/**
 * Marca uma refeição como concluída ou remove a marcação (toggle).
 * meal_time: horário HH:mm (ex: "07:00"); meal_id: id do plano (opcional).
 */
export async function upsertCompletedMeal(
  userId: string,
  logDate: string,
  mealTime: string,
  mealId?: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const row = {
      user_id: userId,
      log_date: logDate,
      meal_time: mealTime,
      meal_id: mealId ?? null,
    };
    const { error } = await supabase.from('completed_meals').upsert(row, {
      onConflict: 'user_id,log_date,meal_time',
      ignoreDuplicates: false,
    });
    if (error) {
      console.warn('[Supabase] upsertCompletedMeal: erro', error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn('[Supabase] upsertCompletedMeal: exceção', message);
    return { ok: false, error: message };
  }
}

/**
 * Remove marcação de refeição concluída.
 */
export async function removeCompletedMeal(
  userId: string,
  logDate: string,
  mealTime: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('completed_meals')
      .delete()
      .eq('user_id', userId)
      .eq('log_date', logDate)
      .eq('meal_time', mealTime);
    if (error) {
      console.warn('[Supabase] removeCompletedMeal: erro', error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn('[Supabase] removeCompletedMeal: exceção', message);
    return { ok: false, error: message };
  }
}

/**
 * Busca refeições concluídas do usuário para uma data (retorna Set de meal_time).
 */
export async function getCompletedMealsForDate(
  userId: string,
  logDate: string
): Promise<Set<string>> {
  try {
    const { data, error } = await supabase
      .from('completed_meals')
      .select('meal_time')
      .eq('user_id', userId)
      .eq('log_date', logDate);
    if (error) {
      console.warn('[Supabase] getCompletedMealsForDate: erro', error.message);
      return new Set();
    }
    const rows = (data as { meal_time: string }[]) ?? [];
    return new Set(rows.map((r) => r.meal_time));
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn('[Supabase] getCompletedMealsForDate: exceção', message);
    return new Set();
  }
}

export async function upsertDailyWater(
  userId: string,
  logDate: string,
  consumed_ml: number,
  daily_goal_ml: number
): Promise<{ ok: boolean; error?: string }> {
  try {
    const consumed = Math.max(0, Math.round(Number(consumed_ml)) || 0);
    const goal = Math.max(0, Math.round(Number(daily_goal_ml)) || 2000);
    const row = {
      user_id: userId,
      log_date: logDate,
      consumed_ml: consumed,
      daily_goal_ml: goal,
    };

    const { error } = await supabase.from('daily_water').upsert(row, {
      onConflict: 'user_id,log_date',
      ignoreDuplicates: false,
    });

    if (error) {
      console.warn('[Supabase] upsertDailyWater: erro', error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn('[Supabase] upsertDailyWater: exceção', message);
    return { ok: false, error: message };
  }
}
