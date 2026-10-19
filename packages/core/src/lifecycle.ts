import { BALANCE } from './balance.ts';

export type Stage = 'young' | 'adult' | 'old';

const { youngDuration, adultDuration, oldDuration, elderSignsDuration } = BALANCE.lifeStages;

/**
 * Durée de vie après éclosion. Le facteur de longévité (hérité plus tard) n'allonge
 * ou ne raccourcit que la vieillesse : jeunesse et âge adulte restent fixes.
 */
export function lifespanOf(longevityFactor = 1): number {
  const total = (youngDuration + adultDuration + oldDuration) * longevityFactor;
  return Math.max(total, youngDuration + adultDuration + elderSignsDuration);
}

export function stageOf(ageMs: number): Stage {
  if (ageMs < youngDuration) return 'young';
  if (ageMs < youngDuration + adultDuration) return 'adult';
  return 'old';
}

/** Signes de grand âge : les derniers jours avant la fin de vie. */
export function hasElderSigns(ageMs: number, lifespanMs: number): boolean {
  return ageMs >= lifespanMs - elderSignsDuration;
}

/**
 * Fin de vie atteinte. Le décès lui-même n'est décidé que par le serveur,
 * pendant une session d'un responsable (GDD §4).
 */
export function isLifeOver(ageMs: number, lifespanMs: number): boolean {
  return ageMs >= lifespanMs;
}

/**
 * Vieillissement entre deux instants du monde (ms), sachant la dernière visite d'un responsable.
 * Au-delà du seuil d'absence, l'âge avance moins vite (GDD §4).
 */
export function agingDuring(fromMs: number, toMs: number, lastVisitAtMs: number): number {
  if (toMs <= fromMs) return 0;
  const { slowAgingAfter, slowAgingFactor } = BALANCE.absence;
  const slowFrom = lastVisitAtMs + slowAgingAfter;
  const normal = Math.max(0, Math.min(toMs, slowFrom) - fromMs);
  const slow = Math.max(0, toMs - Math.max(fromMs, slowFrom));
  return normal + slow * slowAgingFactor;
}
