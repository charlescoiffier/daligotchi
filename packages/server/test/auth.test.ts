import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
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

function login(pseudo: string, password: string) {
  return ctx.app.inject({ method: 'POST', url: '/api/auth/login', payload: { pseudo, password } });
}

function me(cookie?: string) {
  return ctx.app.inject({ method: 'GET', url: '/api/me', headers: cookie ? { cookie } : {} });
}

describe('connexion', () => {
  it('ouvre une session avec un cookie httpOnly', async () => {
    await createPlayer(ctx.database, { pseudo: 'lune', password: 'croissant-de-lune' }, 0);
    const response = await login('lune', 'croissant-de-lune');

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ player: { pseudo: 'lune' } });
    const cookie = response.cookies.find((c) => c.name === 'dg_session');
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe('Lax');
  });

  it('accepte les prénoms accentués, quelle que soit la façon de taper l’accent', async () => {
    await createPlayer(ctx.database, { pseudo: 'Léon', password: 'croissant-de-lune' }, 0);
    expect((await login('LÉON', 'croissant-de-lune')).statusCode).toBe(200);
    // « e » suivi de l'accent combinant, comme certains claviers le produisent
    expect((await login('Le\u0301on', 'croissant-de-lune')).json()).toMatchObject({ player: { pseudo: 'léon' } });
  });

  it('ignore les majuscules et les espaces autour du pseudo', async () => {
    await createPlayer(ctx.database, { pseudo: 'lune', password: 'croissant-de-lune' }, 0);
    expect((await login('  Lune ', 'croissant-de-lune')).statusCode).toBe(200);
  });

  it('refuse un mauvais mot de passe ou un pseudo inconnu avec la même réponse', async () => {
    await createPlayer(ctx.database, { pseudo: 'lune', password: 'croissant-de-lune' }, 0);
    const wrongPassword = await login('lune', 'pas-le-bon');
    const unknown = await login('soleil', 'croissant-de-lune');

    expect(wrongPassword.statusCode).toBe(401);
    expect(unknown.statusCode).toBe(401);
    expect(wrongPassword.json()).toEqual(unknown.json());
    expect(wrongPassword.cookies).toHaveLength(0);
  });

  it('refuse une requête mal formée', async () => {
    const response = await ctx.app.inject({ method: 'POST', url: '/api/auth/login', payload: { pseudo: 1 } });
    expect(response.statusCode).toBe(400);
  });
});

describe('session', () => {
  it('/me reconnaît le joueur connecté', async () => {
    const { cookie } = await loginAs(ctx, 'etoile');
    const response = await me(cookie);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ player: { pseudo: 'etoile' } });
  });

  it('/me refuse sans cookie ou avec un jeton inventé', async () => {
    expect((await me()).statusCode).toBe(401);
    expect((await me('dg_session=jeton-invente')).statusCode).toBe(401);
  });

  it('la déconnexion invalide le jeton, même s’il est réutilisé', async () => {
    const { cookie } = await loginAs(ctx);
    await ctx.app.inject({ method: 'POST', url: '/api/auth/logout', headers: { cookie } });
    expect((await me(cookie)).statusCode).toBe(401);
  });

  it('la session expire après 30 jours', async () => {
    const { cookie } = await loginAs(ctx);
    ctx.clock.advance(29 * 24 * 3600 * 1000);
    expect((await me(cookie)).statusCode).toBe(200);
    ctx.clock.advance(2 * 24 * 3600 * 1000);
    expect((await me(cookie)).statusCode).toBe(401);
  });
});

describe('création de comptes', () => {
  it('refuse un pseudo invalide ou un mot de passe trop court', async () => {
    await expect(createPlayer(ctx.database, { pseudo: 'é!', password: 'assez-long' }, 0)).rejects.toThrow();
    await expect(createPlayer(ctx.database, { pseudo: 'valide', password: 'court' }, 0)).rejects.toThrow();
  });

  it('accepte un mot de passe court seulement sur décision explicite', async () => {
    await expect(createPlayer(ctx.database, { pseudo: 'léon', password: 'Léon' }, 0)).rejects.toThrow();
    await createPlayer(ctx.database, { pseudo: 'léon', password: 'Léon' }, 0, { allowWeakPassword: true });
    expect((await login('Léon', 'Léon')).statusCode).toBe(200);
    // Même mot de passe avec l'accent tapé en deux caractères
    expect((await login('Léon', 'Le\u0301on')).statusCode).toBe(200);
    expect((await login('Léon', 'Leon')).statusCode).toBe(401);
  });

  it('refuse un pseudo déjà pris', async () => {
    await createPlayer(ctx.database, { pseudo: 'lune', password: 'croissant-de-lune' }, 0);
    await expect(createPlayer(ctx.database, { pseudo: 'LUNE', password: 'autre-mot-de-passe' }, 0)).rejects.toThrow();
  });
});

describe('limite des essais de connexion', () => {
  it('bloque une adresse qui multiplie les essais', async () => {
    const strict = await createTestContext(1, 3);
    try {
      const attempt = () =>
        strict.app.inject({ method: 'POST', url: '/api/auth/login', payload: { pseudo: 'lune', password: 'devine' } });
      for (let i = 0; i < 3; i++) expect((await attempt()).statusCode).toBe(401);
      expect((await attempt()).statusCode).toBe(429);
    } finally {
      await strict.close();
    }
  });
});

