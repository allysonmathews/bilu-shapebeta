/**
 * Configuração PM2 para a Hostinger.
 * Servidor unificado: frontend (dist) + API (/api) na mesma porta.
 * Uso: npm run build && npm run build:server && pm2 start ecosystem.config.cjs
 */
module.exports = {
  apps: [
    {
      name: 'bilu-shape',
      cwd: './server',
      script: 'index.js',
      interpreter: 'node',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
    },
  ],
};
