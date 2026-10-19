import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { Database } from '../db/client.ts';
import { familyTree } from '../services/genealogy.ts';
import {
  careForHousehold,
  NestEggNotFoundError,
  NoFreeSlotError,
  placeNestEgg,
  TargetNotFoundError,
  updateAnimal,
  visitHousehold,
} from '../services/households.ts';

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

/** Prénom et/ou description rédigée par ses humains (visible dans la généalogie). */
const AnimalBody = z
  .object({
    name: z.string().trim().min(1).max(20).optional(),
    description: z.string().trim().max(280).optional(),
  })
  .refine((body) => body.name !== undefined || body.description !== undefined);

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
    const body = AnimalBody.safeParse(request.body);
    if (!id.success || !body.success) return reply.code(400).send({ error: 'invalid_request' });
    try {
      await updateAnimal(database, request.player!.id, id.data, body.data);
      return { ok: true };
    } catch (error) {
      if (error instanceof TargetNotFoundError) return reply.code(404).send({ error: 'not_found' });
      throw error;
    }
  });

  app.get<{ Params: { id: string } }>('/animals/:id/tree', { preHandler: app.requireAuth }, async (request, reply) => {
    const id = z.uuid().safeParse(request.params.id);
    if (!id.success) return reply.code(400).send({ error: 'invalid_request' });
    const tree = await familyTree(database, id.data);
    return tree ?? reply.code(404).send({ error: 'not_found' });
  });

  app.post<{ Params: { id: string; choice: string } }>(
    '/nest/:id/:choice',
    { preHandler: app.requireAuth },
    async (request, reply) => {
      const id = z.uuid().safeParse(request.params.id);
      const choice = z.enum(['keep', 'deposit']).safeParse(request.params.choice);
      if (!id.success || !choice.success) return reply.code(400).send({ error: 'invalid_request' });
      try {
        await placeNestEgg(database, request.player!.id, id.data, choice.data, worldNow());
      } catch (error) {
        if (error instanceof NoFreeSlotError) return reply.code(409).send({ error: 'no_free_slot' });
        if (error instanceof NestEggNotFoundError) return reply.code(404).send({ error: 'not_found' });
        throw error;
      }
      return visitHousehold(database, request.player!.id, worldNow());
    },
  );
};
