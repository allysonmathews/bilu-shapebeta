/**
 * Bilu Shape - Backend Express para produção (Hostinger, porta 3001).
 * - CORS restrito a https://app.bilushape.com
 * - Groq SDK para processamento de mensagens da IA
 * - POST /api/chat/onboarding recebe array de messages
 * - Logs de requisições e erros da API Groq
 * - Tratamento de erros (401, etc.) para o servidor não cair
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Groq = require('groq-sdk');

const PORT = 3001;
// Origens permitidas: use ALLOWED_ORIGINS no .env (separadas por vírgula) ou o valor padrão
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://app.bilushape.com,http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const app = express();

app.use(express.json({ limit: '512kb' }));

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        console.log('[CORS] Origem rejeitada:', origin);
        callback(new Error('CORS não permitido para esta origem'));
      }
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    return null;
  }
  return new Groq({ apiKey });
}

/**
 * POST /api/chat/onboarding
 * Body: { messages: Array<{ role: string, content: string }> }
 */
app.post('/api/chat/onboarding', async (req, res) => {
  try {
    const body = req.body || {};
    const { messages } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      console.log('[API] /api/chat/onboarding - 400: messages ausente ou inválido');
      return res.status(400).json({
        error: 'O campo messages é obrigatório e deve ser um array não vazio.',
      });
    }

    const client = getGroqClient();
    if (!client) {
      console.log('[API] /api/chat/onboarding - 500: GROQ_API_KEY não configurada');
      return res.status(500).json({
        error: 'API Groq não configurada. Defina GROQ_API_KEY no ambiente.',
      });
    }

    const model = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
    const systemPrompt =
      process.env.ONBOARDING_SYSTEM_PROMPT ||
      'Bilu Shape AI. Assistente de onboarding. Seja objetivo e acolhedor.';

    const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: typeof m.content === 'string' ? m.content : String(m.content ?? ''),
      })),
    ];

    console.log('[Groq] Enviando requisição, modelo:', model, 'mensagens:', apiMessages.length);

    let completion;
    try {
      completion = await client.chat.completions.create({
        model,
        messages: apiMessages,
        temperature: 0.7,
      });
    } catch (groqError) {
      const status = groqError?.status || groqError?.statusCode;
      const message = groqError?.message || String(groqError);

      if (status === 401) {
        console.error('[Groq] Erro 401 - Chave inválida ou expirada:', message);
        return res.status(502).json({
          error: 'Serviço de IA temporariamente indisponível (credenciais). Tente mais tarde.',
        });
      }
      if (status === 429) {
        console.error('[Groq] Erro 429 - Rate limit:', message);
        return res.status(429).json({
          error: 'Muitas requisições. Aguarde um momento e tente novamente.',
        });
      }
      if (status >= 500) {
        console.error('[Groq] Erro do provedor (5xx):', status, message);
        return res.status(502).json({
          error: 'Serviço de IA temporariamente indisponível. Tente em instantes.',
        });
      }

      console.error('[Groq] Erro na API:', status, message);
      return res.status(502).json({
        error: 'Falha ao processar mensagem com a IA. Tente novamente.',
      });
    }

    const choice = completion?.choices?.[0];
    const content = choice?.message?.content ?? '';

    console.log('[Groq] Resposta recebida, tamanho:', content.length);

    res.set('Content-Type', 'application/json');
    return res.status(200).json({
      message: content,
      role: 'assistant',
    });
  } catch (err) {
    console.error('[API] /api/chat/onboarding - Erro inesperado:', err?.message || err);
    return res.status(500).json({
      error: err?.message || 'Erro interno do servidor',
    });
  }
});

app.get('/health', (req, res) => {
  res.status(200).json({ ok: true, service: 'bilu-shape-api', port: PORT });
});

app.use((err, req, res, next) => {
  if (err.message === 'CORS não permitido para esta origem') {
    return res.status(403).json({ error: err.message });
  }
  console.error('[Express] Erro não tratado:', err?.message || err);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

app.listen(PORT, () => {
  console.log(`[Bilu Shape] Servidor rodando na porta ${PORT}`);
  console.log(`[Bilu Shape] CORS permitido para: ${ALLOWED_ORIGIN}`);
  if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY.trim() === '') {
    console.warn('[Bilu Shape] AVISO: GROQ_API_KEY não definida. /api/chat/onboarding retornará 500.');
  }
});
