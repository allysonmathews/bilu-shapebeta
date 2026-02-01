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
| `GROQ_API_KEY`   | Chave Groq (gsk_...) - alternativa |
| `BiluShapeIA`    | Mesmo que GROQ_API_KEY             |
| `SUPABASE_URL`   | URL do projeto Supabase            |
| `SUPABASE_SERVICE_ROLE_KEY` | Service Role Key (para salvar perfil via Function Calling) |
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

## Frontend

Para usar esta API no frontend, crie `.env` na raiz do projeto com:

```
VITE_CHAT_API_URL=http://localhost:3001/api/chat/onboarding
```
