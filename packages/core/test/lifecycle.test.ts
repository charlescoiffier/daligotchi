import { describe, expect, it } from 'vitest';
import { DAY, HOUR, WEEK } from '../src/clock.ts';
import {
  agingDuring,
  comfortAfterVisit,
  endOfLifeStep,
  hasElderSigns,
  isLifeOver,
  lifespanOf,
  stageOf,
} from '../src/lifecycle.ts';

const LIFESPAN = lifespanOf(1);

describe('lifespanOf', () => {
  it('vaut 17 semaines pour une longévité normale', () => {
    expect(LIFESPAN).toBe(17 * WEEK);
  });

  it('une longévité héritée plus grande allonge la vieillesse', () => {
    expect(lifespanOf(1.1)).toBeGreaterThan(LIFESPAN);
    expect(isLifeOver(17 * WEEK, lifespanOf(1.1))).toBe(false);
  });
});

describe('stageOf', () => {
  it('suit les stades du GDD : 4 semaines jeune, 9 semaines adulte, puis vieux', () => {
    expect(stageOf(0)).toBe('young');
    expect(stageOf(4 * WEEK - 1)).toBe('young');
    expect(stageOf(4 * WEEK)).toBe('adult');
    expect(stageOf(13 * WEEK - 1)).toBe('adult');
    expect(stageOf(13 * WEEK)).toBe('old');
  });
});

describe('fin de vie', () => {
  it('les signes de grand âge apparaissent trois jours avant la fin de vie', () => {
    expect(hasElderSigns(LIFESPAN - 3 * DAY - 1, LIFESPAN)).toBe(false);
    expect(hasElderSigns(LIFESPAN - 3 * DAY, LIFESPAN)).toBe(true);
  });

  it('la fin de vie est atteinte à la durée de vie', () => {
    expect(isLifeOver(LIFESPAN - 1, LIFESPAN)).toBe(false);
    expect(isLifeOver(LIFESPAN, LIFESPAN)).toBe(true);
  });
});

describe('agingDuring (vieillissement ralenti en absence)', () => {
  it('vieillit normalement pendant les deux premiers jours d’absence', () => {
    expect(agingDuring(0, DAY, 0)).toBe(DAY);
    expect(agingDuring(0, 2 * DAY, 0)).toBe(2 * DAY);
  });

  it('vieillit deux fois moins vite au-delà de deux jours sans visite', () => {
    // 2 jours normaux + 8 jours à moitié = 6 jours.
    expect(agingDuring(0, 10 * DAY, 0)).toBe(6 * DAY);
  });

  it('donne le même âge qu’on avance en une ou plusieurs fois', () => {
    const steps = agingDuring(0, DAY, 0) + agingDuring(DAY, 5 * DAY, 0) + agingDuring(5 * DAY, 10 * DAY, 0);
    expect(steps).toBe(agingDuring(0, 10 * DAY, 0));
  });

  it('une visite récente remet le vieillissement à vitesse normale', () => {
    expect(agingDuring(9 * DAY, 10 * DAY, 9 * DAY)).toBe(DAY);
  });

  it('ne revient jamais en arrière', () => {
    expect(agingDuring(5 * DAY, DAY, 0)).toBe(0);
  });
});

describe('comfortAfterVisit', () => {
  it('un vieil animal heureux gagne un peu de vie à chaque visite, jusqu’à trois jours', () => {
    expect(comfortAfterVisit('old', true, 0)).toBe(2 * HOUR);
    expect(comfortAfterVisit('old', true, 3 * DAY - HOUR)).toBe(3 * DAY);
  });

  it('rien pour un adulte, ni pour un vieil animal malheureux', () => {
    expect(comfortAfterVisit('adult', true, 0)).toBe(0);
    expect(comfortAfterVisit('old', false, HOUR)).toBe(HOUR);
  });
});

describe('endOfLifeStep', () => {
  const end = { ageMs: LIFESPAN, lifespanMs: LIFESPAN };

  it('avant le terme, rien', () => {
    expect(endOfLifeStep({ ageMs: LIFESPAN - 1, lifespanMs: LIFESPAN, lastMomentsSince: null, visit: true, now: 0 })).toEqual({
      lastMomentsSince: null,
      dies: false,
    });
  });

  it('jamais sans visite : la tâche de fond ne fait rien', () => {
    expect(endOfLifeStep({ ...end, lastMomentsSince: null, visit: false, now: 0 }).dies).toBe(false);
    expect(endOfLifeStep({ ...end, lastMomentsSince: 0, visit: false, now: DAY }).dies).toBe(false);
  });

  it('la première visite ouvre les derniers moments, l’adieu vient au moins six heures plus tard', () => {
    const first = endOfLifeStep({ ...end, lastMomentsSince: null, visit: true, now: 10 * DAY });
    expect(first).toEqual({ lastMomentsSince: 10 * DAY, dies: false });
    expect(endOfLifeStep({ ...end, lastMomentsSince: 10 * DAY, visit: true, now: 10 * DAY + 5 * HOUR }).dies).toBe(false);
    expect(endOfLifeStep({ ...end, lastMomentsSince: 10 * DAY, visit: true, now: 10 * DAY + 6 * HOUR }).dies).toBe(true);
  });
});
