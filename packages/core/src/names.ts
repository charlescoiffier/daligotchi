import { pick, type Random } from './random.ts';

/** Prénoms proposés à la naissance ; le joueur peut ensuite renommer son animal. */
export const NEWBORN_NAMES = [
  'Pépite',
  'Caramel',
  'Gribouille',
  'Biscotte',
  'Plume',
  'Moustache',
  'Cannelle',
  'Pistache',
  'Grelot',
  'Brioche',
  'Câpre',
  'Filou',
  'Praline',
  'Galette',
  'Bulle',
  'Myrtille',
  'Pompon',
  'Cachou',
] as const;

export function newbornName(random: Random): string {
  return pick(NEWBORN_NAMES, random);
}
