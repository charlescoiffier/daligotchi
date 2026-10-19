import { describe, expect, it } from 'vitest';
import {
  type Genotype,
  inherit,
  makeGenotype,
  randomFounderGenotype,
  visibleForm,
} from '../src/genetics.ts';
import { seededRandom } from '../src/random.ts';

describe('visibleForm', () => {
  it('donne une espèce fondatrice quand les deux allèles sont identiques', () => {
    expect(visibleForm(makeGenotype('renard', 'renard'))).toBe('renard');
    expect(visibleForm(makeGenotype('poulpe', 'poulpe'))).toBe('poulpe');
  });

  it('donne l’hybride du GDD quand les allèles diffèrent, quel que soit l’ordre', () => {
    expect(visibleForm(makeGenotype('renard', 'poulpe'))).toBe('poulpard');
    expect(visibleForm(makeGenotype('poulpe', 'renard'))).toBe('poulpard');
    expect(visibleForm(makeGenotype('tortue', 'cameleon'))).toBe('torteon');
    expect(visibleForm(makeGenotype('hamster', 'tortue'))).toBe('torter');
  });
});

describe('makeGenotype', () => {
  it('range les allèles dans un ordre stable', () => {
    expect(makeGenotype('poulpe', 'renard')).toEqual(makeGenotype('renard', 'poulpe'));
  });
});

describe('inherit', () => {
  it('deux poulpards donnent environ 25 % renards, 50 % poulpards, 25 % poulpes', () => {
    const random = seededRandom(42);
    const poulpard: Genotype = makeGenotype('renard', 'poulpe');
    const counts: Record<string, number> = {};
    const total = 10_000;

    for (let i = 0; i < total; i++) {
      const form = visibleForm(inherit(poulpard, poulpard, random));
      counts[form] = (counts[form] ?? 0) + 1;
    }

    expect(Object.keys(counts).sort()).toEqual(['poulpard', 'poulpe', 'renard']);
    expect((counts.renard ?? 0) / total).toBeCloseTo(0.25, 1);
    expect((counts.poulpard ?? 0) / total).toBeCloseTo(0.5, 1);
    expect((counts.poulpe ?? 0) / total).toBeCloseTo(0.25, 1);
  });

  it('deux renards ne donnent que des renards', () => {
    const random = seededRandom(7);
    const renard = makeGenotype('renard', 'renard');
    for (let i = 0; i < 100; i++) {
      expect(visibleForm(inherit(renard, renard, random))).toBe('renard');
    }
  });
});

describe('randomFounderGenotype', () => {
  it('ne tire que parmi les espèces actives', () => {
    const random = seededRandom(1);
    for (let i = 0; i < 200; i++) {
      const genotype = randomFounderGenotype(['renard', 'poulpe'], random);
      for (const allele of genotype) {
        expect(['renard', 'poulpe']).toContain(allele);
      }
    }
  });
});
