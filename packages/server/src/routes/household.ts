import type { FastifyPluginAsync } from 'fastify';
import type { Database } from '../db/client.ts';
import { visitHousehold } from '../services/households.ts';

interface HouseholdRoutesOptions {
  database: Database;
  worldNow: () => number;
}

export const householdRoutes: FastifyPluginAsync<HouseholdRoutesOptions> = async (
  app,
  { database, worldNow },
) => {
  app.get('/household', { preHandler: app.requireAuth }, async (request) =>
    visitHousehold(database, request.player!.id, worldNow()),
  );
};
