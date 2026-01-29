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

/**
 * Salva ou atualiza o perfil do usuário no Supabase.
 * Usa client_id (localStorage) para identificar o mesmo dispositivo; não remove dados locais.
 * Tabela esperada: profiles (id uuid, client_id text unique, name text, biotype text, objective text, calories int, created_at, updated_at).
 */
export async function saveProfileToSupabase(payload: ProfilePayload): Promise<{ ok: boolean; error?: string }> {
  try {
    const clientId = getOrCreateClientId();
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
