import { BALANCE } from './balance.ts';
import { HOUR } from './clock.ts';

/** Besoins propres à chaque animal (0 = très mauvais, 100 = parfait). */
export const ANIMAL_NEEDS = ['satiety', 'hydration', 'energy', 'hygiene', 'fun', 'affection'] as const;
export type AnimalNeed = (typeof ANIMAL_NEEDS)[number];
export type Needs = Readonly<Record<AnimalNeed, number>>;

export const FULL_NEEDS: Needs = {
  satiety: 100,
  hydration: 100,
  energy: 100,
  hygiene: 100,
  fun: 100,
  affection: 100,
};

/** Niveau affiché : bien, moyen (« a faim »), mauvais (« très faim »). */
export type NeedLevel = 'good' | 'low' | 'bad';

export function needLevel(value: number): NeedLevel {
  if (value >= BALANCE.needs.goodFrom) return 'good';
  if (value >= BALANCE.needs.badBelow) return 'low';
  return 'bad';
}

export function clampNeed(value: number): number {
  return Math.min(100, Math.max(BALANCE.needs.floor, value));
}

/**
 * Fait évoluer les besoins pendant une durée de jeu (ms).
 * Baisse linéaire jusqu'au plancher ; l'énergie, elle, remonte jusqu'à 100.
 * Avancer en plusieurs fois donne le même résultat qu'en une seule fois.
 */
export function advanceNeeds(needs: Needs, elapsedMs: number): Needs {
  const hours = Math.max(0, elapsedMs) / HOUR;
  const { decayPerHour, energyRecoveryPerHour } = BALANCE.needs;
  return {
    satiety: clampNeed(needs.satiety - decayPerHour.satiety * hours),
    hydration: clampNeed(needs.hydration - decayPerHour.hydration * hours),
    energy: clampNeed(needs.energy + energyRecoveryPerHour * hours),
    hygiene: clampNeed(needs.hygiene - decayPerHour.hygiene * hours),
    fun: clampNeed(needs.fun - decayPerHour.fun * hours),
    affection: clampNeed(needs.affection - decayPerHour.affection * hours),
  };
}

/** Propreté de l'habitat, qui se salit lentement jusqu'au plancher. */
export function advanceHomeCleanliness(value: number, elapsedMs: number): number {
  const hours = Math.max(0, elapsedMs) / HOUR;
  return clampNeed(value - BALANCE.needs.homeDecayPerHour * hours);
}
