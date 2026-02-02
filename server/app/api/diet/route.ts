import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

/** Perfil do usuário enviado para geração de dieta via IA. */
export interface DietProfilePayload {
  weight: number; // kg
  height: number; // cm
  age: number;
  gender?: string;
  biotype?: string;
  objective?: string;
  workout_time?: string; // HH:mm
  workout_duration?: number; // minutos
  wake_up_time?: string;
  sleep_time?: string;
  meals_per_day?: number;
  allergies?: string[];
}

const SYSTEM_PROMPT = `Você é um Nutricionista Esportivo especializado em dietas personalizadas. Sua tarefa é gerar uma dieta do zero, baseada EXCLUSIVAMENTE nos dados do usuário fornecidos.

REGRAS:
1. Receba o objeto completo do usuário: peso, altura, idade, biotipo, objetivo e horário de treino.
2. Calcule o TDEE (Total Daily Energy Expenditure) considerando objetivo (emagrecimento = déficit, hipertrofia = superávit, manutenção = equilíbrio).
3. Distribua as refeições ao longo do dia respeitando os horários informados (acordar, treino, dormir).
4. Inclua Pré-Treino (~30 min antes do treino) e Pós-Treino (~30 min após o treino).
5. NUNCA use templates ou modelos pré-definidos. Crie cada dieta de forma única.
6. Respeite alergias e restrições alimentares se informadas.
7. Gere alimentos brasileiros comuns e acessíveis.
8. Cada alimento em lista_alimentos_com_quantidade DEVE ter: alimento, quantidade, calorias, proteina, carboidratos, gorduras (valores numéricos).
9. Retorne APENAS um objeto JSON válido, sem texto antes ou depois.`;

const USER_PROMPT_TEMPLATE = `Gere uma dieta diária personalizada em JSON estrito com este esquema:

{
  "resumo_metabolico": {
    "tdee": number,
    "meta_calorias": number,
    "meta_proteina": number,
    "meta_carboidratos": number,
    "meta_gorduras": number
  },
  "refeicoes": [
    {
      "horario": "HH:mm",
      "titulo_refeicao": "string",
      "lista_alimentos_com_quantidade": [
        { "alimento": "string", "quantidade": "string", "calorias": number, "proteina": number, "carboidratos": number, "gorduras": number }
      ],
      "macros_da_ref": { "calorias": number, "proteina": number, "carboidratos": number, "gorduras": number }
    }
  ],
  "lista_compras": [
    { "item": "string", "quantidade": "string" }
  ]
}

DADOS DO USUÁRIO:
- Peso: {{weight}} kg
- Altura: {{height}} cm
- Idade: {{age}} anos
- Gênero: {{gender}}
- Biotipo: {{biotype}}
- Objetivo: {{objective}}
- Horário de treino: {{workout_time}}
- Duração do treino: {{workout_duration}} min
- Horário de acordar: {{wake_up_time}}
- Horário de dormir: {{sleep_time}}
- Refeições por dia: {{meals_per_day}}
- Alergias/Restrições: {{allergies}}

Retorne SOMENTE o JSON.`;

function buildUserPrompt(profile: DietProfilePayload): string {
  return USER_PROMPT_TEMPLATE
    .replace('{{weight}}', String(profile.weight))
    .replace('{{height}}', String(profile.height))
    .replace('{{age}}', String(profile.age))
    .replace('{{gender}}', profile.gender ?? 'masculino')
    .replace('{{biotype}}', profile.biotype ?? 'mesomorfo')
    .replace('{{objective}}', profile.objective ?? 'hipertrofia')
    .replace('{{workout_time}}', profile.workout_time ?? '18:00')
    .replace('{{workout_duration}}', String(profile.workout_duration ?? 60))
    .replace('{{wake_up_time}}', profile.wake_up_time ?? '07:00')
    .replace('{{sleep_time}}', profile.sleep_time ?? '23:00')
    .replace('{{meals_per_day}}', String(profile.meals_per_day ?? 5))
    .replace('{{allergies}}', Array.isArray(profile.allergies) && profile.allergies.length > 0
      ? profile.allergies.join(', ')
      : 'Nenhuma');
}

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function extractJsonFromResponse(text: string): string {
  const trimmed = text.trim();
  const jsonStart = trimmed.indexOf('{');
  const jsonEnd = trimmed.lastIndexOf('}');
  if (jsonStart >= 0 && jsonEnd > jsonStart) {
    return trimmed.slice(jsonStart, jsonEnd + 1);
  }
  return trimmed;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const profile = body.profile as DietProfilePayload;

    if (!profile || typeof profile.weight !== 'number' || typeof profile.height !== 'number' || typeof profile.age !== 'number') {
      return NextResponse.json(
        { error: 'Perfil inválido. Envie { profile: { weight, height, age, ... } }.' },
        { status: 400, headers: corsHeaders() }
      );
    }

    const groqKey = process.env.GROQ_API_KEY;
    const apiKey = process.env.OPENAI_API_KEY ?? groqKey ?? process.env.BiluShapeIA;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key não configurada. Defina OPENAI_API_KEY ou GROQ_API_KEY.' },
        { status: 500, headers: corsHeaders() }
      );
    }

    const useGroq = !!(groqKey || process.env.BiluShapeIA);
    const openai = new OpenAI({
      apiKey,
      ...(useGroq && { baseURL: 'https://api.groq.com/openai/v1' }),
    });

    const model = process.env.GROQ_MODEL ?? process.env.OPENAI_MODEL ?? (useGroq ? 'llama-3.1-8b-instant' : 'gpt-4o-mini');

    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(profile) },
      ],
      temperature: 0.6,
      max_tokens: 4096,
    });

    const rawContent = completion.choices[0]?.message?.content ?? '';
    const jsonStr = extractJsonFromResponse(rawContent);

    let diet: unknown;
    try {
      diet = JSON.parse(jsonStr);
    } catch {
      return NextResponse.json(
        { error: 'A IA não retornou JSON válido.', raw: rawContent.slice(0, 500) },
        { status: 500, headers: corsHeaders() }
      );
    }

    return NextResponse.json({ diet }, { headers: corsHeaders() });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro interno';
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
