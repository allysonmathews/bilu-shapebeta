# Bilu Shape API

API Next.js (App Router) para o chat de onboarding com streaming.

## Setup

```bash
cd server
npm install
cp .env.example .env.local
# Edite .env.local e adicione sua chave de API
```

## Variáveis de Ambiente

| Variável        | Descrição                          |
|----------------|------------------------------------|
| `OPENAI_API_KEY` | Chave OpenAI (sk-...)             |
| `GROQ_API_KEY`   | Chave Groq (SUA_CHAVE_GROQ_AQUI) - alternativa |
| `BiluShapeIA`    | Mesmo que GROQ_API_KEY             |
| `SUPABASE_URL`   | URL do projeto Supabase            |
| `SUPABASE_SERVICE_ROLE_KEY` | Service Role Key (para salvar perfil via Function Calling) |
| `CRON_SECRET`    | (Opcional) Segredo para proteger `/api/cron/notifications` |
| `OPENAI_MODEL`   | Modelo OpenAI (ex: gpt-4o-mini)    |
| `GROQ_MODEL`     | Modelo Groq com suporte a tools (ex: llama-3.1-70b-versatile) |

## Rodar

```bash
npm run dev
```

A API fica em `http://localhost:3001`.

## Endpoint

### POST /api/chat/onboarding

Recebe `{ messages: [{ role: "user" | "assistant", content: string }] }` e retorna streaming de texto (text/plain).

**Function Calling:** A IA usa a função `updateUserProfile` para salvar nome, peso, altura, idade, objetivo, lesões etc. no Supabase (tabela `profiles`) conforme o usuário informa. O chat continua normalmente — o salvamento é silencioso.

**Auth:** Envie o token Supabase no header `Authorization: Bearer <token>` para identificar o usuário e permitir o salvamento.

**Exemplo:**

```bash
curl -X POST http://localhost:3001/api/chat/onboarding \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Oi, qual meu nome?"}]}'
```

### GET/POST /api/cron/notifications

Worker de notificações proativas. Processa todos os usuários e envia notificações de:
- **Água**: atraso ≥ 500ml no ritmo ideal
- **Refeições**: lembrete 15 min antes; alerta se 30 min após sem marcar como concluída
- **Treino**: lembrete às 20h se não registrou nenhuma série
- **Resumo diário**: 30 min antes de dormir (% água, dieta, dica)

Configure um cron externo (ex.: cron-job.org, GitHub Actions) para chamar a cada 15–30 min. Envie `X-Cron-Secret: <CRON_SECRET>` ou `Authorization: Bearer <CRON_SECRET>` se `CRON_SECRET` estiver definido.

```bash
curl -X GET "http://localhost:3001/api/cron/notifications" \
  -H "X-Cron-Secret: seu_segredo"
```

## Frontend

Para usar esta API no frontend, crie `.env` na raiz do projeto com:

```
VITE_CHAT_API_URL=http://localhost:3001/api/chat/onboarding
```
