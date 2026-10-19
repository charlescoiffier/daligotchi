import Phaser from 'phaser';
import type { Household } from '../api/client.ts';
import { HABITAT_HEIGHT, HABITAT_WIDTH, HabitatScene, HOUSEHOLD_KEY } from './HabitatScene.ts';
import { MeetingScene, type MeetingSceneData } from './MeetingScene.ts';

/** Plus grand agrandissement entier qui tient dans la fenêtre : les pixels restent nets. */
export function integerZoom(viewportWidth: number, viewportHeight: number): number {
  return Math.max(
    1,
    Math.floor(Math.min(viewportWidth / HABITAT_WIDTH, viewportHeight / HABITAT_HEIGHT)),
  );
}

export interface GameHandle {
  setHousehold(household: Household): void;
  /** Ouvre la scène de rencontre à la place de l'habitat. */
  startMeeting(data: MeetingSceneData): void;
  /** Effets de la scène de rencontre en cours. */
  meetingPet(which: 'inviter' | 'invitee'): void;
  meetingBall(): void;
  /** Referme la scène de rencontre et revient à l'habitat. */
  stopMeeting(): void;
  destroy(): void;
}

export function createGame(parent: HTMLElement): GameHandle {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: HABITAT_WIDTH,
    height: HABITAT_HEIGHT,
    pixelArt: true,
    backgroundColor: '#ffffff',
    // N'écouter que les touchers sur l'habitat : un toucher sur un menu posé par-dessus
    // ne doit pas aussi sélectionner l'animal qui se trouve en dessous.
    input: { windowEvents: false },
    scale: {
      mode: Phaser.Scale.NONE,
      // Le centrage est fait par la page (CSS) : un second centrage par Phaser décalerait l'habitat.
      autoCenter: Phaser.Scale.NO_CENTER,
      zoom: integerZoom(window.innerWidth, window.innerHeight),
    },
    scene: [HabitatScene, MeetingScene],
  });

  // Valeur initiale : chaque mise à jour déclenchera ensuite `changedata-household`.
  game.registry.set(HOUSEHOLD_KEY, undefined);

  const onResize = () => game.scale.setZoom(integerZoom(window.innerWidth, window.innerHeight));
  window.addEventListener('resize', onResize);

  return {
    setHousehold(household) {
      game.registry.set(HOUSEHOLD_KEY, household);
    },
    startMeeting(data) {
      game.scene.sleep('habitat');
      game.scene.start('meeting', data);
    },
    meetingPet(which) {
      (game.scene.getScene('meeting') as MeetingScene).pet(which);
    },
    meetingBall() {
      (game.scene.getScene('meeting') as MeetingScene).ball();
    },
    stopMeeting() {
      game.scene.stop('meeting');
      game.scene.wake('habitat');
    },
    destroy() {
      window.removeEventListener('resize', onResize);
      game.destroy(true);
    },
  };
}
