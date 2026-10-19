import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestContext, type TestContext } from './helpers.ts';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestContext(24);
});

afterAll(async () => {
  await ctx.close();
});

describe('GET /api/health', () => {
  it('répond ok avec la base et la vitesse du monde', async () => {
    const response = await ctx.app.inject({ method: 'GET', url: '/api/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'ok', db: 'ok', worldSpeed: 24 });
  });
});

describe('migrations', () => {
  it('créent les tables du jeu', async () => {
    for (const table of ['players', 'sessions', 'households', 'animals', 'world_clock']) {
      const rows = await ctx.database.sql`select to_regclass(${`public.${table}`}) as name`;
      expect(rows[0]?.name).toBe(table);
    }
  });
});
