import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/balance.ts';
import { DAY, HOUR } from '../src/clock.ts';
import {
  ANIMAL_NEEDS,
  advanceHomeCleanliness,
  advanceNeeds,
  FULL_NEEDS,
  needLevel,
} from '../src/needs.ts';

const { goodFrom, badBelow, floor } = BALANCE.needs;

describe('needLevel', () => {
  it('découpe les valeurs en trois niveaux', () => {
    expect(needLevel(100)).toBe('good');
    expect(needLevel(goodFrom)).toBe('good');
    expect(needLevel(goodFrom - 1)).toBe('low');
    expect(needLevel(badBelow)).toBe('low');
    expect(needLevel(badBelow - 1)).toBe('bad');
  });
});

describe('advanceNeeds', () => {
  it('un animal nourri reste rassasié 14 h, a faim ensuite, très faim après 28 h', () => {
    expect(needLevel(advanceNeeds(FULL_NEEDS, 14 * HOUR).satiety)).toBe('good');
    expect(needLevel(advanceNeeds(FULL_NEEDS, 15 * HOUR).satiety)).toBe('low');
    expect(needLevel(advanceNeeds(FULL_NEEDS, 28 * HOUR).satiety)).toBe('low');
    expect(needLevel(advanceNeeds(FULL_NEEDS, 29 * HOUR).satiety)).toBe('bad');
  });

  it('ne descend jamais sous le plancher, même après un mois d’absence', () => {
    const needs = advanceNeeds(FULL_NEEDS, 30 * DAY);
    for (const need of ANIMAL_NEEDS) {
      if (need === 'energy') continue;
      expect(needs[need]).toBe(floor);
    }
  });

  it('l’énergie remonte toute seule sans dépasser 100', () => {
    const tired = { ...FULL_NEEDS, energy: 20 };
    expect(advanceNeeds(tired, 5 * HOUR).energy).toBe(40);
    expect(advanceNeeds(tired, 2 * DAY).energy).toBe(100);
  });

  it('avancer en deux fois donne le même résultat qu’en une fois', () => {
    const twoSteps = advanceNeeds(advanceNeeds(FULL_NEEDS, 5 * HOUR), 7 * HOUR);
    const oneStep = advanceNeeds(FULL_NEEDS, 12 * HOUR);
    for (const need of ANIMAL_NEEDS) {
      expect(twoSteps[need]).toBeCloseTo(oneStep[need], 9);
    }
  });

  it('ne change rien sans temps écoulé', () => {
    expect(advanceNeeds(FULL_NEEDS, 0)).toEqual(FULL_NEEDS);
  });
});

describe('advanceHomeCleanliness', () => {
  it('l’habitat se salit lentement jusqu’au plancher', () => {
    expect(advanceHomeCleanliness(100, 10 * HOUR)).toBe(85);
    expect(advanceHomeCleanliness(100, 30 * DAY)).toBe(floor);
  });
});
