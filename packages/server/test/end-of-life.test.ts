import { BALANCE, HOUR, lifespanOf, makeGenotype } from '@daligotchi/core';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { animals, meetingListings, meetings } from '../src/db/schema.ts';
import { addFounderAnimal, syncAllHouseholds } from '../src/services/households.ts';
import { createTestContext, loginAs, resetDb, type TestContext } from './helpers.ts';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestContext();
});

beforeEach(async () => {
  await resetDb(ctx.database);
});

afterAll(async () => {
  await ctx.close();
});

const LIFESPAN = lifespanOf(1);

function call(cookie: string, method: 'GET' | 'POST' | 'PUT', url: string, payload?: object) {
  return ctx.app.inject({ method, url: `/api${url}`, headers: { cookie }, ...(payload ? { payload } : {}) });
}

async function visit(cookie: string) {
  const response = await call(cookie, 'GET', '/household');
  expect(response.statusCode).toBe(200);
  return response.json();
}

/** Papi Roux, à une heure de la fin de sa vie, son bonus de confort déjà épuisé. */
async function elder(pseudo = 'famille', comfortMs = BALANCE.endOfLife.maxComfort) {
  const { player, cookie } = await loginAs(ctx, pseudo);
  const { id } = await addFounderAnimal(ctx.database, {
    playerId: player.id,
    name: 'Papi Roux',
    genotype: makeGenotype('renard', 'renard'),
    ageMs: LIFESPAN + comfortMs - HOUR,
    worldNow: ctx.app.worldNow(),
  });
  await ctx.database.db.update(animals).set({ comfortMs }).where(eq(animals.id, id));
  await visit(cookie);
  return { player, cookie, id };
}

describe('fin de vie', () => {
  it('jamais sans visite : la tâche de fond ne fait partir personne', async () => {
    const { cookie } = await elder();
    ctx.clock.advance(3 * 24 * HOUR);
    await syncAllHouseholds(ctx.database, ctx.app.worldNow());
    const household = await visit(cookie);
    expect(household.animals).toHaveLength(1);
    expect(household.farewells).toEqual([]);
  });

  it('la première visite ouvre les derniers moments ; l’adieu vient à une visite au moins six heures plus tard', async () => {
    const { cookie } = await elder();
    ctx.clock.advance(2 * HOUR);
    const first = await visit(cookie);
    expect(first.animals[0]).toMatchObject({ name: 'Papi Roux', lastMoments: true });
    expect(first.farewells).toEqual([]);

    ctx.clock.advance(5 * HOUR);
    expect((await visit(cookie)).animals).toHaveLength(1);

    ctx.clock.advance(2 * HOUR);
    const farewell = await visit(cookie);
    expect(farewell.farewells).toEqual([expect.objectContaining({ name: 'Papi Roux', form: 'renard', stage: 'old' })]);
    expect(farewell.animals).toEqual([]);
    expect(farewell.slots.used).toBe(0);

    // L'adieu n'est annoncé qu'une fois.
    expect((await visit(cookie)).farewells).toEqual([]);
  });

  it('un vieil animal heureux gagne un peu de vie à chaque visite', async () => {
    const { cookie, id } = await elder('famille', 0);
    await visit(cookie);
    const [row] = await ctx.database.db.select().from(animals).where(eq(animals.id, id));
    expect(row!.comfortMs).toBeGreaterThan(0);
  });

  it('parti, il reste dans la généalogie mais quitte le lieu de rencontre et ses invitations', async () => {
    const { cookie, id } = await elder();
    const friend = await loginAs(ctx, 'ami');
    const amiRoux = await addFounderAnimal(ctx.database, {
      playerId: friend.player.id,
      name: 'Filou',
      genotype: makeGenotype('poulpe', 'poulpe'),
      ageMs: HOUR,
      worldNow: ctx.app.worldNow(),
    });
    await call(cookie, 'PUT', `/meeting-place/${id}`);
    const invitation = (
      await call(friend.cookie, 'POST', '/meetings', { myAnimalId: amiRoux.id, theirAnimalId: id, phrase: 'hello' })
    ).json();

    ctx.clock.advance(2 * HOUR);
    await visit(cookie);
    ctx.clock.advance(7 * HOUR);
    await visit(cookie);

    const tree = (await call(cookie, 'GET', `/animals/${id}/tree`)).json();
    expect(tree).toMatchObject({ name: 'Papi Roux', deceased: true });
    expect(await ctx.database.db.$count(meetingListings)).toBe(0);
    const [meeting] = await ctx.database.db.select().from(meetings).where(eq(meetings.id, invitation.id));
    expect(meeting?.status).toBe('expired');
    expect((await call(friend.cookie, 'GET', '/meeting-place')).json().others).toEqual([]);
  });
});
