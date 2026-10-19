import type { Form } from '@daligotchi/core';
import { eq } from 'drizzle-orm';
import type { Database } from '../db/client.ts';
import { animals } from '../db/schema.ts';

/** Un animal dans l'arbre : ce qui s'observe (jamais les allèles) et ses parents connus. */
export interface FamilyTree {
  id: string;
  name: string;
  form: Form;
  story: string;
  /** Fondateur : sans ascendants connus. */
  founder: boolean;
  parents: FamilyTree[];
}

/** Nombre de générations remontées au plus (largement assez pour la PVJ). */
export const MAX_GENERATIONS = 8;

/**
 * Arbre des ascendants d'un animal, jusqu'aux fondateurs (GDD §7). Les noms et descriptions
 * sont visibles de tous les joueurs : la PVJ est réservée à la famille et aux amis.
 */
export async function familyTree({ db }: Database, animalId: string, depth = MAX_GENERATIONS): Promise<FamilyTree | undefined> {
  const [row] = await db.select().from(animals).where(eq(animals.id, animalId));
  if (!row) return undefined;
  const parentIds = [row.parentAId, row.parentBId].filter((id): id is string => id !== null);
  const parents: FamilyTree[] = [];
  if (depth > 0) {
    for (const id of parentIds) {
      const parent = await familyTree({ db } as Database, id, depth - 1);
      if (parent) parents.push(parent);
    }
  }
  return {
    id: row.id,
    name: row.name,
    form: row.form,
    story: row.description,
    founder: parentIds.length === 0,
    parents,
  };
}
