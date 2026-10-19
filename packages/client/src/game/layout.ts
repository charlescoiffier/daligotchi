/**
 * Géométrie de l'habitat, en pixels du jeu. Plus la taille est petite, plus tout est
 * agrandi à l'écran : 120 × 180 donne ×3 sur un téléphone courant.
 */
export const HABITAT_WIDTH = 120;
export const HABITAT_HEIGHT = 180;

/** Limite entre le ciel et le sol. */
export const HORIZON_Y = 100;

/** Zone où les animaux peuvent marcher (coordonnées des pattes). */
export const WALK_AREA = { minX: 12, maxX: 108, minY: 118, maxY: 174 } as const;

/** Six places : deux rangées de trois. C'est là que chaque animal revient se poser. */
export const SLOT_POSITIONS = [
  [24, 132],
  [60, 132],
  [96, 132],
  [24, 166],
  [60, 166],
  [96, 166],
] as const;

/** Gamelle de croquettes et bol d'eau, près de l'horizon. */
export const FOOD_BOWL = { x: 92, y: 112 } as const;
export const WATER_BOWL = { x: 105, y: 112 } as const;

/** Nid des œufs pondus, à gauche près de l'horizon (visible seulement s'il contient des œufs). */
export const NEST = { x: 14, y: 112 } as const;

export function clampToWalkArea(x: number, y: number): [number, number] {
  return [
    Math.min(WALK_AREA.maxX, Math.max(WALK_AREA.minX, x)),
    Math.min(WALK_AREA.maxY, Math.max(WALK_AREA.minY, y)),
  ];
}
