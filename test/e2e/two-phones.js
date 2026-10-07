// Two phones play a full game: host + guest, plus a CPU. Mode: online (lobby code) or nearby (QR codes, pasted).
// Usage: node test/e2e/two-phones.js [online|nearby] [relay] [map]
const L = require('./lib');
(async () => {
  const mode = process.argv[2] || 'online', relay = process.argv.includes('relay');
  const map = process.argv.find((a) => ['europe', 'usa', 'nordic', 'india', 'switzerland'].includes(a)) || 'europe';
  const params = {};
  if (process.env.BROKER) params.broker = process.env.BROKER;
  if (relay) params.relay = '1';
  const b = await L.launch();
  const host = await L.phone(b, 'Pixel 7', params);
  const guest = await L.phone(b, 'iPhone 13', params);
  if (mode === 'online') {
    const code = await L.hostOnline(host, 'Anna');
    L.log('lobby', code);
    await L.joinOnline(guest, code, 'Ben');
  } else {
    await L.hostNearby(host, 'Anna');
    await L.pairNearby(host, guest, 'Ben');
    await guest.waitForSelector('.lobby-seats .lobby-seat', { timeout: 20000 });
  }
  if (map !== 'europe') { await host.click('[data-act=maps]'); await host.click(`[data-act=pick-map][data-v=${map}]`); }
  await host.click('[data-act=n][data-v="3"]');
  await host.click('[data-act=seat-kind-2][data-v=c]');
  await host.waitForFunction(() => document.querySelector('#seat-dev-1')?.value, null, { timeout: 10000 });
  await host.click('[data-act=deal]');
  await guest.waitForSelector('#board svg', { timeout: 20000 });
  L.log('game started on both phones');
  let leaks = 0;
  const t0 = Date.now();
  const watch = setInterval(async () => { try { if (!(await L.guestSeesOnly(guest))) leaks++; } catch (e) { /* page busy */ } }, 700);
  const ok = await L.playOut([host, guest]);
  clearInterval(watch);
  await host.screenshot({ path: `${L.OUT}/two-${mode}-host.png` });
  await guest.screenshot({ path: `${L.OUT}/two-${mode}-guest.png` });
  const same = await Promise.all([host, guest].map((p) => p.evaluate(() => JSON.stringify(window.__emitrain.S.session.G.final.rows.map((r) => r.total)))));
  L.log(mode, relay ? 'relay' : '', ok ? 'finished' : 'DID NOT FINISH', `${((Date.now() - t0) / 1000).toFixed(0)}s`, 'scores', same[0], same[1] === same[0] ? '(same on both)' : 'MISMATCH ' + same[1], 'hidden-info leaks', leaks);
  const errs = host.errs.concat(guest.errs);
  if (errs.length) L.log('errors:', errs.slice(0, 6));
  await b.close();
  process.exit(ok && same[0] === same[1] && !leaks && !errs.length ? 0 : 1);
})();
