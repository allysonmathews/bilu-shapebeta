// Edge Function: rapid-action (Supabase – runtime Deno)
// Recebe imagem em base64, envia ao Gemini 1.5 Flash e retorna
// JSON com alimentos identificados: alimento, calorias, proteina, carbo, gordura.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface AlimentoItem {
  alimento: string;
  calorias: number;
  proteina: number;
  carbo: number;
  gordura: number;
}

interface BodyRequest {
  /** Imagem em base64 (data URL ou raw base64) */
  image_base64?: string;
}

interface SuccessResponse {
  ok: boolean;
  alimentos: AlimentoItem[];
}

interface ErrorResponse {
  ok: boolean;
  error: string;
  raw?: string;
}

function jsonResponse(data: SuccessResponse | ErrorResponse, status = 200): Response {
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

  if (req.method !== 'POST') {
    return jsonResponse(
      { ok: false, error: 'Método não permitido. Use POST.' },
      405
    );
  }

  try {
    const body = (await req.json()) as BodyRequest;
    const imageBase64 = body?.image_base64?.trim();

    if (!imageBase64) {
      return jsonResponse(
        { ok: false, error: 'image_base64 é obrigatório no body (JSON)' },
        400
      );
    }

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      return jsonResponse(
        { ok: false, error: 'GEMINI_API_KEY não configurada' },
        500
      );
    }

    // Normalizar base64: remover data URL se existir
    let base64Data = imageBase64;
    const dataUrlMatch = base64Data.match(/^data:image\/\w+;base64,(.+)$/);
    if (dataUrlMatch) base64Data = dataUrlMatch[1];

    const mimeType = imageBase64.startsWith('data:image/png')
      ? 'image/png'
      : 'image/jpeg';

    const prompt = `Analisa esta imagem de um prato ou refeição. Identifica TODOS os alimentos visíveis.

Responde APENAS com um único JSON válido, sem markdown e sem texto antes ou depois. O JSON deve ser um array de objetos. Cada objeto representa um alimento e deve ter exatamente estes campos:
- alimento: nome do alimento em português
- calorias: número (calorias totais da porção visível)
- proteina: número em gramas
- carbo: número em gramas (carboidratos)
- gordura: número em gramas

Exemplo de formato:
[{"alimento":"Arroz branco","calorias":150,"proteina":3,"carbo":33,"gordura":0.3},{"alimento":"Frango grelhado","calorias":120,"proteina":25,"carbo":0,"gordura":2}]

Estima os valores nutricionais de cada alimento visível na imagem.`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`;

    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64Data,
                },
              },
              { text: prompt },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      return jsonResponse(
        {
          ok: false,
          error: `Erro na API Gemini: ${geminiRes.status} - ${errText}`,
        },
        502
      );
    }

    const geminiJson = await geminiRes.json();
    const textPart = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textPart) {
      return jsonResponse(
        {
          ok: false,
          error: 'Resposta da Gemini sem conteúdo',
          raw: JSON.stringify(geminiJson),
        },
        502
      );
    }

    let alimentos: AlimentoItem[];
    try {
      // Remove qualquer markdown de code block (```json ou ```) antes do parse
      const cleaned = textPart
        .replace(/^\s*```(?:json)?\s*/i, '')
        .replace(/\s*```\s*$/i, '')
        .trim();
      const parsed = JSON.parse(cleaned);

      // Aceitar array, objeto com array, ou objeto único de alimento
      const arr = Array.isArray(parsed)
        ? parsed
        : (parsed?.alimentos ?? (parsed && typeof parsed === 'object' && ('alimento' in parsed || 'calorias' in parsed) ? [parsed] : []));
      alimentos = (arr as unknown[]).map((item: unknown) => {
        const i = item as Record<string, unknown>;
        return {
          alimento: String(i.alimento ?? ''),
          calorias: Number(i.calorias ?? 0),
          proteina: Number(i.proteina ?? 0),
          carbo: Number(i.carbo ?? 0),
          gordura: Number(i.gordura ?? 0),
        };
      });
    } catch {
      return jsonResponse(
        {
          ok: false,
          error: 'Resposta da IA não é JSON válido',
          raw: textPart,
        },
        502
      );
    }

    return jsonResponse({
      ok: true,
      alimentos,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return jsonResponse({ ok: false, error: message }, 500);
  }
});
