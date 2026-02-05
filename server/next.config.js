/** @type {import('next').NextConfig} */
const nextConfig = {
  // Permitir CORS para o frontend Vite (dev e produção)
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: 'https://app.bilushape.com' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ];
  },
  // Configuração para produção
  output: 'standalone', // Otimiza o build para produção
  // Se o frontend estiver sendo servido pelo mesmo servidor Next.js, descomente:
  // trailingSlash: true,
  // Se precisar servir arquivos estáticos do frontend, configure:
  // publicRuntimeConfig: {
  //   staticFolder: '/dist',
  // },
};

module.exports = nextConfig;
