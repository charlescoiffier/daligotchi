import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { Database } from '../db/client.ts';
import { careForHousehold, renameAnimal, TargetNotFoundError, visitHousehold } from '../services/households.ts';

interface HouseholdRoutesOptions {
  database: Database;
  worldNow: () => number;
}

/** Soins : action de foyer, action sur un animal, balle (un animal ou tout le foyer), ou soin d'un œuf. */
const CareBody = z.discriminatedUnion('action', [
  z.object({ action: z.enum(['feed', 'water', 'cleanHome']) }),
  z.object({ action: z.enum(['pet', 'wash']), animalId: z.uuid() }),
  z.object({ action: z.literal('ball'), animalId: z.uuid().optional() }),
  z.object({ action: z.enum(['warmEgg', 'washEgg']), eggId: z.uuid() }),
]);

const RenameBody = z.object({ name: z.string().trim().min(1).max(20) });

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
      if (error instanceof TargetNotFoundError) return reply.code(404).send({ error: 'not_found' });
      throw error;
    }
  });

  app.patch<{ Params: { id: string } }>('/animals/:id', { preHandler: app.requireAuth }, async (request, reply) => {
    const id = z.uuid().safeParse(request.params.id);
    const body = RenameBody.safeParse(request.body);
    if (!id.success || !body.success) return reply.code(400).send({ error: 'invalid_request' });
    try {
      await renameAnimal(database, request.player!.id, id.data, body.data.name);
      return { ok: true };
    } catch (error) {
      if (error instanceof TargetNotFoundError) return reply.code(404).send({ error: 'not_found' });
      throw error;
    }
  });
};
