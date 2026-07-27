import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// En produccion el bundle se sirve por nginx y las llamadas a /api las enruta
// el Ingress hacia Kong. En desarrollo replicamos ese mismo origen unico
// haciendo proxy de /api al gateway local (docker compose expone Kong en 8000).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_GATEWAY_URL ?? 'http://localhost:8000',
        changeOrigin: true,
        // El stream SSE no debe almacenarse en buffer.
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            if (proxyRes.headers['content-type']?.includes('text/event-stream')) {
              delete proxyRes.headers['content-length'];
            }
          });
        },
      },
    },
  },
});
