import { HOUR, type Genotype, makeGenotype, pairKey, WEEK } from '@daligotchi/core';
import { and, eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { animals, eggs, meetings, pairs } from '../src/db/schema.ts';
import { addFounderAnimal } from '../src/services/households.ts';
import { expireMeetings } from '../src/services/meetings.ts';
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

const ADULT = 6 * WEEK;
const renard = makeGenotype('renard', 'renard');
const poulpe = makeGenotype('poulpe', 'poulpe');

async function addAnimal(playerId: string, name: string, genotype: Genotype, ageMs = ADULT) {
  const { id } = await addFounderAnimal(ctx.database, { playerId, name, genotype, ageMs, worldNow: ctx.app.worldNow() });
  return id;
}

function call(cookie: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, payload?: object) {
  return ctx.app.inject({ method, url: `/api${url}`, headers: { cookie }, ...(payload ? { payload } : {}) });
}

/** Alice (Roux, un renard) et Bob (Bulle, un poulpe), amis. */
async function friends() {
  const alice = await loginAs(ctx, 'alice');
  const bob = await loginAs(ctx, 'bob');
  const roux = await addAnimal(alice.player.id, 'Roux', renard);
  const bulle = await addAnimal(bob.player.id, 'Bulle', poulpe);
  await call(alice.cookie, 'POST', '/friends', { pseudo: 'bob' });
  await call(bob.cookie, 'POST', `/friends/${alice.player.id}/accept`);
  return { alice, bob, roux, bulle };
}

async function inviteAndAccept(f: Awaited<ReturnType<typeof friends>>) {
  const invitation = await call(f.alice.cookie, 'POST', '/meetings', { myAnimalId: f.roux, theirAnimalId: f.bulle, phrase: 'play' });
  expect(invitation.statusCode).toBe(200);
  const { id } = invitation.json();
  expect((await call(f.bob.cookie, 'POST', `/meetings/${id}/accept`)).statusCode).toBe(200);
  return id as string;
}

const tenInteractions = Array.from({ length: 10 }, (_, i) => ({
  kind: i % 2 ? ('ball' as const) : ('pet' as const),
  animal: i % 4 === 0 ? ('inviter' as const) : ('invitee' as const),
  at: i * 500,
}));

async function pairInteraction(x: string, y: string) {
  const [a, b] = pairKey(x, y);
  const [row] = await ctx.database.db.select().from(pairs).where(and(eq(pairs.animalA, a), eq(pairs.animalB, b)));
  return row?.interaction;
}

describe('amis', () => {
  it('une demande acceptée rend amis, une demande croisée est acceptée d’office', async () => {
    const alice = await loginAs(ctx, 'alice');
    const bob = await loginAs(ctx, 'bob');
    expect((await call(alice.cookie, 'POST', '/friends', { pseudo: 'Bob' })).json()).toMatchObject({ status: 'pending' });
    expect((await call(bob.cookie, 'GET', '/friends')).json().incoming).toEqual([{ id: alice.player.id, pseudo: 'alice' }]);
    expect((await call(bob.cookie, 'POST', '/friends', { pseudo: 'alice' })).json()).toMatchObject({ status: 'accepted' });
    expect((await call(alice.cookie, 'GET', '/friends')).json().friends).toEqual([{ id: bob.player.id, pseudo: 'bob' }]);
  });

  it('refuse un pseudo inconnu ou soi-même', async () => {
    const alice = await loginAs(ctx, 'alice');
    expect((await call(alice.cookie, 'POST', '/friends', { pseudo: 'personne' })).statusCode).toBe(404);
    expect((await call(alice.cookie, 'POST', '/friends', { pseudo: 'alice' })).statusCode).toBe(400);
  });

  it('les animaux d’un joueur ne sont visibles que de ses amis, sans leurs allèles', async () => {
    const { alice, bob } = await friends();
    const carol = await loginAs(ctx, 'carol');
    const seen = await call(alice.cookie, 'GET', `/friends/${bob.player.id}/animals`);
    expect(seen.json().animals).toEqual([expect.objectContaining({ name: 'Bulle', form: 'poulpe', stage: 'adult' })]);
    expect(seen.body).not.toContain('genotype');
    expect((await call(carol.cookie, 'GET', `/friends/${bob.player.id}/animals`)).statusCode).toBe(403);
  });
});

describe('lieu de rencontre', () => {
  it('on y inscrit ses animaux (pas ceux des autres), les autres les voient', async () => {
    const alice = await loginAs(ctx, 'alice');
    const bob = await loginAs(ctx, 'bob');
    const roux = await addAnimal(alice.player.id, 'Roux', renard);
    expect((await call(bob.cookie, 'PUT', `/meeting-place/${roux}`)).statusCode).toBe(403);
    expect((await call(alice.cookie, 'PUT', `/meeting-place/${roux}`)).statusCode).toBe(200);
    expect((await call(alice.cookie, 'GET', '/meeting-place')).json()).toEqual({ others: [], mine: [roux] });
    expect((await call(bob.cookie, 'GET', '/meeting-place')).json().others).toEqual([
      expect.objectContaining({ id: roux, name: 'Roux', owner: 'alice' }),
    ]);
  });
});

describe('invitations', () => {
  it('on ne peut inviter que l’animal d’un ami ou un animal inscrit', async () => {
    const alice = await loginAs(ctx, 'alice');
    const carol = await loginAs(ctx, 'carol');
    const roux = await addAnimal(alice.player.id, 'Roux', renard);
    const pepite = await addAnimal(carol.player.id, 'Pépite', poulpe);
    const invite = () => call(alice.cookie, 'POST', '/meetings', { myAnimalId: roux, theirAnimalId: pepite, phrase: 'hello' });
    expect((await invite()).statusCode).toBe(403);
    await call(carol.cookie, 'PUT', `/meeting-place/${pepite}`);
    expect((await invite()).statusCode).toBe(200);
  });

  it('refuse d’inviter avec l’animal d’un autre, et limite les invitations en attente', async () => {
    const { alice, bob, roux, bulle } = await friends();
    expect((await call(bob.cookie, 'POST', '/meetings', { myAnimalId: roux, theirAnimalId: bulle, phrase: 'hello' })).statusCode).toBe(403);
    for (let i = 0; i < 3; i++) {
      expect((await call(alice.cookie, 'POST', '/meetings', { myAnimalId: roux, theirAnimalId: bulle, phrase: 'hello' })).statusCode).toBe(200);
    }
    expect((await call(alice.cookie, 'POST', '/meetings', { myAnimalId: roux, theirAnimalId: bulle, phrase: 'hello' })).statusCode).toBe(409);
  });

  it('l’invité voit l’invitation avec la phrase ; il peut refuser', async () => {
    const { alice, bob, roux, bulle } = await friends();
    const { id } = (await call(alice.cookie, 'POST', '/meetings', { myAnimalId: roux, theirAnimalId: bulle, phrase: 'cute' })).json();
    const received = (await call(bob.cookie, 'GET', '/meetings')).json().received;
    expect(received).toEqual([
      expect.objectContaining({ id, phrase: 'cute', inviter: 'alice', inviterAnimal: expect.objectContaining({ name: 'Roux' }) }),
    ]);
    expect((await call(bob.cookie, 'POST', `/meetings/${id}/decline`)).statusCode).toBe(200);
    expect((await call(bob.cookie, 'POST', `/meetings/${id}/accept`)).statusCode).toBe(404);
  });
});

describe('scène de rencontre', () => {
  it('pendant la scène, l’animal invité est en visite chez l’autre joueur', async () => {
    const f = await friends();
    await inviteAndAccept(f);
    const household = (await call(f.alice.cookie, 'GET', '/household')).json();
    expect(household.animals[0]).toMatchObject({ name: 'Roux', visitingHost: 'bob' });
  });

  it('les effets ne sont appliqués qu’une fois, même si la fin est envoyée deux fois', async () => {
    const f = await friends();
    const id = await inviteAndAccept(f);
    const finish = () => call(f.bob.cookie, 'POST', `/meetings/${id}/finish`, { interactions: tenInteractions.slice(0, 3) });
    const first = (await finish()).json().outcome;
    const afterFirst = await pairInteraction(f.roux, f.bulle);
    const second = (await finish()).json().outcome;
    expect(second).toEqual(first);
    expect(await pairInteraction(f.roux, f.bulle)).toBe(afterFirst);
    expect(afterFirst).toBe(38); // 20 + 3 × 6
  });

  it('seul l’invité peut terminer la scène', async () => {
    const f = await friends();
    const id = await inviteAndAccept(f);
    expect((await call(f.alice.cookie, 'POST', `/meetings/${id}/finish`, { interactions: [] })).statusCode).toBe(404);
  });

  it('une rencontre très réussie entre deux adultes fait tomber amoureux… et pondre', async () => {
    const f = await friends();
    const id = await inviteAndAccept(f);
    const { outcome } = (await call(f.bob.cookie, 'POST', `/meetings/${id}/finish`, { interactions: tenInteractions })).json();
    expect(outcome.level).toBe('love');
    expect(outcome.eggCount).toBeGreaterThan(0);
    // La fiche de Roux montre son lien avec Bulle, qui vit chez Bob (deux adultes : pas « inséparables »).
    const roux = (await call(f.alice.cookie, 'GET', '/household')).json().animals[0];
    expect(roux.bonds[0]).toMatchObject({ name: 'Bulle' });
    expect(roux.bonds[0].level).not.toBe('inseparable');
    const laid = await ctx.database.db
      .select()
      .from(eggs)
      .where(and(eq(eggs.status, 'nest'), inArray(eggs.parentAId, [f.roux, f.bulle])));
    expect(laid).toHaveLength(outcome.eggCount);
    for (const egg of laid) expect(egg.form).toBe('poulpard');
  });

  it('un animal déjà amoureux chez lui reste fidèle : pas d’amour ni de ponte en rencontre', async () => {
    const f = await friends();
    const flamme = await addAnimal(f.alice.player.id, 'Flamme', poulpe);
    const [a, b] = pairKey(f.roux, flamme);
    await ctx.database.db.insert(pairs).values({ animalA: a, animalB: b, interaction: 90, at: ctx.app.worldNow() });
    // Roux et Flamme viennent de pondre : en récupération, ils restent amoureux.
    await ctx.database.db.update(animals).set({ lastClutchAt: ctx.app.worldNow() }).where(inArray(animals.id, [f.roux, flamme]));
    const id = await inviteAndAccept(f);
    const { outcome } = (await call(f.bob.cookie, 'POST', `/meetings/${id}/finish`, { interactions: tenInteractions })).json();
    expect(outcome.level).toBe('close');
    expect(await pairInteraction(f.roux, f.bulle)).toBe(79);
  });
});

describe('souvenir', () => {
  it('l’invitant revoit la rencontre avec ses interactions, sans nouvel effet', async () => {
    const f = await friends();
    const id = await inviteAndAccept(f);
    await call(f.bob.cookie, 'POST', `/meetings/${id}/finish`, { interactions: tenInteractions.slice(0, 4) });
    const before = await pairInteraction(f.roux, f.bulle);

    const { souvenirs } = (await call(f.alice.cookie, 'GET', '/meetings')).json();
    expect(souvenirs).toHaveLength(1);
    expect(souvenirs[0].interactions).toHaveLength(4);
    expect(souvenirs[0].outcome.level).toBe('friend');

    await call(f.alice.cookie, 'POST', `/meetings/${id}/seen`);
    expect((await call(f.alice.cookie, 'GET', '/meetings')).json().souvenirs).toEqual([]);
    expect(await pairInteraction(f.roux, f.bulle)).toBe(before);
  });
});

describe('expirations', () => {
  it('une invitation sans réponse expire, une scène abandonnée se termine seule', async () => {
    const f = await friends();
    const pending = (await call(f.alice.cookie, 'POST', '/meetings', { myAnimalId: f.roux, theirAnimalId: f.bulle, phrase: 'hello' })).json().id;
    const playing = await inviteAndAccept(f);

    ctx.clock.advance(HOUR);
    await expireMeetings(ctx.database, ctx.clock.now(), ctx.app.worldNow());
    const [scene] = await ctx.database.db.select().from(meetings).where(eq(meetings.id, playing));
    expect(scene?.status).toBe('done');
    expect(await pairInteraction(f.roux, f.bulle)).toBe(20); // effet de base, sans interaction

    ctx.clock.advance(2 * 24 * HOUR);
    await expireMeetings(ctx.database, ctx.clock.now(), ctx.app.worldNow());
    const [invitation] = await ctx.database.db.select().from(meetings).where(eq(meetings.id, pending));
    expect(invitation?.status).toBe('expired');
  });
});
