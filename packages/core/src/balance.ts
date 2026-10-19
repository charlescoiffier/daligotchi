import { DAY, HOUR, WEEK } from './clock.ts';
import type { Species } from './genetics.ts';

/**
 * Tous les nombres d'équilibrage du jeu, réunis ici pour être lus et modifiés facilement.
 * Les valeurs sont des propositions de départ (GDD v0.2) ; elles seront ajustées après les essais.
 */
export const BALANCE = {
  /** Espèces disponibles dans la PVJ. */
  activeSpecies: ['renard', 'poulpe'] as readonly Species[],

  /** Places d'un foyer, animaux et œufs confondus. */
  householdSlots: 6,

  /** Un besoin passe de « bien » à « a faim » en environ 12 h (deux visites par jour). */
  needDropToHungry: 12 * HOUR,

  lifeStages: {
    youngDuration: 4 * WEEK,
    adultDuration: 9 * WEEK,
    oldDuration: 4 * WEEK,
  },

  /** Vieillissement ralenti après une longue absence. */
  absence: {
    slowAgingAfter: 2 * DAY,
    slowAgingFactor: 0.5,
  },

  /** Œuf du nid déposé automatiquement au lieu d'adoption. */
  nestAutoDepositAfter: 7 * DAY,

  /** Récupération de chaque parent après une ponte. */
  breedingCooldown: 2 * WEEK,
} as const;
