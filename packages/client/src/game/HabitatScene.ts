import Phaser from 'phaser';

/** Taille logique de l'habitat, en pixels du jeu (portrait). */
export const HABITAT_WIDTH = 180;
export const HABITAT_HEIGHT = 320;

const GROUND_Y = 250;

/** Habitat de démonstration : trois renards assis et un renard qui se promène. */
export class HabitatScene extends Phaser.Scene {
  constructor() {
    super('habitat');
  }

  preload() {
    this.load.image('renard_jeune', 'sprites/renard_jeune.png');
    this.load.image('renard_adulte', 'sprites/renard_adulte.png');
    this.load.image('renard_vieux', 'sprites/renard_vieux.png');
    this.load.spritesheet('renard_adulte_marche', 'sprites/renard_adulte_marche.png', {
      frameWidth: 27,
      frameHeight: 17,
    });
  }

  create() {
    this.drawGround();

    this.add.image(40, GROUND_Y, 'renard_jeune').setOrigin(0.5, 1);
    this.add.image(90, GROUND_Y, 'renard_adulte').setOrigin(0.5, 1);
    this.add.image(140, GROUND_Y, 'renard_vieux').setOrigin(0.5, 1);

    this.anims.create({
      key: 'renard_marche',
      frames: this.anims.generateFrameNumbers('renard_adulte_marche', { start: 0, end: 7 }),
      frameRate: 8,
      repeat: -1,
    });

    const walker = this.add.sprite(20, GROUND_Y + 40, 'renard_adulte_marche').setOrigin(0.5, 1);
    walker.play('renard_marche');

    // Aller-retour : la planche regarde vers la droite, on la retourne au retour.
    this.tweens.add({
      targets: walker,
      x: HABITAT_WIDTH - 20,
      duration: 6000,
      yoyo: true,
      repeat: -1,
      onYoyo: () => walker.setFlipX(true),
      onRepeat: () => walker.setFlipX(false),
    });
  }

  private drawGround() {
    const g = this.add.graphics();
    g.fillStyle(0x3b3157).fillRect(0, 0, HABITAT_WIDTH, HABITAT_HEIGHT);
    g.fillStyle(0x7fb069).fillRect(0, GROUND_Y - 30, HABITAT_WIDTH, HABITAT_HEIGHT - GROUND_Y + 30);
    g.fillStyle(0x6a9a57);
    for (let x = 4; x < HABITAT_WIDTH; x += 12) {
      g.fillRect(x, GROUND_Y - 30 + ((x * 7) % 60), 2, 1);
    }
  }
}
