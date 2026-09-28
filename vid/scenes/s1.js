/* engine smoke test; replaced by the real scene */
Reel.scene({
  id: 's1', name: 'test', start: 0, end: 15,
  draw(ctx, t, lt, R) {
    const p = R.ease.outBack(R.prog(t % R.BAR, 0, R.BEAT));
    ctx.fillStyle = R.C.blue;
    R.motionBlur(ctx, t, (c, tt) => { c.fillStyle = R.C.blue; c.beginPath(); c.arc(200 + (tt * 400) % 1500, 540, 80, 0, R.TAU); c.fill(); });
    R.font(ctx, 200 * (0.5 + 0.5 * p), 'display', 900);
    ctx.fillStyle = R.C.ice; ctx.textBaseline = 'middle';
    R.text(ctx, 'MOTION', 960, 300, { align: 'center', tracking: 10 });
    R.font(ctx, 90, 'serif', 400, 'italic'); R.text(ctx, 'reel', 960, 800, { align: 'center' });
    R.font(ctx, 40, 'mono', 500); R.text(ctx, t.toFixed(3), 100, 1000);
    R.impact(t, 3.75); R.flash(t, 3.75); R.fx.chroma = 6;
  }
});
