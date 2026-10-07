/* Emi Train Game rules engine. Pure logic, no DOM. Works in the browser (window.TrainEngine) and in Node (module.exports).
 *
 * Train cards are colour indices 0..7 (see COLORS) and 8 for a locomotive (wild). A hand is an array of 9 counts.
 * Routes have colour -1 (gray: any single colour) or 0..7; tunnels may cost extra cards; ferries need locomotives.
 * The whole game is one JSON-serialisable state object, so it can be saved, sent to other phones and replayed.
 * Randomness comes from a seeded generator stored in the state (G.rs), so games are reproducible in tests.
 */
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const E = factory(isNode ? require('./maps.js') : root.TrainMaps);
  if (isNode) module.exports = E;
  else root.TrainEngine = E;
})(typeof self !== 'undefined' ? self : this, function (MAPS) {
  'use strict';

  const COLORS = ['purple', 'white', 'blue', 'yellow', 'orange', 'black', 'red', 'green'];
  const LOCO = 8;
  const GRAY = -1;
  const ROUTE_POINTS = [0, 1, 2, 4, 7, 10, 15, 18, 21, 27];
  const MANDALA_POINTS = [0, 5, 10, 20, 30, 40];
  const DEFAULT_RULES = {
    trains: 45, stations: 0, stationPoints: 4, players: [2, 5], doubleMin: 4,
    deal: { long: 0, short: 3, keep: 2 }, draw: { n: 3, keep: 1 },
    bonus: ['longest'], bonusPoints: 10, locos: 14, perColor: 12, hand: 4, market: 5, endAt: 2,
  };

  const mapOf = (G) => MAPS.get(typeof G === 'string' ? G : G.map);
  function rulesOf(G) {
    const m = mapOf(G), r = Object.assign({}, DEFAULT_RULES, m.rules || {});
    r.deal = Object.assign({}, DEFAULT_RULES.deal, (m.rules || {}).deal || {});
    r.draw = Object.assign({}, DEFAULT_RULES.draw, (m.rules || {}).draw || {});
    return r;
  }
  const routePoints = (len) => ROUTE_POINTS[len] || len * 3;

  // ---------- randomness (Mulberry32, state kept in G.rs) ----------
  function rnd(G) {
    G.rs = (G.rs + 0x6d2b79f5) >>> 0;
    let t = G.rs;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function shuffle(G, a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd(G) * (i + 1));
      const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  const fail = (code) => { throw new Error(code); };
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const sum = (a) => a.reduce((s, x) => s + x, 0);

  // ---------- setup ----------
  /** New game. opts: { map, n, seed, first } */
  function newGame(opts) {
    const m = mapOf(opts.map);
    if (!m) fail('bad-map');
    const n = opts.n | 0;
    const R0 = Object.assign({}, DEFAULT_RULES, m.rules || {});
    if (n < R0.players[0] || n > R0.players[1]) fail('bad-players');
    const G = {
      v: 1, map: m.id, n, rs: (opts.seed == null ? Math.floor(Math.random() * 2 ** 32) : opts.seed) >>> 0,
      phase: 'setup', turn: 0, turnNo: 0, step: null, seq: 0, log: [],
      deck: [], discard: [], market: [], hands: [],
      tdeck: [], ldeck: [], tickets: [], offer: [], keepMin: [],
      trains: [], stations: [], owner: m.routes.map(() => -1), stationAt: m.cities.map(() => -1),
      lastFrom: -1, endIn: 0, passes: 0, final: null,
    };
    const R = rulesOf(G);
    for (let c = 0; c < 8; c++) for (let k = 0; k < R.perColor; k++) G.deck.push(c);
    for (let k = 0; k < R.locos; k++) G.deck.push(LOCO);
    shuffle(G, G.deck);
    m.tickets.forEach((t, i) => (t[3] ? G.ldeck : G.tdeck).push(i));
    shuffle(G, G.tdeck);
    shuffle(G, G.ldeck);
    G.turn = opts.first != null ? opts.first % n : Math.floor(rnd(G) * n);
    for (let p = 0; p < n; p++) {
      G.hands.push(Array(9).fill(0));
      for (let k = 0; k < R.hand; k++) G.hands[p][G.deck.pop()]++;
      G.tickets.push([]);
      const offer = [];
      for (let k = 0; k < R.deal.long && G.ldeck.length; k++) offer.push(G.ldeck.pop());
      for (let k = 0; k < R.deal.short && G.tdeck.length; k++) offer.push(G.tdeck.pop());
      G.offer.push(offer);
      G.keepMin.push(Math.min(R.deal.keep, offer.length));
      G.trains.push(R.trains);
      G.stations.push(R.stations);
    }
    G.ldeck = []; // long tickets not dealt leave the game
    for (let k = 0; k < R.market; k++) G.market.push(-1);
    refillMarket(G);
    return G;
  }

  function note(G, e) {
    e.s = ++G.seq;
    G.log.push(e);
    if (G.log.length > 40) G.log.splice(0, G.log.length - 40);
    return e;
  }

  // ---------- cards ----------
  function drawFromDeck(G) {
    if (!G.deck.length && G.discard.length) { G.deck = shuffle(G, G.discard); G.discard = []; }
    return G.deck.length ? G.deck.pop() : -1;
  }

  /** Fill empty market slots; three or more face-up locomotives replace the whole row (a few tries at most). */
  function refillMarket(G) {
    for (let tries = 0; tries < 4; tries++) {
      for (let i = 0; i < G.market.length; i++) if (G.market[i] < 0) G.market[i] = drawFromDeck(G);
      if (G.market.filter((c) => c === LOCO).length < 3) return;
      if (G.deck.length + G.discard.length < G.market.length) return;
      if (tries === 3) return;
      for (let i = 0; i < G.market.length; i++) { if (G.market[i] >= 0) G.discard.push(G.market[i]); G.market[i] = -1; }
    }
  }

  const deckLeft = (G) => G.deck.length + G.discard.length;
  const handSize = (G, p) => (G.hands[p] ? sum(G.hands[p]) : (G.handN ? G.handN[p] : 0));

  /** Can the current player take a card now (slot -1 = from the deck)? */
  function canTakeCard(G, slot) {
    if (G.phase !== 'play' || (G.step && !G.step.drew) || G.offer[G.turn]) return false;
    if (slot < 0) return deckLeft(G) > 0;
    const c = G.market[slot];
    if (c == null || c < 0) return false;
    return !(c === LOCO && G.step && G.step.drew);
  }
  function anyCardTakeable(G) {
    if (canTakeCard(G, -1)) return true;
    for (let i = 0; i < G.market.length; i++) if (canTakeCard(G, i)) return true;
    return false;
  }

  // ---------- routes ----------
  /** Why player p cannot claim route r right now, ignoring cards (null if they could). */
  function routeBlock(G, p, r) {
    const m = mapOf(G), rt = m.routes[r], R = rulesOf(G);
    if (!rt) return 'bad-route';
    if (G.owner[r] >= 0) return 'taken';
    if (G.trains[p] < rt.len) return 'trains';
    if (rt.pair >= 0) {
      if (G.owner[rt.pair] === p) return 'double-own';
      if (G.owner[rt.pair] >= 0 && G.n < R.doubleMin) return 'double-closed';
    }
    return null;
  }

  /** Check a payment {c, l}: c = colour of the non-locomotive cards (-1 if none), l = locomotives. */
  function payError(hand, need, routeColor, minLocos, c, l) {
    l = l | 0;
    const n = need - l;
    if (l < 0 || n < 0) return 'bad-pay';
    if (l < minLocos) return 'ferry';
    if (hand[LOCO] < l) return 'cards';
    if (n > 0) {
      if (!(c >= 0 && c < 8)) return 'bad-pay';
      if (routeColor !== GRAY && routeColor !== c) return 'color';
      if (hand[c] < n) return 'cards';
    }
    return null;
  }

  /** The cheapest ways for p to pay for route r: per usable colour the fewest locomotives, plus all-locomotives. */
  function paymentOptions(G, p, r) {
    const m = mapOf(G), rt = m.routes[r], hand = G.hands[p];
    if (!hand || routeBlock(G, p, r)) return [];
    return payOptionsFor(hand, rt.len, rt.color, rt.ferry || 0);
  }
  function payOptionsFor(hand, need, color, minL) {
    const out = [];
    const colors = color === GRAY ? [0, 1, 2, 3, 4, 5, 6, 7] : [color];
    for (const c of colors) {
      const l = Math.max(minL, need - hand[c]);
      if (l < need && !payError(hand, need, color, minL, c, l)) out.push({ c, l });
    }
    if (hand[LOCO] >= need) out.push({ c: -1, l: need });
    return out;
  }

  // ---------- stations ----------
  function stationCost(G, p) { return rulesOf(G).stations - G.stations[p] + 1; }
  function stationBlock(G, p, city) {
    if (!rulesOf(G).stations) return 'no-stations';
    if (G.stations[p] <= 0) return 'no-stations-left';
    if (G.stationAt[city] == null) return 'bad-city';
    if (G.stationAt[city] >= 0) return 'station-taken';
    return null;
  }
  function stationOptions(G, p, city) {
    if (!G.hands[p] || stationBlock(G, p, city)) return [];
    return payOptionsFor(G.hands[p], stationCost(G, p), GRAY, 0);
  }

  // ---------- whose move ----------
  /** Players who must act now. During setup everyone with a ticket offer chooses at once. */
  function actors(G) {
    if (G.phase === 'setup') return G.offer.map((o, p) => (o ? p : -1)).filter((p) => p >= 0);
    if (G.phase === 'play') return [G.turn];
    return [];
  }

  /** Can player p do anything at all on their turn (otherwise they must pass)? */
  function canDoAnything(G, p) {
    if (anyCardTakeable(G)) return true;
    if (G.tdeck.length) return true;
    const m = mapOf(G);
    for (let r = 0; r < m.routes.length; r++) if (paymentOptions(G, p, r).length) return true;
    if (rulesOf(G).stations) for (let c = 0; c < m.cities.length; c++) if (stationOptions(G, p, c).length) return true;
    return false;
  }

  // ---------- actions ----------
  /** Apply action a for player p. Throws Error(code) if it is not allowed. Returns the log entry, if any. */
  function apply(G, p, a) {
    if (!a || typeof a.k !== 'string') fail('bad-action');
    if (G.phase === 'over') fail('over');
    const R = rulesOf(G), m = mapOf(G);
    if (a.k === 'keep') return keepTickets(G, p, a.ids, R);
    if (G.phase !== 'play') fail('setup');
    if (p !== G.turn) fail('not-your-turn');
    if (G.offer[p]) fail('choose-tickets');
    const step = G.step;

    switch (a.k) {
      case 'card': {
        const slot = a.slot | 0;
        if (slot >= G.market.length || slot < -1) fail('bad-slot');
        if (step && !step.drew) fail('busy');
        if (!canTakeCard(G, slot)) fail(slot >= 0 && G.market[slot] === LOCO ? 'loco-second' : 'no-card');
        let c;
        if (slot < 0) c = drawFromDeck(G);
        else { c = G.market[slot]; G.market[slot] = -1; refillMarket(G); }
        G.hands[p][c]++;
        const first = !step;
        const e = note(G, { p, k: 'card', c: slot >= 0 ? c : -1, slot });
        if (first && !(slot >= 0 && c === LOCO)) {
          G.step = { drew: 1, first: e.c };
          if (!anyCardTakeable(G)) endTurn(G);
        } else endTurn(G);
        return e;
      }
      case 'claim': {
        if (step) fail('busy');
        const r = a.r | 0, rt = m.routes[r];
        const why = routeBlock(G, p, r);
        if (why) fail(why);
        const c = a.c == null ? -1 : a.c | 0, l = a.l | 0;
        const pe = payError(G.hands[p], rt.len, rt.color, rt.ferry || 0, c, l);
        if (pe) fail(pe);
        const n = rt.len - l;
        const paid = Array(9).fill(0);
        if (n > 0) paid[c] = n;
        paid[LOCO] = l;
        for (let k = 0; k < 9; k++) G.hands[p][k] -= paid[k];
        if (rt.tunnel) {
          const rev = [];
          for (let k = 0; k < 3; k++) { const x = drawFromDeck(G); if (x >= 0) rev.push(x); }
          const extra = rev.filter((x) => x === LOCO || (n > 0 && x === c)).length;
          if (extra === 0) {
            G.discard.push(...rev);
            return completeClaim(G, p, r, paid, { rev });
          }
          G.step = { tunnel: { r, c: n > 0 ? c : -1, paid, extra, rev } };
          return note(G, { p, k: 'tunnel', r, rev, extra });
        }
        return completeClaim(G, p, r, paid, null);
      }
      case 'tunnel': {
        if (!step || !step.tunnel) fail('no-tunnel');
        const T = step.tunnel, rt = m.routes[T.r];
        if (!a.pay) {
          for (let k = 0; k < 9; k++) G.hands[p][k] += T.paid[k];
          G.discard.push(...T.rev);
          const e = note(G, { p, k: 'tunnel-no', r: T.r });
          endTurn(G);
          return e;
        }
        const hand = G.hands[p];
        let l = a.l == null ? Math.max(0, T.extra - (T.c >= 0 ? hand[T.c] : 0)) : a.l | 0;
        if (T.c < 0) l = T.extra;
        const pe = payError(hand, T.extra, T.c >= 0 ? T.c : GRAY, 0, T.c, l);
        if (pe || (T.c < 0 && l !== T.extra)) fail(pe || 'cards');
        const paid = T.paid.slice();
        if (T.extra - l > 0) { hand[T.c] -= T.extra - l; paid[T.c] += T.extra - l; }
        hand[LOCO] -= l; paid[LOCO] += l;
        G.discard.push(...T.rev);
        G.step = null;
        return completeClaim(G, p, T.r, paid, { rev: T.rev, extra: T.extra });
      }
      case 'tickets': {
        if (step) fail('busy');
        if (!G.tdeck.length) fail('no-tickets');
        const offer = [];
        for (let k = 0; k < R.draw.n && G.tdeck.length; k++) offer.push(G.tdeck.pop());
        G.offer[p] = offer;
        G.keepMin[p] = Math.min(R.draw.keep, offer.length);
        return note(G, { p, k: 'ticket-draw', n: offer.length });
      }
      case 'station': {
        if (step) fail('busy');
        const city = a.city | 0;
        const why = stationBlock(G, p, city);
        if (why) fail(why);
        const cost = stationCost(G, p), c = a.c == null ? -1 : a.c | 0, l = a.l | 0;
        const pe = payError(G.hands[p], cost, GRAY, 0, c, l);
        if (pe) fail(pe);
        if (cost - l > 0) G.hands[p][c] -= cost - l;
        G.hands[p][LOCO] -= l;
        for (let k = 0; k < cost - l; k++) G.discard.push(c);
        for (let k = 0; k < l; k++) G.discard.push(LOCO);
        G.stationAt[city] = p;
        G.stations[p]--;
        refillMarket(G);
        const e = note(G, { p, k: 'station', city });
        endTurn(G);
        return e;
      }
      case 'pass': {
        if (step && step.drew && !anyCardTakeable(G)) { endTurn(G); return null; }
        if (step || canDoAnything(G, p)) fail('can-move');
        const e = note(G, { p, k: 'pass' });
        G.passes++;
        endTurn(G, true);
        return e;
      }
      default:
        fail('bad-action');
    }
  }

  function keepTickets(G, p, ids, R) {
    const offer = G.offer[p];
    if (!offer) fail('no-offer');
    if (!Array.isArray(ids)) fail('bad-keep');
    const keep = Array.from(new Set(ids.map((x) => x | 0)));
    if (keep.some((x) => !offer.includes(x))) fail('bad-keep');
    if (keep.length < G.keepMin[p]) fail('keep-more');
    const m = mapOf(G);
    G.tickets[p].push(...keep);
    // Returned tickets go under the pile; returned long tickets leave the game.
    for (const x of offer) if (!keep.includes(x) && !m.tickets[x][3]) G.tdeck.unshift(x);
    G.offer[p] = null;
    G.keepMin[p] = 0;
    const e = note(G, { p, k: 'keep', n: keep.length, of: offer.length });
    if (G.phase === 'setup') {
      if (G.offer.every((o) => !o)) G.phase = 'play';
    } else endTurn(G);
    return e;
  }

  function completeClaim(G, p, r, paid, info) {
    const rt = mapOf(G).routes[r];
    for (let k = 0; k < 9; k++) for (let j = 0; j < paid[k]; j++) G.discard.push(k);
    G.owner[r] = p;
    G.trains[p] -= rt.len;
    G.step = null;
    refillMarket(G);
    const e = note(G, Object.assign({ p, k: 'claim', r, pts: routePoints(rt.len) }, info || {}));
    endTurn(G);
    return e;
  }

  function endTurn(G, passed) {
    const p = G.turn;
    G.step = null;
    if (!passed) G.passes = 0;
    refillMarket(G);
    if (G.lastFrom < 0 && G.trains[p] <= rulesOf(G).endAt) {
      G.lastFrom = p;
      G.endIn = G.n;
      note(G, { p, k: 'last-round' });
    } else if (G.lastFrom >= 0) {
      G.endIn--;
      if (G.endIn <= 0) { finish(G); return; }
    }
    // Safety net: everyone passing, or a game that has run far longer than any real one.
    if (G.passes >= G.n * 2 || G.turnNo >= 150 * G.n) { finish(G); return; }
    G.turn = (p + 1) % G.n;
    G.turnNo++;
  }

  function finish(G) {
    G.phase = 'over';
    G.step = null;
    G.final = score(G);
    note(G, { p: -1, k: 'over' });
  }

  /** Is action a allowed for p? Returns null or an error code. */
  function legal(G, p, a) {
    try { apply(clone(G), p, a); return null; } catch (e) { return e.message; }
  }

  // ---------- networks and scoring ----------
  function ufFind(u, x) { while (u[x] !== x) { u[x] = u[u[x]]; x = u[x]; } return x; }
  /** Union-find of cities joined by the given route indices. */
  function components(m, routeIdx) {
    const u = m.cities.map((_, i) => i);
    for (const r of routeIdx) { const a = ufFind(u, m.routes[r].a), b = ufFind(u, m.routes[r].b); if (a !== b) u[a] = b; }
    return u;
  }
  const ownRoutes = (G, p) => G.owner.map((o, r) => (o === p ? r : -1)).filter((r) => r >= 0);

  /** Ticket status on p's own network (stations not counted): used for the live ticket list. */
  function ticketDone(G, p, id) {
    const m = mapOf(G), t = m.tickets[id], u = components(m, ownRoutes(G, p));
    return ufFind(u, t[0]) === ufFind(u, t[1]);
  }

  /** Longest continuous path (routes used once each) in a set of routes. */
  function longestPath(m, routeIdx) {
    const adj = m.cities.map(() => []);
    routeIdx.forEach((r, k) => { const rt = m.routes[r]; adj[rt.a].push([rt.b, k, rt.len]); adj[rt.b].push([rt.a, k, rt.len]); });
    const used = new Uint8Array(routeIdx.length);
    let best = 0;
    const dfs = (c, len) => {
      if (len > best) best = len;
      for (const [d, k, l] of adj[c]) if (!used[k]) { used[k] = 1; dfs(d, len + l); used[k] = 0; }
    };
    for (let c = 0; c < adj.length; c++) if (adj[c].length) dfs(c, 0);
    return best;
  }

  /** Two route-disjoint paths between a and b (max flow of 2 with unit capacities). */
  function twoPaths(m, routeIdx, a, b) {
    const cap = new Map(), adj = m.cities.map(() => []);
    const key = (x, y, k) => x + ':' + y + ':' + k;
    routeIdx.forEach((r, k) => {
      const rt = m.routes[r];
      cap.set(key(rt.a, rt.b, k), 1); cap.set(key(rt.b, rt.a, k), 1);
      adj[rt.a].push([rt.b, k]); adj[rt.b].push([rt.a, k]);
    });
    let flow = 0;
    while (flow < 2) {
      const prev = new Map([[a, null]]), q = [a];
      while (q.length && !prev.has(b)) {
        const x = q.shift();
        for (const [y, k] of adj[x]) if (!prev.has(y) && cap.get(key(x, y, k)) > 0) { prev.set(y, [x, k]); q.push(y); }
      }
      if (!prev.has(b)) break;
      for (let y = b; y !== a;) {
        const [x, k] = prev.get(y);
        cap.set(key(x, y, k), cap.get(key(x, y, k)) - 1);
        cap.set(key(y, x, k), cap.get(key(y, x, k)) + 1);
        y = x;
      }
      flow++;
    }
    return flow >= 2;
  }

  /** Each station lets its owner use one route of another player into that city; pick the best choice. */
  function bestStations(G, p, own) {
    const m = mapOf(G);
    const mine = G.stationAt.map((o, c) => (o === p ? c : -1)).filter((c) => c >= 0);
    const options = mine.map((c) => [null].concat(m.routes.map((rt, r) => ((rt.a === c || rt.b === c) && G.owner[r] >= 0 && G.owner[r] !== p ? r : -1)).filter((r) => r >= 0)));
    const ticketsScore = (borrowed) => {
      const u = components(m, own.concat(borrowed));
      let s = 0;
      const done = [];
      for (const id of G.tickets[p]) {
        const t = m.tickets[id], ok = ufFind(u, t[0]) === ufFind(u, t[1]);
        s += ok ? t[2] : -t[2];
        if (ok) done.push(id);
      }
      return { s, done };
    };
    let best = { borrowed: [], res: ticketsScore([]) };
    const total = options.reduce((x, o) => x * o.length, 1);
    if (total <= 20000) {
      const pick = (i, acc) => {
        if (i === options.length) {
          const b = acc.filter((r) => r != null), res = ticketsScore(b);
          if (res.s > best.res.s) best = { borrowed: b, res };
          return;
        }
        for (const o of options[i]) pick(i + 1, acc.concat([o]));
      };
      pick(0, []);
    } else {
      let acc = [];
      for (const o of options) {
        let bo = null, bs = -Infinity;
        for (const r of o) { const res = ticketsScore(acc.concat(r == null ? [] : [r])); if (res.s > bs) { bs = res.s; bo = r; } }
        if (bo != null) acc = acc.concat([bo]);
      }
      best = { borrowed: acc, res: ticketsScore(acc) };
    }
    return best;
  }

  /** Full scores. Per player: routes, tickets (+done / -failed), stations, bonuses, total. */
  function score(G) {
    const m = mapOf(G), R = rulesOf(G);
    const rows = [];
    for (let p = 0; p < G.n; p++) {
      const own = ownRoutes(G, p);
      const routes = own.reduce((s, r) => s + routePoints(m.routes[r].len), 0);
      const st = bestStations(G, p, own);
      const done = st.res.done;
      const failed = G.tickets[p].filter((id) => !done.includes(id));
      const plus = done.reduce((s, id) => s + m.tickets[id][2], 0);
      const minus = failed.reduce((s, id) => s + m.tickets[id][2], 0);
      const longest = longestPath(m, own);
      const mandalas = R.bonus.includes('mandala') ? done.filter((id) => twoPaths(m, own, m.tickets[id][0], m.tickets[id][1])).length : 0;
      rows.push({
        p, routes, plus, minus, done, failed, borrowed: st.borrowed,
        stations: G.stations[p] * R.stationPoints, longest, mandalas, bonus: {}, total: 0,
      });
    }
    const award = (name, val) => {
      const best = Math.max(...rows.map(val));
      if (best <= 0) return;
      rows.forEach((x) => { if (val(x) === best) x.bonus[name] = R.bonusPoints; });
    };
    if (R.bonus.includes('longest')) award('longest', (x) => x.longest);
    if (R.bonus.includes('globetrotter')) award('globetrotter', (x) => x.done.length);
    if (R.bonus.includes('mandala')) rows.forEach((x) => { if (x.mandalas) x.bonus.mandala = MANDALA_POINTS[Math.min(5, x.mandalas)]; });
    for (const x of rows) x.total = x.routes + x.plus - x.minus + x.stations + sum(Object.values(x.bonus));
    // Ranking: total, then completed tickets, then longest path.
    const order = rows.slice().sort((a, b) => b.total - a.total || b.done.length - a.done.length || b.longest - a.longest);
    const top = order[0];
    const winners = order.filter((x) => x.total === top.total && x.done.length === top.done.length && x.longest === top.longest).map((x) => x.p);
    return { rows, winners };
  }

  /** Points visible during play: claimed routes only. */
  function routeScore(G, p) {
    const m = mapOf(G);
    return G.owner.reduce((s, o, r) => (o === p ? s + routePoints(m.routes[r].len) : s), 0);
  }

  // ---------- views for other phones ----------
  /** A copy of G with what `seats` may not see hidden: others' hands and tickets, the deck order, the RNG. */
  function view(G, seats) {
    const v = clone(G);
    const over = G.phase === 'over';
    v.handN = G.hands.map((h) => sum(h));
    v.ticketN = G.tickets.map((t) => t.length);
    if (!over) {
      v.hands = G.hands.map((h, p) => (seats.includes(p) ? h.slice() : null));
      v.tickets = G.tickets.map((t, p) => (seats.includes(p) ? t.slice() : t.map(() => -1)));
      v.offer = G.offer.map((o, p) => (o && !seats.includes(p) ? o.map(() => -1) : o));
    }
    v.deck = G.deck.map(() => -1);
    v.tdeck = G.tdeck.map(() => -1);
    v.rs = 0;
    return v;
  }

  return {
    COLORS, LOCO, GRAY, ROUTE_POINTS, MANDALA_POINTS, DEFAULT_RULES,
    mapOf, rulesOf, routePoints, newGame, apply, legal, actors, canTakeCard, anyCardTakeable, canDoAnything,
    routeBlock, paymentOptions, payOptionsFor, stationCost, stationBlock, stationOptions,
    ticketDone, longestPath, twoPaths, components, ufFind, ownRoutes, score, routeScore, view, handSize, deckLeft, clone,
  };
});
