import { pick, type Random } from './random.ts';

/** Les six espèces fondatrices (identifiants techniques, sans accents). */
export const SPECIES = ['renard', 'hamster', 'poulpe', 'phoque', 'tortue', 'cameleon'] as const;
export type Species = (typeof SPECIES)[number];

/** Deux allèles d'espèce, toujours rangés dans l'ordre de SPECIES. */
export type Genotype = readonly [Species, Species];

/** Hybrides du GDD, indexés par la paire d'espèces rangée. */
const HYBRIDS = {
  'renard+hamster': 'hamstard',
  'renard+poulpe': 'poulpard',
  'renard+phoque': 'renoque',
  'renard+tortue': 'tortard',
  'renard+cameleon': 'camelard',
  'hamster+poulpe': 'hamoulpe',
  'hamster+phoque': 'hamoque',
  'hamster+tortue': 'torter',
  'hamster+cameleon': 'camelester',
  'poulpe+phoque': 'poulpoque',
  'poulpe+tortue': 'tortoulpe',
  'poulpe+cameleon': 'cameloulpe',
  'phoque+tortue': 'tortoque',
  'phoque+cameleon': 'cameloque',
  'tortue+cameleon': 'torteon',
} as const;

export type Hybrid = (typeof HYBRIDS)[keyof typeof HYBRIDS];
/** Forme visible d'un animal : espèce fondatrice ou hybride. */
export type Form = Species | Hybrid;

export function makeGenotype(a: Species, b: Species): Genotype {
  return SPECIES.indexOf(a) <= SPECIES.indexOf(b) ? [a, b] : [b, a];
}

export function visibleForm([a, b]: Genotype): Form {
  if (a === b) return a;
  return HYBRIDS[`${a}+${b}` as keyof typeof HYBRIDS];
}

/** Chaque parent transmet au hasard l'un de ses deux allèles (une chance sur deux). */
export function inherit(parentA: Genotype, parentB: Genotype, random: Random): Genotype {
  return makeGenotype(pick(parentA, random), pick(parentB, random));
}

/** Œuf généré par le jeu : deux allèles tirés au hasard parmi les espèces actives. */
export function randomFounderGenotype(activeSpecies: readonly Species[], random: Random): Genotype {
  return makeGenotype(pick(activeSpecies, random), pick(activeSpecies, random));
}
