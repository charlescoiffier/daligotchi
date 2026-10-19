import { type AnimalDescription, describeAnimal, FULL_NEEDS, newbornAnimal, seededRandom } from '@daligotchi/core';
import { describe, expect, it } from 'vitest';
import { type Behaviour, behaviourWeights, chooseBehaviour } from '../src/behaviour/chooseBehaviour.ts';

function descriptionWith(needs: Partial<typeof FULL_NEEDS>): AnimalDescription {
  return describeAnimal({ ...newbornAnimal(0), needs: { ...FULL_NEEDS, ...needs } }, 100);
}

function frequencies(description: AnimalDescription): Record<Behaviour, number> {
  const random = seededRandom(3);
  const counts = { sit: 0, wander: 0, sleep: 0, goToBowl: 0, beg: 0, circle: 0 };
  for (let i = 0; i < 2000; i++) counts[chooseBehaviour(description, random)]++;
  return counts;
}

describe('chooseBehaviour', () => {
  it('un animal comblé ne dort pas, ne mendie pas et ne va pas à la gamelle', () => {
    const counts = frequencies(descriptionWith({}));
    expect(counts.sleep).toBe(0);
    expect(counts.beg).toBe(0);
    expect(counts.goToBowl).toBe(0);
    expect(counts.wander).toBeGreaterThan(0);
  });

  it('un animal épuisé dort la plupart du temps', () => {
    const counts = frequencies(descriptionWith({ energy: 10 }));
    expect(counts.sleep).toBeGreaterThan(1000);
    expect(counts.beg).toBe(0);
  });

  it('un animal affamé va souvent à la gamelle', () => {
    const counts = frequencies(descriptionWith({ satiety: 10 }));
    expect(counts.goToBowl).toBeGreaterThan(counts.wander);
  });

  it('un animal qui s’ennuie réclame du jeu', () => {
    const weights = behaviourWeights(descriptionWith({ fun: 10 }));
    expect(weights.beg).toBeGreaterThan(0);
    expect(weights.circle).toBeGreaterThan(0);
  });
});
