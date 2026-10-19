/**
 * Source de hasard injectable : renvoie un nombre dans [0, 1[.
 * Le serveur utilise Math.random ; les tests utilisent seededRandom pour être reproductibles.
 */
export type Random = () => number;

export const defaultRandom: Random = Math.random;

/** Générateur déterministe (mulberry32) pour les tests et le simulateur. */
export function seededRandom(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(items: readonly T[], random: Random): T {
  if (items.length === 0) throw new Error('pick: liste vide');
  return items[Math.floor(random() * items.length)] as T;
}
