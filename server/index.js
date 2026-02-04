/**
 * Servidor unificado para a Hostinger: serve a API Next.js (/api) e os arquivos
 * estáticos do frontend Vite (pasta dist). Assim frontend e backend rodam na mesma porta.
 *
 * Uso: na pasta server, após "npm run build", execute "node index.js"
 * Ou na raiz: "npm run build:server" e "npm run start" (ajuste start para node server/index.js)
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

  // 1) Rotas da API: repassadas ao Next.js (path completo preservado)
  server.use((req, res, next) => {
    if (req.path.startsWith('/api')) return handle(req, res);
    next();
  });

  // 2) Arquivos estáticos do frontend (Vite build)
  server.use(express.static(distPath));

  // 3) Catch-all: SPA retorna index.html para rotas do frontend
  server.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });

  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Bilu Shape: frontend (dist) + API (/api) em http://localhost:${port}`);
  });
});
