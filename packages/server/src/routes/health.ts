import type { FastifyPluginAsync } from 'fastify';
import type { Config } from '../config.ts';
import type { Database } from '../db/client.ts';

interface HealthOptions {
  config: Config;
  database: Database;
}

/** État du serveur et de la base, utilisé par le jeu et par la surveillance du VPS. */
export const healthRoutes: FastifyPluginAsync<HealthOptions> = async (app, { config, database }) => {
  app.get('/health', async (_request, reply) => {
    let db: 'ok' | 'error' = 'ok';
    try {
      await database.sql`select 1`;
    } catch {
      db = 'error';
    }
    return reply.code(db === 'ok' ? 200 : 503).send({
      status: db === 'ok' ? 'ok' : 'degraded',
      db,
      worldSpeed: config.WORLD_SPEED,
      serverTime: new Date().toISOString(),
    });
  });
};
