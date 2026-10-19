import path from 'node:path';
import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';
import type { Config } from './config.ts';
import type { Database } from './db/client.ts';
import { healthRoutes } from './routes/health.ts';

export interface AppDeps {
  config: Config;
  database: Database;
}

export async function buildApp({ config, database }: AppDeps) {
  const app = Fastify({
    logger: config.NODE_ENV === 'test' ? false : { level: 'info' },
  });

  await app.register(healthRoutes, { prefix: '/api', config, database });

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
