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
