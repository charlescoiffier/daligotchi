import { clutchSize, inherit, newEgg, type PairState, type Random, visibleForm } from '@daligotchi/core';
import { and, count, eq } from 'drizzle-orm';
import { animals, clutches, eggs } from '../db/schema.ts';
import type { Tx } from './households.ts';

type AnimalRow = typeof animals.$inferSelect;

/** Des œufs de la ponte précédente de cette paire attendent-ils encore au nid ? */
export async function previousClutchPending(tx: Tx, pair: PairState): Promise<boolean> {
  const [row] = await tx
    .select({ n: count() })
    .from(eggs)
    .where(and(eq(eggs.status, 'nest'), eq(eggs.parentAId, pair.a), eq(eggs.parentBId, pair.b)));
  return (row?.n ?? 0) > 0;
}

/**
 * Crée une ponte (GDD §8) : 1 à 3 œufs au nid, chacun héritant d'un allèle de chaque parent.
 * `nests` liste les foyers qui reçoivent les œufs, à tour de rôle (un seul pour une ponte
 * dans un foyer ; les deux foyers pour une ponte entre animaux de joueurs différents).
 * La numérotation par paire, unique en base, empêche toute ponte en double.
 */
export async function layClutch(
  tx: Tx,
  input: {
    pair: PairState;
    parentA: AnimalRow;
    parentB: AnimalRow;
    nests: readonly string[];
    worldNow: number;
    random: Random;
    /** L'annonce est-elle déjà faite autrement (fin de rencontre, souvenir) ? */
    announced?: boolean;
  },
): Promise<number> {
  const { pair, parentA, parentB, nests, worldNow, random } = input;
  const [previous] = await tx
    .select({ n: count() })
    .from(clutches)
    .where(and(eq(clutches.animalA, pair.a), eq(clutches.animalB, pair.b)));
  const eggCount = clutchSize(random);
  const [clutch] = await tx
    .insert(clutches)
    .values({
      animalA: pair.a,
      animalB: pair.b,
      number: (previous?.n ?? 0) + 1,
      householdId: nests[0]!,
      laidAt: worldNow,
      eggCount,
      seen: input.announced ?? false,
    })
    .returning({ id: clutches.id });

  // Si plusieurs nids, le premier œuf va au hasard dans l'un d'eux, puis à tour de rôle.
  const offset = Math.floor(random() * nests.length);
  for (let e = 0; e < eggCount; e++) {
    const genotype = inherit(parentA.genotype, parentB.genotype, random);
    await tx.insert(eggs).values({
      status: 'nest',
      origin: 'player',
      householdId: nests[(offset + e) % nests.length]!,
      genotype,
      form: visibleForm(genotype),
      ...newEgg(worldNow),
      listedAt: worldNow,
      parentAId: pair.a,
      parentBId: pair.b,
      clutchId: clutch!.id,
    });
  }
  await tx.update(animals).set({ lastClutchAt: worldNow }).where(eq(animals.id, pair.a));
  await tx.update(animals).set({ lastClutchAt: worldNow }).where(eq(animals.id, pair.b));
  return eggCount;
}
