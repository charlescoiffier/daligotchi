/**
 * Pont entre l'habitat (Phaser) et les menus (Preact) : chacun publie ou écoute
 * des événements sans dépendre de l'autre.
 */
interface BridgeEvents {
  'animal-selected': { id: string };
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
