import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'src/index.ts', migrate: 'src/db/migrate.ts', admin: 'src/admin/cli.ts' },
  format: 'esm',
  platform: 'node',
  target: 'node24',
  clean: true,
  // Les règles partagées sont intégrées au fichier compilé.
  noExternal: ['@daligotchi/core'],
});
