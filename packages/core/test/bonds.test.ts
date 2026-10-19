import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/balance.ts';
import {
  advanceBonds,
  areRelated,
  bondLevel,
  boostBonds,
  isLove,
  type PairContext,
  type PairState,
  pairKey,
} from '../src/bonds.ts';
import { canLay, clutchSize } from '../src/breeding.ts';
import { DAY, HOUR, WEEK } from '../src/clock.ts';
import { seededRandom } from '../src/random.ts';

const { loveThreshold } = BALANCE.bonds;
const together: PairContext = { together: true, allowed: true };

function pair(a: string, b: string, interaction = 0, at = 0): PairState {
  const [x, y] = pairKey(a, b);
  return { a: x, b: y, interaction, at };
}

const find = (pairs: PairState[], a: string, b: string) => {
  const [x, y] = pairKey(a, b);
  return pairs.find((p) => p.a === x && p.b === y)!;
};

describe('advanceBonds', () => {
  it('deux animaux qui vivent ensemble tombent amoureux en trois jours environ', () => {
    const [after2] = advanceBonds([pair('a', 'b')], 2 * DAY, () => together);
    const [after3] = advanceBonds([pair('a', 'b')], 3 * DAY, () => together);
    expect(isLove(after2!)).toBe(false);
    expect(isLove(after3!)).toBe(true);
  });

  it('séparés, la jauge baisse lentement, sur plusieurs semaines', () => {
    const [after] = advanceBonds([pair('a', 'b', 90)], 2 * WEEK, () => ({ together: false, allowed: true }));
    expect(after!.interaction).toBeGreaterThan(45);
    expect(after!.interaction).toBeLessThan(90);
  });

  it('un animal amoureux ne peut pas dépasser le seuil avec un autre', () => {
    const pairs = [pair('a', 'b', 95), pair('a', 'c', 50)];
    const after = advanceBonds(pairs, 10 * DAY, () => together);
    expect(isLove(find(after, 'a', 'b'))).toBe(true);
    expect(find(after, 'a', 'c').interaction).toBe(loveThreshold - 1);
  });

  it('quand deux paires visent le même animal, la première arrivée au seuil l’emporte', () => {
    const pairs = [pair('a', 'b', 70), pair('a', 'c', 60)];
    const after = advanceBonds(pairs, 5 * DAY, () => together);
    expect(isLove(find(after, 'a', 'b'))).toBe(true);
    expect(isLove(find(after, 'a', 'c'))).toBe(false);
  });

  it('frères, sœurs, parents et enfants restent sous le seuil', () => {
    const after = advanceBonds([pair('a', 'b')], 10 * DAY, () => ({ together: true, allowed: false }));
    expect(after[0]!.interaction).toBe(loveThreshold - 1);
  });

  it('avancer en plusieurs fois donne le même résultat qu’en une fois', () => {
    const start = [pair('a', 'b', 70), pair('a', 'c', 60), pair('b', 'c', 10)];
    const once = advanceBonds(start, 4 * DAY, () => together);
    let steps = start;
    for (const t of [5 * HOUR, 19 * HOUR, 2 * DAY, 4 * DAY]) steps = advanceBonds(steps, t, () => together);
    for (const p of once) expect(find(steps, p.a, p.b).interaction).toBeCloseTo(p.interaction, 9);
  });
});

describe('boostBonds', () => {
  it('la balle pour tous rapproche chaque paire, sans briser l’exclusivité', () => {
    const pairs = [pair('a', 'b', 90), pair('a', 'c', 78), pair('c', 'd', 10)];
    const after = boostBonds(pairs, () => together);
    expect(find(after, 'c', 'd').interaction).toBe(14);
    expect(find(after, 'a', 'c').interaction).toBe(loveThreshold - 1);
  });
});

describe('areRelated', () => {
  const founder = (id: string) => ({ id, parentA: null, parentB: null });
  const child = (id: string, a: string, b: string) => ({ id, parentA: a, parentB: b });

  it('reconnaît parent et enfant, frères et sœurs, demi-frères et demi-sœurs', () => {
    expect(areRelated(founder('p'), child('e', 'p', 'q'))).toBe(true);
    expect(areRelated(child('e1', 'p', 'q'), child('e2', 'p', 'q'))).toBe(true);
    expect(areRelated(child('e1', 'p', 'q'), child('e3', 'p', 'r'))).toBe(true);
  });

  it('laisse libres les animaux sans parent commun', () => {
    expect(areRelated(founder('x'), founder('y'))).toBe(false);
    expect(areRelated(child('e1', 'p', 'q'), child('e4', 'r', 's'))).toBe(false);
  });
});

describe('bondLevel', () => {
  it('copain, très proche, amoureux', () => {
    expect(bondLevel(10)).toBeUndefined();
    expect(bondLevel(30)).toBe('friend');
    expect(bondLevel(60)).toBe('close');
    expect(bondLevel(loveThreshold)).toBe('love');
  });
});

describe('canLay', () => {
  const adult = { stage: 'adult' as const, lastClutchAt: null };
  const love = pair('a', 'b', 90);
  const free = { related: false, previousClutchPending: false };

  it('pond entre deux adultes amoureux, reposés, sans parenté', () => {
    expect(canLay(love, adult, adult, 10 * WEEK, free)).toBe(true);
  });

  it('refuse sans amour, avec un jeune, avec parenté ou si la ponte précédente attend', () => {
    expect(canLay(pair('a', 'b', 60), adult, adult, 0, free)).toBe(false);
    expect(canLay(love, adult, { stage: 'young', lastClutchAt: null }, 0, free)).toBe(false);
    expect(canLay(love, adult, adult, 0, { ...free, related: true })).toBe(false);
    expect(canLay(love, adult, adult, 0, { ...free, previousClutchPending: true })).toBe(false);
  });

  it('chaque parent attend deux semaines, tous partenaires confondus', () => {
    const tired = { stage: 'adult' as const, lastClutchAt: 10 * WEEK };
    expect(canLay(love, adult, tired, 11 * WEEK, free)).toBe(false);
    expect(canLay(love, adult, tired, 12 * WEEK, free)).toBe(true);
  });
});

describe('clutchSize', () => {
  it('donne 1 à 3 œufs, le plus souvent 1', () => {
    const random = seededRandom(9);
    const counts = [0, 0, 0, 0];
    for (let i = 0; i < 5000; i++) counts[clutchSize(random)]!++;
    expect(counts[0]).toBe(0);
    expect(counts[1]).toBeGreaterThan(counts[2]!);
    expect(counts[2]).toBeGreaterThan(counts[3]!);
    expect(counts[3]).toBeGreaterThan(0);
  });
});
