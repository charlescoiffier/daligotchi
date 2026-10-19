import {
  BALANCE,
  newEgg,
  type CareAction,
  DAY,
  defaultRandom,
  type EggAction,
  type Form,
  FULL_NEEDS,
  type Genotype,
  lifespanOf,
  newbornName,
  type Random,
  randomFounderGenotype,
  type Stage,
  stageOf,
  visibleForm,
  WEEK,
} from '@daligotchi/core';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { Database } from '../db/client.ts';
import { type HouseholdView, syncHousehold, TargetNotFoundError } from './sync.ts';

export { type HouseholdView, TargetNotFoundError };
import { animals, eggs, households } from '../db/schema.ts';

export type CareRequest =
  | { action: CareAction; animalId?: string }
  | { action: EggAction; eggId: string };

export type Tx = Parameters<Parameters<Database['db']['transaction']>[0]>[0];

/** Verrouille le foyer du joueur pour la durée de la transaction. */
export async function lockHousehold(tx: Tx, playerId: string) {
  const [household] = await tx.select().from(households).where(eq(households.playerId, playerId)).for('update');
  if (!household) throw new Error(`Aucun foyer pour le joueur ${playerId}`);
  return household;
}

/** Places occupées : animaux et œufs en incubation confondus (GDD §3). */
export async function usedSlots(tx: Tx, householdId: string): Promise<number> {
  const animalCount = await tx.$count(animals, and(eq(animals.householdId, householdId), isNull(animals.diedAt)));
  const eggCount = await tx.$count(eggs, and(eq(eggs.householdId, householdId), eq(eggs.status, 'incubating')));
  return animalCount + eggCount;
}

/** Visite d'un responsable : synchronise le foyer, éventuellement avec un soin. */
async function withVisit(
  { db }: Database,
  playerId: string,
  worldNow: number,
  care?: CareRequest,
  random: Random = defaultRandom,
): Promise<HouseholdView> {
  return db.transaction(async (tx) => {
    const householdRow = await lockHousehold(tx, playerId);
    return syncHousehold(tx, householdRow, worldNow, { visit: true, care, random });
  });
}

export function visitHousehold(database: Database, playerId: string, worldNow: number, random?: Random) {
  return withVisit(database, playerId, worldNow, undefined, random);
}

/** Applique un soin (animal, foyer ou œuf) pendant une visite et renvoie le foyer à jour. */
export function careForHousehold(database: Database, playerId: string, worldNow: number, care: CareRequest) {
  return withVisit(database, playerId, worldNow, care);
}

/**
 * Tâche de fond : fait vivre tous les foyers sans compter de visite (pontes hors connexion,
 * dépôt automatique des œufs du nid). Un foyer déjà verrouillé par une visite est sauté.
 */
export async function syncAllHouseholds({ db }: Database, worldNow: number, random: Random = defaultRandom) {
  const rows = await db.select({ id: households.id }).from(households);
  let synced = 0;
  for (const { id } of rows) {
    await db.transaction(async (tx) => {
      const [householdRow] = await tx
        .select()
        .from(households)
        .where(eq(households.id, id))
        .for('update', { skipLocked: true });
      if (!householdRow) return;
      await syncHousehold(tx, householdRow, worldNow, { visit: false, random });
      synced++;
    });
  }
  return synced;
}

/** Change le prénom et/ou la description d'un animal du foyer du joueur. */
export async function updateAnimal(
  { db }: Database,
  playerId: string,
  animalId: string,
  changes: { name?: string; description?: string },
) {
  const updated = await db
    .update(animals)
    .set(changes)
    .where(
      and(
        eq(animals.id, animalId),
        eq(animals.householdId, sql`(select ${households.id} from ${households} where ${households.playerId} = ${playerId})`),
      ),
    )
    .returning({ id: animals.id });
  if (updated.length === 0) throw new TargetNotFoundError(animalId);
}

/** Ajoute un animal fondateur (sans parents) dans le foyer d'un joueur. Sert aux données de test. */
export async function addFounderAnimal(
  { db }: Database,
  input: { playerId: string; name: string; genotype: Genotype; ageMs: number; worldNow: number },
) {
  const [household] = await db
    .select({ id: households.id })
    .from(households)
    .where(eq(households.playerId, input.playerId));
  if (!household) throw new Error(`Aucun foyer pour le joueur ${input.playerId}`);

  const [animal] = await db
    .insert(animals)
    .values({
      householdId: household.id,
      name: input.name,
      genotype: input.genotype,
      form: visibleForm(input.genotype),
      needs: FULL_NEEDS,
      ageMs: input.ageMs,
      lifespanMs: lifespanOf(1),
      at: input.worldNow,
    })
    .returning({ id: animals.id });
  return animal!;
}

/**
 * Animaux de départ : donne à un joueur jusqu'à `count` fondateurs d'espèces et d'âges variés
 * (jeunes ou adultes), sans jamais dépasser les places libres du foyer. Renvoie ceux qui ont été ajoutés.
 */
export async function addStarterAnimals(
  { db }: Database,
  playerId: string,
  count: number,
  worldNow: number,
  random: Random = defaultRandom,
): Promise<{ name: string; form: Form; stage: Stage }[]> {
  return db.transaction(async (tx) => {
    const household = await lockHousehold(tx, playerId);
    const free = BALANCE.householdSlots - (await usedSlots(tx, household.id));
    const added: { name: string; form: Form; stage: Stage }[] = [];
    const { youngDuration, adultDuration } = BALANCE.lifeStages;
    for (let i = 0; i < Math.min(count, free); i++) {
      const genotype = randomFounderGenotype(BALANCE.activeSpecies, random);
      // Entre 2 jours et la fin de l'âge adulte moins une semaine : jamais vieux au départ.
      const minAge = 2 * DAY;
      const ageMs = minAge + random() * (youngDuration + adultDuration - WEEK - minAge);
      const name = newbornName(random);
      const form = visibleForm(genotype);
      await tx.insert(animals).values({
        householdId: household.id,
        name,
        genotype,
        form,
        needs: FULL_NEEDS,
        ageMs,
        lifespanMs: lifespanOf(1),
        at: worldNow,
      });
      added.push({ name, form, stage: stageOf(ageMs) });
    }
    return added;
  });
}

export class NestEggNotFoundError extends Error {
  constructor(id: string) {
    super(`Œuf ${id} absent du nid de ce joueur`);
  }
}

export class NoFreeSlotError extends Error {
  constructor() {
    super('Le foyer est plein');
  }
}

/**
 * Œuf du nid : le garder (il entre au foyer s'il y a une place libre, et son incubation commence)
 * ou le déposer au lieu d'adoption, où un autre joueur pourra l'adopter.
 */
export async function placeNestEgg(
  { db }: Database,
  playerId: string,
  eggId: string,
  choice: 'keep' | 'deposit',
  worldNow: number,
) {
  await db.transaction(async (tx) => {
    const household = await lockHousehold(tx, playerId);
    const nestEgg = and(eq(eggs.id, eggId), eq(eggs.householdId, household.id), eq(eggs.status, 'nest'));
    if (choice === 'keep') {
      if ((await usedSlots(tx, household.id)) >= BALANCE.householdSlots) throw new NoFreeSlotError();
      const moved = await tx.update(eggs).set({ status: 'incubating', ...newEgg(worldNow) }).where(nestEgg).returning({ id: eggs.id });
      if (moved.length === 0) throw new NestEggNotFoundError(eggId);
    } else {
      const moved = await tx
        .update(eggs)
        .set({ status: 'available', householdId: null, listedAt: worldNow })
        .where(nestEgg)
        .returning({ id: eggs.id });
      if (moved.length === 0) throw new NestEggNotFoundError(eggId);
    }
  });
}

