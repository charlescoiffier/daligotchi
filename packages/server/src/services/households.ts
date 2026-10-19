import {
  type AnimalDescription,
  type AnimalState,
  advanceHousehold,
  BALANCE,
  describeAnimal,
  describeHome,
  type Form,
  FULL_NEEDS,
  type Genotype,
  type HouseholdState,
  lifespanOf,
  type MessageKey,
  type Stage,
  stageOf,
  visibleForm,
} from '@daligotchi/core';
import { asc, eq } from 'drizzle-orm';
import type { Database } from '../db/client.ts';
import { animals, households } from '../db/schema.ts';

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
}

/**
 * Visite d'un responsable : calcule l'état actuel du foyer, l'enregistre comme nouvel
 * instantané et note la visite (pour le vieillissement ralenti). Verrouille le foyer
 * pendant l'opération pour que deux visites simultanées ne se marchent pas dessus.
 */
export async function visitHousehold(
  { db }: Database,
  playerId: string,
  worldNow: number,
): Promise<HouseholdView> {
  return db.transaction(async (tx) => {
    const [householdRow] = await tx
      .select()
      .from(households)
      .where(eq(households.playerId, playerId))
      .for('update');
    if (!householdRow) throw new Error(`Aucun foyer pour le joueur ${playerId}`);

    const animalRows = await tx
      .select()
      .from(animals)
      .where(eq(animals.householdId, householdRow.id))
      .orderBy(asc(animals.createdAt), asc(animals.id));

    const before: HouseholdState = {
      homeCleanliness: householdRow.homeCleanliness,
      at: householdRow.at,
      lastVisitAt: householdRow.lastVisitAt,
      animals: animalRows.map(
        (row): AnimalState => ({
          needs: row.needs,
          ageMs: row.ageMs,
          lifespanMs: row.lifespanMs,
          at: row.at,
        }),
      ),
    };
    const after = advanceHousehold(before, worldNow);

    await tx
      .update(households)
      .set({ homeCleanliness: after.homeCleanliness, at: after.at, lastVisitAt: worldNow })
      .where(eq(households.id, householdRow.id));

    for (const [index, row] of animalRows.entries()) {
      const animal = after.animals[index]!;
      await tx
        .update(animals)
        .set({ needs: animal.needs, ageMs: animal.ageMs, at: animal.at })
        .where(eq(animals.id, row.id));
    }

    return {
      worldTime: worldNow,
      home: describeHome(after.homeCleanliness),
      slots: { used: animalRows.length, total: BALANCE.householdSlots },
      animals: animalRows.map((row, index) => {
        const animal = after.animals[index]!;
        return {
          id: row.id,
          name: row.name,
          form: row.form,
          stage: stageOf(animal.ageMs),
          description: describeAnimal(animal, after.homeCleanliness),
        };
      }),
    };
  });
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
