import { BALANCE } from './balance.ts';
import { isLove, type PairState } from './bonds.ts';

/** Phrases prédéfinies échangées avec les invitations (pas de texte libre entre joueurs, GDD §12). */
export const PHRASES = ['hello', 'play', 'friends', 'cute', 'thanks'] as const;
export type Phrase = (typeof PHRASES)[number];

/** Ce que l'invité a fait pendant la scène : caresser l'un des deux animaux, ou lancer la balle. */
export interface MeetingInteraction {
  kind: 'pet' | 'ball';
  /** Animal concerné (pour une caresse) : celui de l'invitant ou celui de l'invité. */
  animal?: 'inviter' | 'invitee';
  /** Moment dans la scène, en millisecondes, pour rejouer le souvenir. */
  at: number;
}

/** Rapprochement apporté par une rencontre, selon le nombre d'interactions (plafonné). */
export function meetingBoost(interactionCount: number): number {
  const { baseBoost, perInteraction, maxInteractions } = BALANCE.meetings;
  return baseBoost + perInteraction * Math.min(Math.max(0, interactionCount), maxInteractions);
}

/**
 * Applique une rencontre à la jauge de la paire, en respectant la parenté et l'exclusivité :
 * si l'un des deux aime déjà un autre animal, la paire reste juste sous le seuil.
 */
export function applyMeeting(
  pair: PairState,
  boost: number,
  context: { allowed: boolean; lovedElsewhere: boolean },
  at: number,
): PairState {
  const { loveThreshold } = BALANCE.bonds;
  const boosted = Math.min(100, pair.interaction + boost);
  const mayLove = isLove(pair) || (context.allowed && !context.lovedElsewhere);
  const interaction = mayLove ? boosted : Math.min(boosted, Math.max(loveThreshold - 1, pair.interaction));
  return { ...pair, interaction, at };
}
