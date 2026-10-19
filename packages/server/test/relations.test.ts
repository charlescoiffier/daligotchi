import { DAY, type Genotype, makeGenotype, seededRandom, WEEK } from '@daligotchi/core';
import { and, eq, or } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { animals, clutches, eggs } from '../src/db/schema.ts';
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

const ADULT = 6 * WEEK;
const renard = makeGenotype('renard', 'renard');
const poulpe = makeGenotype('poulpe', 'poulpe');

async function addAnimal(
  playerId: string,
  name: string,
  genotype: Genotype,
  ageMs = ADULT,
  parents: [string, string] | null = null,
) {
  const { id } = await addFounderAnimal(ctx.database, { playerId, name, genotype, ageMs, worldNow: ctx.app.worldNow() });
  if (parents) {
    await ctx.database.db.update(animals).set({ parentAId: parents[0], parentBId: parents[1] }).where(eq(animals.id, id));
  }
  return id;
}

const job = () => syncAllHouseholds(ctx.database, ctx.app.worldNow(), seededRandom(4));

async function visit(cookie: string) {
  const response = await ctx.app.inject({ method: 'GET', url: '/api/household', headers: { cookie } });
  expect(response.statusCode).toBe(200);
  return response.json();
}

function nestAction(cookie: string, eggId: string, choice: 'keep' | 'deposit') {
  return ctx.app.inject({ method: 'POST', url: `/api/nest/${eggId}/${choice}`, headers: { cookie } });
}

async function clutchCount() {
  return ctx.database.db.$count(clutches);
}

/** Un renard et un poulpe adultes qui vivent ensemble. */
async function couple() {
  const { player, cookie } = await loginAs(ctx);
  const roux = await addAnimal(player.id, 'Roux', renard);
  const bulle = await addAnimal(player.id, 'Bulle', poulpe);
  await visit(cookie);
  return { player, cookie, roux, bulle };
}

describe('liens et amour', () => {
  it('deux adultes qui vivent ensemble tombent amoureux en quelques jours', async () => {
    const { cookie } = await couple();
    ctx.clock.advance(DAY);
    expect((await visit(cookie)).animals[0].bonds[0]?.level).not.toBe('love');

    // Au seuil, la ponte suit aussitôt et l'amour retombe juste en dessous… puis revient vite.
    ctx.clock.advance(3 * DAY);
    await job();
    expect(await clutchCount()).toBe(1);
    ctx.clock.advance(DAY);
    const roux = (await visit(cookie)).animals.find((a: { name: string }) => a.name === 'Roux');
    expect(roux.bonds).toEqual([expect.objectContaining({ name: 'Bulle', level: 'love' })]);
  });

  it('deux jeunes deviennent inséparables, sans ponte', async () => {
    const { player, cookie } = await loginAs(ctx);
    await addAnimal(player.id, 'Petit', renard, 2 * DAY);
    await addAnimal(player.id, 'Mini', poulpe, 2 * DAY);
    await visit(cookie);
    ctx.clock.advance(5 * DAY);
    await job();
    expect((await visit(cookie)).animals[0].bonds[0].level).toBe('inseparable');
    expect(await clutchCount()).toBe(0);
  });

  it('frères et sœurs restent très proches, jamais amoureux', async () => {
    const other = await loginAs(ctx, 'grands-parents');
    const p = await addAnimal(other.player.id, 'Papa', renard);
    const q = await addAnimal(other.player.id, 'Maman', poulpe);
    const { player, cookie } = await loginAs(ctx);
    const brother = await addAnimal(player.id, 'Frère', renard, ADULT, [p, q]);
    await addAnimal(player.id, 'Sœur', poulpe, ADULT, [p, q]);
    await visit(cookie);
    ctx.clock.advance(10 * DAY);
    await job();
    expect((await visit(cookie)).animals[0].bonds[0].level).toBe('close');
    // Les parents, eux, ont pu pondre dans leur foyer ; le frère et la sœur jamais.
    const siblingClutches = await ctx.database.db
      .select()
      .from(clutches)
      .where(or(eq(clutches.animalA, brother), eq(clutches.animalB, brother)));
    expect(siblingClutches).toEqual([]);
  });
});

describe('pontes', () => {
  it('pondent en l’absence du joueur, une seule fois, et l’annonce attend la visite suivante', async () => {
    const { cookie } = await couple();
    ctx.clock.advance(4 * DAY);
    await job();
    await job();
    expect(await clutchCount()).toBe(1);

    const household = await visit(cookie);
    expect(household.newClutches).toHaveLength(1);
    expect(household.newClutches[0].parents.sort()).toEqual(['Bulle', 'Roux']);
    expect(household.nest.length).toBe(household.newClutches[0].eggCount);
    expect(household.slots.used).toBe(2); // le nid ne prend pas de place
    expect((await visit(cookie)).newClutches).toEqual([]);
  });

  it('un renard et un poulpe ne donnent que des poulpards (allèles hérités)', async () => {
    await couple();
    ctx.clock.advance(4 * DAY);
    await job();
    const laid = await ctx.database.db.select().from(eggs).where(eq(eggs.status, 'nest'));
    expect(laid.length).toBeGreaterThan(0);
    for (const egg of laid) expect(egg.form).toBe('poulpard');
  });

  it('pas de nouvelle ponte tant que la précédente attend au nid, puis deux semaines de repos', async () => {
    const { cookie } = await couple();
    ctx.clock.advance(4 * DAY);
    await job();
    const { nest } = await visit(cookie);

    ctx.clock.advance(3 * DAY);
    await job();
    expect(await clutchCount()).toBe(1); // les œufs attendent toujours au nid

    for (const egg of nest) expect((await nestAction(cookie, egg.id, 'deposit')).statusCode).toBe(200);
    ctx.clock.advance(5 * DAY);
    await job();
    expect(await clutchCount()).toBe(1); // 8 jours seulement depuis la ponte

    ctx.clock.advance(7 * DAY);
    await job();
    expect(await clutchCount()).toBe(2);
  });
});

describe('nid', () => {
  async function coupleWithNest() {
    const pair = await couple();
    ctx.clock.advance(4 * DAY);
    await job();
    const { nest } = await visit(pair.cookie);
    return { ...pair, nest };
  }

  it('garder un œuf le met en incubation dans le foyer', async () => {
    const { cookie, nest } = await coupleWithNest();
    const response = await nestAction(cookie, nest[0].id, 'keep');
    expect(response.statusCode).toBe(200);
    expect(response.json().eggs.map((e: { id: string }) => e.id)).toContain(nest[0].id);
    expect(response.json().slots.used).toBe(3);
  });

  it('refuse de garder un œuf quand le foyer est plein', async () => {
    const { player, cookie, nest } = await coupleWithNest();
    for (let i = 0; i < 4; i++) await addAnimal(player.id, `Ami ${i}`, renard, 2 * DAY);
    expect((await nestAction(cookie, nest[0].id, 'keep')).json()).toEqual({ error: 'no_free_slot' });
  });

  it('déposer un œuf le met au lieu d’adoption, avec le nom de ses parents', async () => {
    const { cookie, nest } = await coupleWithNest();
    await nestAction(cookie, nest[0].id, 'deposit');
    const adoption = (await ctx.app.inject({ method: 'GET', url: '/api/adoption', headers: { cookie } })).json();
    const egg = adoption.eggs.find((e: { id: string }) => e.id === nest[0].id);
    expect(egg.origin).toBe('player');
    expect(egg.parents.map((p: { name: string }) => p.name).sort()).toEqual(['Bulle', 'Roux']);
    expect(JSON.stringify(egg)).not.toContain('genotype');
  });

  it('un œuf oublié au nid part seul au lieu d’adoption au bout de 7 jours', async () => {
    const { cookie, nest } = await coupleWithNest();
    expect(nest[0].depositInDays).toBe(7);
    ctx.clock.advance(8 * DAY);
    await job();
    expect((await visit(cookie)).nest).toEqual([]);
    const [egg] = await ctx.database.db.select().from(eggs).where(eq(eggs.id, nest[0].id));
    expect(egg?.status).toBe('available');
  });

  it('on ne peut pas toucher au nid d’un autre joueur', async () => {
    const { nest } = await coupleWithNest();
    const stranger = await loginAs(ctx, 'voisin');
    expect((await nestAction(stranger.cookie, nest[0].id, 'deposit')).statusCode).toBe(404);
  });
});

describe('généalogie', () => {
  it('le bébé connaît ses parents, et l’arbre montre leurs descriptions', async () => {
    const { cookie, roux } = await couple();
    await ctx.app.inject({
      method: 'PATCH',
      url: `/api/animals/${roux}`,
      headers: { cookie },
      payload: { description: 'Adore les balles rouges.' },
    });
    ctx.clock.advance(4 * DAY);
    await job();
    const { nest } = await visit(cookie);
    await nestAction(cookie, nest[0].id, 'keep');
    await ctx.database.db.update(eggs).set({ progress: 1 }).where(and(eq(eggs.id, nest[0].id)));

    const { hatched } = await visit(cookie);
    expect(hatched).toHaveLength(1);
    const tree = (
      await ctx.app.inject({ method: 'GET', url: `/api/animals/${hatched[0].animalId}/tree`, headers: { cookie } })
    ).json();
    expect(tree.founder).toBe(false);
    expect(tree.form).toBe('poulpard');
    expect(tree.parents.map((p: { name: string }) => p.name).sort()).toEqual(['Bulle', 'Roux']);
    const rouxNode = tree.parents.find((p: { name: string }) => p.name === 'Roux');
    expect(rouxNode).toMatchObject({ founder: true, story: 'Adore les balles rouges.', parents: [] });
    expect(JSON.stringify(tree)).not.toContain('genotype');
  });
});
