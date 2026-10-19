import type { Form, Needs, Species } from '@daligotchi/core';
import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
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
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('animals_household_idx').on(table.householdId)],
);

export type EggStatus = 'available' | 'incubating' | 'hatched' | 'removed';

/**
 * Œuf : au lieu d'adoption (`available`, sans foyer), en incubation dans un foyer,
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
    /** Arrivée au lieu d'adoption (pour retirer les plus anciens). */
    listedAt: worldTime('listed_at').notNull(),
    hatchedAnimalId: uuid('hatched_animal_id').references(() => animals.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('eggs_status_idx').on(table.status),
    index('eggs_household_idx').on(table.householdId),
    check(
      'eggs_status_household',
      sql`${table.status} in ('available', 'incubating', 'hatched', 'removed')
        and (${table.status} <> 'incubating' or ${table.householdId} is not null)
        and (${table.status} <> 'available' or ${table.householdId} is null)`,
    ),
  ],
);
