import type { FastifyBaseLogger } from 'fastify';
import type { Database } from './db/client.ts';
import { restockAdoption } from './services/adoption.ts';
import { syncAllHouseholds } from './services/households.ts';
import { expireMeetings } from './services/meetings.ts';

export const JOB_INTERVAL_MS = 5 * 60 * 1000;

interface JobDeps {
  database: Database;
  now: () => number;
  worldNow: () => number;
  log: FastifyBaseLogger;
}

/**
 * Tâches de fond, toutes les 5 minutes (et une fois au démarrage). Chacune peut être
 * relancée sans risque : elle ne fait que ce qui manque.
 */
export function startJobs({ database, now, worldNow, log }: JobDeps) {
  const run = async () => {
    try {
      // Rencontres expirées ou abandonnées, puis les foyers (pontes hors connexion, dépôts du nid),
      // puis le lieu d'adoption.
      await expireMeetings(database, now(), worldNow());
      await syncAllHouseholds(database, worldNow());
      const result = await restockAdoption(database, now(), worldNow());
      if (result.added || result.removed) log.info(result, 'lieu d’adoption réapprovisionné');
    } catch (error) {
      log.error(error, 'échec d’une tâche de fond');
    }
  };
  void run();
  const timer = setInterval(run, JOB_INTERVAL_MS);
  timer.unref();
  return () => clearInterval(timer);
}
