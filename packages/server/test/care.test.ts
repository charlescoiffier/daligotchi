import { HOUR, makeGenotype } from '@daligotchi/core';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createPlayer } from '../src/services/players.ts';
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

async function addFox(playerId: string, name: string) {
  return addFounderAnimal(ctx.database, {
    playerId,
    name,
    genotype: makeGenotype('renard', 'renard'),
    ageMs: 0,
    worldNow: ctx.app.worldNow(),
  });
}

function care(cookie: string | undefined, payload: object) {
  return ctx.app.inject({
    method: 'POST',
    url: '/api/household/care',
    headers: cookie ? { cookie } : {},
    payload,
  });
}

/** Un joueur avec deux renards, laissés seuls 30 heures : affamés, sales, ennuyés. */
async function neglectedHousehold() {
  const { player, cookie } = await loginAs(ctx);
  const first = await addFox(player.id, 'Roux');
  const second = await addFox(player.id, 'Fauve');
  ctx.clock.advance(30 * HOUR);
  return { cookie, first, second };
}

describe('POST /api/household/care', () => {
  it('exige une session', async () => {
    expect((await care(undefined, { action: 'feed' })).statusCode).toBe(401);
  });

  it('nourrir rassasie tous les animaux, même après une longue absence', async () => {
    const { cookie } = await neglectedHousehold();
    const response = await care(cookie, { action: 'feed' });
    expect(response.statusCode).toBe(200);
    for (const animal of response.json().animals) {
      expect(animal.description.needs.satiety).toBe('need.satiety.good');
      expect(animal.description.needs.hydration).not.toBe('need.hydration.good');
    }
  });

  it('nettoyer remet l’habitat à neuf', async () => {
    const { cookie } = await neglectedHousehold();
    const response = await care(cookie, { action: 'cleanHome' });
    expect(response.json().home).toBe('need.home.good');
  });

  it('caresser ne concerne que l’animal choisi', async () => {
    const { cookie, first } = await neglectedHousehold();
    const { animals } = (await care(cookie, { action: 'pet', animalId: first.id })).json();
    const petted = animals.find((a: { id: string }) => a.id === first.id);
    const other = animals.find((a: { id: string }) => a.id !== first.id);
    expect(petted.description.needs.affection).not.toBe(other.description.needs.affection);
  });

  it('la balle sans animal choisi amuse tout le foyer', async () => {
    const { cookie } = await neglectedHousehold();
    const before = (await ctx.app.inject({ method: 'GET', url: '/api/household', headers: { cookie } })).json();
    const after = (await care(cookie, { action: 'ball' })).json();
    expect(before.animals[0].description.needs.fun).toBe('need.fun.bad');
    for (const animal of after.animals) expect(animal.description.needs.fun).not.toBe('need.fun.bad');
  });

  it('caresser ou laver sans animal choisi est refusé', async () => {
    const { cookie } = await neglectedHousehold();
    expect((await care(cookie, { action: 'pet' })).statusCode).toBe(400);
    expect((await care(cookie, { action: 'wash' })).statusCode).toBe(400);
  });

  it('refuse une action inconnue', async () => {
    const { cookie } = await neglectedHousehold();
    expect((await care(cookie, { action: 'soigner' })).statusCode).toBe(400);
  });

  it('refuse de soigner l’animal d’un autre joueur', async () => {
    const { cookie } = await neglectedHousehold();
    const other = await createPlayer(ctx.database, { pseudo: 'voisin', password: 'mot-de-passe-voisin' }, ctx.app.worldNow());
    const strangerFox = await addFox(other.id, 'Inconnu');
    const response = await care(cookie, { action: 'pet', animalId: strangerFox.id });
    expect(response.statusCode).toBe(404);
  });
});
