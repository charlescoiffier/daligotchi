import { DAY, HOUR, makeGenotype } from '@daligotchi/core';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { animals } from '../src/db/schema.ts';
import { addFounderAnimal } from '../src/services/households.ts';
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

async function visit(cookie: string) {
  const response = await ctx.app.inject({ method: 'GET', url: '/api/household', headers: { cookie } });
  expect(response.statusCode).toBe(200);
  return response.json();
}

async function playerWithFox(ageMs = 0) {
  const { player, cookie } = await loginAs(ctx);
  const { id } = await addFounderAnimal(ctx.database, {
    playerId: player.id,
    name: 'Roux',
    genotype: makeGenotype('renard', 'renard'),
    ageMs,
    worldNow: ctx.app.worldNow(),
  });
  return { cookie, animalId: id };
}

async function storedAge(animalId: string) {
  const [row] = await ctx.database.db.select().from(animals).where(eq(animals.id, animalId));
  return row!.ageMs;
}

describe('GET /api/household', () => {
  it('exige une session', async () => {
    const response = await ctx.app.inject({ method: 'GET', url: '/api/household' });
    expect(response.statusCode).toBe(401);
  });

  it('un nouveau joueur a un foyer vide et propre de six places', async () => {
    const { cookie } = await loginAs(ctx);
    const household = await visit(cookie);
    expect(household).toMatchObject({
      home: 'need.home.good',
      slots: { used: 0, total: 6 },
      animals: [],
    });
  });

  it('montre la forme et des libellés, jamais les allèles ni des nombres', async () => {
    const { cookie } = await playerWithFox();
    const household = await visit(cookie);
    const [fox] = household.animals;

    expect(fox).toMatchObject({ name: 'Roux', form: 'renard', stage: 'young' });
    expect(fox.description.needs.satiety).toBe('need.satiety.good');
    expect(JSON.stringify(household)).not.toContain('genotype');
    expect(JSON.stringify(fox.description)).not.toMatch(/\d/);
  });

  it('le temps passe entre deux visites : le renard a faim le lendemain', async () => {
    const { cookie } = await playerWithFox();
    await visit(cookie);
    ctx.clock.advance(30 * HOUR);
    const household = await visit(cookie);
    expect(household.animals[0].description.needs.satiety).toBe('need.satiety.bad');
  });

  it('après 25 jours d’absence, le renard est affamé mais toujours là', async () => {
    const { cookie } = await playerWithFox();
    ctx.clock.advance(25 * DAY);
    const household = await visit(cookie);
    expect(household.animals).toHaveLength(1);
    expect(household.home).toBe('need.home.bad');
  });

  it('enregistre la visite : le vieillissement ralenti ne s’applique qu’à l’absence', async () => {
    const { cookie, animalId } = await playerWithFox();
    await visit(cookie);

    ctx.clock.advance(10 * DAY);
    await visit(cookie);
    expect(await storedAge(animalId)).toBe(6 * DAY);

    ctx.clock.advance(DAY);
    await visit(cookie);
    expect(await storedAge(animalId)).toBe(7 * DAY);
  });

  it('le stade évolue avec l’âge', async () => {
    const { cookie } = await playerWithFox(13 * 7 * DAY);
    const household = await visit(cookie);
    expect(household.animals[0].stage).toBe('old');
  });
});

describe('vitesse du monde', () => {
  it('à vitesse 24, une heure réelle fait vivre une journée', async () => {
    const fast = await createTestContext(24);
    try {
      await resetDb(fast.database);
      const { player, cookie } = await loginAs(fast);
      const { id } = await addFounderAnimal(fast.database, {
        playerId: player.id,
        name: 'Vif',
        genotype: makeGenotype('renard', 'renard'),
        ageMs: 0,
        worldNow: fast.app.worldNow(),
      });
      await fast.app.inject({ method: 'GET', url: '/api/household', headers: { cookie } });
      fast.clock.advance(HOUR);
      await fast.app.inject({ method: 'GET', url: '/api/household', headers: { cookie } });
      const [row] = await fast.database.db.select().from(animals).where(eq(animals.id, id));
      expect(row!.ageMs).toBe(DAY);
    } finally {
      await fast.close();
    }
  });
});
