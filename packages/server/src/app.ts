import path from 'node:path';
import { worldTimeAt } from '@daligotchi/core';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';
import { authPlugin } from './auth.ts';
import type { Config } from './config.ts';
import type { Database } from './db/client.ts';
import { adoptionRoutes } from './routes/adoption.ts';
import { authRoutes } from './routes/auth.ts';
import { healthRoutes } from './routes/health.ts';
import { householdRoutes } from './routes/household.ts';
import { loadWorldClock } from './services/world.ts';

export interface AppDeps {
  config: Config;
  database: Database;
  /** Heure réelle (ms). Remplaçable dans les tests pour faire avancer le temps. */
  now?: () => number;
}

declare module 'fastify' {
  interface FastifyInstance {
    /** Heure actuelle du monde (ms). */
    worldNow: () => number;
  }
}

export async function buildApp({ config, database, now = Date.now }: AppDeps) {
  const app = Fastify({
    logger: config.NODE_ENV === 'test' ? false : { level: 'info' },
    trustProxy: config.NODE_ENV === 'production',
  });

  const clock = await loadWorldClock(database, config.WORLD_SPEED, now());
  const worldNow = () => worldTimeAt(clock, now());
  app.decorate('worldNow', worldNow);

  await app.register(fastifyRateLimit, { global: false });
  await app.register(authPlugin, { config, database, now });

  await app.register(
    async (api) => {
      await api.register(healthRoutes, { config, database });
      await api.register(authRoutes, { config, database, now });
      await api.register(householdRoutes, { database, worldNow });
      await api.register(adoptionRoutes, { database, worldNow });
    },
    { prefix: '/api' },
  );

  if (config.CLIENT_DIST) {
    await app.register(fastifyStatic, { root: path.resolve(config.CLIENT_DIST) });
    // Toute route inconnue hors /api renvoie le jeu (application d'une seule page).
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api/')) {
        return reply.code(404).send({ error: 'not_found' });
      }
      return reply.sendFile('index.html');
    });
  }

  return app;
}
