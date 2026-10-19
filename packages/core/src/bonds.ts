import { BALANCE } from './balance.ts';
import { HOUR } from './clock.ts';

/** Instantané de la jauge d'interaction d'une paire (identifiants rangés : a < b). */
export interface PairState {
  readonly a: string;
  readonly b: string;
  readonly interaction: number;
  readonly at: number;
}

/** Ce qu'il faut savoir d'une paire pendant la période : vivent-ils ensemble ? peuvent-ils s'aimer ? */
export interface PairContext {
  together: boolean;
  /** Faux pour la parenté proche : très proches possible, amoureux jamais. */
  allowed: boolean;
}

/** Ascendance connue d'un animal (null pour un fondateur). */
export interface Kin {
  id: string;
  parentA: string | null;
  parentB: string | null;
}

export function pairKey(x: string, y: string): [string, string] {
  return x < y ? [x, y] : [y, x];
}

/**
 * Parenté exclue de l'amour (GDD §8) : parent et enfant, frères et sœurs,
 * et demi-frères et demi-sœurs (au moins un parent commun).
 */
export function areRelated(x: Kin, y: Kin): boolean {
  const parentsOf = (k: Kin) => [k.parentA, k.parentB].filter((p): p is string => p !== null);
  if (parentsOf(x).includes(y.id) || parentsOf(y).includes(x.id)) return true;
  return parentsOf(x).some((parent) => parentsOf(y).includes(parent));
}

export function isLove(pair: PairState): boolean {
  return pair.interaction >= BALANCE.bonds.loveThreshold;
}

/**
 * Fait évoluer toutes les jauges d'un foyer jusqu'à `to`, en respectant l'exclusivité :
 * un animal amoureux ne peut pas dépasser le seuil avec un autre. Quand plusieurs paires
 * atteignent le seuil pendant la période, la première arrivée l'emporte (calcul exact :
 * les jauges montent en ligne droite, on sait donc quand chacune atteint le seuil).
 */
export function advanceBonds(
  pairs: readonly PairState[],
  to: number,
  contextOf: (pair: PairState) => PairContext,
): PairState[] {
  const { loveThreshold, togetherPerHour, apartPerHour } = BALANCE.bonds;
  const cap = loveThreshold - 1;

  // Animaux déjà amoureux au début de la période.
  const inLove = new Set<string>();
  for (const pair of pairs) {
    if (isLove(pair) && contextOf(pair).allowed) inLove.add(pair.a).add(pair.b);
  }

  // Paires qui atteignent le seuil pendant la période, dans l'ordre d'arrivée.
  const reaching = pairs
    .filter((pair) => to > pair.at && !isLove(pair) && contextOf(pair).together)
    .map((pair) => ({ pair, when: pair.at + ((loveThreshold - pair.interaction) / togetherPerHour) * HOUR }))
    .filter(({ when }) => when <= to)
    .sort((x, y) => x.when - y.when || (x.pair.a + x.pair.b).localeCompare(y.pair.a + y.pair.b));

  const fallsInLove = new Set<PairState>();
  for (const { pair } of reaching) {
    if (contextOf(pair).allowed && !inLove.has(pair.a) && !inLove.has(pair.b)) {
      fallsInLove.add(pair);
      inLove.add(pair.a).add(pair.b);
    }
  }

  return pairs.map((pair) => {
    if (to <= pair.at) return pair;
    const hours = (to - pair.at) / HOUR;
    const { together } = contextOf(pair);
    let interaction = together
      ? Math.min(100, pair.interaction + togetherPerHour * hours)
      : Math.max(0, pair.interaction - apartPerHour * hours);
    const loving = (isLove(pair) && contextOf(pair).allowed) || fallsInLove.has(pair);
    if (together && !loving) interaction = Math.min(interaction, Math.max(cap, pair.interaction));
    return { ...pair, interaction, at: to };
  });
}

/** Lancer la balle à tout le foyer : chaque paire se rapproche, sans franchir le seuil interdit. */
export function boostBonds(
  pairs: readonly PairState[],
  contextOf: (pair: PairState) => PairContext,
): PairState[] {
  const { ballForAllBoost, loveThreshold } = BALANCE.bonds;
  const inLove = new Set<string>();
  for (const pair of pairs) if (isLove(pair) && contextOf(pair).allowed) inLove.add(pair.a).add(pair.b);
  return pairs.map((pair) => {
    if (!contextOf(pair).together) return pair;
    const boosted = Math.min(100, pair.interaction + ballForAllBoost);
    const mayLove = contextOf(pair).allowed && (isLove(pair) || (!inLove.has(pair.a) && !inLove.has(pair.b)));
    if (mayLove && boosted >= loveThreshold && !isLove(pair)) inLove.add(pair.a).add(pair.b);
    return { ...pair, interaction: mayLove ? boosted : Math.min(boosted, Math.max(loveThreshold - 1, pair.interaction)) };
  });
}

export type BondLevel = 'love' | 'close' | 'friend';

export function bondLevel(interaction: number): BondLevel | undefined {
  const { loveThreshold, closeFrom, friendFrom } = BALANCE.bonds;
  if (interaction >= loveThreshold) return 'love';
  if (interaction >= closeFrom) return 'close';
  if (interaction >= friendFrom) return 'friend';
  return undefined;
}
