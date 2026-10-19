import Phaser from 'phaser';
import { HABITAT_HEIGHT, HABITAT_WIDTH, HabitatScene } from './HabitatScene.ts';

/** Plus grand agrandissement entier qui tient dans la fenêtre : les pixels restent nets. */
export function integerZoom(viewportWidth: number, viewportHeight: number): number {
  return Math.max(
    1,
    Math.floor(Math.min(viewportWidth / HABITAT_WIDTH, viewportHeight / HABITAT_HEIGHT)),
  );
}

export function createGame(parent: HTMLElement): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: HABITAT_WIDTH,
    height: HABITAT_HEIGHT,
    pixelArt: true,
    backgroundColor: '#2b2340',
    scale: {
      mode: Phaser.Scale.NONE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      zoom: integerZoom(window.innerWidth, window.innerHeight),
    },
    scene: [HabitatScene],
  });

  window.addEventListener('resize', () => {
    game.scale.setZoom(integerZoom(window.innerWidth, window.innerHeight));
  });

  return game;
}
