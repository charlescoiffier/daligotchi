import preact from '@preact/preset-vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [preact()],
  server: {
    port: 5173,
    // En développement, les appels /api partent vers le serveur Fastify.
    proxy: { '/api': 'http://127.0.0.1:3000' },
  },
  build: {
    // Phaser pèse à lui seul environ 1,2 Mo (365 Ko compressé).
    chunkSizeWarningLimit: 1600,
  },
  test: {
    name: 'client',
  },
});
