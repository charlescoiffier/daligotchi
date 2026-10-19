import { describe, expect, it } from 'vitest';
import { DAY, HOUR } from '../src/clock.ts';
import fr from '../src/i18n/fr.json';
import {
  advanceEgg,
  applyEggCare,
  describeEgg,
  type EggState,
  isReadyToHatch,
  newEgg,
} from '../src/incubation.ts';

/** Fait vivre un œuf avec des visites régulières (couver + laver) ; renvoie le jour d'éclosion. */
function hatchDay(visitHours: readonly number[], maxDays = 30): number | undefined {
  let egg = newEgg(0);
  for (let hour = 1; hour <= maxDays * 24; hour++) {
    egg = advanceEgg(egg, hour * HOUR);
    if (isReadyToHatch(egg)) return hour / 24;
    if (visitHours.includes(hour % 24)) {
      egg = applyEggCare(applyEggCare(egg, 'warmEgg'), 'washEgg');
    }
  }
  return undefined;
}

describe('advanceEgg', () => {
  it('avec deux visites par jour, l’œuf éclot en un à deux jours', () => {
    const day = hatchDay([8, 19]);
    expect(day).toBeGreaterThanOrEqual(1);
    expect(day).toBeLessThanOrEqual(2);
  });

  it('avec une seule visite par jour, il éclot plus tard, mais il éclot', () => {
    const twice = hatchDay([8, 19])!;
    const once = hatchDay([18])!;
    expect(once).toBeGreaterThan(twice);
    expect(once).toBeLessThan(5);
  });

  it('sans aucun soin, l’œuf avance bien plus lentement mais ne recule jamais', () => {
    let egg = newEgg(0);
    let previous = 0;
    for (let day = 1; day <= 4; day++) {
      egg = advanceEgg(egg, day * DAY);
      expect(egg.progress).toBeGreaterThanOrEqual(previous);
      previous = egg.progress;
    }
    // Un œuf soigné aurait éclos en moins de deux jours ; délaissé, il n'a pas fini au bout de quatre.
    expect(isReadyToHatch(egg)).toBe(false);
    // Il n'est jamais détruit : il finit par éclore, très tard.
    expect(hatchDay([], 60)).toBeGreaterThan(5);
  });

  it('avancer en plusieurs fois donne le même résultat qu’en une fois', () => {
    const once = advanceEgg(newEgg(0), 30 * HOUR);
    const steps = advanceEgg(advanceEgg(advanceEgg(newEgg(0), 3 * HOUR), 17 * HOUR), 30 * HOUR);
    expect(steps.progress).toBeCloseTo(once.progress, 12);
    expect(steps.warmth).toBeCloseTo(once.warmth, 12);
  });

  it('ne revient jamais en arrière dans le temps', () => {
    const egg: EggState = { ...newEgg(5 * HOUR), progress: 0.4 };
    expect(advanceEgg(egg, HOUR)).toEqual(egg);
  });
});

describe('applyEggCare', () => {
  it('couver réchauffe sans dépasser 100, laver rend propre', () => {
    const cold: EggState = { warmth: 10, cleanliness: 10, progress: 0, at: 0 };
    expect(applyEggCare(cold, 'warmEgg').warmth).toBe(70);
    expect(applyEggCare(applyEggCare(cold, 'warmEgg'), 'warmEgg').warmth).toBe(100);
    expect(applyEggCare(cold, 'washEgg').cleanliness).toBe(100);
  });
});

describe('describeEgg', () => {
  it('ne renvoie que des libellés traduits', () => {
    const description = describeEgg({ warmth: 20, cleanliness: 90, progress: 0.8, at: 0 });
    expect(description).toEqual({
      warmth: 'egg.warmth.bad',
      cleanliness: 'egg.cleanliness.good',
      progress: 'egg.progress.almost',
    });
    for (const key of Object.values(description)) expect(fr).toHaveProperty([key]);
  });
});
