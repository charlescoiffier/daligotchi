import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { SESSION_COOKIE, sessionCookieOptions } from '../auth.ts';
import type { Config } from '../config.ts';
import type { Database } from '../db/client.ts';
import { verifyCredentials } from '../services/players.ts';
import { createSession, deleteSession } from '../services/sessions.ts';

interface AuthRoutesOptions {
  config: Config;
  database: Database;
  now: () => number;
}

const LoginBody = z.object({
  pseudo: z.string().max(100),
  password: z.string().max(200),
});

export const authRoutes: FastifyPluginAsync<AuthRoutesOptions> = async (
  app,
  { config, database, now },
) => {
  app.post(
    '/auth/login',
    { config: { rateLimit: { max: config.LOGIN_ATTEMPTS_PER_MINUTE, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const body = LoginBody.safeParse(request.body);
      if (!body.success) return reply.code(400).send({ error: 'invalid_request' });

      const player = await verifyCredentials(database, body.data.pseudo, body.data.password);
      if (!player) return reply.code(401).send({ error: 'invalid_credentials' });

      const { token } = await createSession(database, player.id, now());
      reply.setCookie(SESSION_COOKIE, token, sessionCookieOptions(config));
      return { player };
    },
  );

  app.post('/auth/logout', async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE];
    if (token) await deleteSession(database, token);
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });

  app.get('/me', { preHandler: app.requireAuth }, async (request) => ({ player: request.player }));
};
