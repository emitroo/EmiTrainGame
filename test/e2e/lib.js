// Shared helpers for the browser tests. Needs Playwright (local or global) and the app served at BASE.
const { chromium, devices } = (() => {
  try { return require('playwright'); } catch (e) { return require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright'); }
})();

const BASE = process.env.BASE || 'http://localhost:8765/';
const OUT = process.env.OUT || require('os').tmpdir();
const log = (...a) => console.log(...a);

function url(params) {
  const q = new URLSearchParams(params || {}).toString();
  return BASE + (q ? (BASE.includes('?') ? '&' : '?') + q : '');
}

async function launch(args) {
  const opts = { args: args || [] };
  if (process.env.HTTPS_PROXY && /^https:/.test(BASE)) opts.proxy = { server: process.env.HTTPS_PROXY };
  return chromium.launch(opts);
}

/** A fresh phone with empty storage, CPU turns sped up. */
async function phone(browser, model, params, extra) {
  const ctx = await browser.newContext(Object.assign({ ...devices[model] }, extra || {}));
  const p = await ctx.newPage();
  p.errs = [];
  p.on('pageerror', (e) => p.errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') p.errs.push(m.text()); });
  await p.goto(url(params));
  await p.evaluate(() => localStorage.clear());
  await p.goto(url(params));
  await p.evaluate(() => { window.__emitrain.ui.testFast = true; });
  return p;
}

const devicesOnline = (host) => host.evaluate(() => Object.values(window.__emitrain.net.devices).filter((d) => d.online).length);

async function hostNearby(host, name) {
  await host.click('[data-act=host-nearby]');
  await host.fill('#seat-name-0', name); await host.locator('#seat-name-0').blur();
}

/** Nearby pairing with the text codes (headless browsers have no camera). */
async function pairNearby(host, guest, guestName) {
  const before = await devicesOnline(host);
  await host.evaluate(() => window.__emitrain.hostPairQR());
  await host.waitForFunction(() => document.querySelector('#pq-mycode')?.value.startsWith('T1.'), null, { timeout: 15000 });
  const offer = await host.$eval('#pq-mycode', (e) => e.value);
  await guest.evaluate(() => window.__emitrain.openNearbyJoin());
  if (guestName) await guest.fill('#pj-name', guestName);
  await guest.evaluate(() => { document.querySelector('#pair-layer details').open = true; });
  await guest.fill('#pj-paste', offer);
  await guest.click('[data-act=join-paste]');
  await guest.waitForFunction(() => document.querySelector('#pj-mycode')?.value.startsWith('T1.'), null, { timeout: 15000 });
  const answer = await guest.$eval('#pj-mycode', (e) => e.value);
  await host.evaluate(() => { document.querySelector('#pair-layer details').open = true; });
  await host.fill('#pq-paste', answer);
  await host.click('[data-act=pair-paste]');
  await host.waitForFunction((n) => Object.values(window.__emitrain.net.devices).filter((d) => d.online).length > n, before, { timeout: 30000 });
  return { offer, answer };
}

async function hostOnline(host, name) {
  await host.click('[data-act=host-online]');
  await host.fill('#seat-name-0', name); await host.locator('#seat-name-0').blur();
  await host.waitForSelector('#room-code', { timeout: 20000 });
  return host.$eval('#room-code', (e) => e.textContent.trim());
}

async function joinOnline(guest, code, name) {
  await guest.click('[data-act=join-online]');
  await guest.fill('#my-name', name);
  await guest.fill('#pj-room', code);
  await guest.click('[data-act=join-room]');
  await guest.waitForSelector('.lobby-seats .lobby-seat', { timeout: 40000 });
}

/** One step of play through the UI on phone p, if it has something to do. The CPU logic picks the move;
 *  the test then performs it by tapping the real buttons (routes and cities through the board's tap handlers). */
async function uiStep(p, level) {
  const plan = await p.evaluate((lvl) => {
    const T = window.__emitrain, S = T.S, ui = T.ui;
    if (document.querySelector('.overlay.handoff')) return { kind: 'reveal' };
    if (!S.session || !S.session.G || document.getElementById('game').hidden) return null;
    const g = S.session.G, v = ui.handoff ? -1 : ui.viewer;
    if (g.phase === 'over') return { kind: 'over' };
    if (v < 0 || ui.sent) return null;
    const mine = T.E.actors(g).includes(v);
    if (!mine) return null;
    if (g.offer[v] && document.querySelector('.sheet-offer')) return { kind: 'keep', ids: T.AI.choose(g, v, lvl).ids, sel: Array.from(ui.keep.ids) };
    if (g.offer[v]) return null;
    const a = T.AI.choose(g, v, lvl);
    return { kind: 'act', a };
  }, level || 'normal');
  if (!plan) return false;
  if (plan.kind === 'over') return 'over';
  if (plan.kind === 'reveal') { await p.waitForTimeout(470); await p.click('.overlay.handoff button'); return true; }
  if (plan.kind === 'keep') {
    for (const id of plan.ids) if (!plan.sel.includes(id)) await p.click(`[data-act=keep-toggle][data-v="${id}"] .tick`);
    for (const id of plan.sel) if (!plan.ids.includes(id)) await p.click(`[data-act=keep-toggle][data-v="${id}"] .tick`);
    await p.click('[data-act=keep-ok]');
    return true;
  }
  const a = plan.a;
  if (a.k === 'card') await p.click(`#tray [data-act=take][data-v="${a.slot}"]`);
  else if (a.k === 'tickets') await p.click('#tray [data-act=draw-tickets]');
  else if (a.k === 'claim') {
    await p.evaluate((r) => window.__emitrain.ui.board.handlers.route(r), a.r);
    await p.click(`.pay[data-act=claim][data-cards="${a.cards.join(',')}"]`);
  } else if (a.k === 'station') {
    await p.evaluate((c) => window.__emitrain.ui.board.handlers.city(c), a.city);
    await p.click(`.pay[data-act=station][data-cards="${a.cards.join(',')}"]`);
  } else if (a.k === 'tunnel') {
    if (a.pay) await p.click(`.pay[data-act=tunnel-pay][data-cards="${a.cards.join(',')}"]`); else await p.click('[data-act=tunnel-no]');
  } else if (a.k === 'pass') {
    await p.evaluate(() => { const T = window.__emitrain; T.E.apply(T.S.session.G, T.ui.viewer, { k: 'pass' }); });
  }
  return true;
}

/** Play every phone through the UI until all show the final scores. */
async function playOut(phones, maxSteps) {
  for (let i = 0; i < (maxSteps || 6000); i++) {
    const res = await Promise.all(phones.map((p) => uiStep(p).catch((e) => { p.errs.push('step: ' + e.message.split('\n')[0]); return false; })));
    const over = await Promise.all(phones.map((p) => p.evaluate(() => !!document.querySelector('.sheet-summary'))));
    if (over.every(Boolean)) return true;
    if (!res.some((r) => r === true)) await phones[0].waitForTimeout(60);
  }
  return false;
}

/** True if a guest phone ever holds other players' cards or tickets, or the deck order. */
async function guestSeesOnly(guest) {
  return guest.evaluate(() => {
    const s = window.__emitrain.S.session;
    if (!s || !s.G || s.G.phase === 'over') return true;
    const g = s.G;
    return g.hands.every((h, p) => s.cfg.seats[p].remote === 'me' || h === null)
      && g.tickets.every((tk, p) => s.cfg.seats[p].remote === 'me' || tk.every((x) => x === -1))
      && g.deck.every((c) => c === -1) && g.tdeck.every((c) => c === -1);
  });
}

const winner = (p) => p.evaluate(() => document.querySelector('.result-banner h2')?.textContent || null);

module.exports = { chromium, devices, BASE, OUT, log, url, launch, phone, devicesOnline, hostNearby, pairNearby, hostOnline, joinOnline, uiStep, playOut, guestSeesOnly, winner };
