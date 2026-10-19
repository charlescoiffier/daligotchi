import { describe, expect, it } from 'vitest';
import {
  advanceAnimal,
  advanceHousehold,
  applyAnimalAction,
  applyHouseholdAction,
  type AnimalState,
  describeAnimal,
  emotionOf,
  type HouseholdState,
  newbornAnimal,
} from '../src/animal.ts';
import { BALANCE } from '../src/balance.ts';
import { DAY, HOUR } from '../src/clock.ts';
import fr from '../src/i18n/fr.json';
import { FULL_NEEDS } from '../src/needs.ts';

const { floor } = BALANCE.needs;

function household(animals: AnimalState[], at = 0): HouseholdState {
  return { homeCleanliness: 100, animals, at, lastVisitAt: at };
}

describe('advanceAnimal', () => {
  it('fait vieillir et baisser les besoins, en ralentissant l’âge pendant l’absence', () => {
    const animal = advanceAnimal(newbornAnimal(0), 10 * DAY, 0);
    expect(animal.at).toBe(10 * DAY);
    expect(animal.ageMs).toBe(6 * DAY);
    expect(animal.needs.satiety).toBe(floor);
  });

  it('ne revient jamais en arrière', () => {
    const animal = newbornAnimal(5 * DAY);
    expect(advanceAnimal(animal, DAY, 0)).toEqual(animal);
  });
});

describe('advanceHousehold', () => {
  it('fait avancer l’habitat et tous ses animaux jusqu’au même instant', () => {
    const h = advanceHousehold(household([newbornAnimal(0), newbornAnimal(0)]), 12 * HOUR);
    expect(h.at).toBe(12 * HOUR);
    expect(h.homeCleanliness).toBeLessThan(100);
    for (const animal of h.animals) expect(animal.at).toBe(12 * HOUR);
  });
});

describe('actions du foyer', () => {
  const hungry = { ...newbornAnimal(0), needs: { ...FULL_NEEDS, satiety: 10, hydration: 10 } };

  it('nourrir rassasie tous les animaux du foyer', () => {
    const h = applyHouseholdAction(household([hungry, hungry]), 'feed');
    for (const animal of h.animals) expect(animal.needs.satiety).toBe(100);
  });

  it('abreuver désaltère tous les animaux du foyer', () => {
    const h = applyHouseholdAction(household([hungry]), 'water');
    expect(h.animals[0]?.needs.hydration).toBe(100);
  });

  it('nettoyer remet l’habitat à neuf', () => {
    const h = applyHouseholdAction({ ...household([]), homeCleanliness: 12 }, 'cleanHome');
    expect(h.homeCleanliness).toBe(100);
  });
});

describe('actions sur un animal', () => {
  it('caresser apporte de l’affection, sans dépasser 100', () => {
    const lonely = { ...FULL_NEEDS, affection: 20 };
    expect(applyAnimalAction(lonely, 'pet').affection).toBe(60);
    expect(applyAnimalAction(FULL_NEEDS, 'pet').affection).toBe(100);
  });

  it('laver rend l’animal propre', () => {
    expect(applyAnimalAction({ ...FULL_NEEDS, hygiene: 8 }, 'wash').hygiene).toBe(100);
  });

  it('la balle amuse et fatigue', () => {
    const bored = { ...FULL_NEEDS, fun: 20 };
    const after = applyAnimalAction(bored, 'ball');
    expect(after.fun).toBe(55);
    expect(after.energy).toBe(85);
  });

  it('un animal fatigué profite moins de la balle', () => {
    const tired = { ...FULL_NEEDS, fun: 20, energy: 20 };
    const after = applyAnimalAction(tired, 'ball');
    expect(after.fun).toBe(34);
    expect(after.energy).toBe(floor);
  });
});

describe('émotion', () => {
  it('un animal comblé dans un habitat propre est heureux', () => {
    expect(emotionOf(FULL_NEEDS, 100)).toBe('happy');
  });

  it('un animal négligé est triste', () => {
    const neglected = { ...FULL_NEEDS, satiety: floor, hydration: floor, fun: floor, affection: floor, hygiene: floor };
    expect(emotionOf(neglected, floor)).toBe('sad');
  });
});

describe('describeAnimal', () => {
  it('renvoie uniquement des libellés traduits, jamais de nombres', () => {
    const description = describeAnimal(newbornAnimal(0), 100);
    const keys = [description.stage, description.emotion, ...Object.values(description.needs)];
    for (const key of keys) expect(fr).toHaveProperty([key]);
    expect(JSON.stringify(description)).not.toMatch(/\d/);
  });

  it('signale les signes de grand âge', () => {
    const elder = { ...newbornAnimal(0), ageMs: newbornAnimal(0).lifespanMs - DAY };
    expect(describeAnimal(elder, 100).elderSigns).toBe(true);
  });
});
