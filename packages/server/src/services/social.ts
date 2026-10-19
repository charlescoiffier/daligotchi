import { type Form, type Stage, stageOf } from '@daligotchi/core';
import { and, eq, inArray, ne, or } from 'drizzle-orm';
import type { Database } from '../db/client.ts';
import { animals, friendships, households, meetingListings, players } from '../db/schema.ts';
import { findPlayerByPseudo } from './players.ts';

export class SocialError extends Error {
  constructor(readonly code: 'unknown_player' | 'self' | 'not_friends' | 'not_yours' | 'not_found') {
    super(code);
  }
}

/** Animal tel qu'un autre joueur le voit : jamais ses allèles ni ses besoins. */
export interface PublicAnimal {
  id: string;
  name: string;
  form: Form;
  stage: Stage;
}

function ordered(x: string, y: string): [string, string] {
  return x < y ? [x, y] : [y, x];
}

export async function areFriends({ db }: Database, x: string, y: string): Promise<boolean> {
  const [a, b] = ordered(x, y);
  const [row] = await db
    .select({ status: friendships.status })
    .from(friendships)
    .where(and(eq(friendships.playerA, a), eq(friendships.playerB, b)));
  return row?.status === 'accepted';
}

/**
 * Demande d'amitié par pseudo. Si l'autre joueur avait déjà demandé, l'amitié est acceptée
 * aussitôt (les deux le veulent).
 */
export async function requestFriend(database: Database, me: string, pseudo: string) {
  const other = await findPlayerByPseudo(database, pseudo);
  if (!other) throw new SocialError('unknown_player');
  if (other.id === me) throw new SocialError('self');
  const [a, b] = ordered(me, other.id);
  const { db } = database;
  const [existing] = await db
    .select()
    .from(friendships)
    .where(and(eq(friendships.playerA, a), eq(friendships.playerB, b)));
  if (existing?.status === 'accepted') return { status: 'accepted' as const, pseudo: other.pseudo };
  if (existing && existing.requestedBy !== me) {
    await db.update(friendships).set({ status: 'accepted' }).where(and(eq(friendships.playerA, a), eq(friendships.playerB, b)));
    return { status: 'accepted' as const, pseudo: other.pseudo };
  }
  if (!existing) await db.insert(friendships).values({ playerA: a, playerB: b, requestedBy: me, status: 'pending' });
  return { status: 'pending' as const, pseudo: other.pseudo };
}

export async function acceptFriend({ db }: Database, me: string, otherId: string) {
  const [a, b] = ordered(me, otherId);
  const updated = await db
    .update(friendships)
    .set({ status: 'accepted' })
    .where(and(eq(friendships.playerA, a), eq(friendships.playerB, b), ne(friendships.requestedBy, me)))
    .returning();
  if (updated.length === 0) throw new SocialError('not_found');
}

/** Refuser une demande, l'annuler, ou retirer un ami. */
export async function removeFriend({ db }: Database, me: string, otherId: string) {
  const [a, b] = ordered(me, otherId);
  await db.delete(friendships).where(and(eq(friendships.playerA, a), eq(friendships.playerB, b)));
}

export async function listFriends({ db }: Database, me: string) {
  const rows = await db
    .select()
    .from(friendships)
    .where(or(eq(friendships.playerA, me), eq(friendships.playerB, me)));
  const otherIds = rows.map((row) => (row.playerA === me ? row.playerB : row.playerA));
  const pseudos =
    otherIds.length === 0
      ? []
      : await db.select({ id: players.id, pseudo: players.pseudo }).from(players).where(inArray(players.id, otherIds));
  const pseudoOf = new Map(pseudos.map((p) => [p.id, p.pseudo]));
  const entry = (row: (typeof rows)[number]) => {
    const id = row.playerA === me ? row.playerB : row.playerA;
    return { id, pseudo: pseudoOf.get(id) ?? '?' };
  };
  return {
    friends: rows.filter((row) => row.status === 'accepted').map(entry),
    incoming: rows.filter((row) => row.status === 'pending' && row.requestedBy !== me).map(entry),
    outgoing: rows.filter((row) => row.status === 'pending' && row.requestedBy === me).map(entry),
  };
}

async function publicAnimals({ db }: Database, where: ReturnType<typeof eq>) {
  const rows = await db
    .select({ id: animals.id, name: animals.name, form: animals.form, ageMs: animals.ageMs })
    .from(animals)
    .innerJoin(households, eq(households.id, animals.householdId))
    .where(where);
  return rows.map(({ ageMs, ...animal }): PublicAnimal => ({ ...animal, stage: stageOf(ageMs) }));
}

/** Animaux d'un ami (pour l'inviter). Réservé aux amis. */
export async function friendAnimals(database: Database, me: string, friendId: string): Promise<PublicAnimal[]> {
  if (!(await areFriends(database, me, friendId))) throw new SocialError('not_friends');
  return publicAnimals(database, eq(households.playerId, friendId));
}

/** Propriétaire d'un animal (ou undefined). */
export async function ownerOf({ db }: Database, animalId: string): Promise<string | undefined> {
  const [row] = await db
    .select({ playerId: households.playerId })
    .from(animals)
    .innerJoin(households, eq(households.id, animals.householdId))
    .where(eq(animals.id, animalId));
  return row?.playerId;
}

// --- Lieu de rencontre (inscription volontaire) ---

export async function setListing(database: Database, me: string, animalId: string, listed: boolean) {
  if ((await ownerOf(database, animalId)) !== me) throw new SocialError('not_yours');
  if (listed) {
    await database.db.insert(meetingListings).values({ animalId }).onConflictDoNothing();
  } else {
    await database.db.delete(meetingListings).where(eq(meetingListings.animalId, animalId));
  }
}

export async function isListed({ db }: Database, animalId: string): Promise<boolean> {
  const [row] = await db.select().from(meetingListings).where(eq(meetingListings.animalId, animalId));
  return Boolean(row);
}

/** Animaux inscrits par les autres joueurs, et les miens qui le sont. */
export async function meetingPlace({ db }: Database, me: string) {
  const rows = await db
    .select({
      id: animals.id,
      name: animals.name,
      form: animals.form,
      ageMs: animals.ageMs,
      ownerId: households.playerId,
      owner: players.pseudo,
    })
    .from(meetingListings)
    .innerJoin(animals, eq(animals.id, meetingListings.animalId))
    .innerJoin(households, eq(households.id, animals.householdId))
    .innerJoin(players, eq(players.id, households.playerId))
    .orderBy(meetingListings.listedAt);
  return {
    others: rows
      .filter((row) => row.ownerId !== me)
      .map((row) => ({ id: row.id, name: row.name, form: row.form, stage: stageOf(row.ageMs), owner: row.owner })),
    mine: rows.filter((row) => row.ownerId === me).map((row) => row.id),
  };
}
