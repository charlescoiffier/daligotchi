import { describe, expect, it } from 'vitest';
import { DAY, HOUR, reanchorWorldClock, worldElapsed, worldTimeAt } from '../src/clock.ts';

describe('worldTimeAt', () => {
  const clock = { anchorRealMs: 1_000_000, anchorWorldMs: 5 * DAY, speed: 24 };

  it('part de l’ancre et avance selon la vitesse', () => {
    expect(worldTimeAt(clock, 1_000_000)).toBe(5 * DAY);
    expect(worldTimeAt(clock, 1_000_000 + HOUR)).toBe(6 * DAY);
  });

  it('changer de vitesse ne fait pas sauter le temps du monde', () => {
    const later = 1_000_000 + 2 * HOUR;
    const slower = reanchorWorldClock(clock, later, 1);
    expect(worldTimeAt(slower, later)).toBe(worldTimeAt(clock, later));
    expect(worldTimeAt(slower, later + HOUR)).toBe(7 * DAY + HOUR);
  });
});

describe('worldElapsed', () => {
  it('à vitesse 1, le temps du monde suit le temps réel', () => {
    expect(worldElapsed(0, 3 * HOUR, 1)).toBe(3 * HOUR);
  });

  it('à vitesse 24, une heure réelle vaut une journée de jeu', () => {
    expect(worldElapsed(0, HOUR, 24)).toBe(DAY);
  });

  it('ne revient jamais en arrière', () => {
    expect(worldElapsed(10 * HOUR, 5 * HOUR, 1)).toBe(0);
  });
});
