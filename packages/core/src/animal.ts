import { BALANCE } from './balance.ts';
import type { MessageKey } from './i18n/index.ts';
import { agingDuring, hasElderSigns, lifespanOf, type Stage, stageOf } from './lifecycle.ts';
import {
  ANIMAL_NEEDS,
  type AnimalNeed,
  advanceHomeCleanliness,
  advanceNeeds,
  clampNeed,
  FULL_NEEDS,
  type Needs,
  needLevel,
} from './needs.ts';

/**
 * Instantané d'un animal : son état à l'instant `at` (temps du monde, en ms).
 * L'état à un autre instant se calcule avec advanceAnimal, sans rien stocker entre les deux.
 */
export interface AnimalState {
  readonly needs: Needs;
  readonly ageMs: number;
  readonly lifespanMs: number;
  readonly at: number;
}

/** Instantané d'un foyer : l'habitat et ses animaux, tous au même instant. */
export interface HouseholdState {
  readonly homeCleanliness: number;
  readonly animals: readonly AnimalState[];
  readonly at: number;
  /** Dernière visite d'un responsable (temps du monde), pour le vieillissement ralenti. */
  readonly lastVisitAt: number;
}

export function newbornAnimal(at: number, longevityFactor = 1): AnimalState {
  return { needs: FULL_NEEDS, ageMs: 0, lifespanMs: lifespanOf(longevityFactor), at };
}

export function advanceAnimal(animal: AnimalState, to: number, lastVisitAt: number): AnimalState {
  if (to <= animal.at) return animal;
  return {
    ...animal,
    needs: advanceNeeds(animal.needs, to - animal.at),
    ageMs: animal.ageMs + agingDuring(animal.at, to, lastVisitAt),
    at: to,
  };
}

export function advanceHousehold(household: HouseholdState, to: number): HouseholdState {
  if (to <= household.at) return household;
  return {
    ...household,
    homeCleanliness: advanceHomeCleanliness(household.homeCleanliness, to - household.at),
    animals: household.animals.map((animal) => advanceAnimal(animal, to, household.lastVisitAt)),
    at: to,
  };
}

/** Actions qui concernent tout le foyer (GDD §5). */
export type HouseholdAction = 'feed' | 'water' | 'cleanHome';
/** Actions sur un animal sélectionné. */
export type AnimalAction = 'pet' | 'ball' | 'wash';

export function applyHouseholdAction(
  household: HouseholdState,
  action: HouseholdAction,
): HouseholdState {
  if (action === 'cleanHome') return { ...household, homeCleanliness: 100 };
  const need: AnimalNeed = action === 'feed' ? 'satiety' : 'hydration';
  return {
    ...household,
    animals: household.animals.map((animal) => ({
      ...animal,
      needs: { ...animal.needs, [need]: 100 },
    })),
  };
}

export function applyAnimalAction(needs: Needs, action: AnimalAction): Needs {
  const { petAffection, ballFun, ballEnergyCost, tiredBallFactor } = BALANCE.actions;
  switch (action) {
    case 'pet':
      return { ...needs, affection: clampNeed(needs.affection + petAffection) };
    case 'wash':
      return { ...needs, hygiene: 100 };
    case 'ball': {
      const tired = needLevel(needs.energy) !== 'good';
      return {
        ...needs,
        fun: clampNeed(needs.fun + ballFun * (tired ? tiredBallFactor : 1)),
        energy: clampNeed(needs.energy - ballEnergyCost),
      };
    }
  }
}

export type Emotion = 'happy' | 'calm' | 'sad';

/** L'émotion n'est pas stockée : elle découle de la moyenne des besoins et de l'habitat. */
export function emotionOf(needs: Needs, homeCleanliness: number): Emotion {
  const values = [...ANIMAL_NEEDS.map((need) => needs[need]), homeCleanliness];
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (average >= BALANCE.emotion.happyFrom) return 'happy';
  if (average < BALANCE.emotion.sadBelow) return 'sad';
  return 'calm';
}

/** Ce que le joueur a le droit de voir : des libellés, jamais de nombres. */
export interface AnimalDescription {
  stage: MessageKey;
  emotion: MessageKey;
  needs: Record<AnimalNeed, MessageKey>;
  elderSigns: boolean;
}

export function describeAnimal(animal: AnimalState, homeCleanliness: number): AnimalDescription {
  const stage: Stage = stageOf(animal.ageMs);
  const needs = Object.fromEntries(
    ANIMAL_NEEDS.map((need) => [need, `need.${need}.${needLevel(animal.needs[need])}`]),
  ) as Record<AnimalNeed, MessageKey>;
  return {
    stage: `stage.${stage}`,
    emotion: `emotion.${emotionOf(animal.needs, homeCleanliness)}`,
    needs,
    elderSigns: hasElderSigns(animal.ageMs, animal.lifespanMs),
  };
}

export function describeHome(homeCleanliness: number): MessageKey {
  return `need.home.${needLevel(homeCleanliness)}`;
}

/** Toutes les actions de soin de la PVJ. */
export type CareAction = HouseholdAction | AnimalAction;
export const CARE_ACTIONS: readonly CareAction[] = ['feed', 'water', 'cleanHome', 'pet', 'ball', 'wash'];
/** Actions qui demandent de choisir un animal. La balle peut aussi être lancée à tout le foyer. */
export const ANIMAL_ONLY_ACTIONS: readonly AnimalAction[] = ['pet', 'wash'];

/**
 * Applique une action de soin au foyer. `animalIndex` désigne l'animal visé ;
 * sans lui, la balle est lancée à tout le foyer.
 */
export function applyCare(
  household: HouseholdState,
  action: CareAction,
  animalIndex?: number,
): HouseholdState {
  if (action === 'feed' || action === 'water' || action === 'cleanHome') {
    return applyHouseholdAction(household, action);
  }
  if (animalIndex === undefined && action !== 'ball') {
    throw new Error(`L'action ${action} demande un animal`);
  }
  return {
    ...household,
    animals: household.animals.map((animal, index) =>
      animalIndex === undefined || index === animalIndex
        ? { ...animal, needs: applyAnimalAction(animal.needs, action) }
        : animal,
    ),
  };
}
