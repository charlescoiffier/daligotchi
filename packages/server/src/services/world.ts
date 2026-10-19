import { reanchorWorldClock, type WorldClock } from '@daligotchi/core';
import { eq } from 'drizzle-orm';
import type { Database } from '../db/client.ts';
import { worldClock } from '../db/schema.ts';

/**
 * Charge l'horloge du monde depuis la base, la crée au premier démarrage,
 * et la ré-ancre si la vitesse configurée a changé (le temps du monde ne saute pas).
 */
export async function loadWorldClock(
  { db }: Database,
  speed: number,
  realNowMs: number,
): Promise<WorldClock> {
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(worldClock).where(eq(worldClock.id, 1)).for('update');
    if (!row) {
      const clock: WorldClock = { anchorRealMs: realNowMs, anchorWorldMs: 0, speed };
      await tx.insert(worldClock).values({ id: 1, ...clock });
      return clock;
    }
    if (row.speed === speed) return row;
    const clock = reanchorWorldClock(row, realNowMs, speed);
    await tx.update(worldClock).set(clock).where(eq(worldClock.id, 1));
    return clock;
  });
}
