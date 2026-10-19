import type { Form, MeetingInteraction, Needs, Species } from '@daligotchi/core';
import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  bigint,
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Convention : les colonnes `*_at` en `bigint` sont des instants du **monde** (ms),
 * celles en `timestamp` sont des instants réels (création, expiration).
 */
const worldTime = (name: string) => bigint(name, { mode: 'number' });

/** Joueurs : pseudo + mot de passe, comptes créés par l'administrateur. */
export const players = pgTable('players', {
  id: uuid('id').primaryKey().defaultRandom(),
  pseudo: text('pseudo').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
});

/** Sessions : seule l'empreinte SHA-256 du jeton est stockée, jamais le jeton lui-même. */
export const sessions = pgTable(
  'sessions',
  {
    tokenHash: text('token_hash').primaryKey(),
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [index('sessions_player_idx').on(table.playerId)],
);

/** Horloge du monde : une seule ligne (id = 1). */
export const worldClock = pgTable('world_clock', {
  id: integer('id').primaryKey(),
  anchorRealMs: bigint('anchor_real_ms', { mode: 'number' }).notNull(),
  anchorWorldMs: worldTime('anchor_world_ms').notNull(),
  speed: doublePrecision('speed').notNull(),
});

/** Foyer : un par joueur dans la PVJ. Instantané de l'habitat à l'instant `at`. */
export const households = pgTable('households', {
  id: uuid('id').primaryKey().defaultRandom(),
  playerId: uuid('player_id')
    .notNull()
    .unique()
    .references(() => players.id, { onDelete: 'cascade' }),
  homeCleanliness: doublePrecision('home_cleanliness').notNull(),
  at: worldTime('at').notNull(),
  lastVisitAt: worldTime('last_visit_at').notNull(),
});

/** Animal : instantané de ses besoins et de son âge à l'instant `at`. */
export const animals = pgTable(
  'animals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    /** Deux allèles d'espèce, jamais envoyés au jeu. */
    genotype: jsonb('genotype').$type<readonly [Species, Species]>().notNull(),
    form: text('form').$type<Form>().notNull(),
    needs: jsonb('needs').$type<Needs>().notNull(),
    ageMs: doublePrecision('age_ms').notNull(),
    lifespanMs: doublePrecision('lifespan_ms').notNull(),
    at: worldTime('at').notNull(),
    /** Parents (null pour un fondateur sans ascendants connus). */
    parentAId: uuid('parent_a_id').references((): AnyPgColumn => animals.id),
    parentBId: uuid('parent_b_id').references((): AnyPgColumn => animals.id),
    /** Description rédigée par ses humains, visible dans la généalogie (GDD §7). */
    description: text('description').notNull().default(''),
    /** Dernière ponte, tous partenaires confondus (récupération de deux semaines). */
    lastClutchAt: worldTime('last_clutch_at'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('animals_household_idx').on(table.householdId)],
);

/**
 * Jauge d'interaction d'une paire d'animaux (GDD §8), instantané à l'instant `at`.
 * Les identifiants sont rangés : animal_a < animal_b.
 */
export const pairs = pgTable(
  'pairs',
  {
    animalA: uuid('animal_a').notNull().references(() => animals.id),
    animalB: uuid('animal_b').notNull().references(() => animals.id),
    interaction: doublePrecision('interaction').notNull(),
    at: worldTime('at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.animalA, table.animalB] }),
    check('pairs_ordered', sql`${table.animalA} < ${table.animalB}`),
  ],
);

/** Pontes : une ligne par ponte, numérotée par paire. L'unicité empêche toute ponte en double. */
export const clutches = pgTable(
  'clutches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    animalA: uuid('animal_a').notNull().references(() => animals.id),
    animalB: uuid('animal_b').notNull().references(() => animals.id),
    number: integer('number').notNull(),
    householdId: uuid('household_id').notNull().references(() => households.id),
    laidAt: worldTime('laid_at').notNull(),
    eggCount: integer('egg_count').notNull(),
    /** Le joueur a-t-il déjà vu l'annonce de cette ponte ? */
    seen: boolean('seen').notNull().default(false),
  },
  (table) => [unique('clutches_pair_number').on(table.animalA, table.animalB, table.number)],
);

export type EggStatus = 'nest' | 'available' | 'incubating' | 'hatched' | 'removed';

/**
 * Œuf : au nid après une ponte (`nest`, hors des six places), au lieu d'adoption
 * (`available`, sans foyer), en incubation dans un foyer,
 * éclos (il reste pour la généalogie) ou retiré. L'espèce est tirée une seule fois,
 * à la création, et n'est jamais montrée avant l'éclosion.
 */
export const eggs = pgTable(
  'eggs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    status: text('status').$type<EggStatus>().notNull(),
    /** `game` : fondateur créé par le jeu ; `player` : pondu par des animaux de joueurs. */
    origin: text('origin').$type<'game' | 'player'>().notNull(),
    householdId: uuid('household_id').references(() => households.id, { onDelete: 'restrict' }),
    genotype: jsonb('genotype').$type<readonly [Species, Species]>().notNull(),
    form: text('form').$type<Form>().notNull(),
    warmth: doublePrecision('warmth').notNull(),
    cleanliness: doublePrecision('cleanliness').notNull(),
    progress: doublePrecision('progress').notNull(),
    at: worldTime('at').notNull(),
    /** Arrivée à sa place actuelle : au nid (dépôt automatique après 7 jours) ou au lieu d'adoption. */
    listedAt: worldTime('listed_at').notNull(),
    parentAId: uuid('parent_a_id').references(() => animals.id),
    parentBId: uuid('parent_b_id').references(() => animals.id),
    clutchId: uuid('clutch_id').references(() => clutches.id),
    hatchedAnimalId: uuid('hatched_animal_id').references(() => animals.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('eggs_status_idx').on(table.status),
    index('eggs_household_idx').on(table.householdId),
    check(
      'eggs_status_household',
      sql`${table.status} in ('nest', 'available', 'incubating', 'hatched', 'removed')
        and (${table.status} not in ('incubating', 'nest') or ${table.householdId} is not null)
        and (${table.status} <> 'available' or ${table.householdId} is null)`,
    ),
  ],
);

/** Amitiés entre joueurs (identifiants rangés : player_a < player_b). */
export const friendships = pgTable(
  'friendships',
  {
    playerA: uuid('player_a').notNull().references(() => players.id, { onDelete: 'cascade' }),
    playerB: uuid('player_b').notNull().references(() => players.id, { onDelete: 'cascade' }),
    requestedBy: uuid('requested_by').notNull().references(() => players.id, { onDelete: 'cascade' }),
    status: text('status').$type<'pending' | 'accepted'>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.playerA, table.playerB] }),
    check('friendships_ordered', sql`${table.playerA} < ${table.playerB}`),
  ],
);

/** Animaux inscrits volontairement au lieu de rencontre (GDD §9). */
export const meetingListings = pgTable('meeting_listings', {
  animalId: uuid('animal_id').primaryKey().references(() => animals.id),
  listedAt: timestamp('listed_at', { withTimezone: true }).notNull().defaultNow(),
});

export type MeetingStatus = 'pending' | 'playing' | 'done' | 'declined' | 'expired';

/**
 * Rencontre : invitation, puis scène jouée par l'invité. Les effets sont appliqués une seule
 * fois (`effects_applied_at`) ; l'invitant revoit ensuite la scène comme un souvenir.
 * Les dates sont réelles : ce sont des humains qui se répondent.
 */
export const meetings = pgTable(
  'meetings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    inviterId: uuid('inviter_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
    inviteeId: uuid('invitee_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
    inviterAnimalId: uuid('inviter_animal_id').notNull().references(() => animals.id),
    inviteeAnimalId: uuid('invitee_animal_id').notNull().references(() => animals.id),
    phrase: text('phrase').notNull(),
    status: text('status').$type<MeetingStatus>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    interactions: jsonb('interactions').$type<MeetingInteraction[]>().notNull().default([]),
    outcome: jsonb('outcome').$type<MeetingOutcome>(),
    effectsAppliedAt: timestamp('effects_applied_at', { withTimezone: true }),
    inviterSeen: boolean('inviter_seen').notNull().default(false),
  },
  (table) => [
    index('meetings_invitee_idx').on(table.inviteeId, table.status),
    index('meetings_inviter_idx').on(table.inviterId, table.status),
  ],
);

/** Résultat d'une rencontre, montré à l'invité puis dans le souvenir. */
export interface MeetingOutcome {
  level: 'love' | 'inseparable' | 'close' | 'friend' | 'none';
  eggCount: number;
}
