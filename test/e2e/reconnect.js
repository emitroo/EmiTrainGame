// Online: the guest's page reloads mid-game; it reopens on the join screen with the code filled in, rejoins its seat,
// and the game plays on to the end. Usage: node test/e2e/reconnect.js
const L = require('./lib');
(async () => {
  const params = process.env.BROKER ? { broker: process.env.BROKER } : {};
  const b = await L.launch();
  const host = await L.phone(b, 'Pixel 7', params);
  const guest = await L.phone(b, 'iPhone 13', params);
  const code = await L.hostOnline(host, 'Anna');
  await L.joinOnline(guest, code, 'Ben');
  await host.click('[data-act=n][data-v="2"]');
  await host.waitForFunction(() => document.querySelector('#seat-dev-1')?.value, null, { timeout: 10000 });
  await host.click('[data-act=deal]');
  await guest.waitForSelector('#board svg', { timeout: 20000 });
  for (let i = 0; i < 40; i++) { await Promise.all([L.uiStep(host), L.uiStep(guest)]); await host.waitForTimeout(50); }
  const before = await host.evaluate(() => window.__emitrain.S.session.G.seq);
  await guest.reload();
  await guest.evaluate(() => { window.__emitrain.ui.testFast = true; });
  const prefilled = await guest.$eval('#pj-room', (e) => e.value);
  await guest.click('[data-act=join-room]');
  await guest.waitForSelector('#board svg', { timeout: 40000 });
  L.log('rejoined with', prefilled, 'at log seq', before);
  const ok = await L.playOut([host, guest]);
  const errs = host.errs.concat(guest.errs);
  L.log(ok ? 'finished after reconnect' : 'DID NOT FINISH', errs.length ? errs.slice(0, 5) : '');
  await b.close();
  process.exit(ok && prefilled === code && !errs.length ? 0 : 1);
})();
