import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/balance.ts';
import { advanceBonds, apartInteraction, isLove, type PairState } from '../src/bonds.ts';
import { DAY, HOUR } from '../src/clock.ts';
import fr from '../src/i18n/fr.json';
import { applyMeeting, meetingBoost, PHRASES } from '../src/meetings.ts';

const { loveThreshold } = BALANCE.bonds;
const pair = (interaction: number, at = 0): PairState => ({ a: 'a', b: 'b', interaction, at });
const free = { allowed: true, lovedElsewhere: false };

describe('meetingBoost', () => {
  it('une rencontre très réussie peut franchir le seuil d’amour d’un coup', () => {
    expect(meetingBoost(0)).toBe(20);
    expect(meetingBoost(10)).toBe(80);
    expect(meetingBoost(50)).toBe(80); // plafonné
    expect(isLove(applyMeeting(pair(0), meetingBoost(10), free, 0))).toBe(true);
  });
});

describe('applyMeeting', () => {
  it('reste sous le seuil si l’un des deux aime déjà ailleurs, ou en cas de parenté', () => {
    expect(applyMeeting(pair(60), 40, { allowed: true, lovedElsewhere: true }, 0).interaction).toBe(loveThreshold - 1);
    expect(applyMeeting(pair(60), 40, { allowed: false, lovedElsewhere: false }, 0).interaction).toBe(loveThreshold - 1);
  });

  it('un amour existant n’est jamais réduit', () => {
    expect(applyMeeting(pair(90), 20, { allowed: true, lovedElsewhere: true }, 0).interaction).toBe(100);
  });
});

describe('amours hors du foyer', () => {
  it('séparés, la jauge s’effrite avec le temps', () => {
    expect(apartInteraction(pair(90), 10 * DAY)).toBeCloseTo(90 - 0.12 * 240, 9);
    expect(apartInteraction(pair(5), 30 * DAY)).toBe(0);
  });

  it('un animal amoureux ailleurs ne tombe pas amoureux dans son foyer', () => {
    const local: PairState = { a: 'a', b: 'c', interaction: 70, at: 0 };
    const [after] = advanceBonds([local], 5 * DAY, () => ({ together: true, allowed: true }), new Set(['a']));
    expect(after!.interaction).toBe(loveThreshold - 1);
    const [free2] = advanceBonds([local], 10 * HOUR, () => ({ together: true, allowed: true }));
    expect(free2!.interaction).toBe(82);
  });
});

describe('PHRASES', () => {
  it('chaque phrase prédéfinie a son texte', () => {
    for (const phrase of PHRASES) expect(fr).toHaveProperty([`phrase.${phrase}`]);
  });
});
