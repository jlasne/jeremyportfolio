/**
 * Gigawatt — the pixel art.
 *
 * Every building is twelve by twelve, drawn by hand, one character per pixel.
 * Keep them chunky: if a shape needs more than a couple of pixels to read, it
 * is the wrong shape. The palette is warm and saturated on purpose — this is a
 * toy island, not a control room.
 */

export const PALETTE = {
  o: '#241f2e',   // outline
  s: '#0000003d', // ground shadow
  1: '#5a6472',   // metal, dark
  2: '#8a95a5',   // metal, mid
  3: '#c3ccd8',   // metal, light
  4: '#eef2f7',   // near-white
  w: '#8a5a34',   // timber, dark
  W: '#c08148',   // timber, light
  y: '#ffd24a',   // a light that is on
  c: '#4fe0d0',   // a rack light
  r: '#e8503f',
};

/** Lights blink; everything else holds still. */
export const BLINK = new Set(['y', 'c']);

const P = (rows) => rows;

export const PLANT_SPRITES = [
  P([ // Diesel shed
    '............',
    '............',
    '.......oo...',
    '......o11o..',
    '..oooooooo..',
    '..oWWWWWWo..',
    '..owwwwwwo..',
    '..owwyywwo..',
    '..owwwwwwo..',
    '..oooooooo..',
    '...ssssss...',
    '............',
  ]),
  P([ // Gas turbine
    '............',
    '.....oo.....',
    '....o22o....',
    '....o22o....',
    '.oooooooooo.',
    '.o33333333o.',
    '.o21111112o.',
    '.o2y1111y2o.',
    '.o21111112o.',
    '.o22222222o.',
    '.oooooooooo.',
    '..ssssssss..',
  ]),
  P([ // Coal stack
    '..oo....oo..',
    '..o2o..o2o..',
    '..o2o..o2o..',
    '..o2o..o2o..',
    'oooooooooooo',
    'o3322223322o',
    'o2111111112o',
    'o2y111111y2o',
    'o2111111112o',
    'o2222222222o',
    'oooooooooooo',
    '.ssssssssss.',
  ]),
  P([ // Nuclear pile
    '...oooooo...',
    '...o4444o...',
    '...o3333o...',
    '....o33o....',
    '....o33o....',
    '...o3333o...',
    '..oo3333oo..',
    '.oo211112oo.',
    'oo22222222oo',
    'o21y1111y12o',
    'oooooooooooo',
    '.ssssssssss.',
  ]),
  P([ // Fusion ring
    '............',
    '...oooooo...',
    '..occcccco..',
    '.oc4oooo4co.',
    '.oco....oco.',
    '.oc4oooo4co.',
    '..occcccco..',
    '..oo2222oo..',
    '.o22222222o.',
    '.o2y1111y2o.',
    '.oooooooooo.',
    '..ssssssss..',
  ]),
];

export const DC_SPRITES = [
  P([ // Server closet
    '............',
    '............',
    '............',
    '...oooooo...',
    '...o1111o...',
    '...o2c22o...',
    '...o1111o...',
    '...o22c2o...',
    '...oooooo...',
    '....ssss....',
    '............',
    '............',
  ]),
  P([ // Rack row
    '............',
    '............',
    '..oooooooo..',
    '..o111111o..',
    '..o2c22c2o..',
    '..o111111o..',
    '..o22c22co..',
    '..o111111o..',
    '..oooooooo..',
    '...ssssss...',
    '............',
    '............',
  ]),
  P([ // Cold aisle
    '............',
    '..o3o..o3o..',
    '.oooooooooo.',
    '.o11111111o.',
    '.o2c222c22o.',
    '.o11111111o.',
    '.o22c222c2o.',
    '.o11111111o.',
    '.o2c2222c2o.',
    '.oooooooooo.',
    '..ssssssss..',
    '............',
  ]),
  P([ // Hyperscale
    '.o3o.o3o.o3o',
    'oooooooooooo',
    'o1111111111o',
    'o2c222c222co',
    'o1111111111o',
    'o22c222c222o',
    'o1111111111o',
    'o2c2222c22co',
    'o1111111111o',
    'o22c22c222co',
    'oooooooooooo',
    '.ssssssssss.',
  ]),
  P([ // Compute mesa
    'o3oo3oo3oo3o',
    'oooooooooooo',
    'o4444444444o',
    'oooooooooooo',
    'oc2c2c2c2c2o',
    'o1111111111o',
    'o2c2c2c2c2co',
    'o1111111111o',
    'oc2c2c2c2c2o',
    'o1111111111o',
    'oooooooooooo',
    'ssssssssssss',
  ]),
];

export const SPRITE_SIZE = 12;
