import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ukykvrqnwmvwhfjhsamy.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_fUN44y_IwArfw7L3wk3h3g_snErBzrY';

/** Cliente Supabase (anon key para uso no frontend). */
export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/** Chave no localStorage para identificar o mesmo usuário/dispositivo na nuvem. */
const CLIENT_ID_KEY = 'bilu_supabase_client_id';

/** Gera ou recupera um ID único do cliente para upsert no Supabase. */
function getOrCreateClientId(): string {
  let id = typeof localStorage !== 'undefined' ? localStorage.getItem(CLIENT_ID_KEY) : null;
  if (!id) {
    id = `bilu_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    try {
      localStorage.setItem(CLIENT_ID_KEY, id);
    } catch {
      // ignore
    }
  }
  return id;
}

/** Dados do perfil para enviar ao Supabase (Nome, Biotipo, Objetivo, Calorias). */
export interface ProfilePayload {
  name?: string;
  biotype: string;
  objective: string;
  calories: number;
}

/** Perfil retornado do Supabase (para verificar se usuário já é aluno). */
export interface ProfileRow {
  id: string;
  client_id: string;
  name: string | null;
  biotype: string;
  objective: string;
  calories: number;
  created_at?: string;
  updated_at?: string;
}

/**
 * Busca perfil na tabela profiles pelo ID do usuário logado (client_id = userId do Auth).
 * Usado para saber se o usuário já concluiu onboarding em outro dispositivo.
 */
export async function getProfileByUserId(userId: string): Promise<ProfileRow | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, client_id, name, biotype, objective, calories, created_at, updated_at')
      .eq('client_id', userId)
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
 * Se userId (Auth) for passado, usa como client_id (um perfil por usuário logado).
 * Caso contrário usa client_id do localStorage (dispositivo).
 */
export async function saveProfileToSupabase(
  payload: ProfilePayload,
  userId?: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const clientId = userId ?? getOrCreateClientId();
    const now = new Date().toISOString();

    const row = {
      client_id: clientId,
      name: payload.name ?? '',
      biotype: payload.biotype,
      objective: payload.objective,
      calories: payload.calories,
      updated_at: now,
    };

    const { error } = await supabase.from('profiles').upsert(row, {
      onConflict: 'client_id',
      ignoreDuplicates: false,
    });

    if (error) {
      console.warn('[Supabase] Erro ao salvar perfil:', error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn('[Supabase] Exceção ao salvar perfil:', message);
    return { ok: false, error: message };
  }
}
