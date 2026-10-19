import { PHRASES } from '@daligotchi/core';
import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { z } from 'zod';
import type { Database } from '../db/client.ts';
import {
  acceptMeeting,
  declineMeeting,
  finishMeeting,
  invite,
  listMeetings,
  MeetingError,
  markSouvenirSeen,
} from '../services/meetings.ts';
import {
  acceptFriend,
  friendAnimals,
  listFriends,
  meetingPlace,
  removeFriend,
  requestFriend,
  SocialError,
  setListing,
} from '../services/social.ts';

interface SocialRoutesOptions {
  database: Database;
  now: () => number;
  worldNow: () => number;
}

const Id = z.uuid();
const InviteBody = z.object({ myAnimalId: z.uuid(), theirAnimalId: z.uuid(), phrase: z.enum(PHRASES) });
const FinishBody = z.object({
  interactions: z
    .array(
      z.object({
        kind: z.enum(['pet', 'ball']),
        animal: z.enum(['inviter', 'invitee']).optional(),
        at: z.number().nonnegative(),
      }),
    )
    .max(200),
});

const STATUS: Record<string, number> = {
  unknown_player: 404,
  self: 400,
  not_friends: 403,
  not_yours: 403,
  not_found: 404,
  not_reachable: 403,
  same_owner: 400,
  too_many_pending: 409,
  busy: 409,
};

/** Erreurs métier → réponses HTTP lisibles par le jeu. */
async function handle<T>(reply: FastifyReply, work: () => Promise<T>) {
  try {
    return await work();
  } catch (error) {
    if (error instanceof SocialError || error instanceof MeetingError) {
      return reply.code(STATUS[error.code] ?? 400).send({ error: error.code });
    }
    throw error;
  }
}

/** Amis, lieu de rencontre et rencontres (GDD §9 et §12). */
export const socialRoutes: FastifyPluginAsync<SocialRoutesOptions> = async (app, { database, now, worldNow }) => {
  const auth = { preHandler: app.requireAuth };

  // --- Amis ---
  app.get('/friends', auth, async (request) => listFriends(database, request.player!.id));

  app.post('/friends', auth, async (request, reply) => {
    const body = z.object({ pseudo: z.string().max(100) }).safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_request' });
    return handle(reply, () => requestFriend(database, request.player!.id, body.data.pseudo));
  });

  app.post<{ Params: { id: string } }>('/friends/:id/accept', auth, async (request, reply) => {
    const id = Id.safeParse(request.params.id);
    if (!id.success) return reply.code(400).send({ error: 'invalid_request' });
    return handle(reply, async () => {
      await acceptFriend(database, request.player!.id, id.data);
      return { ok: true };
    });
  });

  app.delete<{ Params: { id: string } }>('/friends/:id', auth, async (request, reply) => {
    const id = Id.safeParse(request.params.id);
    if (!id.success) return reply.code(400).send({ error: 'invalid_request' });
    await removeFriend(database, request.player!.id, id.data);
    return { ok: true };
  });

  app.get<{ Params: { id: string } }>('/friends/:id/animals', auth, async (request, reply) => {
    const id = Id.safeParse(request.params.id);
    if (!id.success) return reply.code(400).send({ error: 'invalid_request' });
    return handle(reply, async () => ({ animals: await friendAnimals(database, request.player!.id, id.data) }));
  });

  // --- Lieu de rencontre ---
  app.get('/meeting-place', auth, async (request) => meetingPlace(database, request.player!.id));

  app.put<{ Params: { id: string } }>('/meeting-place/:id', auth, async (request, reply) => {
    const id = Id.safeParse(request.params.id);
    if (!id.success) return reply.code(400).send({ error: 'invalid_request' });
    return handle(reply, async () => {
      await setListing(database, request.player!.id, id.data, true);
      return { ok: true };
    });
  });

  app.delete<{ Params: { id: string } }>('/meeting-place/:id', auth, async (request, reply) => {
    const id = Id.safeParse(request.params.id);
    if (!id.success) return reply.code(400).send({ error: 'invalid_request' });
    return handle(reply, async () => {
      await setListing(database, request.player!.id, id.data, false);
      return { ok: true };
    });
  });

  // --- Rencontres ---
  app.get('/meetings', auth, async (request) => listMeetings(database, request.player!.id));

  app.post('/meetings', auth, async (request, reply) => {
    const body = InviteBody.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_request' });
    return handle(reply, () => invite(database, request.player!.id, body.data, now()));
  });

  app.post<{ Params: { id: string } }>('/meetings/:id/accept', auth, async (request, reply) => {
    const id = Id.safeParse(request.params.id);
    if (!id.success) return reply.code(400).send({ error: 'invalid_request' });
    return handle(reply, () => acceptMeeting(database, request.player!.id, id.data, now()));
  });

  app.post<{ Params: { id: string } }>('/meetings/:id/decline', auth, async (request, reply) => {
    const id = Id.safeParse(request.params.id);
    if (!id.success) return reply.code(400).send({ error: 'invalid_request' });
    return handle(reply, async () => {
      await declineMeeting(database, request.player!.id, id.data);
      return { ok: true };
    });
  });

  app.post<{ Params: { id: string } }>('/meetings/:id/finish', auth, async (request, reply) => {
    const id = Id.safeParse(request.params.id);
    const body = FinishBody.safeParse(request.body);
    if (!id.success || !body.success) return reply.code(400).send({ error: 'invalid_request' });
    return handle(reply, async () => ({
      outcome: await finishMeeting(database, id.data, {
        by: request.player!.id,
        interactions: body.data.interactions,
        realNowMs: now(),
        worldNow: worldNow(),
      }),
    }));
  });

  app.post<{ Params: { id: string } }>('/meetings/:id/seen', auth, async (request, reply) => {
    const id = Id.safeParse(request.params.id);
    if (!id.success) return reply.code(400).send({ error: 'invalid_request' });
    await markSouvenirSeen(database, request.player!.id, id.data);
    return { ok: true };
  });
};
