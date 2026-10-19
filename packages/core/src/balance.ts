import { DAY, WEEK } from './clock.ts';
import type { Species } from './genetics.ts';

/**
 * Tous les nombres d'équilibrage du jeu, réunis ici pour être lus et modifiés facilement.
 * Les valeurs sont des propositions de départ (GDD v0.3) ; elles seront ajustées après les essais.
 *
 * Les besoins vont de 0 (très mauvais) à 100 (parfait). Ces nombres ne sont jamais montrés
 * aux joueurs : ils voient seulement des libellés (« rassasié », « a faim », « très faim »).
 */
export const BALANCE = {
  /** Espèces disponibles dans la PVJ. */
  activeSpecies: ['renard', 'poulpe'] as readonly Species[],

  /** Places d'un foyer, animaux et œufs confondus. */
  householdSlots: 6,

  needs: {
    /** Au-dessus : libellé « bien » (rassasié, propre…). */
    goodFrom: 65,
    /** En dessous : libellé « très » (très faim, très sale…). Entre les deux : « a faim »… */
    badBelow: 30,
    /** Plancher : l'absence ne peut pas descendre plus bas (pas de dette de soins illimitée). */
    floor: 5,

    /**
     * Baisse par heure de jeu. Avec 2,5 par heure, un animal nourri passe sous « rassasié »
     * après 14 h, est « affamé » après 28 h : deux visites par jour le gardent en forme,
     * une seule visite le laisse correct mais pas épanoui.
     * La propreté baisse plus lentement : un lavage tous les deux jours environ suffit.
     */
    decayPerHour: {
      satiety: 2.5,
      hydration: 2.5,
      hygiene: 0.75,
      fun: 2.5,
      affection: 2,
    },
    /** L'énergie remonte toute seule (l'animal se repose) et baisse quand il joue. */
    energyRecoveryPerHour: 4,
    /** Propreté de l'habitat. */
    homeDecayPerHour: 1.5,
  },

  actions: {
    petAffection: 40,
    ballFun: 35,
    ballEnergyCost: 15,
    /** Un animal fatigué profite moins de la balle (effet multiplié). */
    tiredBallFactor: 0.4,
  },

  /** Seuils de l'émotion, déduite de la moyenne de tous les besoins (habitat compris). */
  emotion: {
    happyFrom: 65,
    sadBelow: 40,
  },

  lifeStages: {
    youngDuration: 4 * WEEK,
    adultDuration: 9 * WEEK,
    oldDuration: 4 * WEEK,
    /** Durée des signes de grand âge avant la fin de vie. */
    elderSignsDuration: 3 * DAY,
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
