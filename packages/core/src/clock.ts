/** Durées en millisecondes. */
export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;
export const WEEK = 7 * DAY;

/**
 * Temps du monde écoulé entre deux instants réels (en ms), selon la vitesse du monde.
 * Vitesse 1 en production ; plus rapide en test pour parcourir un cycle de vie en quelques jours.
 */
export function worldElapsed(fromMs: number, toMs: number, worldSpeed: number): number {
  return Math.max(0, toMs - fromMs) * worldSpeed;
}

/**
 * Horloge du monde : à l'instant réel `anchorRealMs`, le monde en était à `anchorWorldMs`,
 * et il avance depuis à la vitesse `speed`. Le serveur la conserve en base.
 */
export interface WorldClock {
  readonly anchorRealMs: number;
  readonly anchorWorldMs: number;
  readonly speed: number;
}

export function worldTimeAt(clock: WorldClock, realMs: number): number {
  return clock.anchorWorldMs + worldElapsed(clock.anchorRealMs, realMs, clock.speed);
}

/** Change la vitesse sans faire sauter le temps du monde. */
export function reanchorWorldClock(clock: WorldClock, realMs: number, speed: number): WorldClock {
  return { anchorRealMs: realMs, anchorWorldMs: worldTimeAt(clock, realMs), speed };
}
