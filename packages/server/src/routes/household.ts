import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { Database } from '../db/client.ts';
import { AnimalNotFoundError, careForHousehold, visitHousehold } from '../services/households.ts';

interface HouseholdRoutesOptions {
  database: Database;
  worldNow: () => number;
}

/** Soins : action de foyer, action sur un animal, ou balle (un animal ou tout le foyer). */
const CareBody = z.discriminatedUnion('action', [
  z.object({ action: z.enum(['feed', 'water', 'cleanHome']) }),
  z.object({ action: z.enum(['pet', 'wash']), animalId: z.uuid() }),
  z.object({ action: z.literal('ball'), animalId: z.uuid().optional() }),
]);

export const householdRoutes: FastifyPluginAsync<HouseholdRoutesOptions> = async (
  app,
  { database, worldNow },
) => {
  app.get('/household', { preHandler: app.requireAuth }, async (request) =>
    visitHousehold(database, request.player!.id, worldNow()),
  );

  app.post('/household/care', { preHandler: app.requireAuth }, async (request, reply) => {
    const body = CareBody.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_request' });
    try {
      return await careForHousehold(database, request.player!.id, worldNow(), body.data);
    } catch (error) {
      if (error instanceof AnimalNotFoundError) return reply.code(404).send({ error: 'animal_not_found' });
      throw error;
    }
  });
};
