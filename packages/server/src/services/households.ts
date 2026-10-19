import {
  type AnimalDescription,
  type AnimalState,
  advanceEgg,
  advanceHousehold,
  applyCare,
  applyEggCare,
  BALANCE,
  type CareAction,
  defaultRandom,
  describeAnimal,
  describeEgg,
  describeHome,
  type EggAction,
  type EggDescription,
  type Form,
  FULL_NEEDS,
  type Genotype,
  type HouseholdState,
  isReadyToHatch,
  lifespanOf,
  type MessageKey,
  newbornAnimal,
  newbornName,
  type Random,
  type Stage,
  stageOf,
  visibleForm,
} from '@daligotchi/core';
import { and, asc, eq, sql } from 'drizzle-orm';
import type { Database } from '../db/client.ts';
import { animals, eggs, households } from '../db/schema.ts';

/** Ce que le jeu reçoit : des libellés et des formes visibles, jamais les allèles ni les nombres. */
export interface HouseholdView {
  worldTime: number;
  home: MessageKey;
  slots: { used: number; total: number };
  animals: {
    id: string;
    name: string;
    form: Form;
    stage: Stage;
    description: AnimalDescription;
  }[];
  /** Œufs en incubation : leur espèce reste secrète jusqu'à l'éclosion. */
  eggs: { id: string; description: EggDescription }[];
  /** Éclosions survenues pendant cette visite, pour jouer la scène. */
  hatched: { eggId: string; animalId: string; name: string; form: Form }[];
}

/** L'animal ou l'œuf visé n'existe pas dans le foyer de ce joueur. */
export class TargetNotFoundError extends Error {
  constructor(id: string) {
    super(`${id} introuvable dans ce foyer`);
  }
}

export type CareRequest =
  | { action: CareAction; animalId?: string }
  | { action: EggAction; eggId: string };

function isEggCare(care: CareRequest): care is { action: EggAction; eggId: string } {
  return care.action === 'warmEgg' || care.action === 'washEgg';
}

export type Tx = Parameters<Parameters<Database['db']['transaction']>[0]>[0];

/** Verrouille le foyer du joueur pour la durée de la transaction. */
export async function lockHousehold(tx: Tx, playerId: string) {
  const [household] = await tx.select().from(households).where(eq(households.playerId, playerId)).for('update');
  if (!household) throw new Error(`Aucun foyer pour le joueur ${playerId}`);
  return household;
}

/** Places occupées : animaux et œufs en incubation confondus (GDD §3). */
export async function usedSlots(tx: Tx, householdId: string): Promise<number> {
  const animalCount = await tx.$count(animals, eq(animals.householdId, householdId));
  const eggCount = await tx.$count(eggs, and(eq(eggs.householdId, householdId), eq(eggs.status, 'incubating')));
  return animalCount + eggCount;
}

/**
 * Visite d'un responsable : calcule l'état actuel du foyer (animaux et œufs), applique
 * éventuellement un soin, fait éclore les œufs prêts, enregistre le tout comme nouvel
 * instantané et note la visite (vieillissement ralenti). Le foyer est verrouillé pendant
 * l'opération : deux visites simultanées ne se marchent pas dessus.
 */
async function withVisit(
  { db }: Database,
  playerId: string,
  worldNow: number,
  care?: CareRequest,
  random: Random = defaultRandom,
): Promise<HouseholdView> {
  return db.transaction(async (tx) => {
    const householdRow = await lockHousehold(tx, playerId);

    const animalRows = await tx
      .select()
      .from(animals)
      .where(eq(animals.householdId, householdRow.id))
      .orderBy(asc(animals.createdAt), asc(animals.id));
    const eggRows = await tx
      .select()
      .from(eggs)
      .where(and(eq(eggs.householdId, householdRow.id), eq(eggs.status, 'incubating')))
      .orderBy(asc(eggs.createdAt), asc(eggs.id));

    const before: HouseholdState = {
      homeCleanliness: householdRow.homeCleanliness,
      at: householdRow.at,
      lastVisitAt: householdRow.lastVisitAt,
      animals: animalRows.map(
        (row): AnimalState => ({ needs: row.needs, ageMs: row.ageMs, lifespanMs: row.lifespanMs, at: row.at }),
      ),
    };
    let after = advanceHousehold(before, worldNow);
    let eggStates = eggRows.map((row) => advanceEgg(row, worldNow));

    if (care && isEggCare(care)) {
      const index = eggRows.findIndex((row) => row.id === care.eggId);
      if (index === -1) throw new TargetNotFoundError(care.eggId);
      eggStates = eggStates.map((egg, i) => (i === index ? applyEggCare(egg, care.action) : egg));
    } else if (care) {
      const index = care.animalId ? animalRows.findIndex((row) => row.id === care.animalId) : undefined;
      if (index === -1) throw new TargetNotFoundError(care.animalId!);
      after = applyCare(after, care.action, index);
    }

    await tx
      .update(households)
      .set({ homeCleanliness: after.homeCleanliness, at: after.at, lastVisitAt: worldNow })
      .where(eq(households.id, householdRow.id));

    for (const [index, row] of animalRows.entries()) {
      const animal = after.animals[index]!;
      await tx.update(animals).set({ needs: animal.needs, ageMs: animal.ageMs, at: animal.at }).where(eq(animals.id, row.id));
    }

    // Éclosions : l'œuf prêt devient un animal, à la même place. Il reste en base pour la généalogie.
    const hatched: HouseholdView['hatched'] = [];
    const remainingEggs: HouseholdView['eggs'] = [];
    const newborns: HouseholdView['animals'] = [];
    for (const [index, row] of eggRows.entries()) {
      const egg = eggStates[index]!;
      if (isReadyToHatch(egg)) {
        const baby = newbornAnimal(worldNow);
        const name = newbornName(random);
        const [inserted] = await tx
          .insert(animals)
          .values({ householdId: householdRow.id, name, genotype: row.genotype, form: row.form, ...baby })
          .returning({ id: animals.id });
        await tx
          .update(eggs)
          .set({ status: 'hatched', ...egg, hatchedAnimalId: inserted!.id })
          .where(eq(eggs.id, row.id));
        hatched.push({ eggId: row.id, animalId: inserted!.id, name, form: row.form });
        newborns.push({
          id: inserted!.id,
          name,
          form: row.form,
          stage: stageOf(baby.ageMs),
          description: describeAnimal(baby, after.homeCleanliness),
        });
      } else {
        await tx
          .update(eggs)
          .set({ warmth: egg.warmth, cleanliness: egg.cleanliness, progress: egg.progress, at: egg.at })
          .where(eq(eggs.id, row.id));
        remainingEggs.push({ id: row.id, description: describeEgg(egg) });
      }
    }

    const animalViews = animalRows.map((row, index) => {
      const animal = after.animals[index]!;
      return {
        id: row.id,
        name: row.name,
        form: row.form,
        stage: stageOf(animal.ageMs),
        description: describeAnimal(animal, after.homeCleanliness),
      };
    });

    return {
      worldTime: worldNow,
      home: describeHome(after.homeCleanliness),
      slots: { used: animalRows.length + eggRows.length, total: BALANCE.householdSlots },
      animals: [...animalViews, ...newborns],
      eggs: remainingEggs,
      hatched,
    };
  });
}

export function visitHousehold(database: Database, playerId: string, worldNow: number, random?: Random) {
  return withVisit(database, playerId, worldNow, undefined, random);
}

/** Applique un soin (animal, foyer ou œuf) pendant une visite et renvoie le foyer à jour. */
export function careForHousehold(database: Database, playerId: string, worldNow: number, care: CareRequest) {
  return withVisit(database, playerId, worldNow, care);
}

/** Renomme un animal du foyer du joueur. */
export async function renameAnimal({ db }: Database, playerId: string, animalId: string, name: string) {
  const updated = await db
    .update(animals)
    .set({ name })
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
