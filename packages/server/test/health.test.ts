import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import { createDb, runMigrations } from '../src/db/client.ts';

const config = loadConfig({
  NODE_ENV: 'test',
  DATABASE_URL:
    process.env.TEST_DATABASE_URL ?? 'postgres://daligotchi@localhost:5434/daligotchi_test',
  WORLD_SPEED: '24',
});
const database = createDb(config.DATABASE_URL);
const app = await buildApp({ config, database });

beforeAll(async () => {
  await runMigrations(database, fileURLToPath(new URL('../drizzle', import.meta.url)));
});

afterAll(async () => {
  await app.close();
  await database.sql.end();
});

describe('GET /api/health', () => {
  it('répond ok avec la base et la vitesse du monde', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'ok', db: 'ok', worldSpeed: 24 });
  });
});

describe('migrations', () => {
  it('créent la table des joueurs', async () => {
    const rows = await database.sql`select to_regclass('public.players') as name`;
    expect(rows[0]?.name).toBe('players');
  });
});
