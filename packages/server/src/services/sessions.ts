import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, isNull, lt, or } from 'drizzle-orm';
import type { Database } from '../db/client.ts';
import { players, sessions } from '../db/schema.ts';
import type { Player } from './players.ts';

export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Crée une session et renvoie le jeton à placer dans le cookie (jamais stocké tel quel). */
export async function createSession(
  { db }: Database,
  playerId: string,
  realNowMs: number,
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(realNowMs + SESSION_DURATION_MS);
  await db.insert(sessions).values({ tokenHash: hashToken(token), playerId, expiresAt });
  await db.update(players).set({ lastSeenAt: new Date(realNowMs) }).where(eq(players.id, playerId));
  return { token, expiresAt };
}

export async function findSessionPlayer(
  { db }: Database,
  token: string,
  realNowMs: number,
): Promise<Player | undefined> {
  const [row] = await db
    .select({ id: players.id, pseudo: players.pseudo })
    .from(sessions)
    .innerJoin(players, eq(players.id, sessions.playerId))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date(realNowMs))));
  return row;
}

export async function deleteSession({ db }: Database, token: string) {
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}

/**
 * Note que le joueur est actif (au plus une écriture par minute). Sert à compter
 * les joueurs récemment actifs pour le lieu d'adoption.
 */
export async function touchLastSeen({ db }: Database, playerId: string, realNowMs: number) {
  const now = new Date(realNowMs);
  await db
    .update(players)
    .set({ lastSeenAt: now })
    .where(
      and(
        eq(players.id, playerId),
        or(isNull(players.lastSeenAt), lt(players.lastSeenAt, new Date(realNowMs - 60_000))),
      ),
    );
}
