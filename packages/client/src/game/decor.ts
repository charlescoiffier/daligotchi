import { seededRandom } from '@daligotchi/core';
import type Phaser from 'phaser';
import { HABITAT_HEIGHT, HABITAT_WIDTH, HORIZON_Y } from './layout.ts';

/** Sol : fond blanc, trame de points gris clair avec quelques imperfections. */
export function drawGround(scene: Phaser.Scene) {
  const random = seededRandom(19);
  const g = scene.add.graphics().setDepth(-10);
  g.fillStyle(0xffffff).fillRect(0, 0, HABITAT_WIDTH, HABITAT_HEIGHT);

  // Ligne d'horizon, avec quelques trous.
  g.fillStyle(0xd2d2d2);
  for (let x = 0; x < HABITAT_WIDTH; x++) {
    if (random() > 0.08) g.fillRect(x, HORIZON_Y, 1, 1);
  }

  // Trame : un point tous les 6 pixels, une rangée sur deux décalée, de plus en plus dense vers le bas.
  for (let y = HORIZON_Y + 5, row = 0; y < HABITAT_HEIGHT; y += 6, row++) {
    for (let x = (row % 2) * 3 + 1; x < HABITAT_WIDTH; x += 6) {
      const roll = random();
      if (roll < 0.12) continue; // point manquant
      g.fillStyle(roll > 0.93 ? 0xc4c4c4 : 0xe0e0e0);
      g.fillRect(x, y, roll > 0.96 ? 2 : 1, 1); // parfois un petit trait
    }
  }
}

/** Deux nuages qui traversent lentement le ciel, puis reviennent de l'autre côté. */
export function startClouds(scene: Phaser.Scene) {
  const clouds = [
    { key: 'cloudBig', y: 22, duration: 70000, start: 0.3 },
    { key: 'cloudSmall', y: 48, duration: 95000, start: 0.75 },
  ];
  for (const cloud of clouds) {
    const image = scene.add.image(0, cloud.y, cloud.key).setDepth(-8);
    const from = -image.width;
    const to = HABITAT_WIDTH + image.width;
    image.x = Math.round(from + (to - from) * cloud.start);
    const drift = (startX: number) =>
      scene.tweens.add({
        targets: image,
        x: to,
        duration: cloud.duration * ((to - startX) / (to - from)),
        onUpdate: () => image.setX(Math.round(image.x)),
        onComplete: () => {
          image.x = from;
          drift(from);
        },
      });
    drift(image.x);
  }
}
