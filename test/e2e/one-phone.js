// One phone: players on this device (pass-and-play) plus CPUs, a full game through the UI.
// Usage: node test/e2e/one-phone.js [map] [humans] [players]
const L = require('./lib');
(async () => {
  const map = process.argv[2] || 'europe', humans = +(process.argv[3] || 1), n = +(process.argv[4] || 3);
  const b = await L.launch();
  // A landscape phone with LANDSCAPE=1 (Pixel 7 turned sideways, browser bars showing).
  const p = await L.phone(b, 'Pixel 7', {}, process.env.LANDSCAPE ? { viewport: { width: 915, height: 360 } } : undefined);
  await p.click('[data-act=go-local]');
  if (map !== 'europe') { await p.click('[data-act=maps]'); await p.click(`[data-act=pick-map][data-v=${map}]`); }
  await p.click(`[data-act=n][data-v="${n}"]`);
  for (let s = 0; s < n; s++) await p.click(`[data-act=seat-kind-${s}][data-v=${s < humans ? 'h' : 'c'}]`);
  await p.click('[data-act=deal]');
  await p.waitForSelector('#board svg');
  const t0 = Date.now();
  const ok = await L.playOut([p]);
  await p.screenshot({ path: `${L.OUT}/one-phone-${map}.png` });
  const res = await p.evaluate(() => { const g = window.__emitrain.S.session.G; return { turns: g.turnNo, totals: g.final && g.final.rows.map((r) => r.total) }; });
  L.log(map, `${humans} human(s) of ${n}`, ok ? 'finished' : 'DID NOT FINISH', JSON.stringify(res), `${((Date.now() - t0) / 1000).toFixed(0)}s`, await L.winner(p));
  if (p.errs.length) L.log('errors:', p.errs.slice(0, 5));
  if (p.tapMiss) L.log('board taps that missed their city:', p.tapMiss);
  await b.close();
  process.exit(ok && !p.errs.length && !p.tapMiss ? 0 : 1);
})();
