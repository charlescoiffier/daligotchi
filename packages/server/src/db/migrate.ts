import path from 'node:path';
import { loadConfig } from '../config.ts';
import { createDb, runMigrations } from './client.ts';

const config = loadConfig();
const database = createDb(config.DATABASE_URL);
const folder = path.resolve(config.MIGRATIONS_DIR);

try {
  await runMigrations(database, folder);
  console.log(`Migrations appliquées depuis ${folder}`);
} finally {
  await database.sql.end();
}
