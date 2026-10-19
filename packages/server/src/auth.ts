import fastifyCookie from '@fastify/cookie';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import type { Config } from './config.ts';
import type { Database } from './db/client.ts';
import type { Player } from './services/players.ts';
import { findSessionPlayer, SESSION_DURATION_MS, touchLastSeen } from './services/sessions.ts';

export const SESSION_COOKIE = 'dg_session';

declare module 'fastify' {
  interface FastifyRequest {
    player?: Player;
  }
  interface FastifyInstance {
    requireAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

interface AuthOptions {
  config: Config;
  database: Database;
  now: () => number;
}

export function sessionCookieOptions(config: Config) {
  return {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_DURATION_MS / 1000,
  };
}

/** Cookie de session + `app.requireAuth`, à placer en preHandler des routes protégées. */
export const authPlugin = fp<AuthOptions>(async (app: FastifyInstance, { database, now }) => {
  await app.register(fastifyCookie);

  app.decorate('requireAuth', async (request: FastifyRequest, reply: FastifyReply) => {
    const token = request.cookies[SESSION_COOKIE];
    const player = token ? await findSessionPlayer(database, token, now()) : undefined;
    if (!player) {
      return reply.code(401).send({ error: 'not_authenticated' });
    }
    request.player = player;
    await touchLastSeen(database, player.id, now());
  });
});
