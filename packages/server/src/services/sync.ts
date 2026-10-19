import {
  type AnimalDescription,
  type AnimalState,
  advanceBonds,
  advanceEgg,
  advanceHousehold,
  apartInteraction,
  applyCare,
  applyEggCare,
  areRelated,
  BALANCE,
  type BondLevel,
  bondLevel,
  boostBonds,
  canLay,
  DAY,
  describeAnimal,
  describeEgg,
  describeHome,
  type EggDescription,
  type Form,
  type HouseholdState,
  isReadyToHatch,
  type MessageKey,
  newbornAnimal,
  newbornName,
  type PairContext,
  type PairState,
  pairKey,
  type Random,
  type Stage,
  stageOf,
} from '@daligotchi/core';
import { and, asc, eq, inArray, lte, notInArray, or } from 'drizzle-orm';
import { animals, clutches, eggs, households, meetings, pairs, players } from '../db/schema.ts';
import { layClutch, previousClutchPending } from './clutch.ts';
import type { CareRequest, Tx } from './households.ts';

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
    /** Texte rédigé par ses humains (généalogie). */
    story: string;
    bonds: { animalId: string; name: string; level: BondLevel | 'inseparable' }[];
    /** Pseudo du joueur chez qui l'animal est en visite (scène de rencontre en cours). */
    visitingHost?: string;
  }[];
  /** Œufs en incubation : leur espèce reste secrète jusqu'à l'éclosion. */
  eggs: { id: string; description: EggDescription }[];
  /** Œufs pondus qui attendent au nid (hors des six places). */
  nest: { id: string; parents: string[]; depositInDays: number }[];
  /** Éclosions survenues pendant cette visite, pour jouer la scène. */
  hatched: { eggId: string; animalId: string; name: string; form: Form }[];
  /** Pontes pas encore annoncées au joueur. */
  newClutches: { parents: string[]; eggCount: number }[];
}

/** L'animal ou l'œuf visé n'existe pas dans le foyer de ce joueur. */
export class TargetNotFoundError extends Error {
  constructor(id: string) {
    super(`${id} introuvable dans ce foyer`);
  }
}

function isEggCare(care: CareRequest): care is Extract<CareRequest, { eggId: string }> {
  return care.action === 'warmEgg' || care.action === 'washEgg';
}

type HouseholdRow = typeof households.$inferSelect;

export interface SyncOptions {
  /** Visite d'un responsable : note la visite, annonce les pontes et fait éclore les œufs prêts. */
  visit: boolean;
  care?: CareRequest;
  random: Random;
}

/**
 * Synchronise un foyer jusqu'à `worldNow` : besoins, âge, œufs, liens entre animaux,
 * soin éventuel, pontes, dépôt automatique des œufs restés trop longtemps au nid et,
 * pendant une visite, éclosions. Le foyer doit déjà être verrouillé par l'appelant.
 * Utilisé par la visite du joueur comme par la tâche de fond (pontes hors connexion).
 */
export async function syncHousehold(
  tx: Tx,
  householdRow: HouseholdRow,
  worldNow: number,
  { visit, care, random }: SyncOptions,
): Promise<HouseholdView> {
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

  // --- Animaux et habitat ---
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

  // --- Liens : une jauge par paire d'animaux du foyer (créée au besoin) ---
  const ids = animalRows.map((row) => row.id);
  const kinById = new Map(animalRows.map((row) => [row.id, { id: row.id, parentA: row.parentAId, parentB: row.parentBId }]));
  const storedPairs =
    ids.length < 2
      ? []
      : await tx.select().from(pairs).where(and(inArray(pairs.animalA, ids), inArray(pairs.animalB, ids)));
  const pairByKey = new Map(storedPairs.map((p) => [`${p.animalA}|${p.animalB}`, p]));
  let pairStates: PairState[] = [];
  const newPairs = new Set<string>();
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const [a, b] = pairKey(ids[i]!, ids[j]!);
      const stored = pairByKey.get(`${a}|${b}`);
      if (!stored) newPairs.add(`${a}|${b}`);
      pairStates.push({ a, b, interaction: stored?.interaction ?? 0, at: stored?.at ?? householdRow.at });
    }
  }
  const contextOf = (pair: PairState): PairContext => ({
    together: true,
    allowed: !areRelated(kinById.get(pair.a)!, kinById.get(pair.b)!),
  });
  // Liens avec des animaux d'autres foyers (rencontres) : ils comptent pour l'exclusivité.
  const crossPairs =
    ids.length === 0
      ? []
      : await tx
          .select()
          .from(pairs)
          .where(
            or(
              and(inArray(pairs.animalA, ids), notInArray(pairs.animalB, ids)),
              and(notInArray(pairs.animalA, ids), inArray(pairs.animalB, ids)),
            ),
          );
  const lovedElsewhere = new Set<string>();
  for (const pair of crossPairs) {
    if (apartInteraction({ a: pair.animalA, b: pair.animalB, interaction: pair.interaction, at: pair.at }, worldNow) >= BALANCE.bonds.loveThreshold) {
      lovedElsewhere.add(ids.includes(pair.animalA) ? pair.animalA : pair.animalB);
    }
  }
  pairStates = advanceBonds(pairStates, worldNow, contextOf, lovedElsewhere);

  // --- Soin ---
  if (care && isEggCare(care)) {
    const index = eggRows.findIndex((row) => row.id === care.eggId);
    if (index === -1) throw new TargetNotFoundError(care.eggId);
    eggStates = eggStates.map((egg, i) => (i === index ? applyEggCare(egg, care.action) : egg));
  } else if (care) {
    const animalId = 'animalId' in care ? care.animalId : undefined;
    const index = animalId ? animalRows.findIndex((row) => row.id === animalId) : undefined;
    if (index === -1) throw new TargetNotFoundError(animalId!);
    after = applyCare(after, care.action, index);
    if (care.action === 'ball' && index === undefined) pairStates = boostBonds(pairStates, contextOf, lovedElsewhere);
  }

  // --- Pontes (GDD §8) ---
  const lastClutchAt = new Map(animalRows.map((row) => [row.id, row.lastClutchAt]));
  const stageById = new Map(animalRows.map((row, i) => [row.id, stageOf(after.animals[i]!.ageMs)]));
  const rowById = new Map(animalRows.map((row) => [row.id, row]));
  for (const [index, pair] of pairStates.entries()) {
    const parent = (id: string) => ({ stage: stageById.get(id)!, lastClutchAt: lastClutchAt.get(id) ?? null });
    const allowed = canLay(pair, parent(pair.a), parent(pair.b), worldNow, {
      related: !contextOf(pair).allowed,
      previousClutchPending: await previousClutchPending(tx, pair),
    });
    if (!allowed) continue;
    await layClutch(tx, {
      pair,
      parentA: rowById.get(pair.a)!,
      parentB: rowById.get(pair.b)!,
      nests: [householdRow.id],
      worldNow,
      random,
    });
    lastClutchAt.set(pair.a, worldNow).set(pair.b, worldNow);
    pairStates[index] = { ...pair, interaction: BALANCE.bonds.afterClutchInteraction };
  }

  // --- Nid : dépôt automatique au lieu d'adoption après 7 jours (GDD §6) ---
  await tx
    .update(eggs)
    .set({ status: 'available', householdId: null, listedAt: worldNow })
    .where(
      and(
        eq(eggs.householdId, householdRow.id),
        eq(eggs.status, 'nest'),
        lte(eggs.listedAt, worldNow - BALANCE.nestAutoDepositAfter),
      ),
    );

  // --- Enregistrement ---
  await tx
    .update(households)
    .set({
      homeCleanliness: after.homeCleanliness,
      at: after.at,
      ...(visit ? { lastVisitAt: worldNow } : {}),
    })
    .where(eq(households.id, householdRow.id));

  for (const [index, row] of animalRows.entries()) {
    const animal = after.animals[index]!;
    await tx
      .update(animals)
      .set({ needs: animal.needs, ageMs: animal.ageMs, at: animal.at, lastClutchAt: lastClutchAt.get(row.id) ?? null })
      .where(eq(animals.id, row.id));
  }

  for (const pair of pairStates) {
    if (newPairs.has(`${pair.a}|${pair.b}`)) {
      await tx.insert(pairs).values({ animalA: pair.a, animalB: pair.b, interaction: pair.interaction, at: pair.at });
    } else {
      await tx
        .update(pairs)
        .set({ interaction: pair.interaction, at: pair.at })
        .where(and(eq(pairs.animalA, pair.a), eq(pairs.animalB, pair.b)));
    }
  }

  // --- Éclosions : seulement pendant une visite, pour que le joueur assiste à la scène ---
  const hatched: HouseholdView['hatched'] = [];
  const remainingEggs: HouseholdView['eggs'] = [];
  const newborns: HouseholdView['animals'] = [];
  for (const [index, row] of eggRows.entries()) {
    const egg = eggStates[index]!;
    if (visit && isReadyToHatch(egg)) {
      const baby = newbornAnimal(worldNow);
      const name = newbornName(random);
      const [inserted] = await tx
        .insert(animals)
        .values({
          householdId: householdRow.id,
          name,
          genotype: row.genotype,
          form: row.form,
          parentAId: row.parentAId,
          parentBId: row.parentBId,
          ...baby,
        })
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
        story: '',
        bonds: [],
      });
    } else {
      await tx
        .update(eggs)
        .set({ warmth: egg.warmth, cleanliness: egg.cleanliness, progress: egg.progress, at: egg.at })
        .where(eq(eggs.id, row.id));
      remainingEggs.push({ id: row.id, description: describeEgg(egg) });
    }
  }

  // --- Nid et annonces ---
  const nameById = new Map(animalRows.map((row) => [row.id, row.name]));
  const nestRows = await tx
    .select()
    .from(eggs)
    .where(and(eq(eggs.householdId, householdRow.id), eq(eggs.status, 'nest')))
    .orderBy(asc(eggs.listedAt), asc(eggs.id));
  const parentNames = async (a: string | null, b: string | null) => {
    const wanted = [a, b].filter((id): id is string => id !== null);
    const missing = wanted.filter((id) => !nameById.has(id));
    if (missing.length > 0) {
      for (const row of await tx.select({ id: animals.id, name: animals.name }).from(animals).where(inArray(animals.id, missing))) {
        nameById.set(row.id, row.name);
      }
    }
    return wanted.map((id) => nameById.get(id) ?? '?');
  };
  const nest: HouseholdView['nest'] = [];
  for (const row of nestRows) {
    nest.push({
      id: row.id,
      parents: await parentNames(row.parentAId, row.parentBId),
      depositInDays: Math.max(1, Math.ceil((row.listedAt + BALANCE.nestAutoDepositAfter - worldNow) / DAY)),
    });
  }

  const newClutches: HouseholdView['newClutches'] = [];
  if (visit) {
    const unseen = await tx
      .update(clutches)
      .set({ seen: true })
      .where(and(eq(clutches.householdId, householdRow.id), eq(clutches.seen, false)))
      .returning();
    for (const clutch of unseen) {
      newClutches.push({ parents: await parentNames(clutch.animalA, clutch.animalB), eggCount: clutch.eggCount });
    }
  }

  // --- Vue ---
  // Noms des animaux des autres foyers avec qui un lien existe.
  const crossIds = crossPairs.map((pair) => (ids.includes(pair.animalA) ? pair.animalB : pair.animalA));
  if (crossIds.length > 0) {
    const crossRows = await tx
      .select({ id: animals.id, name: animals.name, ageMs: animals.ageMs })
      .from(animals)
      .where(inArray(animals.id, crossIds));
    for (const row of crossRows) {
      nameById.set(row.id, row.name);
      stageById.set(row.id, stageOf(row.ageMs));
    }
  }
  const crossStates: PairState[] = crossPairs.map((pair) => ({
    a: pair.animalA,
    b: pair.animalB,
    interaction: apartInteraction({ a: pair.animalA, b: pair.animalB, interaction: pair.interaction, at: pair.at }, worldNow),
    at: worldNow,
  }));
  // Animaux partis en visite le temps d'une scène de rencontre (GDD §9).
  const visits =
    ids.length === 0
      ? []
      : await tx
          .select({ animalId: meetings.inviterAnimalId, host: players.pseudo })
          .from(meetings)
          .innerJoin(players, eq(players.id, meetings.inviteeId))
          .where(and(eq(meetings.status, 'playing'), inArray(meetings.inviterAnimalId, ids)));
  const visitingHost = new Map(visits.map((v) => [v.animalId, v.host]));

  const bondsOf = (id: string): HouseholdView['animals'][number]['bonds'] =>
    [...pairStates, ...crossStates]
      .filter((pair) => pair.a === id || pair.b === id)
      .map((pair) => {
        const other = pair.a === id ? pair.b : pair.a;
        let level: BondLevel | 'inseparable' | undefined = bondLevel(pair.interaction);
        if (level === 'love' && (stageById.get(id) !== 'adult' || stageById.get(other) !== 'adult')) {
          level = 'inseparable';
        }
        return level ? { animalId: other, name: nameById.get(other) ?? '?', level } : undefined;
      })
      .filter((bond) => bond !== undefined)
      .sort((x, y) => ['love', 'inseparable', 'close', 'friend'].indexOf(x.level) - ['love', 'inseparable', 'close', 'friend'].indexOf(y.level));

  const animalViews = animalRows.map((row, index) => {
    const animal = after.animals[index]!;
    return {
      id: row.id,
      name: row.name,
      form: row.form,
      stage: stageOf(animal.ageMs),
      description: describeAnimal(animal, after.homeCleanliness),
      story: row.description,
      bonds: bondsOf(row.id),
      visitingHost: visitingHost.get(row.id),
    };
  });

  return {
    worldTime: worldNow,
    home: describeHome(after.homeCleanliness),
    slots: { used: animalRows.length + eggRows.length, total: BALANCE.householdSlots },
    animals: [...animalViews, ...newborns],
    eggs: remainingEggs,
    nest,
    hatched,
    newClutches,
  };
}

/** Foyers à synchroniser par la tâche de fond (sans les verrouiller ici). */
export async function householdIds(tx: Tx): Promise<string[]> {
  const rows = await tx.select({ id: households.id }).from(households);
  return rows.map((row) => row.id);
}
