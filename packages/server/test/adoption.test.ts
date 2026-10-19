import { HOUR, makeGenotype, seededRandom } from '@daligotchi/core';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eggs, players } from '../src/db/schema.ts';
import { createGameEgg, restockAdoption } from '../src/services/adoption.ts';
import { addFounderAnimal, addStarterAnimals } from '../src/services/households.ts';
import { createPlayer } from '../src/services/players.ts';
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

const restock = () => restockAdoption(ctx.database, ctx.clock.now(), ctx.app.worldNow(), seededRandom(1));
const newGameEgg = () => createGameEgg(ctx.database.db, ctx.app.worldNow(), seededRandom(2));

function adopt(cookie: string, eggId: string) {
  return ctx.app.inject({ method: 'POST', url: `/api/adoption/${eggId}/adopt`, headers: { cookie } });
}

function care(cookie: string, payload: object) {
  return ctx.app.inject({ method: 'POST', url: '/api/household/care', headers: { cookie }, payload });
}

function visit(cookie: string) {
  return ctx.app.inject({ method: 'GET', url: '/api/household', headers: { cookie } });
}

async function availableCount() {
  return ctx.database.db.$count(eggs, eq(eggs.status, 'available'));
}

describe('réapprovisionnement du lieu d’adoption', () => {
  it('sans joueur actif, garde au moins trois œufs, sans en rajouter à chaque passage', async () => {
    expect(await restock()).toMatchObject({ added: 3, target: 3 });
    expect(await restock()).toMatchObject({ added: 0, removed: 0 });
    expect(await availableCount()).toBe(3);
  });

  it('prévoit un œuf et demi par joueur récemment actif', async () => {
    for (const pseudo of ['un', 'deux', 'trois', 'quatre']) {
      const player = await createPlayer(ctx.database, { pseudo: `joueur-${pseudo}`, password: 'mot-de-passe' }, 0);
      await ctx.database.db.update(players).set({ lastSeenAt: new Date(ctx.clock.now()) }).where(eq(players.id, player.id));
    }
    expect(await restock()).toMatchObject({ target: 6, added: 6 });
  });

  it('en cas de surplus, retire les plus anciens œufs du jeu mais jamais ceux des joueurs', async () => {
    const [playerEgg] = await ctx.database.db
      .insert(eggs)
      .values({
        status: 'available',
        origin: 'player',
        genotype: makeGenotype('renard', 'poulpe'),
        form: 'poulpard',
        warmth: 50,
        cleanliness: 100,
        progress: 0,
        at: 0,
        listedAt: -1,
      })
      .returning({ id: eggs.id });
    for (let i = 0; i < 9; i++) await newGameEgg();

    // Cible 3, maximum 6 : sur 10 œufs, 4 œufs du jeu sont retirés.
    expect(await restock()).toMatchObject({ removed: 4 });
    expect(await availableCount()).toBe(6);
    const [kept] = await ctx.database.db.select().from(eggs).where(eq(eggs.id, playerEgg!.id));
    expect(kept?.status).toBe('available');
  });
});

describe('GET /api/adoption', () => {
  it('liste les œufs disponibles sans révéler leur espèce', async () => {
    const { cookie } = await loginAs(ctx);
    await restock();
    const response = await ctx.app.inject({ method: 'GET', url: '/api/adoption', headers: { cookie } });
    expect(response.statusCode).toBe(200);
    expect(response.json().eggs).toHaveLength(3);
    expect(response.body).not.toMatch(/renard|poulpe|genotype|form/);
  });
});

describe('POST /api/adoption/:id/adopt', () => {
  it('l’œuf rejoint le foyer et occupe une place', async () => {
    const { cookie } = await loginAs(ctx);
    const egg = await newGameEgg();
    const response = await adopt(cookie, egg.id);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ slots: { used: 1 }, eggs: [{ id: egg.id }] });
    expect(response.json().eggs[0].description.progress).toBe('egg.progress.asleep');
  });

  it('un œuf ne peut être adopté qu’une fois, même par deux joueurs en même temps', async () => {
    const first = await loginAs(ctx, 'premier');
    const second = await loginAs(ctx, 'second');
    const egg = await newGameEgg();

    const results = await Promise.all([adopt(first.cookie, egg.id), adopt(second.cookie, egg.id)]);
    expect(results.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    expect((await adopt(first.cookie, egg.id)).json()).toEqual({ error: 'egg_unavailable' });
  });

  it('refuse l’adoption quand le foyer est plein (animaux et œufs confondus)', async () => {
    const { player, cookie } = await loginAs(ctx);
    for (let i = 0; i < 5; i++) {
      await addFounderAnimal(ctx.database, {
        playerId: player.id,
        name: `Renard ${i}`,
        genotype: makeGenotype('renard', 'renard'),
        ageMs: 0,
        worldNow: ctx.app.worldNow(),
      });
    }
    expect((await adopt(cookie, (await newGameEgg()).id)).statusCode).toBe(200);
    const refused = await adopt(cookie, (await newGameEgg()).id);
    expect(refused.statusCode).toBe(409);
    expect(refused.json()).toEqual({ error: 'no_free_slot' });
  });
});

describe('incubation et éclosion', () => {
  it('couver et laver l’œuf se voient dans ses libellés', async () => {
    const { cookie } = await loginAs(ctx);
    const egg = await newGameEgg();
    await adopt(cookie, egg.id);
    ctx.clock.advance(10 * HOUR);
    const cold = (await visit(cookie)).json().eggs[0].description;
    expect(cold.warmth).toBe('egg.warmth.bad');

    await care(cookie, { action: 'warmEgg', eggId: egg.id });
    const warm = (await care(cookie, { action: 'warmEgg', eggId: egg.id })).json().eggs[0].description;
    expect(warm.warmth).toBe('egg.warmth.good');
  });

  it('un œuf bien soigné éclot en un à deux jours, une seule fois, avec l’espèce tirée à sa création', async () => {
    const { cookie } = await loginAs(ctx);
    const egg = await newGameEgg();
    const [stored] = await ctx.database.db.select().from(eggs).where(eq(eggs.id, egg.id));
    await adopt(cookie, egg.id);

    let hatched: { animalId: string; form: string }[] = [];
    let hours = 0;
    while (hatched.length === 0 && hours < 72) {
      ctx.clock.advance(12 * HOUR);
      hours += 12;
      await care(cookie, { action: 'warmEgg', eggId: egg.id }).then(async (r) => {
        if (r.statusCode === 404) return; // déjà éclos pendant cette visite
        hatched = r.json().hatched;
        if (hatched.length === 0) await care(cookie, { action: 'washEgg', eggId: egg.id });
      });
    }

    expect(hours).toBeGreaterThanOrEqual(24);
    expect(hours).toBeLessThanOrEqual(48);
    expect(hatched[0]?.form).toBe(stored?.form);

    const after = (await visit(cookie)).json();
    expect(after.hatched).toEqual([]);
    expect(after.eggs).toEqual([]);
    expect(after.slots.used).toBe(1);
    expect(after.animals[0]).toMatchObject({ id: hatched[0]?.animalId, stage: 'young' });
  });

  it('refuse de soigner l’œuf d’un autre joueur', async () => {
    const { cookie } = await loginAs(ctx);
    const other = await loginAs(ctx, 'voisin');
    const egg = await newGameEgg();
    await adopt(other.cookie, egg.id);
    expect((await care(cookie, { action: 'warmEgg', eggId: egg.id })).statusCode).toBe(404);
  });
});

describe('PATCH /api/animals/:id', () => {
  it('renomme son animal, mais pas celui d’un autre', async () => {
    const { player, cookie } = await loginAs(ctx);
    const other = await createPlayer(ctx.database, { pseudo: 'voisin', password: 'mot-de-passe' }, 0);
    const mine = await addFounderAnimal(ctx.database, {
      playerId: player.id,
      name: 'Pépite',
      genotype: makeGenotype('renard', 'renard'),
      ageMs: 0,
      worldNow: ctx.app.worldNow(),
    });
    const theirs = await addFounderAnimal(ctx.database, {
      playerId: other.id,
      name: 'Filou',
      genotype: makeGenotype('renard', 'renard'),
      ageMs: 0,
      worldNow: ctx.app.worldNow(),
    });
    const rename = (id: string, name: string) =>
      ctx.app.inject({ method: 'PATCH', url: `/api/animals/${id}`, headers: { cookie }, payload: { name } });

    expect((await rename(mine.id, '  Étincelle  ')).statusCode).toBe(200);
    expect((await visit(cookie)).json().animals[0].name).toBe('Étincelle');
    expect((await rename(theirs.id, 'Volé')).statusCode).toBe(404);
    expect((await rename(mine.id, '   ')).statusCode).toBe(400);
  });
});

describe('animaux de départ', () => {
  it('donne des fondateurs jeunes ou adultes, sans dépasser les places libres', async () => {
    const { player, cookie } = await loginAs(ctx);
    const first = await addStarterAnimals(ctx.database, player.id, 4, ctx.app.worldNow(), seededRandom(5));
    expect(first).toHaveLength(4);
    for (const animal of first) {
      expect(['renard', 'poulpe', 'poulpard']).toContain(animal.form);
      expect(animal.stage).not.toBe('old');
    }
    const second = await addStarterAnimals(ctx.database, player.id, 4, ctx.app.worldNow(), seededRandom(6));
    expect(second).toHaveLength(2);
    expect((await visit(cookie)).json().slots).toEqual({ used: 6, total: 6 });
  });
});
