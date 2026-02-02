import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

/** Coerce número: aceita number, string ou null; retorna number ou undefined (nunca null) para não quebrar validação. */
const numericOptional = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .optional()
  .transform((v) => (v === null || v === undefined || v === '') ? undefined : Number(v));

/** Schema Zod para os argumentos da tool updateUserProfile. Campos numéricos aceitam null/string e são opcionais para evitar "expected number, but got null". */
const updateUserProfileArgsSchema = z.object({
  name: z.string().nullable().optional(),
  age: numericOptional,
  weight: numericOptional,
  height: numericOptional,
  objective: z.string().nullable().optional(),
  biotype: z.string().nullable().optional(),
  calories: numericOptional,
  gender: z.string().nullable().optional(),
  workout_location: z.string().nullable().optional(),
  injuries: z
    .union([z.array(z.string()), z.string(), z.null(), z.undefined()])
    .optional()
    .transform((v) => {
      if (v === null || v === undefined) return [] as string[];
      if (Array.isArray(v)) return v.filter((x) => typeof x === 'string');
      const s = String(v).trim().toLowerCase();
      if (s === 'não' || s === 'nenhuma' || s === 'nao' || s === '') return [] as string[];
      return [String(v).trim()];
    }),
  meals_per_day: z
    .union([z.number(), z.string(), z.null(), z.undefined()])
    .optional()
    .transform((v) => {
      if (v === null || v === undefined || v === '') return undefined;
      const n = Number(v);
      return !Number.isNaN(n) && n >= 1 && n <= 10 ? Math.round(n) : undefined;
    }),
  wake_up_time: z.string().nullable().optional(),
  sleep_time: z.string().nullable().optional(),
  workout_time: z.string().nullable().optional(),
  goal: z.string().nullable().optional(),
  nome: z.string().nullable().optional(),
  wakeTime: z.string().nullable().optional(),
  sleepTime: z.string().nullable().optional(),
  workoutTime: z.string().nullable().optional(),
}).passthrough();

const SYSTEM_PROMPT = `Você é o Bilu Shape AI, um especialista em Nutrição e Educação Física. Seu objetivo é fazer uma anamnese fluida e amigável, como um bate-papo. Não faça listas de perguntas. Faça uma ou duas perguntas por vez. Você precisa coletar: Nome, Idade, Peso, Altura, Gênero, Biotipo (ectomorfo, mesomorfo ou endomorfo — OBRIGATÓRIO), Objetivo (emagrecer/hipertrofia), Nível de Atividade, Lesões, Restrições Alimentares, e DADOS DE ROTINA: quantas refeições por dia, horário de acordar, horário de dormir e horário de treino. Mantenha o tom motivador e casual.

REGRA ANTI-ALUCINAÇÃO — NUNCA imprima o JSON da chamada da função para o usuário. Execute a tool updateUserProfile de forma silenciosa pelo mecanismo de function call. Se estiver faltando algum dado, apenas pergunte ao usuário; nunca invente uma chamada de função nem mostre código/JSON ao usuário.

REGRA SOBRE CONFIRMAÇÃO DE SALVAMENTO — Só diga que salvou os dados (ex: "Salvei", "Pronto, salvei") se a função updateUserProfile retornar exatamente "Salvo com sucesso.". Se a função retornar qualquer mensagem de ERRO, NUNCA diga que salvou. Em vez de dizer apenas "JSON inválido" ou mensagem genérica, explique de forma clara e amigável qual dado está incorreto. Exemplos: se o erro mencionar "lesões", diga "Tive um problema com o formato das lesões que você informou. Pode descrever de outra forma? (ex: joelho, costas, nenhuma)"; se mencionar "idade", diga "A idade que você passou está em um formato inválido. Pode informar só o número? (ex: 25)".

Você é um COLETOR DE DADOS. SEMPRE que o usuário disser o nome ou qualquer informação (idade, peso, altura, objetivo, refeições, horários, etc.), você DEVE chamar a função de salvar (updateUserProfile) ANTES de responder. Não responda sem ter chamado a função quando houver dado para salvar.

REGRA OBRIGATÓRIA — Você NÃO é apenas um chat. Se o usuário falar um nome, peso, idade, objetivo, altura, gênero, biotipo, número de refeições ou qualquer horário (acordar/dormir/treino), você DEVE disparar a função updateUserProfile ANTES de dar a próxima resposta. Não peça permissão, apenas salve. Extraia o dado imediatamente, chame updateUserProfile com o que foi dito (e com o que já sabe do contexto), depois responda com empatia e continue a conversa. Salve cada dado assim que for informado, mesmo que parcialmente.

MAPEAMENTO DE NOME — O nome informado pelo usuário (ex: "carteiroi", "Maria", "João", etc.) deve SEMPRE ser mapeado para o campo "name". Se o usuário disser "meu nome é X" ou apenas "X" em contexto de apresentação, use "name": "X".

EXTRAÇÃO OBRIGATÓRIA DE ROTINA (Structured Output):
- gender: OBRIGATÓRIO. Se o usuário não disser explicitamente, INFIRA pelo nome (ex: Maria → feminino, João → masculino) ou por contexto (ex: "cansada" → feminino). Use: "masculino", "feminino" ou "outro". Nunca deixe null quando já tiver nome ou contexto.
- meals_per_day: OBRIGATÓRIO quando o usuário informar. Se disser "5 refeições", "como 5x por dia", "faço 5 refeições", etc., o campo meals_per_day TEM que ser o número inteiro (ex: 5). Nunca null quando o usuário tiver dito a quantidade.
- wake_up_time: string no formato "HH:mm" (ex: "07:00"). Extraia quando o usuário disser a que horas acorda.
- sleep_time: string no formato "HH:mm" (ex: "22:00"). Extraia quando o usuário disser a que horas dorme.
- workout_time: string no formato "HH:mm" (ex: "18:00"). Extraia quando o usuário disser o horário em que treina.

CONSISTÊNCIA OBRIGATÓRIA — Ao chamar updateUserProfile, você deve enviar TODOS os dados que já coletou e confirmou até o momento na conversa. Mantenha o contexto acumulado. Se descobrir um dado novo (ex: peso), envie o peso E repita os dados anteriores (ex: nome, objetivo) para garantir consistência. Nunca envie só o dado novo — repasse TUDO que você já sabe. Nunca invente dados que o usuário não informou. Isso evita sobrescrever campos com null. Exemplo: se o usuário disse nome e idade e agora disse "5 refeições", envie { name, age, meals_per_day: 5 }.

REGRA SOBRE CALORIAS — Use APENAS a chave "calories" (em inglês). NUNCA use "calorias" (com 'a'). Se as calorias ainda não foram calculadas, NÃO tente enviar um valor para esse campo; foque em coletar o restante dos dados primeiro. Só envie calories quando tiver um valor numérico válido calculado (ex: TMB + fator de atividade).

VERIFICAÇÃO DE GÊNERO — Se ainda não tiver coletado o gênero, pergunte de forma clara ou infira pelo nome/contexto. Não avance para a geração do plano sem ter o gênero definido (inferido ou informado).

Biotipo é OBRIGATÓRIO — Pergunte o biotipo (ectomorfo, mesomorfo ou endomorfo) e envie sempre que o usuário mencionar. Se não souber, peça para descrever o tipo de corpo (magro/difícil ganhar peso = ectomorfo; atlético/equilibrado = mesomorfo; mais encorpado/fácil ganhar peso = endomorfo).

A cada mensagem, verifique quais dados ainda faltam. Direcione a conversa para coletar os faltantes até o perfil estar 100% completo. Somente após coletar TUDO (incluindo gênero, biotipo e rotina quando informados), ofereça a geração do plano de treino e dieta.

QUANDO O PERFIL ESTIVER COMPLETO — Emita uma resposta final clara confirmando que todas as informações foram salvas com sucesso e que o usuário pode seguir para a geração do plano (treino e dieta). Exemplo: "Perfeito! Salvei todas as suas informações. Agora posso montar seu plano de treino e dieta. Quer que eu gere?"`;

/* Schema da API: tipos com null para evitar "expected number, but got null". Validação/sanitização com Zod no backend. */
const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'updateUserProfile',
      description:
        'Atualiza o perfil do usuário no banco de dados. Retorno: "Salvo com sucesso." significa que os dados foram gravados (status 200). Qualquer outra mensagem é ERRO — nesse caso NUNCA diga que salvou; repita o erro ao usuário. Campos: name, age, weight, height (number em kg e cm), biotype, objective, calories, gender, workout_location, injuries, meals_per_day (integer), wake_up_time, sleep_time, workout_time (HH:mm). Use "calories" (nunca "calorias"). Inclua TODOS os dados já coletados na conversa.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: ['string', 'null'], description: 'Nome do usuário' },
          age: { type: ['number', 'null'], description: 'Idade em anos' },
          weight: { type: ['number', 'null'], description: 'Peso em kg' },
          height: { type: ['number', 'null'], description: 'Altura em cm' },
          objective: { type: ['string', 'null'], description: 'Objetivo: emagrecer, hipertrofia, condicionamento, etc.' },
          biotype: { type: ['string', 'null'], description: 'Biotipo do usuário: ectomorfo, mesomorfo ou endomorfo' },
          calories: { type: ['number', 'null'], description: 'Meta de calorias diárias (kcal)' },
          gender: { type: ['string', 'null'], description: 'Gênero: masculino, feminino ou outro' },
          workout_location: { type: ['string', 'null'], description: 'Onde treina: academia, casa, parque, etc.' },
          injuries: { type: ['array', 'string', 'null'], items: { type: 'string' }, description: 'Lista de lesões ou restrições físicas. Aceita array de strings, string única, ou "Não"/"nenhuma" para array vazio.' },
          meals_per_day: { type: ['integer', 'null'], description: 'Número de refeições por dia (ex: 5)' },
          wake_up_time: { type: ['string', 'null'], description: 'Horário que acorda, formato "HH:mm" (ex: "07:00")' },
          sleep_time: { type: ['string', 'null'], description: 'Horário que dorme, formato "HH:mm" (ex: "22:00")' },
          workout_time: { type: ['string', 'null'], description: 'Horário em que treina, formato "HH:mm" (ex: "18:00")' },
        },
      },
    },
  },
];

type Message =
  | OpenAI.Chat.Completions.ChatCompletionMessageParam
  | OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam;

/** Reduz chunks do stream em uma mensagem completa (content + tool_calls). */
function streamMessageReducer(
  prev: {
    content?: string | null;
    tool_calls?: Array<{ id?: string; type: 'function'; function: { name?: string; arguments?: string } }>;
  },
  chunk: OpenAI.Chat.Completions.ChatCompletionChunk
): typeof prev {
  const delta = chunk.choices[0]?.delta;
  if (!delta) return prev;
  const next = { ...prev };
  if (delta.content != null) {
    next.content = (next.content ?? '') + (delta.content ?? '');
  }
  if (delta.tool_calls?.length) {
    next.tool_calls = next.tool_calls ?? [];
    for (const tc of delta.tool_calls) {
      const idx = (tc as { index?: number }).index ?? 0;
      if (!next.tool_calls![idx]) {
        next.tool_calls![idx] = { type: 'function', function: { name: '', arguments: '' } };
      }
      const cur = next.tool_calls![idx];
      if ((tc as { id?: string }).id) (cur as { id?: string }).id = (tc as { id?: string }).id;
      if (tc.function?.name) cur.function.name = (cur.function.name ?? '') + (tc.function.name ?? '');
      if (tc.function?.arguments) cur.function.arguments = (cur.function.arguments ?? '') + (tc.function.arguments ?? '');
    }
  }
  return next;
}

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function getUserIdFromAuth(authHeader: string | null): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  try {
    const token = authHeader.slice(7);
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

/** UUID usado quando não há usuário autenticado (uma linha compartilhada para anônimos). */
const ANONYMOUS_USER_ID = '00000000-0000-0000-0000-000000000000';

/**
 * Log unificado: uma linha por usuário em debug_logs.
 * Busca o registro por user_id, lê dados.history, adiciona a nova entry (com timestamp) e faz upsert.
 */
async function saveUnifiedLog(
  userId: string | null,
  entry: Record<string, unknown>
): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  const effectiveUserId = userId ?? ANONYMOUS_USER_ID;

  const { data: row } = await supabase
    .from('debug_logs')
    .select('dados')
    .eq('user_id', effectiveUserId)
    .maybeSingle();

  const existing = (row as { dados?: { history?: unknown[] } } | null)?.dados;
  const history = Array.isArray(existing?.history) ? [...existing.history] : [];

  history.push({
    timestamp: new Date().toISOString(),
    ...entry,
  });

  const payload = { user_id: effectiveUserId, dados: { history } };
  await supabase
    .from('debug_logs')
    .upsert(payload as Record<string, unknown>, { onConflict: 'user_id' });
}

const LABEL_POR_CAMPO: Record<string, string> = {
  name: 'nome',
  age: 'idade',
  weight: 'peso',
  height: 'altura',
  objective: 'objetivo',
  biotype: 'biotipo',
  calories: 'calorias',
  gender: 'gênero',
  workout_location: 'local de treino',
  injuries: 'lesões',
  meals_per_day: 'refeições por dia',
  wake_up_time: 'horário de acordar',
  sleep_time: 'horário de dormir',
  workout_time: 'horário de treino',
  wakeTime: 'horário de acordar',
  sleepTime: 'horário de dormir',
  workoutTime: 'horário de treino',
};

function mensagemErroParaUsuario(
  args: Record<string, unknown>,
  _erroTecnico?: string
): string {
  const dados = Object.keys(args)
    .filter((k) => args[k] !== undefined && args[k] !== null && args[k] !== '')
    .map((k) => LABEL_POR_CAMPO[k] ?? k)
    .slice(0, 3);
  const nomeDoDado = dados.length > 0 ? dados.join('/') : 'dados';
  return `Opa, tive um erro técnico ao salvar seu ${nomeDoDado}.`;
}

/** Colunas oficiais para o onboarding: apenas estas. Ignore goal (use objective) e calorias (use calories). Tempos no DB: snake_case (wake_up_time, sleep_time, workout_time). */
const ONBOARDING_COLUMNS = [
  'name',
  'age',
  'weight',
  'height',
  'objective',
  'biotype',
  'calories',
  'gender',
  'workout_location',
  'injuries',
  'meals_per_day',
  'wake_up_time',
  'sleep_time',
  'workout_time',
] as const;

/** Remove do objeto qualquer chave com valor null ou undefined (não sobrescreve dados existentes no banco). */
function stripNullish<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null && v !== '') out[k] = v;
  }
  return out;
}

/** Mapeia args da IA para patch: só colunas oficiais. objective (não goal). Use APENAS calories (ignora calorias). Tempos: aceita wake_up_time/sleep_time/workout_time ou wakeTime/sleepTime/workoutTime da IA e grava em snake_case no DB. Só inclui no patch o que vier preenchido; null/undefined são removidos para não sobrescrever dados existentes. */
function buildProfilePatch(params: Record<string, unknown>): Record<string, unknown> {
  const paramsClean = stripNullish(params);
  const patch: Record<string, unknown> = {};
  const objective = paramsClean.objective ?? paramsClean.goal;
  if (objective !== undefined && objective !== null) {
    patch.objective = typeof objective === 'string' ? objective : String(objective);
  }
  if (paramsClean.biotype !== undefined && paramsClean.biotype !== null && String(paramsClean.biotype).trim()) {
    patch.biotype = typeof paramsClean.biotype === 'string' ? paramsClean.biotype.trim() : String(paramsClean.biotype).trim();
  }
  // calories: só inclui se tiver valor numérico válido (> 0). Evita erro de restrição no banco quando vazio/nulo.
  if (paramsClean.calories !== undefined && paramsClean.calories !== null && paramsClean.calories !== '') {
    const n = Number(paramsClean.calories);
    if (!Number.isNaN(n) && n > 0) patch.calories = Math.round(n);
  }
  const rawName = paramsClean.name ?? paramsClean.nome;
  if (rawName !== undefined && rawName !== null && String(rawName).trim()) {
    patch.name = typeof rawName === 'string' ? rawName.trim() : String(rawName).trim();
  }
  if (paramsClean.age !== undefined && paramsClean.age !== null) {
    const n = Number(paramsClean.age);
    if (!Number.isNaN(n)) patch.age = Math.round(n);
  }
  if (paramsClean.weight !== undefined && paramsClean.weight !== null) {
    const n = Number(paramsClean.weight);
    if (!Number.isNaN(n)) patch.weight = n;
  }
  if (paramsClean.height !== undefined && paramsClean.height !== null) {
    const n = Number(paramsClean.height);
    if (!Number.isNaN(n)) patch.height = n;
  }
  if (paramsClean.gender !== undefined && paramsClean.gender !== null && String(paramsClean.gender).trim()) {
    patch.gender = String(paramsClean.gender).trim();
  }
  if (paramsClean.workout_location !== undefined && paramsClean.workout_location !== null) {
    patch.workout_location =
      typeof paramsClean.workout_location === 'string'
        ? paramsClean.workout_location
        : String(paramsClean.workout_location);
  }
  if (Array.isArray(paramsClean.injuries)) {
    patch.injuries = paramsClean.injuries.filter((x) => typeof x === 'string');
  }
  // meals_per_day: integer quando informado (ex: "5 refeições" → 5)
  if (paramsClean.meals_per_day !== undefined && paramsClean.meals_per_day !== null) {
    const n = Number(paramsClean.meals_per_day);
    if (!Number.isNaN(n) && n >= 1 && n <= 10) patch.meals_per_day = Math.round(n);
  }
  // Tempos: aceitar snake_case (wake_up_time, sleep_time, workout_time) ou camelCase (wakeTime, etc.) da IA e gravar em snake_case no DB
  const wakeVal = paramsClean.wake_up_time ?? paramsClean.wakeTime;
  if (wakeVal !== undefined && wakeVal !== null && String(wakeVal).trim()) {
    patch.wake_up_time = typeof wakeVal === 'string' ? wakeVal.trim() : String(wakeVal).trim();
  }
  const sleepVal = paramsClean.sleep_time ?? paramsClean.sleepTime;
  if (sleepVal !== undefined && sleepVal !== null && String(sleepVal).trim()) {
    patch.sleep_time = typeof sleepVal === 'string' ? sleepVal.trim() : String(sleepVal).trim();
  }
  const workoutVal = paramsClean.workout_time ?? paramsClean.workoutTime;
  if (workoutVal !== undefined && workoutVal !== null && String(workoutVal).trim()) {
    patch.workout_time = typeof workoutVal === 'string' ? workoutVal.trim() : String(workoutVal).trim();
  }
  const allowed = new Set(ONBOARDING_COLUMNS);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || v === null || v === '') continue;
    if (allowed.has(k as (typeof ONBOARDING_COLUMNS)[number])) out[k] = v;
  }
  return out;
}

async function updateUserProfile(
  accessToken: string | null,
  params: Record<string, unknown>
): Promise<{ ok: boolean; error?: string }> {
  if (!accessToken || accessToken.trim() === '') {
    await saveUnifiedLog(null, {
      type: 'error',
      context: 'updateUserProfile',
      message: 'accessToken ausente — usuário não autenticado.',
    }).catch(() => {});
    return { ok: false, error: 'Sessão inválida. Faça login novamente e tente de novo.' };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    await saveUnifiedLog(null, {
      type: 'error',
      context: 'updateUserProfile',
      message: 'Supabase não configurado (SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY).',
    }).catch(() => {});
    return { ok: false, error: 'Supabase não configurado' };
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(accessToken);

  if (authError) {
    await saveUnifiedLog(null, {
      type: 'error',
      context: 'updateUserProfile',
      message: `Erro ao obter usuário: ${authError.message}`,
    }).catch(() => {});
    return { ok: false, error: `Erro de autenticação: ${authError.message}. Peça ao usuário para fazer login novamente.` };
  }

  if (!user?.id) {
    await saveUnifiedLog(null, {
      type: 'error',
      context: 'updateUserProfile',
      message: 'user_id não encontrado. accessToken presente mas usuário inválido.',
    }).catch(() => {});
    return { ok: false, error: 'Usuário não logado. Faça login e tente novamente.' };
  }

  await saveUnifiedLog(user.id, { type: 'tool_input', params }).catch(() => {});

  const patchFromAI = buildProfilePatch(params);

  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('name, age, weight, height, objective, biotype, calories, gender, workout_location, injuries, meals_per_day, wake_up_time, sleep_time, workout_time')
    .eq('id', user.id)
    .maybeSingle();

  const existing = (existingProfile ?? {}) as Record<string, unknown>;
  const merged: Record<string, unknown> = {};
  for (const col of ONBOARDING_COLUMNS) {
    const aiVal = patchFromAI[col];
    const dbVal = existing[col];
    if (aiVal !== undefined && aiVal !== null && aiVal !== '') {
      merged[col] = aiVal;
    } else if (dbVal !== undefined && dbVal !== null && dbVal !== '') {
      merged[col] = dbVal;
    }
  }

  const mergedClean = stripNullish(merged);
  const numericCols = ['age', 'weight', 'height', 'calories', 'meals_per_day'] as const;
  for (const col of numericCols) {
    const v = mergedClean[col];
    if (v !== undefined && v !== null && v !== '') {
      const n = Number(v);
      if (!Number.isNaN(n)) mergedClean[col] = col === 'weight' || col === 'height' ? n : Math.round(n);
    }
  }

  const payload: Record<string, unknown> = {
    id: user.id,
    updated_at: new Date().toISOString(),
    ...mergedClean,
  };

  const { data, error } = await supabase
    .from('profiles')
    .upsert(payload, { onConflict: 'id' })
    .select('id')
    .single();

  if (error) {
    await saveUnifiedLog(user.id, {
      type: 'error',
      context: 'updateUserProfile',
      source: 'supabase',
      message: error.message,
      code: error.code,
    }).catch(() => {});
    return { ok: false, error: `Banco de dados: ${error.message}. Não diga que salvou.` };
  }

  if (!data?.id) {
    await saveUnifiedLog(user.id, {
      type: 'error',
      context: 'updateUserProfile',
      message: 'Upsert retornou sem data.id.',
    }).catch(() => {});
    return { ok: false, error: 'Salvamento não confirmado pelo banco. Tente novamente.' };
  }

  await saveUnifiedLog(user.id, { type: 'tool_result', ok: true, id: data.id }).catch(() => {});
  return { ok: true };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages } = body as { messages: { role: string; content: string }[] };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'O campo messages é obrigatório e deve ser um array não vazio.' },
        { status: 400, headers: corsHeaders() }
      );
    }

    const authHeader = req.headers.get('Authorization');
    const userId = getUserIdFromAuth(authHeader);

    // Log unificado: input do usuário
    const lastUserMessage = messages[messages.length - 1];
    if (lastUserMessage) {
      await saveUnifiedLog(userId, { type: 'user_input', message: lastUserMessage }).catch(() => {});
    }

    // Teste forçado de conexão com Supabase: se a última mensagem do usuário for exatamente 'TESTE'
    const testMessageCheck = messages.filter((m) => m.role === 'user').pop()?.content?.trim();
    if (testMessageCheck === 'TESTE') {
      const supabaseTest = getSupabaseAdmin();
      if (!supabaseTest) {
        const errMsg = 'Supabase não configurado (SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY)';
        return streamTextResponse('❌ ERRO: ' + errMsg);
      }
      try {
        await saveUnifiedLog(userId, { type: 'test', teste: 'Funcionou!', horario: new Date().toISOString() });
        return streamTextResponse('✅ CONEXÃO COM O BANCO OK!');
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        return streamTextResponse('❌ ERRO: ' + errMsg);
      }
    }

    const groqKey = process.env.GROQ_API_KEY;
    const apiKey = process.env.OPENAI_API_KEY ?? groqKey ?? process.env.BiluShapeIA;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key não configurada. Defina OPENAI_API_KEY, GROQ_API_KEY ou BiluShapeIA.' },
        { status: 500, headers: corsHeaders() }
      );
    }

    const useGroq = !!(groqKey || process.env.BiluShapeIA);
    const baseURL = useGroq ? 'https://api.groq.com/openai/v1' : undefined;

    const openai = new OpenAI({
      apiKey,
      ...(baseURL && { baseURL }),
    });

    const model =
      process.env.OPENAI_MODEL ??
      process.env.GROQ_MODEL ??
      (useGroq ? 'llama-3.1-8b-instant' : 'gpt-4o-mini');

    const apiMessages: Message[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages.map((m) =>
        m.role === 'assistant'
          ? ({ role: 'assistant' as const, content: m.content })
          : ({ role: 'user' as const, content: m.content })
      ),
    ];

    let lastContent = '';
    let iterations = 0;
    const maxIterations = 10;
    let hasProcessedToolCalls = false;
    const pendingDebugLogs: Array<{ args: Record<string, unknown>; userId: string | null }> = [];

    const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    while (iterations < maxIterations) {
      iterations++;

      const useTools = !hasProcessedToolCalls;

      let stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>;
      try {
        stream = (
          await openai.chat.completions.create({
            model,
            messages: apiMessages,
            ...(useTools && { tools: TOOLS, tool_choice: 'required' as const }),
            temperature: 0.7,
            stream: true,
          })
        ) as AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>;
      } catch (apiError: unknown) {
        // Não exibir mais a mensagem de "muitas informações"; deixar o erro propagar
        throw apiError;
      }

      let message: {
        content?: string | null;
        tool_calls?: Array<{ id?: string; type: 'function'; function: { name?: string; arguments?: string } }>;
      } = {};
      const toolResults = new Map<string, string>();

      // Acumula o stream completo — NÃO processa tool_calls durante o stream
      for await (const chunk of stream) {
        message = streamMessageReducer(message, chunk);
      }

      // Só após o stream terminar: processa tool_calls UMA VEZ por resposta da IA
      if (message.tool_calls && message.tool_calls.length > 0) {
        hasProcessedToolCalls = true;
        for (const tc of message.tool_calls) {
          if (!tc) continue;
          const id = (tc as { id?: string }).id;
          const rawArgs = tc.function?.arguments ?? '';
          if (!id) continue;
          let args: Record<string, unknown> = {};
          let toolContent: string;
          try {
            const parsed = JSON.parse(rawArgs) as Record<string, unknown>;
            const zodResult = updateUserProfileArgsSchema.safeParse(parsed);
            if (!zodResult.success) {
              const issues = zodResult.error.issues;
              const failedFields = Array.from(new Set(issues.map((i) => i.path.join('.')))).map(
                (p) => LABEL_POR_CAMPO[p] ?? p
              );
              await saveUnifiedLog(userId, {
                type: 'VALIDATION_ERROR',
                issues,
                failedFields,
                zodFormat: zodResult.error.format(),
              }).catch(() => {});
              const fieldList = failedFields.length > 0 ? failedFields.join(', ') : 'dados';
              toolContent = `ERRO DE VALIDAÇÃO: Tive um problema com o formato de: ${fieldList}. Por favor, informe novamente de forma válida.`;
              toolResults.set(id, toolContent);
              continue;
            }
            args = stripNullish(zodResult.data as Record<string, unknown>);
          } catch {
            await saveUnifiedLog(userId, {
              type: 'JSON_PARSE_ERROR',
              raw: rawArgs,
            }).catch(() => {});
            toolContent =
              'ERRO: Os dados enviados estão em formato inválido (JSON malformado). Reformule os dados e tente novamente.';
            toolResults.set(id, toolContent);
            continue;
          }

          pendingDebugLogs.push({ args, userId });

          const result = await updateUserProfile(accessToken, args);
          toolContent = result.ok
            ? 'Salvo com sucesso.'
            : `ERRO: ${result.error ?? mensagemErroParaUsuario(args, result.error)}`;
          toolResults.set(id, toolContent);
        }
        const assistantMsg: OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam = {
          role: 'assistant',
          content: message.content ?? null,
          tool_calls: message.tool_calls
            .filter((tc) => (tc as { id?: string }).id)
            .map((tc) => ({
              id: (tc as { id?: string }).id!,
              type: 'function' as const,
              function: { name: tc.function?.name ?? 'updateUserProfile', arguments: tc.function?.arguments ?? '{}' },
            })),
        };
        apiMessages.push(assistantMsg);
        for (const tc of message.tool_calls) {
          const id = (tc as { id?: string }).id;
          if (id && toolResults.has(id)) {
            apiMessages.push({
              role: 'tool',
              tool_call_id: id,
              content: toolResults.get(id)!,
            } as OpenAI.Chat.Completions.ChatCompletionToolMessageParam);
          }
        }
        continue;
      }

      if (message.content) {
        lastContent = message.content;
        break;
      }
    }

    if (!lastContent) {
      lastContent = 'Desculpe, não consegui gerar uma resposta. Tente novamente.';
    }

    // Log unificado: tool_calls e resposta da IA
    try {
      for (const { args, userId: entryUserId } of pendingDebugLogs) {
        await saveUnifiedLog(entryUserId, { type: 'tool_call', args }).catch(() => {});
      }
      await saveUnifiedLog(userId, { type: 'ai_response', content: lastContent }).catch(() => {});
    } catch (_e) {
      // Silencioso: falha no log não deve quebrar a resposta
    }

    const encoder = new TextEncoder();
    const chunkSize = 20;
    const readable = new ReadableStream({
      async start(controller) {
        for (let i = 0; i < lastContent.length; i += chunkSize) {
          controller.enqueue(encoder.encode(lastContent.slice(i, i + chunkSize)));
          await new Promise((r) => setTimeout(r, 20));
        }
        controller.close();
      },
    });

    return new NextResponse(readable, {
      headers: {
        ...corsHeaders(),
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro interno';
    const userIdCatch = getUserIdFromAuth(req.headers.get('Authorization'));
    await saveUnifiedLog(userIdCatch, { type: 'error', context: 'api/chat/onboarding', message }).catch(() => {});
    return NextResponse.json(
      { error: message },
      { status: 500, headers: corsHeaders() }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders(),
  });
}

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function streamTextResponse(text: string): NextResponse {
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
  return new NextResponse(readable, {
    headers: {
      ...corsHeaders(),
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
