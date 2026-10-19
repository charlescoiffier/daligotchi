import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'server',
    // Les fichiers de test partagent la même base : ils passent l'un après l'autre.
    fileParallelism: false,
  },
});
