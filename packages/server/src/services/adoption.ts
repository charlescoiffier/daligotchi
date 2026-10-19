import {
  BALANCE,
  defaultRandom,
  newEgg,
  type Random,
  randomFounderGenotype,
  visibleForm,
} from '@daligotchi/core';
import { and, asc, count, eq, gte, inArray, sql } from 'drizzle-orm';
import type { Database } from '../db/client.ts';
import { eggs, players } from '../db/schema.ts';
import { lockHousehold, type Tx, usedSlots } from './households.ts';

export class NoFreeSlotError extends Error {
  constructor() {
    super('Le foyer est plein');
  }
}

export class EggUnavailableError extends Error {
  constructor() {
    super("Cet œuf n'est plus disponible");
  }
}

/** Œuf tel que présenté au lieu d'adoption : jamais son espèce. */
export interface AdoptionEgg {
  id: string;
  origin: 'game' | 'player';
}

type Executor = Database['db'] | Tx;

/**
 * Crée un œuf fondateur au lieu d'adoption. Ses deux allèles sont tirés au hasard parmi les
 * espèces actives, une seule fois, à la création (GDD §6 et §11).
 */
export async function createGameEgg(db: Executor, worldNow: number, random: Random = defaultRandom) {
  const genotype = randomFounderGenotype(BALANCE.activeSpecies, random);
  const egg = newEgg(worldNow);
  const [row] = await db
    .insert(eggs)
    .values({
      status: 'available',
      origin: 'game',
      genotype,
      form: visibleForm(genotype),
      ...egg,
      listedAt: worldNow,
    })
    .returning({ id: eggs.id });
  return row!;
}

export async function listAvailableEggs({ db }: Database): Promise<AdoptionEgg[]> {
  return db
    .select({ id: eggs.id, origin: eggs.origin })
    .from(eggs)
    .where(eq(eggs.status, 'available'))
    .orderBy(asc(eggs.listedAt), asc(eggs.id));
}

/**
 * Adopte un œuf : il faut une place libre, et l'œuf doit être encore disponible.
 * La mise à jour conditionnelle garantit qu'un même œuf ne peut pas être adopté deux fois.
 * L'incubation commence à l'adoption (rien n'avance tant que l'œuf attend au lieu d'adoption).
 */
export async function adoptEgg({ db }: Database, playerId: string, eggId: string, worldNow: number) {
  return db.transaction(async (tx) => {
    const household = await lockHousehold(tx, playerId);
    if ((await usedSlots(tx, household.id)) >= BALANCE.householdSlots) throw new NoFreeSlotError();

    const adopted = await tx
      .update(eggs)
      .set({ status: 'incubating', householdId: household.id, ...newEgg(worldNow) })
      .where(and(eq(eggs.id, eggId), eq(eggs.status, 'available')))
      .returning({ id: eggs.id });
    if (adopted.length === 0) throw new EggUnavailableError();
    return adopted[0]!;
  });
}

/** Nombre d'œufs visé au lieu d'adoption, d'après le nombre de joueurs récemment actifs. */
export function adoptionTarget(activePlayers: number): number {
  const { eggsPerActivePlayer, minimumEggs } = BALANCE.adoption;
  return Math.max(minimumEggs, Math.ceil(activePlayers * eggsPerActivePlayer));
}

/**
 * Réapprovisionne le lieu d'adoption (GDD §10) : ajoute des œufs du jeu sous la cible,
 * retire les plus anciens œufs du jeu au-delà de `removeAboveFactor` × la cible.
 * Les œufs déposés par des joueurs ne sont jamais retirés automatiquement.
 * Un verrou empêche deux exécutions simultanées.
 */
export async function restockAdoption(
  { db }: Database,
  realNowMs: number,
  worldNow: number,
  random: Random = defaultRandom,
): Promise<{ added: number; removed: number; target: number }> {
  return db.transaction(async (tx) => {
    const [lock] = await tx.execute<{ locked: boolean }>(sql`select pg_try_advisory_xact_lock(4242) as locked`);
    if (!lock?.locked) return { added: 0, removed: 0, target: 0 };

    const since = new Date(realNowMs - BALANCE.adoption.activeWindowMs);
    const [active] = await tx.select({ n: count() }).from(players).where(gte(players.lastSeenAt, since));
    const target = adoptionTarget(active?.n ?? 0);
    const available = await tx.$count(eggs, eq(eggs.status, 'available'));

    let added = 0;
    for (; available + added < target; added++) await createGameEgg(tx, worldNow, random);

    let removed = 0;
    const maximum = target * BALANCE.adoption.removeAboveFactor;
    if (available > maximum) {
      const oldest = await tx
        .select({ id: eggs.id })
        .from(eggs)
        .where(and(eq(eggs.status, 'available'), eq(eggs.origin, 'game')))
        .orderBy(asc(eggs.listedAt), asc(eggs.id))
        .limit(available - maximum);
      if (oldest.length > 0) {
        await tx
          .update(eggs)
          .set({ status: 'removed' })
          .where(inArray(eggs.id, oldest.map((egg) => egg.id)));
      }
      removed = oldest.length;
    }

    return { added, removed, target };
  });
}
