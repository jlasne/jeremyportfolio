/* asset smoke test; replaced by the real scene */
(() => {
  const R = Reel;
  R.preload({ cm: '/vid/assets/creatormatch.svg', shop: '/vid/assets/wlnsshop.svg', soon: '/vid/assets/soon.svg', brain: '/vid/assets/brain.svg',
    fox: '/vid/assets/kaught-512.png', idy: '/vid/assets/idareyou-192.png', me: '/vid/assets/avatar.webp', ridge: '/vid/assets/ridge.jpg' });
  R.scene({ id: 's1', name: 'test', start: 0, end: 15, draw(ctx, t) {
    R.drawCover(ctx, 'ridge', 0, 0, 1920, 1080);
    const keys = ['cm', 'shop', 'soon', 'brain', 'fox', 'idy'];
    keys.forEach((k, i) => R.drawIcon(ctx, k, 220 + i * 300, 300, 240 + 20 * Math.sin(t * 3 + i)));
    keys.forEach((k, i) => R.drawIcon(ctx, k, 360 + i * 240, 760, 480 * (i === 4 ? 1 : .5)));
    R.drawIcon(ctx, 'me', 1700, 900, 200, { radius: .5 });
    R.motionBlur(ctx, t, (c, tt) => { c.fillStyle = R.C.acid; c.beginPath(); c.arc(200 + (tt * 900) % 1500, 540, 40, 0, R.TAU); c.fill(); }, { samples: 10, subs: 2, shutter: R.shutterFor(900, 10, 14) });
  } });
})();
