// Edge Function: rapid-action
// Recebe user_id, busca Perfil + Dieta + Mapa de Lesões no Supabase,
// envia para a API do Gemini e retorna treino mensal + dieta em JSON.

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
};

interface RapidActionBody {
  user_id?: string;
}

interface RapidActionResult {
  ok: boolean;
  error?: string;
  treino_mensal?: unknown;
  dieta?: unknown;
  raw?: string;
}

function jsonResponse(data: RapidActionResult, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request): Promise<Response> => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  let userId: string | null = null;

  try {
    if (req.method === 'GET') {
      const url = new URL(req.url);
      userId = url.searchParams.get('user_id');
    } else if (req.method === 'POST') {
      const body = (await req.json()) as RapidActionBody;
      userId = body?.user_id ?? null;
    }

    if (!userId?.trim()) {
      return jsonResponse({ ok: false, error: 'user_id é obrigatório (body ou query)' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      return jsonResponse({ ok: false, error: 'Configuração do Supabase ausente' }, 500);
    }
    if (!geminiApiKey) {
      return jsonResponse({ ok: false, error: 'GEMINI_API_KEY não configurada' }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1) Perfil (tabela profiles, id = user_id)
    const { data: perfil, error: errPerfil } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (errPerfil) {
      return jsonResponse({
        ok: false,
        error: `Erro ao buscar perfil: ${errPerfil.message}`,
      }, 500);
    }

    // 2) Dieta (tabela dieta, coluna user_id) — se a tabela existir
    let dieta: unknown = null;
    try {
      const { data: dietaData, error: errDieta } = await supabase
        .from('dieta')
        .select('*')
        .eq('user_id', userId);
      if (!errDieta) dieta = dietaData;
    } catch {
      // Tabela dieta pode não existir; continuamos sem ela
    }

    // 3) Mapa de Lesões (tabela mapa_lesoes, coluna user_id) — se existir
    let mapaLesoes: unknown = null;
    try {
      const { data: lesoesData, error: errLesoes } = await supabase
        .from('mapa_lesoes')
        .select('*')
        .eq('user_id', userId);
      if (!errLesoes) mapaLesoes = lesoesData;
    } catch {
      // Tabela mapa_lesoes pode não existir
    }

    const userData = {
      perfil: perfil ?? null,
      dieta,
      mapa_lesoes: mapaLesoes,
    };

    if (!perfil) {
      return jsonResponse({
        ok: false,
        error: 'Perfil não encontrado para este user_id',
      }, 404);
    }

    // 4) Chamar a API do Gemini
    const prompt = `Você é um personal trainer e nutricionista. Com base nos dados do usuário abaixo, gere um plano de treino mensal (4 semanas) e um plano de dieta semanal (replicável para o mês), em português.

Dados do usuário (JSON):
${JSON.stringify(userData, null, 2)}

Responda APENAS com um único objeto JSON válido, sem markdown e sem texto antes ou depois, no seguinte formato:
{
  "treino_mensal": {
    "semanas": [
      {
        "semana": 1,
        "dias": [
          {
            "dia": "Segunda",
            "grupo_muscular": "Peito e Tríceps",
            "exercicios": [ { "nome": "...", "series": 3, "repeticoes": "10-12", "observacao": "" } ],
            "duracao_minutos": 45
          }
        ]
      }
    ]
  },
  "dieta": {
    "calorias_diarias": 0,
    "refeicoes_por_dia": 0,
    "dias_da_semana": [
      {
        "dia": "Segunda",
        "refeicoes": [
          { "refeicao": "Café da manhã", "horario": "07:00", "alimentos": "...", "calorias": 0 }
        ]
      }
    ]
  }
}

Preencha os campos de acordo com o perfil (biotipo, objetivo, calorias), respeitando restrições e lesões do mapa de lesões. Se não houver dados de dieta ou lesões, use apenas o perfil.`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`;
    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      return jsonResponse({
        ok: false,
        error: `Erro na API Gemini: ${geminiRes.status} - ${errText}`,
      }, 502);
    }

    const geminiJson = await geminiRes.json();
    const textPart = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textPart) {
      return jsonResponse({
        ok: false,
        error: 'Resposta da Gemini sem conteúdo',
        raw: JSON.stringify(geminiJson),
      }, 502);
    }

    let parsed: { treino_mensal?: unknown; dieta?: unknown };
    try {
      const cleaned = textPart.replace(/^```json\s*/i, '').replace(/\s*```\s*$/i, '').trim();
      parsed = JSON.parse(cleaned) as { treino_mensal?: unknown; dieta?: unknown };
    } catch {
      return jsonResponse({
        ok: true,
        treino_mensal: null,
        dieta: null,
        raw: textPart,
        error: 'Resposta da IA não é JSON válido; enviada em raw.',
      });
    }

    return jsonResponse({
      ok: true,
      treino_mensal: parsed.treino_mensal ?? null,
      dieta: parsed.dieta ?? null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return jsonResponse({ ok: false, error: message }, 500);
  }
});
