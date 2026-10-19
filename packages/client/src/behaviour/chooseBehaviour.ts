import type { AnimalDescription, Random } from '@daligotchi/core';

/**
 * Comportements décoratifs : ce que l'animal fait à l'écran entre deux soins.
 * Ils sont choisis sur le téléphone, d'après les libellés, et ne sont jamais envoyés au serveur.
 */
export type Behaviour =
  | 'sit' // reste assis
  | 'wander' // se promène
  | 'sleep' // dort
  | 'goToBowl' // va vers la gamelle
  | 'beg' // réclame du jeu ou des câlins (sautille)
  | 'circle'; // tourne en rond

type Level = 'good' | 'low' | 'bad';

function level(key: string): Level {
  return key.slice(key.lastIndexOf('.') + 1) as Level;
}

const NEED_WEIGHT: Record<Level, number> = { good: 0, low: 3, bad: 6 };

/** Poids de chaque comportement : plus le poids est grand, plus il est fréquent. */
export function behaviourWeights(description: AnimalDescription): Record<Behaviour, number> {
  const { needs, emotion, elderSigns, stage } = description;
  const energy = level(needs.energy);
  const hunger = Math.max(NEED_WEIGHT[level(needs.satiety)], NEED_WEIGHT[level(needs.hydration)]);
  const boredom = NEED_WEIGHT[level(needs.fun)];
  const loneliness = NEED_WEIGHT[level(needs.affection)];
  const old = stage === 'stage.old' || elderSigns;

  return {
    sit: old ? 5 : 3,
    wander: energy === 'good' ? (emotion === 'emotion.happy' ? 4 : 2) * (old ? 0.5 : 1) : 0.5,
    sleep: { good: 0, low: 3, bad: 8 }[energy] + (old ? 1 : 0),
    goToBowl: hunger,
    beg: energy === 'bad' ? 0 : Math.max(boredom, loneliness),
    circle: energy === 'bad' ? 0 : boredom / 2 + (emotion === 'emotion.sad' ? 1 : 0),
  };
}

export function chooseBehaviour(description: AnimalDescription, random: Random): Behaviour {
  const entries = Object.entries(behaviourWeights(description)) as [Behaviour, number][];
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = random() * total;
  for (const [behaviour, weight] of entries) {
    roll -= weight;
    if (roll < 0) return behaviour;
  }
  return 'sit';
}
