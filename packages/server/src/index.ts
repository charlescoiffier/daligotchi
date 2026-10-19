import { buildApp } from './app.ts';
import { loadConfig } from './config.ts';
import { createDb } from './db/client.ts';

const config = loadConfig();
const database = createDb(config.DATABASE_URL);
const app = await buildApp({ config, database });

const shutdown = async () => {
  await app.close();
  await database.sql.end();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await app.listen({ host: config.HOST, port: config.SERVER_PORT });
