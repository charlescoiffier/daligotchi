import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/** Joueurs : pseudo + mot de passe, comptes créés par l'administrateur (étape 2). */
export const players = pgTable('players', {
  id: uuid('id').primaryKey().defaultRandom(),
  pseudo: text('pseudo').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
});
