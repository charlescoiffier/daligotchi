import { fileURLToPath } from 'node:url';
import { sql } from 'drizzle-orm';
import { buildApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import { createDb, type Database, runMigrations } from '../src/db/client.ts';
import { createPlayer } from '../src/services/players.ts';

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://daligotchi@localhost:5434/daligotchi_test';

export const MIGRATIONS = fileURLToPath(new URL('../drizzle', import.meta.url));

/** Vide toutes les tables de jeu (l'horloge du monde est conservée). */
export async function resetDb({ db }: Database) {
  await db.execute(sql`truncate table eggs, animals, households, sessions, players cascade`);
}

/**
 * Application de test avec une horloge réelle contrôlable :
 * `clock.advance(ms)` fait passer le temps sans attendre.
 */
export async function createTestContext(worldSpeed = 1, loginAttemptsPerMinute = 1000) {
  const config = loadConfig({
    NODE_ENV: 'test',
    DATABASE_URL: TEST_DATABASE_URL,
    WORLD_SPEED: String(worldSpeed),
    LOGIN_ATTEMPTS_PER_MINUTE: String(loginAttemptsPerMinute),
  });
  const database = createDb(config.DATABASE_URL);
  await runMigrations(database, MIGRATIONS);
  await database.db.execute(sql`truncate table world_clock`);

  let realNow = Date.UTC(2026, 9, 19, 8);
  const clock = {
    now: () => realNow,
    advance: (ms: number) => {
      realNow += ms;
    },
  };
  const app = await buildApp({ config, database, now: clock.now });

  return {
    app,
    database,
    clock,
    async close() {
      await app.close();
      await database.sql.end();
    },
  };
}

export type TestContext = Awaited<ReturnType<typeof createTestContext>>;

/** Crée un joueur, le connecte et renvoie le cookie de session à joindre aux requêtes. */
export async function loginAs(ctx: TestContext, pseudo = 'essai', password = 'mot-de-passe-test') {
  const player = await createPlayer(ctx.database, { pseudo, password }, ctx.app.worldNow());
  const response = await ctx.app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { pseudo, password },
  });
  const cookie = response.cookies.find((c) => c.name === 'dg_session');
  if (!cookie) throw new Error(`connexion impossible : ${response.body}`);
  return { player, cookie: `dg_session=${cookie.value}` };
}

