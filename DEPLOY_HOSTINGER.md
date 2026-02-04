# Guia de Deploy na Hostinger - Bilu Shape

## 📋 Configuração de Variáveis de Ambiente na Hostinger

### 🔐 Variáveis para o Backend (Next.js - servidor)

No painel da Hostinger, configure as seguintes variáveis de ambiente para o **servidor Next.js**:

#### Variáveis Obrigatórias:

1. **GROQ_API_KEY**
   - Valor: `SUA_CHAVE_AQUI` (obtenha em https://console.groq.com)
   - Descrição: Chave da API Groq para integração com IA

2. **GROQ_MODEL** (opcional, mas recomendado)
   - Valor: `llama-3.3-70b-versatile`
   - Descrição: Modelo da Groq a ser usado

3. **SUPABASE_URL**
   - Valor: `https://seu-projeto.supabase.co`
   - Descrição: URL do projeto Supabase

4. **SUPABASE_SERVICE_ROLE_KEY**
   - Valor: `SUA_SERVICE_ROLE_KEY_AQUI` (em Supabase: Settings → API)
   - Descrição: Service Role Key do Supabase (mantenha segredo!)

### 🌐 Variáveis para o Frontend (Vite)

No painel da Hostinger, configure as seguintes variáveis de ambiente para o **frontend Vite**:

#### Variáveis Obrigatórias:

1. **VITE_SUPABASE_URL**
   - Valor: `https://seu-projeto.supabase.co`
   - Descrição: URL do projeto Supabase

2. **VITE_SUPABASE_ANON_KEY**
   - Valor: Sua chave anônima do Supabase (diferente da service role)
   - Descrição: Chave pública do Supabase para o frontend

3. **VITE_CHAT_API_URL** (opcional)
   - Valor: `/api/chat/onboarding` (URL relativa - recomendado)
   - Ou: `https://biluverso.com.br/api/chat/onboarding` (URL absoluta)
   - Descrição: Endpoint da API de chat

## 📝 Como Configurar Variáveis de Ambiente na Hostinger

### Método 1: Via Painel de Controle (hPanel)

1. Acesse o **hPanel** da Hostinger
2. Vá em **Domínios** → Selecione seu domínio (`biluverso.com.br`)
3. Procure por **Variáveis de Ambiente** ou **Environment Variables**
4. Clique em **Adicionar Variável**
5. Preencha:
   - **Nome**: `GROQ_API_KEY` (ou outra variável)
   - **Valor**: Cole o valor correspondente
6. Repita para todas as variáveis necessárias
7. Salve e reinicie o serviço

### Método 2: Via Arquivo .env (se suportado)

Se a Hostinger permitir upload de arquivo `.env`:

1. Crie um arquivo `.env` na raiz do projeto do servidor com:
```env
GROQ_API_KEY=SUA_CHAVE_AQUI
GROQ_MODEL=llama-3.3-70b-versatile
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=SUA_SERVICE_ROLE_KEY_AQUI
```

2. Faça upload via FTP/SSH para a pasta do servidor

### Método 3: Via SSH (se tiver acesso)

1. Conecte-se via SSH ao servidor
2. Navegue até a pasta do projeto
3. Edite ou crie o arquivo `.env`:
```bash
cd /caminho/do/projeto/server
nano .env
```

4. Adicione as variáveis e salve
5. Reinicie o serviço Node.js/Next.js

## 🏗️ Estrutura de Deploy Recomendada

### Opção 1: Frontend e Backend no Mesmo Domínio

```
biluverso.com.br/
├── / (frontend - arquivos estáticos do Vite)
└── /api/* (backend - rotas do Next.js)
```

**Vantagem**: URL relativa `/api/chat/onboarding` funciona automaticamente

### Opção 2: Frontend e Backend em Subdomínios Diferentes

```
app.biluverso.com.br (frontend)
api.biluverso.com.br (backend)
```

**Configuração necessária**:
- Frontend: `VITE_CHAT_API_URL=https://api.biluverso.com.br/api/chat/onboarding`
- Backend: Configurar CORS para aceitar requisições de `app.biluverso.com.br`

## 🔄 Processo de Deploy

### 1. Build do Frontend

```bash
npm run build
# Gera arquivos em /dist
```

### 2. Build do Backend

```bash
cd server
npm run build
# Gera arquivos em /.next
```

### 3. Upload para Hostinger

- **Frontend**: Faça upload da pasta `dist/` para a raiz do domínio
- **Backend**: Faça upload da pasta `server/` e execute `npm start` ou configure PM2

### 4. Configurar Servidor Web

Se usar Nginx ou Apache, configure:

**Nginx** (exemplo):
```nginx
server {
    listen 80;
    server_name biluverso.com.br;

    # Frontend (arquivos estáticos)
    location / {
        root /caminho/para/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API (proxy para Next.js)
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## ✅ Checklist de Deploy

- [ ] Variáveis de ambiente configuradas no painel Hostinger
- [ ] GROQ_API_KEY configurada no servidor
- [ ] SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY configuradas no servidor
- [ ] VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY configuradas no frontend
- [ ] VITE_CHAT_API_URL configurada (ou usando URL relativa)
- [ ] Frontend buildado (`npm run build`)
- [ ] Backend buildado (`cd server && npm run build`)
- [ ] Arquivos enviados para o servidor
- [ ] Servidor Node.js rodando (PM2 ou similar)
- [ ] Teste da rota `/api/chat/onboarding` funcionando
- [ ] Teste do frontend acessando a API

## 🐛 Troubleshooting

### Erro 404 na API

- Verifique se o servidor Next.js está rodando
- Verifique se a rota `/api/chat/onboarding` está acessível
- Verifique se o proxy/reverse proxy está configurado corretamente

### Erro de CORS

- Verifique se o `next.config.js` tem os headers CORS configurados
- Verifique se o domínio do frontend está permitido

### Variáveis de ambiente não carregadas

- Reinicie o servidor após adicionar variáveis
- Verifique se o nome da variável está correto (case-sensitive)
- Verifique se está usando `process.env` no backend e `import.meta.env` no frontend

## 📞 Suporte

Se precisar de ajuda adicional, verifique:
- Documentação da Hostinger sobre variáveis de ambiente
- Logs do servidor para identificar erros
- Console do navegador para erros do frontend
