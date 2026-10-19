import { hash, verify } from '@node-rs/argon2';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from '../db/client.ts';
import { households, players } from '../db/schema.ts';

export const PseudoSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_-]{3,20}$/, '3 à 20 caractères : lettres sans accents, chiffres, - ou _');

export const PasswordSchema = z.string().min(8, 'au moins 8 caractères').max(200);

export interface Player {
  id: string;
  pseudo: string;
}

/** Empreinte factice : vérifier un pseudo inconnu prend le même temps qu'un pseudo connu. */
const DUMMY_HASH_PROMISE = hash('mot-de-passe-factice');

/** Crée un joueur et son foyer vide, dans une même transaction. */
export async function createPlayer(
  { db }: Database,
  input: { pseudo: string; password: string },
  worldNow: number,
): Promise<Player> {
  const pseudo = PseudoSchema.parse(input.pseudo);
  const passwordHash = await hash(PasswordSchema.parse(input.password));
  return db.transaction(async (tx) => {
    const [player] = await tx
      .insert(players)
      .values({ pseudo, passwordHash })
      .returning({ id: players.id, pseudo: players.pseudo });
    await tx.insert(households).values({
      playerId: player!.id,
      homeCleanliness: 100,
      at: worldNow,
      lastVisitAt: worldNow,
    });
    return player!;
  });
}

export async function setPassword({ db }: Database, pseudo: string, password: string) {
  const passwordHash = await hash(PasswordSchema.parse(password));
  const updated = await db
    .update(players)
    .set({ passwordHash })
    .where(eq(players.pseudo, PseudoSchema.parse(pseudo)))
    .returning({ id: players.id });
  return updated.length > 0;
}

export async function findPlayerByPseudo({ db }: Database, pseudo: string) {
  const parsed = PseudoSchema.safeParse(pseudo);
  if (!parsed.success) return undefined;
  const [player] = await db.select().from(players).where(eq(players.pseudo, parsed.data));
  return player;
}

/** Renvoie le joueur si le pseudo et le mot de passe correspondent, sinon undefined. */
export async function verifyCredentials(
  database: Database,
  pseudo: string,
  password: string,
): Promise<Player | undefined> {
  const player = await findPlayerByPseudo(database, pseudo);
  const ok = await verify(player?.passwordHash ?? (await DUMMY_HASH_PROMISE), password);
  return player && ok ? { id: player.id, pseudo: player.pseudo } : undefined;
}

export async function listPlayers({ db }: Database) {
  return db
    .select({ pseudo: players.pseudo, createdAt: players.createdAt, lastSeenAt: players.lastSeenAt })
    .from(players)
    .orderBy(players.pseudo);
}
