/**
 * Pont entre l'habitat (Phaser) et les menus (Preact) : chacun publie ou écoute
 * des événements sans dépendre de l'autre.
 */
import type { CareAction } from '@daligotchi/core';

interface BridgeEvents {
  /** Un animal a été touché dans l'habitat. */
  'animal-selected': { id: string };
  /** La fiche a été fermée : l'habitat retire le marqueur. */
  'animal-deselected': Record<string, never>;
  /** Un soin a été accepté par le serveur : l'habitat joue l'effet correspondant. */
  'care-performed': { action: CareAction; animalId?: string };
}

const target = new EventTarget();

export const bridge = {
  emit<K extends keyof BridgeEvents>(type: K, detail: BridgeEvents[K]) {
    target.dispatchEvent(new CustomEvent(type, { detail }));
  },
  on<K extends keyof BridgeEvents>(type: K, listener: (detail: BridgeEvents[K]) => void) {
    const handler = (event: Event) => listener((event as CustomEvent<BridgeEvents[K]>).detail);
    target.addEventListener(type, handler);
    return () => target.removeEventListener(type, handler);
  },
};
