/**
 * Servidor unificado para Node.js Deployment (ex.: Hostinger).
 * - Express escuta em process.env.PORT || 3001.
 * - API (/api) é tratada pelo Next.js (server/app/api).
 * - Frontend: arquivos estáticos da pasta dist (build do Vite) + catch-all com index.html.
 *
 * Variáveis de ambiente: em produção use APENAS as variáveis definidas no painel
 * do host (ex.: GROQ_API_KEY). Não dependa de arquivos .env no servidor.
 */
const path = require('path');
const next = require('next');
const express = require('express');

const dev = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT || '3001', 10);
const app = next({ dev, dir: __dirname });
const handle = app.getRequestHandler();

const distPath = path.join(__dirname, '..', 'dist');

app.prepare().then(() => {
  const server = express();

  // 1) API: repassada ao Next.js (path completo preservado)
  server.use((req, res, next) => {
    if (req.path.startsWith('/api')) return handle(req, res);
    next();
  });

  // 2) Arquivos estáticos do frontend (Vite → dist)
  server.use(express.static(distPath));

  // 3) Catch-all: SPA — qualquer rota não-API recebe index.html (evita 404 no refresh)
  server.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });

  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Bilu Shape: frontend (dist) + API (/api) na porta ${port}`);
  });
});
