import { BALANCE } from './balance.ts';
import { DAY, HOUR } from './clock.ts';
import type { MessageKey } from './i18n/index.ts';
import { clampNeed, needLevel } from './needs.ts';

/** Instantané d'un œuf en incubation à l'instant `at` (temps du monde, en ms). */
export interface EggState {
  readonly warmth: number;
  readonly cleanliness: number;
  /** Avancement de 0 à 1 : à 1, l'œuf est prêt à éclore. */
  readonly progress: number;
  readonly at: number;
}

export type EggAction = 'warmEgg' | 'washEgg';
export const EGG_ACTIONS: readonly EggAction[] = ['warmEgg', 'washEgg'];

export function newEgg(at: number): EggState {
  return {
    warmth: BALANCE.egg.startWarmth,
    cleanliness: BALANCE.egg.startCleanliness,
    progress: 0,
    at,
  };
}

/**
 * Intégrale (en « valeur × heures ») d'un besoin qui baisse linéairement de `start`
 * à la vitesse `perHour`, sans descendre sous le plancher, pendant `hours` heures.
 */
function areaUnderDecay(start: number, perHour: number, hours: number): number {
  const floor = BALANCE.needs.floor;
  if (start <= floor) return floor * hours;
  const hoursToFloor = (start - floor) / perHour;
  if (hours <= hoursToFloor) return start * hours - (perHour * hours * hours) / 2;
  return start * hoursToFloor - (perHour * hoursToFloor * hoursToFloor) / 2 + floor * (hours - hoursToFloor);
}

/**
 * Fait évoluer l'œuf jusqu'à l'instant `to`. L'avancement gagné est proportionnel
 * à la moyenne de la chaleur et de la propreté sur la période (calcul exact, sans pas de temps) :
 * avancer en plusieurs fois donne le même résultat qu'en une seule fois.
 */
export function advanceEgg(egg: EggState, to: number): EggState {
  if (to <= egg.at) return egg;
  const { warmthDecayPerHour, cleanlinessDecayPerHour, fullCareDays } = BALANCE.egg;
  const hours = (to - egg.at) / HOUR;
  const careArea =
    (areaUnderDecay(egg.warmth, warmthDecayPerHour, hours) +
      areaUnderDecay(egg.cleanliness, cleanlinessDecayPerHour, hours)) /
    200;
  const progressPerHour = 1 / ((fullCareDays * DAY) / HOUR);
  return {
    warmth: clampNeed(egg.warmth - warmthDecayPerHour * hours),
    cleanliness: clampNeed(egg.cleanliness - cleanlinessDecayPerHour * hours),
    progress: Math.min(1, egg.progress + careArea * progressPerHour),
    at: to,
  };
}

export function applyEggCare(egg: EggState, action: EggAction): EggState {
  if (action === 'washEgg') return { ...egg, cleanliness: 100 };
  return { ...egg, warmth: clampNeed(egg.warmth + BALANCE.egg.warmBoost) };
}

export function isReadyToHatch(egg: EggState): boolean {
  return egg.progress >= 1;
}

/** Ce que le joueur voit d'un œuf : des libellés, jamais l'espèce ni des nombres. */
export interface EggDescription {
  warmth: MessageKey;
  cleanliness: MessageKey;
  progress: MessageKey;
}

export function describeEgg(egg: EggState): EggDescription {
  const [moving, almost] = BALANCE.egg.progressSteps;
  const progress = egg.progress >= almost! ? 'almost' : egg.progress >= moving! ? 'moving' : 'asleep';
  return {
    warmth: `egg.warmth.${needLevel(egg.warmth)}`,
    cleanliness: `egg.cleanliness.${needLevel(egg.cleanliness)}`,
    progress: `egg.progress.${progress}`,
  };
}
