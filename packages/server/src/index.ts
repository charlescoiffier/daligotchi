import { buildApp } from './app.ts';
import { loadConfig } from './config.ts';
import { createDb } from './db/client.ts';
import { startJobs } from './jobs.ts';

const config = loadConfig();
const database = createDb(config.DATABASE_URL);
const app = await buildApp({ config, database });

const stopJobs = startJobs({ database, now: Date.now, worldNow: app.worldNow, log: app.log });

const shutdown = async () => {
  stopJobs();
  await app.close();
  await database.sql.end();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await app.listen({ host: config.HOST, port: config.SERVER_PORT });
