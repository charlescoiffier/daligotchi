import { BALANCE } from './balance.ts';
import { isLove, type PairState } from './bonds.ts';
import type { Stage } from './lifecycle.ts';
import type { Random } from './random.ts';

export interface BreedingParent {
  stage: Stage;
  /** Dernière ponte, tous partenaires confondus (temps du monde), ou null. */
  lastClutchAt: number | null;
}

/**
 * Conditions d'une ponte (GDD §8) : deux adultes, amoureux, sans parenté proche,
 * reposés depuis deux semaines chacun, et la ponte précédente de la paire entièrement placée.
 */
export function canLay(
  pair: PairState,
  a: BreedingParent,
  b: BreedingParent,
  now: number,
  options: { related: boolean; previousClutchPending: boolean },
): boolean {
  const rested = (parent: BreedingParent) =>
    parent.lastClutchAt === null || now - parent.lastClutchAt >= BALANCE.breedingCooldown;
  return (
    isLove(pair) &&
    a.stage === 'adult' &&
    b.stage === 'adult' &&
    !options.related &&
    !options.previousClutchPending &&
    rested(a) &&
    rested(b)
  );
}

/** Taille de la ponte : 1 à 3 œufs, plus souvent 1. */
export function clutchSize(random: Random): number {
  let roll = random();
  for (const [size, chance] of BALANCE.clutchSizeChances) {
    if (roll < chance) return size;
    roll -= chance;
  }
  return 1;
}
