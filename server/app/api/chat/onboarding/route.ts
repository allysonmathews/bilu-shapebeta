import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const SYSTEM_PROMPT = `Você é o Bilu Shape AI, um especialista em Nutrição e Educação Física. Seu objetivo é fazer uma anamnese fluida e amigável, como um bate-papo. Não faça listas de perguntas. Faça uma ou duas perguntas por vez. Você precisa coletar: Nome, Idade, Peso, Altura, Gênero, Objetivo (emagrecer/hipertrofia), Nível de Atividade, Lesões e Restrições Alimentares. Mantenha o tom motivador e casual.

Você é um COLETOR DE DADOS. SEMPRE que o usuário disser o nome ou qualquer informação (idade, peso, altura, objetivo, etc.), você DEVE chamar a função de salvar (updateUserProfile) ANTES de responder. Não responda sem ter chamado a função quando houver dado para salvar.

REGRA OBRIGATÓRIA — Você NÃO é apenas um chat. Se o usuário falar um nome, peso, idade, objetivo, altura, gênero ou qualquer dado do perfil, você DEVE disparar a função updateUserProfile ANTES de dar a próxima resposta. Não peça permissão, apenas salve. Extraia o dado imediatamente, chame updateUserProfile com o que foi dito (e com o que já sabe do contexto), depois responda com empatia e continue a conversa. Salve cada dado assim que for informado, mesmo que parcialmente.

MAPEAMENTO DE NOME — O nome informado pelo usuário (ex: "carteiroi", "Maria", "João", etc.) deve SEMPRE ser mapeado para o campo "name". Se o usuário disser "meu nome é X" ou apenas "X" em contexto de apresentação, use "name": "X".

CONSISTÊNCIA OBRIGATÓRIA — Ao chamar updateUserProfile, inclua SEMPRE TODOS os dados que já coletou até agora na conversa (name, age, weight, height, gender, objective, calories, workout_location, injuries). Nunca envie só o dado novo — repasse TUDO que você já sabe. Isso evita sobrescrever campos com null. Exemplo: se o usuário disse nome e idade e agora disse peso, envie { name, age, weight }.

REGRA SOBRE CALORIAS — Use APENAS a chave "calories" (em inglês). NUNCA use "calorias" (com 'a'). Ignore completamente a coluna "calorias".

VERIFICAÇÃO DE GÊNERO — Se ainda não tiver coletado o gênero, pergunte de forma clara: "Para personalizar melhor seu plano, qual é o seu gênero? (masculino, feminino ou outro)". Não avance para a geração do plano sem ter o gênero salvo.

A cada mensagem, verifique quais dados ainda faltam. Direcione a conversa para coletar os faltantes até o perfil estar 100% completo. Somente após coletar TUDO (incluindo gênero), ofereça a geração do plano de treino e dieta.`;

const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'updateUserProfile',
      description:
        'Atualiza o perfil do usuário. Colunas: name, age, weight, height, objective, calories, gender, workout_location, injuries. OBRIGATÓRIO: use APENAS "calories" (nunca "calorias"). Ao chamar, inclua TODOS os dados já coletados na conversa, não apenas o novo — evite null.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nome do usuário' },
          age: { type: 'number', description: 'Idade em anos' },
          weight: { type: 'number', description: 'Peso em kg' },
          height: { type: 'number', description: 'Altura em cm' },
          objective: { type: 'string', description: 'Objetivo: emagrecer, hipertrofia, condicionamento, etc.' },
          calories: { type: 'number', description: 'Meta de calorias diárias (kcal)' },
          gender: { type: 'string', description: 'Gênero: masculino, feminino, outro' },
          workout_location: { type: 'string', description: 'Onde treina: academia, casa, parque, etc.' },
          injuries: {
            type: 'array',
            items: { type: 'string' },
            description: 'Lista de lesões ou restrições físicas',
          },
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

const LABEL_POR_CAMPO: Record<string, string> = {
  name: 'nome',
  age: 'idade',
  weight: 'peso',
  height: 'altura',
  objective: 'objetivo',
  calories: 'calorias',
  gender: 'gênero',
  workout_location: 'local de treino',
  injuries: 'lesões',
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

/** Colunas oficiais para o onboarding: apenas estas. Ignore goal (use objective) e calorias (use calories). */
const ONBOARDING_COLUMNS = [
  'name',
  'age',
  'weight',
  'height',
  'objective',
  'calories',
  'gender',
  'workout_location',
  'injuries',
] as const;

/** Mapeia args da IA para patch: só colunas oficiais. objective (não goal). Use APENAS calories (ignora calorias). */
function buildProfilePatch(params: Record<string, unknown>): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  const objective = params.objective ?? params.goal;
  if (objective !== undefined && objective !== null) {
    patch.objective = typeof objective === 'string' ? objective : String(objective);
  }
  if (params.calories !== undefined && params.calories !== null) {
    const n = Number(params.calories);
    if (!Number.isNaN(n)) patch.calories = Math.round(n);
  }
  const rawName = params.name ?? params.nome;
  if (rawName !== undefined && rawName !== null && String(rawName).trim()) {
    patch.name = typeof rawName === 'string' ? rawName.trim() : String(rawName).trim();
  }
  if (params.age !== undefined && params.age !== null) {
    const n = Number(params.age);
    if (!Number.isNaN(n)) patch.age = Math.round(n);
  }
  if (params.weight !== undefined && params.weight !== null) {
    const n = Number(params.weight);
    if (!Number.isNaN(n)) patch.weight = n;
  }
  if (params.height !== undefined && params.height !== null) {
    const n = Number(params.height);
    if (!Number.isNaN(n)) patch.height = n;
  }
  if (params.gender !== undefined && params.gender !== null && String(params.gender).trim()) {
    patch.gender = String(params.gender).trim();
  }
  if (params.workout_location !== undefined && params.workout_location !== null) {
    patch.workout_location =
      typeof params.workout_location === 'string'
        ? params.workout_location
        : String(params.workout_location);
  }
  if (Array.isArray(params.injuries)) {
    patch.injuries = params.injuries.filter((x) => typeof x === 'string');
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
  console.log('>>> TENTANDO SALVAR NO SUPABASE AGORA...');
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: 'Supabase não configurado' };

  const {
    data: { user },
  } = await supabase.auth.getUser(accessToken ?? undefined);

  if (!user) {
    return { ok: false, error: 'Usuário não logado. Faça login e tente novamente.' };
  }

  const patchFromAI = buildProfilePatch(params);

  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('name, age, weight, height, objective, calories, gender, workout_location, injuries')
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

  const userId = user.id;
  const { error } = await supabase
    .from('profiles')
    .upsert(
      { id: userId, ...merged, updated_at: new Date().toISOString() } as Record<string, unknown>,
      { onConflict: 'id' }
    );

  if (error) {
    return { ok: false, error: error.message };
  }
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

    // SALVAMENTO FORÇADO: input do usuário direto no banco ANTES de qualquer chamada à IA (provar que o banco funciona)
    const lastUserMessage = messages[messages.length - 1];
    try {
      const supabase = getSupabaseAdmin();
      if (supabase && lastUserMessage) {
        await supabase.from('debug_logs').insert({
          dados: { source: 'DIRECT_USER_INPUT', message: lastUserMessage },
        });
        console.log('>>> SALVAMENTO FORÇADO EXECUTADO');
      }
    } catch (e) {
      console.error('>>> ERRO NO SALVAMENTO FORÇADO (debug_logs):', e);
    }

    // Teste forçado de conexão com Supabase: se a última mensagem do usuário for exatamente 'TESTE'
    const testMessageCheck = messages.filter((m) => m.role === 'user').pop()?.content?.trim();
    if (testMessageCheck === 'TESTE') {
      const supabase = getSupabaseAdmin();
      if (!supabase) {
        const errMsg = 'Supabase não configurado (SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY)';
        return streamTextResponse('❌ ERRO: ' + errMsg);
      }
      try {
        const { error } = await supabase.from('debug_logs').insert({
          dados: { teste: 'Funcionou!', horario: new Date().toISOString() },
        });
        if (error) {
          console.log('>>> ERRO REAL DO SUPABASE (TESTE):', error);
          throw error;
        }
        return streamTextResponse('✅ CONEXÃO COM O BANCO OK!');
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        return streamTextResponse('❌ ERRO: ' + errMsg);
      }
    }

    const authHeader = req.headers.get('Authorization');
    const userId = getUserIdFromAuth(authHeader);

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
      (useGroq ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini');

    const apiMessages: Message[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
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
        const status = (apiError as { status?: number })?.status;
        const is429 = status === 429 || String(apiError).toLowerCase().includes('429') || String(apiError).toLowerCase().includes('rate limit');
        if (is429) {
          return streamTextResponse('Estou processando muitas informações, tente novamente em alguns minutos.');
        }
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
          try {
            args = JSON.parse(rawArgs);
          } catch {
            continue;
          }

          pendingDebugLogs.push({ args, userId });

          const result = await updateUserProfile(accessToken, args);
          const toolContent = result.ok
            ? 'Salvo com sucesso.'
            : mensagemErroParaUsuario(args, result.error);
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

    // debug_logs: no final da resposta da IA (tabela: debug_logs, colunas: id, dados)
    console.log('>>> PENDING_DEBUG_LOGS:', pendingDebugLogs.length);
    try {
      const supabase = getSupabaseAdmin();
      if (supabase && pendingDebugLogs.length > 0) {
        for (const { args } of pendingDebugLogs) {
          const { data, error } = await supabase.from('debug_logs').insert([{ dados: args }]).select();
          console.log('>>> RESULTADO DO BANCO:', { data, error });
        }
      }
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
    const errStr = String(error);
    const is429 = errStr.includes('429') || errStr.toLowerCase().includes('rate limit');
    if (is429) {
      return streamTextResponse('Estou processando muitas informações, tente novamente em alguns minutos.');
    }
    const message = error instanceof Error ? error.message : 'Erro interno';
    console.error('[api/chat/onboarding]', message);
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
