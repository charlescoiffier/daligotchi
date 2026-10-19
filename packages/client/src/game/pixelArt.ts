import type Phaser from 'phaser';

/**
 * Petits dessins du jeu, en caractères : chaque lettre est un pixel de la couleur indiquée
 * dans PALETTE, et « . » est transparent. Pour modifier un dessin, il suffit de changer
 * les lettres (toutes les lignes d'un dessin doivent avoir la même longueur).
 */
export const PALETTE: Record<string, string> = {
  k: '#5a5a5a', // gris foncé (contours)
  g: '#b4b4b4', // gris
  l: '#dadada', // gris clair
  w: '#ffffff', // blanc
  r: '#e0504a', // rouge (balle)
  p: '#ff7f9e', // rose (cœurs)
  c: '#9fd3f2', // bleu clair (bulles)
  b: '#5aa7e0', // bleu (eau)
  f: '#b07a45', // marron (croquettes)
  d: '#9c8c7a', // terre (saletés)
  x: '#1e1e1e', // noir (contours des animaux)
  o: '#ff6a14', // orange renard
  n: '#7a3e12', // brun (intérieur des oreilles)
  v: '#9b6bd1', // violet poulpe
  V: '#6f46a6', // violet foncé
};

export const DRAWINGS = {
  heart: [
    '.pp.pp.',
    'ppppppp',
    'ppppppp',
    '.ppppp.',
    '..ppp..',
    '...p...',
  ],
  ball: [
    '.rrr.',
    'rrwrr',
    'rrrrr',
    'rrrrr',
    '.rrr.',
  ],
  bubble: [
    '.ccc.',
    'c.w.c',
    'c...c',
    'c...c',
    '.ccc.',
  ],
  zzz: [
    'gggg',
    '..g.',
    '.g..',
    'gggg',
  ],
  sparkle: [
    '..g..',
    '..l..',
    'glwlg',
    '..l..',
    '..g..',
  ],
  marker: [
    'kkkkk',
    '.kkk.',
    '..k..',
  ],
  bowlEmpty: [
    '.........',
    'g.......g',
    '.ggggggg.',
    '..ggggg..',
  ],
  bowlFood: [
    '.f.ff.ff.',
    'gfffffffg',
    '.ggggggg.',
    '..ggggg..',
  ],
  bowlWater: [
    '.........',
    'gbbbbbbbg',
    '.ggggggg.',
    '..ggggg..',
  ],
  speck: ['dd'],
  egg: [
    '...kkk...',
    '..kwwwk..',
    '.kwwwwwk.',
    '.kwwlwwk.',
    'kwwwwwwwk',
    'kwwlwwwwk',
    'kwwwwwlwk',
    'kwwwwwwwk',
    '.kwwwwwk.',
    '..kkkkk..',
  ],
  eggCracked: [
    '...kkk...',
    '..kwwwk..',
    '.kwwkwwk.',
    '.kwkwkwk.',
    'kwkwwwkwk',
    'kwwwwwwwk',
    'kwwlwwwwk',
    'kwwwwwlwk',
    '.kwwwwwk.',
    '..kkkkk..',
  ],
  /** Provisoire, à redessiner dans Piskel. */
  poulpe: [
    '.....xxxxxxx.....',
    '...xxvvvvvvvxx...',
    '..xvvvvvvvvvvvx..',
    '.xvvvvvvvvvvvvvx.',
    '.xvvwxvvvvvwxvvx.',
    '.xvvxxvvvvvxxvvx.',
    '.xvvvvvvpvvvvvvx.',
    '..xvvvvvvvvvvvx..',
    '..xvVvvVvVvvVvx..',
    '.xvVxvVxvxVvxVvx.',
    '.xvx.xvxvxvx.xvx.',
    'xvx..xvx.xvx..xvx',
    'xx...xvx.xvx...xx',
    '......x...x......',
  ],
  /** Provisoire, à redessiner dans Piskel : un poulpe avec des oreilles et un museau de renard. */
  poulpard: [
    '..xx.........xx..',
    '..xnx.xxxxx.xnx..',
    '..xnoxoooooxonx..',
    '..xooooooooooox..',
    '.xooooooooooooox.',
    '.xoowxooooowxoox.',
    '.xooxxooooooxxox.',
    '.xoooowwxwwoooox.',
    '..xooowwwwwooox..',
    '..xoVooVoVooVox..',
    '.xoVxoVxoxVoxVox.',
    '.xox.xoxoxox.xox.',
    'xwx..xox.xox..xwx',
    'xx...xwx.xwx...xx',
    '......x...x......',
  ],
  /** Nid avec 1, 2 ou 3 œufs visibles (au-delà, on en montre 3). */
  nest1: [
    '......k......',
    '.....kwk.....',
    '.....kwk.....',
    'n.nnnnnnnnn.n',
    '.nfnfnfnfnfn.',
    '..nnnnnnnnn..',
  ],
  nest2: [
    '....k...k....',
    '...kwk.kwk...',
    '...kwk.kwk...',
    'n.nnnnnnnnn.n',
    '.nfnfnfnfnfn.',
    '..nnnnnnnnn..',
  ],
  nest3: [
    '..k...k...k..',
    '.kwk.kwk.kwk.',
    '.kwk.kwk.kwk.',
    'n.nnnnnnnnn.n',
    '.nfnfnfnfnfn.',
    '..nnnnnnnnn..',
  ],
  groundDirt: [
    '.d.',
    'ddd',
  ],
  cloudBig: [
    '......llll......',
    '...llllllll.lll.',
    '.lllllllllllllll',
    'llllllllllllllll',
    '.gggggggggggggg.',
  ],
  cloudSmall: [
    '...lll....',
    '.lllllll..',
    'llllllllll',
    '.gggggggg.',
  ],
} satisfies Record<string, string[]>;

export type DrawingName = keyof typeof DRAWINGS;

/** Vérifie qu'un dessin est rectangulaire et n'utilise que des couleurs connues. */
export function checkDrawing(rows: readonly string[]): string | undefined {
  if (rows.length === 0) return 'dessin vide';
  const width = rows[0]!.length;
  for (const [index, row] of rows.entries()) {
    if (row.length !== width) return `ligne ${index + 1} : ${row.length} caractères au lieu de ${width}`;
    for (const char of row) {
      if (char !== '.' && !(char in PALETTE)) return `ligne ${index + 1} : couleur « ${char} » inconnue`;
    }
  }
  return undefined;
}

/** Transforme tous les dessins en textures Phaser (une fois, au démarrage de la scène). */
export function registerDrawings(scene: Phaser.Scene) {
  for (const [name, rows] of Object.entries(DRAWINGS)) {
    if (scene.textures.exists(name)) continue;
    const texture = scene.textures.createCanvas(name, rows[0]!.length, rows.length);
    if (!texture) continue;
    const context = texture.getContext();
    rows.forEach((row, y) => {
      [...row].forEach((char, x) => {
        const color = PALETTE[char];
        if (!color) return;
        context.fillStyle = color;
        context.fillRect(x, y, 1, 1);
      });
    });
    texture.refresh();
  }
}
