/**
 * Administration en ligne de commande (pas d'accès web).
 *
 *   pnpm admin create-user <pseudo> [--password <mdp>]      crée un joueur et son foyer
 *   pnpm admin reset-password <pseudo> [--password <mdp>]   change le mot de passe
 *   pnpm admin list-users                                   liste les joueurs
 *   pnpm admin seed-test-accounts                           3 comptes de test (hors production)
 *
 * Sans --password, un mot de passe est généré et affiché une seule fois.
 * --allow-weak-password accepte un mot de passe de moins de 8 caractères (déconseillé sur un site public).
 */
import { randomInt } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { DAY, makeGenotype, WEEK, worldTimeAt } from '@daligotchi/core';
import { z } from 'zod';
import { loadConfig } from '../config.ts';
import { createDb, type Database } from '../db/client.ts';
import { addFounderAnimal } from '../services/households.ts';
import { createPlayer, findPlayerByPseudo, listPlayers, setPassword } from '../services/players.ts';
import { loadWorldClock } from '../services/world.ts';

const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

/** Mot de passe lisible : 3 groupes de 4 caractères sans lettres ambiguës (ex. k3fp-9qzm-tr7a). */
export function generatePassword(): string {
  const group = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
  return [group(), group(), group()].join('-');
}

const TEST_ACCOUNTS = [
  { pseudo: 'essai1', fox: { name: 'Noisette', ageMs: 3 * DAY } },
  { pseudo: 'essai2', fox: { name: 'Flamme', ageMs: 6 * WEEK } },
  { pseudo: 'essai3', fox: { name: 'Papi Roux', ageMs: 15 * WEEK } },
] as const;

async function seedTestAccounts(database: Database, worldNow: number, outputFile: string) {
  const lines = [
    '# Comptes de test Dalígotchi (fichier local, jamais dans Git)',
    '# pseudo : mot de passe',
  ];
  for (const account of TEST_ACCOUNTS) {
    if (await findPlayerByPseudo(database, account.pseudo)) {
      console.log(`${account.pseudo} existe déjà : ignoré (utiliser reset-password si besoin).`);
      continue;
    }
    const password = generatePassword();
    const player = await createPlayer(database, { pseudo: account.pseudo, password }, worldNow);
    await addFounderAnimal(database, {
      playerId: player.id,
      name: account.fox.name,
      genotype: makeGenotype('renard', 'renard'),
      ageMs: account.fox.ageMs,
      worldNow,
    });
    lines.push(`${account.pseudo} : ${password}`);
    console.log(`${account.pseudo} créé avec le renard ${account.fox.name}.`);
  }
  if (lines.length > 2) {
    await mkdir(path.dirname(outputFile), { recursive: true });
    await writeFile(outputFile, `${lines.join('\n')}\n`, { mode: 0o600 });
    console.log(`Mots de passe enregistrés dans ${outputFile}`);
  }
}

async function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      password: { type: 'string' },
      'allow-weak-password': { type: 'boolean', default: false },
    },
  });
  const [command, pseudo] = positionals;
  const config = loadConfig();
  const database = createDb(config.DATABASE_URL);

  try {
    const clock = await loadWorldClock(database, config.WORLD_SPEED, Date.now());
    const worldNow = worldTimeAt(clock, Date.now());

    switch (command) {
      case 'create-user': {
        if (!pseudo) throw new Error('Usage : create-user <pseudo> [--password <mdp>]');
        const password = values.password ?? generatePassword();
        const weak = { allowWeakPassword: values['allow-weak-password'] };
        const player = await createPlayer(database, { pseudo, password }, worldNow, weak);
        console.log(`Joueur « ${player.pseudo} » créé.`);
        if (!values.password) console.log(`Mot de passe (à transmettre au joueur) : ${password}`);
        break;
      }
      case 'reset-password': {
        if (!pseudo) throw new Error('Usage : reset-password <pseudo> [--password <mdp>]');
        const password = values.password ?? generatePassword();
        const weak = { allowWeakPassword: values['allow-weak-password'] };
        if (!(await setPassword(database, pseudo, password, weak))) throw new Error(`Joueur « ${pseudo} » introuvable.`);
        console.log(`Mot de passe de « ${pseudo} » changé.`);
        if (!values.password) console.log(`Nouveau mot de passe : ${password}`);
        break;
      }
      case 'list-users': {
        for (const player of await listPlayers(database)) {
          const seen = player.lastSeenAt ? player.lastSeenAt.toLocaleString('fr-FR') : 'jamais connecté';
          console.log(`${player.pseudo.padEnd(20)} ${seen}`);
        }
        break;
      }
      case 'seed-test-accounts': {
        if (config.NODE_ENV === 'production') throw new Error('Interdit en production.');
        await seedTestAccounts(
          database,
          worldNow,
          path.resolve(process.env.TEST_ACCOUNTS_FILE ?? '../../.data/comptes-de-test.txt'),
        );
        break;
      }
      default:
        throw new Error('Commandes : create-user, reset-password, list-users, seed-test-accounts');
    }
  } finally {
    await database.sql.end();
  }
}

main().catch((error: unknown) => {
  if (error instanceof z.ZodError) {
    console.error(error.issues.map((issue) => issue.message).join('\n'));
  } else {
    console.error(error instanceof Error ? error.message : error);
  }
  process.exitCode = 1;
});
