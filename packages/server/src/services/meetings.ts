import {
  apartInteraction,
  applyMeeting,
  areRelated,
  BALANCE,
  bondLevel,
  canLay,
  defaultRandom,
  type MeetingInteraction,
  meetingBoost,
  type PairState,
  pairKey,
  type Phrase,
  type Random,
  stageOf,
} from '@daligotchi/core';
import { and, count, eq, inArray, lt, ne, or } from 'drizzle-orm';
import type { Database } from '../db/client.ts';
import { animals, households, type MeetingOutcome, meetings, pairs, players } from '../db/schema.ts';
import { layClutch, previousClutchPending } from './clutch.ts';
import type { Tx } from './households.ts';
import { areFriends, isListed, ownerOf, type PublicAnimal } from './social.ts';
import { syncHousehold } from './sync.ts';

export class MeetingError extends Error {
  constructor(
    readonly code:
      | 'not_yours'
      | 'not_reachable'
      | 'same_owner'
      | 'too_many_pending'
      | 'not_found'
      | 'busy',
  ) {
    super(code);
  }
}

type MeetingRow = typeof meetings.$inferSelect;

/** Rencontre telle que le jeu la voit : les deux animaux, l'autre joueur, la phrase, le résultat. */
export interface MeetingView {
  id: string;
  status: MeetingRow['status'];
  phrase: string;
  inviter: string;
  invitee: string;
  inviterAnimal: PublicAnimal;
  inviteeAnimal: PublicAnimal;
  interactions: MeetingInteraction[];
  outcome: MeetingOutcome | null;
}

/**
 * Invitation : un de mes animaux rencontre l'animal d'un autre joueur, qui doit être
 * mon ami ou avoir inscrit son animal au lieu de rencontre (GDD §9).
 */
export async function invite(
  database: Database,
  me: string,
  input: { myAnimalId: string; theirAnimalId: string; phrase: Phrase },
  realNowMs: number,
) {
  if ((await ownerOf(database, input.myAnimalId)) !== me) throw new MeetingError('not_yours');
  const other = await ownerOf(database, input.theirAnimalId);
  if (!other) throw new MeetingError('not_found');
  if (other === me) throw new MeetingError('same_owner');
  if (!(await areFriends(database, me, other)) && !(await isListed(database, input.theirAnimalId))) {
    throw new MeetingError('not_reachable');
  }
  const [pending] = await database.db
    .select({ n: count() })
    .from(meetings)
    .where(and(eq(meetings.inviterAnimalId, input.myAnimalId), eq(meetings.status, 'pending')));
  if ((pending?.n ?? 0) >= BALANCE.meetings.maxPendingPerAnimal) throw new MeetingError('too_many_pending');

  const [row] = await database.db
    .insert(meetings)
    .values({
      inviterId: me,
      inviteeId: other,
      inviterAnimalId: input.myAnimalId,
      inviteeAnimalId: input.theirAnimalId,
      phrase: input.phrase,
      status: 'pending',
      createdAt: new Date(realNowMs),
    })
    .returning({ id: meetings.id });
  return row!;
}

async function toViews({ db }: Database, rows: MeetingRow[]): Promise<MeetingView[]> {
  if (rows.length === 0) return [];
  const animalIds = [...new Set(rows.flatMap((row) => [row.inviterAnimalId, row.inviteeAnimalId]))];
  const playerIds = [...new Set(rows.flatMap((row) => [row.inviterId, row.inviteeId]))];
  const animalRows = await db
    .select({ id: animals.id, name: animals.name, form: animals.form, ageMs: animals.ageMs })
    .from(animals)
    .where(inArray(animals.id, animalIds));
  const playerRows = await db.select({ id: players.id, pseudo: players.pseudo }).from(players).where(inArray(players.id, playerIds));
  const animal = new Map(animalRows.map(({ ageMs, ...a }) => [a.id, { ...a, stage: stageOf(ageMs) }]));
  const pseudo = new Map(playerRows.map((p) => [p.id, p.pseudo]));
  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    phrase: row.phrase,
    inviter: pseudo.get(row.inviterId) ?? '?',
    invitee: pseudo.get(row.inviteeId) ?? '?',
    inviterAnimal: animal.get(row.inviterAnimalId)!,
    inviteeAnimal: animal.get(row.inviteeAnimalId)!,
    interactions: row.interactions,
    outcome: row.outcome,
  }));
}

/** Ce qui attend le joueur : invitations reçues et envoyées, scènes à reprendre, souvenirs. */
export async function listMeetings(database: Database, me: string) {
  const { db } = database;
  const received = await db.select().from(meetings).where(and(eq(meetings.inviteeId, me), eq(meetings.status, 'pending')));
  const sent = await db.select().from(meetings).where(and(eq(meetings.inviterId, me), eq(meetings.status, 'pending')));
  const toResume = await db.select().from(meetings).where(and(eq(meetings.inviteeId, me), eq(meetings.status, 'playing')));
  const souvenirs = await db
    .select()
    .from(meetings)
    .where(and(eq(meetings.inviterId, me), eq(meetings.status, 'done'), eq(meetings.inviterSeen, false)));
  return {
    received: await toViews(database, received),
    sent: await toViews(database, sent),
    toResume: await toViews(database, toResume),
    souvenirs: await toViews(database, souvenirs),
  };
}

/**
 * L'invité accepte : la scène commence. Un animal ne peut être que dans une scène à la fois.
 * La mise à jour conditionnelle empêche d'accepter deux fois.
 */
export async function acceptMeeting(database: Database, me: string, meetingId: string, realNowMs: number) {
  return database.db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(meetings)
      .where(and(eq(meetings.id, meetingId), eq(meetings.inviteeId, me), eq(meetings.status, 'pending')))
      .for('update');
    if (!row) throw new MeetingError('not_found');
    const [busy] = await tx
      .select({ n: count() })
      .from(meetings)
      .where(
        and(
          eq(meetings.status, 'playing'),
          ne(meetings.id, meetingId),
          or(
            inArray(meetings.inviterAnimalId, [row.inviterAnimalId, row.inviteeAnimalId]),
            inArray(meetings.inviteeAnimalId, [row.inviterAnimalId, row.inviteeAnimalId]),
          ),
        ),
      );
    if ((busy?.n ?? 0) > 0) throw new MeetingError('busy');
    const [started] = await tx
      .update(meetings)
      .set({ status: 'playing', startedAt: new Date(realNowMs) })
      .where(eq(meetings.id, meetingId))
      .returning();
    return (await toViews(database, [started!]))[0]!;
  });
}

export async function declineMeeting({ db }: Database, me: string, meetingId: string) {
  const updated = await db
    .update(meetings)
    .set({ status: 'declined' })
    .where(and(eq(meetings.id, meetingId), eq(meetings.inviteeId, me), eq(meetings.status, 'pending')))
    .returning({ id: meetings.id });
  if (updated.length === 0) throw new MeetingError('not_found');
}

/** Ne garde que des interactions valides, dans l'ordre, et en nombre raisonnable. */
export function cleanInteractions(raw: readonly MeetingInteraction[]): MeetingInteraction[] {
  return raw
    .filter((i) => (i.kind === 'pet' && (i.animal === 'inviter' || i.animal === 'invitee')) || i.kind === 'ball')
    .map((i) => ({ kind: i.kind, ...(i.kind === 'pet' ? { animal: i.animal } : {}), at: Math.max(0, Math.round(i.at)) }))
    .sort((x, y) => x.at - y.at)
    .slice(0, 60);
}

async function lockHouseholdById(tx: Tx, id: string) {
  const [row] = await tx.select().from(households).where(eq(households.id, id)).for('update');
  if (!row) throw new Error(`Foyer ${id} introuvable`);
  return row;
}

/**
 * Effets d'une rencontre, appliqués une seule fois (GDD §9) : la jauge de la paire monte
 * selon les interactions, dans le respect de la parenté et de l'exclusivité ; si toutes les
 * conditions sont réunies, la paire pond, et les œufs sont répartis entre les nids des deux
 * propriétaires (simplification du nid partagé pour la PVJ).
 */
async function applyEffects(
  tx: Tx,
  row: MeetingRow,
  interactions: MeetingInteraction[],
  worldNow: number,
  random: Random,
): Promise<MeetingOutcome> {
  const [inviterAnimal] = await tx.select().from(animals).where(eq(animals.id, row.inviterAnimalId));
  const [inviteeAnimal] = await tx.select().from(animals).where(eq(animals.id, row.inviteeAnimalId));
  if (!inviterAnimal || !inviteeAnimal || inviterAnimal.diedAt !== null || inviteeAnimal.diedAt !== null) {
    return { level: 'none', eggCount: 0 };
  }

  // Les deux foyers sont verrouillés dans un ordre fixe (pas d'interblocage), puis mis à jour.
  const householdIds = [...new Set([inviterAnimal.householdId, inviteeAnimal.householdId])].sort();
  for (const id of householdIds) {
    const household = await lockHouseholdById(tx, id);
    await syncHousehold(tx, household, worldNow, { visit: false, random });
  }
  const [a, b] = pairKey(inviterAnimal.id, inviteeAnimal.id);
  const rowA = (await tx.select().from(animals).where(eq(animals.id, a)))[0]!;
  const rowB = (await tx.select().from(animals).where(eq(animals.id, b)))[0]!;

  const [stored] = await tx.select().from(pairs).where(and(eq(pairs.animalA, a), eq(pairs.animalB, b)));
  const current: PairState = {
    a,
    b,
    interaction: stored ? apartInteraction({ a, b, interaction: stored.interaction, at: stored.at }, worldNow) : 0,
    at: worldNow,
  };

  // Un des deux aime-t-il déjà un autre animal ?
  const others = await tx
    .select()
    .from(pairs)
    .where(or(inArray(pairs.animalA, [a, b]), inArray(pairs.animalB, [a, b])));
  const lovedElsewhere = others.some(
    (p) =>
      !(p.animalA === a && p.animalB === b) &&
      apartInteraction({ a: p.animalA, b: p.animalB, interaction: p.interaction, at: p.at }, worldNow) >=
        BALANCE.bonds.loveThreshold,
  );
  const related = areRelated(
    { id: a, parentA: rowA.parentAId, parentB: rowA.parentBId },
    { id: b, parentA: rowB.parentAId, parentB: rowB.parentBId },
  );
  let pair = applyMeeting(current, meetingBoost(interactions.length), { allowed: !related, lovedElsewhere }, worldNow);

  let eggCount = 0;
  const parent = (r: typeof rowA) => ({ stage: stageOf(r.ageMs), lastClutchAt: r.lastClutchAt });
  if (canLay(pair, parent(rowA), parent(rowB), worldNow, { related, previousClutchPending: await previousClutchPending(tx, pair) })) {
    eggCount = await layClutch(tx, {
      pair,
      parentA: rowA,
      parentB: rowB,
      nests: [inviteeAnimal.householdId, inviterAnimal.householdId],
      worldNow,
      random,
      announced: true,
    });
    pair = { ...pair, interaction: BALANCE.bonds.afterClutchInteraction };
  }

  if (stored) {
    await tx.update(pairs).set({ interaction: pair.interaction, at: worldNow }).where(and(eq(pairs.animalA, a), eq(pairs.animalB, b)));
  } else {
    await tx.insert(pairs).values({ animalA: a, animalB: b, interaction: pair.interaction, at: worldNow });
  }

  // Le résultat montre le lien atteint pendant la rencontre (avant l'éventuelle ponte).
  const reached = eggCount > 0 ? 'love' : bondLevel(pair.interaction);
  const young = stageOf(rowA.ageMs) !== 'adult' || stageOf(rowB.ageMs) !== 'adult';
  return { level: reached === 'love' && young ? 'inseparable' : (reached ?? 'none'), eggCount };
}

/**
 * Fin de la scène (par l'invité, ou automatiquement après le délai) : les effets ne sont
 * appliqués qu'une fois ; terminer une seconde fois renvoie simplement le résultat déjà obtenu.
 */
export async function finishMeeting(
  database: Database,
  meetingId: string,
  options: { by?: string; interactions: readonly MeetingInteraction[]; realNowMs: number; worldNow: number; random?: Random },
): Promise<MeetingOutcome> {
  return database.db.transaction(async (tx) => {
    const [row] = await tx.select().from(meetings).where(eq(meetings.id, meetingId)).for('update');
    if (!row || (options.by && row.inviteeId !== options.by)) throw new MeetingError('not_found');
    if (row.effectsAppliedAt) return row.outcome ?? { level: 'none', eggCount: 0 };
    if (row.status !== 'playing') throw new MeetingError('not_found');

    const interactions = cleanInteractions(options.interactions);
    const outcome = await applyEffects(tx, row, interactions, options.worldNow, options.random ?? defaultRandom);
    await tx
      .update(meetings)
      .set({
        status: 'done',
        interactions,
        outcome,
        finishedAt: new Date(options.realNowMs),
        effectsAppliedAt: new Date(options.realNowMs),
      })
      .where(eq(meetings.id, meetingId));
    return outcome;
  });
}

/** L'invitant a regardé le souvenir. */
export async function markSouvenirSeen({ db }: Database, me: string, meetingId: string) {
  await db
    .update(meetings)
    .set({ inviterSeen: true })
    .where(and(eq(meetings.id, meetingId), eq(meetings.inviterId, me), eq(meetings.status, 'done')));
}

/** Tâche de fond : invitations sans réponse expirées, scènes abandonnées terminées. */
export async function expireMeetings(database: Database, realNowMs: number, worldNow: number) {
  const { invitationExpiryMs, sceneTimeoutMs } = BALANCE.meetings;
  await database.db
    .update(meetings)
    .set({ status: 'expired' })
    .where(and(eq(meetings.status, 'pending'), lt(meetings.createdAt, new Date(realNowMs - invitationExpiryMs))));
  const abandoned = await database.db
    .select({ id: meetings.id })
    .from(meetings)
    .where(and(eq(meetings.status, 'playing'), lt(meetings.startedAt, new Date(realNowMs - sceneTimeoutMs))));
  for (const { id } of abandoned) {
    await finishMeeting(database, id, { interactions: [], realNowMs, worldNow });
  }
  return abandoned.length;
}
