import { BALANCE } from '@daligotchi/core';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { Database } from '../db/client.ts';
import { adoptEgg, EggUnavailableError, listAvailableEggs, NoFreeSlotError } from '../services/adoption.ts';
import { visitHousehold } from '../services/households.ts';

interface AdoptionRoutesOptions {
  database: Database;
  worldNow: () => number;
}

export const adoptionRoutes: FastifyPluginAsync<AdoptionRoutesOptions> = async (app, { database, worldNow }) => {
  app.get('/adoption', { preHandler: app.requireAuth }, async () => ({
    eggs: await listAvailableEggs(database),
    slotsTotal: BALANCE.householdSlots,
  }));

  app.post<{ Params: { id: string } }>(
    '/adoption/:id/adopt',
    { preHandler: app.requireAuth },
    async (request, reply) => {
      const id = z.uuid().safeParse(request.params.id);
      if (!id.success) return reply.code(400).send({ error: 'invalid_request' });
      try {
        await adoptEgg(database, request.player!.id, id.data, worldNow());
      } catch (error) {
        if (error instanceof NoFreeSlotError) return reply.code(409).send({ error: 'no_free_slot' });
        if (error instanceof EggUnavailableError) return reply.code(409).send({ error: 'egg_unavailable' });
        throw error;
      }
      return visitHousehold(database, request.player!.id, worldNow());
    },
  );
};
