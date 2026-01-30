import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ukykvrqnwmvwhfjhsamy.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_fUN44y_IwArfw7L3wk3h3g_snErBzrY';

/** Cliente Supabase (anon key para uso no frontend). */
export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
