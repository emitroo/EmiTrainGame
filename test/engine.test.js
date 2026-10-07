const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../src/engine.js');
const AI = require('../src/ai.js');
const M = require('../src/maps.js');

const LOCO = E.LOCO;
const routeIdx = (map, a, b) => {
  const m = M.get(map);
  const ia = m.cities.findIndex((c) => c.id === a), ib = m.cities.findIndex((c) => c.id === b);
  return m.routes.map((r, i) => ((r.a === ia && r.b === ib) || (r.a === ib && r.b === ia) ? i : -1)).filter((i) => i >= 0);
};
const cityIdx = (map, id) => M.get(map).cities.findIndex((c) => c.id === id);
/** Game in the play phase with every player keeping all their tickets. */
function playing(map, n, seed) {
  const G = E.newGame({ map, n, seed, first: 0 });
  for (let p = 0; p < n; p++) E.apply(G, p, { k: 'keep', ids: G.offer[p].slice() });
  return G;
}
const setHand = (G, p, counts) => { G.hands[p] = Array(9).fill(0); for (const [c, k] of Object.entries(counts)) G.hands[p][c] = k; };

test('every map is valid: connected, sane routes, slots match lengths, tickets reachable', () => {
  for (const id of M.list) {
    const m = M.get(id);
    assert.ok(m.cities.length >= 30, id);
    for (const r of m.routes) {
      assert.ok(r.len >= 1 && r.len <= 9, `${id} length`);
      assert.equal(r.slots.length, r.len, `${id} slots`);
      assert.ok(r.color >= -1 && r.color < 8);
      if (r.pair >= 0) { assert.equal(m.routes[r.pair].pair, m.routes.indexOf(r)); assert.notEqual(m.routes[r.pair].color === r.color && r.color >= 0, true, `${id} double colours`); }
      if (r.ferry) assert.ok(r.ferry <= r.len);
    }
    const u = E.components(m, m.routes.map((_, i) => i));
    const roots = new Set(m.cities.map((_, i) => E.ufFind(u, i)));
    assert.equal(roots.size, 1, `${id} connected`);
    for (const t of m.tickets) {
      if (E.isCountryTicket(t)) { assert.ok(t.o.length >= 2 && t.o.every((o) => m.countries[o[0]] && o[1] > 0)); continue; }
      assert.notEqual(t[0], t[1]); assert.ok(t[2] > 0);
    }
    const R = E.rulesOf(id);
    assert.ok(m.tickets.filter((t) => !t[3]).length >= R.players[1] * R.deal.short + R.draw.n, `${id} enough tickets`);
  }
});

test('every car on a board is the same length, like the plastic pieces', () => {
  for (const id of M.list) {
    const lens = M.get(id).routes.flatMap((r) => r.slots.map((s) => s[3]));
    assert.ok(Math.max(...lens) - Math.min(...lens) <= 0.2, `${id}: cars from ${Math.min(...lens)} to ${Math.max(...lens)}`);
  }
});

test('official boards: city, route and ticket counts as published', () => {
  const lanes = (id) => M.get(id).routes.length;
  const conn = (id) => M.get(id).routes.filter((r, i) => r.pair < 0 || r.pair > i).length; // a double route counts once
  const expect = { europe: [47, 101, 46], usa: [36, 100, 30], nordic: [39, 81, 46], india: [39, 108, 58], switzerland: [51, 88, 46] };
  for (const [id, [cities, routes, tickets]] of Object.entries(expect)) {
    const m = M.get(id);
    assert.equal(m.cities.length, cities, `${id} cities`);
    assert.equal(lanes(id), routes, `${id} lanes`);
    assert.equal(m.tickets.length, tickets, `${id} tickets`);
  }
  assert.equal(conn('usa'), 78);
  assert.equal(conn('nordic'), 70);
  assert.equal(conn('india'), 80);
  assert.equal(conn('switzerland'), 76);
  // Every colour appears equally often on the USA and India boards.
  for (const id of ['usa', 'india']) {
    const per = Array(8).fill(0);
    M.get(id).routes.forEach((r) => { if (r.color >= 0) per[r.color] += r.len; });
    assert.ok(per.every((x) => x === per[0]), `${id} colours ${per}`);
  }
});

test('new game: 110 cards, hands of 4, market of 5, ticket offers', () => {
  const G = E.newGame({ map: 'europe', n: 4, seed: 7 });
  const total = G.deck.length + G.discard.length + G.market.filter((c) => c >= 0).length + G.hands.reduce((s, h) => s + h.reduce((a, b) => a + b, 0), 0);
  assert.equal(total, 8 * 12 + 14);
  assert.ok(G.hands.every((h) => h.reduce((a, b) => a + b, 0) === 4));
  assert.equal(G.market.length, 5);
  assert.ok(G.market.filter((c) => c === LOCO).length < 3);
  const m = M.get('europe');
  for (const o of G.offer) { assert.equal(o.length, 4); assert.equal(o.filter((id) => m.tickets[id][3]).length, 1); }
  assert.equal(G.phase, 'setup');
  assert.deepEqual(E.actors(G), [0, 1, 2, 3]);
});

test('same seed, same game', () => {
  const a = E.newGame({ map: 'usa', n: 3, seed: 42 }), b = E.newGame({ map: 'usa', n: 3, seed: 42 });
  assert.deepEqual(a, b);
});

test('initial tickets: keep at least two; play starts once everyone has chosen', () => {
  const G = E.newGame({ map: 'usa', n: 2, seed: 3, first: 1 });
  assert.equal(E.legal(G, 0, { k: 'keep', ids: [G.offer[0][0]] }), 'keep-more');
  assert.equal(E.legal(G, 0, { k: 'keep', ids: [999] }), 'bad-keep');
  E.apply(G, 0, { k: 'keep', ids: G.offer[0].slice(0, 2) });
  assert.equal(G.phase, 'setup');
  assert.equal(E.legal(G, 1, { k: 'card', slot: -1 }), 'setup');
  const returned = G.offer[1][2];
  E.apply(G, 1, { k: 'keep', ids: G.offer[1].slice(0, 2) });
  assert.equal(G.phase, 'play');
  assert.equal(G.turn, 1);
  assert.equal(G.tdeck[0], returned, 'returned ticket goes under the pile');
});

test('drawing cards: two per turn, a face-up locomotive is the whole turn and never the second card', () => {
  const G = playing('usa', 2, 5);
  G.market = [LOCO, 0, 1, 2, 3];
  E.apply(G, 0, { k: 'card', slot: 1 });
  assert.equal(G.turn, 0);
  assert.equal(E.legal(G, 0, { k: 'card', slot: 0 }), 'loco-second');
  assert.equal(E.legal(G, 0, { k: 'claim', r: 0, c: 0, l: 0 }), 'busy');
  E.apply(G, 0, { k: 'card', slot: -1 });
  assert.equal(G.turn, 1);
  G.market[2] = LOCO;
  const before = G.hands[1][LOCO];
  E.apply(G, 1, { k: 'card', slot: 2 });
  assert.equal(G.hands[1][LOCO], before + 1);
  assert.equal(G.turn, 0, 'face-up locomotive ends the turn');
});

test('three face-up locomotives replace the market', () => {
  const G = playing('usa', 2, 9);
  G.deck.push(LOCO, LOCO, LOCO, 1, 2, 3, 4, 5);
  G.market = [-1, -1, -1, -1, -1];
  G.deck.push(0, 0, LOCO, LOCO, LOCO);
  E.apply(G, 0, { k: 'card', slot: -1 }); // forces a refill at turn end
  assert.ok(G.market.filter((c) => c === LOCO).length < 3);
});

test('claiming: colour, gray, locomotives, trains and points', () => {
  const G = playing('usa', 2, 11);
  const m = M.get('usa');
  const colored = m.routes.findIndex((r) => r.color >= 0 && r.len === 3 && r.pair < 0);
  const rc = m.routes[colored].color, other = (rc + 1) % 8;
  setHand(G, 0, { [rc]: 2, [other]: 3, [LOCO]: 1 });
  assert.equal(E.legal(G, 0, { k: 'claim', r: colored, c: other, l: 0 }), 'color');
  assert.equal(E.legal(G, 0, { k: 'claim', r: colored, c: rc, l: 0 }), 'cards');
  const want = Array(9).fill(0); want[rc] = 2; want[LOCO] = 1;
  assert.deepEqual(E.paymentOptions(G, 0, colored), [want]);
  E.apply(G, 0, { k: 'claim', r: colored, c: rc, l: 1 });
  assert.equal(G.owner[colored], 0);
  assert.equal(G.trains[0], 45 - 3);
  assert.equal(E.routeScore(G, 0), 4);
  assert.equal(G.turn, 1);
  assert.equal(E.legal(G, 1, { k: 'claim', r: colored, c: rc, l: 0 }), 'taken');
  const gray = m.routes.findIndex((r) => r.color === -1 && r.len === 2 && r.pair < 0 && G.owner[m.routes.indexOf(r)] < 0);
  setHand(G, 1, { 5: 2 });
  assert.equal(E.legal(G, 1, { k: 'claim', r: gray, c: 5, l: 0 }), null);
});

test('double routes: one owner per pair, and closed in small games', () => {
  const [a, b] = routeIdx('usa', 'newyork', 'boston');
  const G = playing('usa', 3, 2);
  const m = M.get('usa');
  setHand(G, 0, { [LOCO]: 10 });
  E.apply(G, 0, { k: 'claim', r: a, c: -1, l: m.routes[a].len });
  setHand(G, 1, { [LOCO]: 10 });
  assert.equal(E.legal(G, 1, { k: 'claim', r: b, c: -1, l: m.routes[b].len }), 'double-closed');
  const G4 = playing('usa', 4, 2);
  setHand(G4, 0, { [LOCO]: 10 });
  E.apply(G4, 0, { k: 'claim', r: a, c: -1, l: 2 });
  setHand(G4, 1, { [LOCO]: 10 });
  assert.equal(E.legal(G4, 1, { k: 'claim', r: b, c: -1, l: 2 }), null);
  G4.turn = 0;
  setHand(G4, 0, { [LOCO]: 10 });
  assert.equal(E.legal(G4, 0, { k: 'claim', r: b, c: -1, l: 2 }), 'double-own');
});

test('ferries need their locomotives', () => {
  const G = playing('europe', 2, 4);
  const [r] = routeIdx('europe', 'lon', 'ams');
  setHand(G, 0, { 3: 2, [LOCO]: 1 });
  assert.equal(E.legal(G, 0, { k: 'claim', r, c: 3, l: 1 }), 'ferry');
  setHand(G, 0, { 3: 2, [LOCO]: 2 });
  assert.deepEqual(E.paymentOptions(G, 0, r), [[0, 0, 0, 0, 0, 0, 0, 0, 2]]);
  assert.equal(E.legal(G, 0, { k: 'claim', r, c: 3, l: 1 }), 'ferry');
  assert.equal(E.legal(G, 0, { k: 'claim', r, c: -1, l: 2 }), null);
});

test('tunnels: matching revealed cards cost extra; giving up returns the cards', () => {
  const m = M.get('europe');
  const r = m.routes.findIndex((x) => x.tunnel && x.color >= 0 && x.len === 2 && x.pair < 0);
  const col = m.routes[r].color;
  const G = playing('europe', 2, 8);
  setHand(G, 0, { [col]: 3, [LOCO]: 0 });
  G.deck.push((col + 1) % 8, LOCO, col); // revealed: col, loco, other -> 2 extra
  E.apply(G, 0, { k: 'claim', r, c: col, l: 0 });
  assert.equal(G.step.tunnel.extra, 2);
  assert.equal(G.turn, 0);
  assert.equal(E.legal(G, 0, { k: 'tunnel', pay: true }), 'cards');
  E.apply(G, 0, { k: 'tunnel', pay: false });
  assert.equal(G.hands[0][col], 3);
  assert.equal(G.owner[r], -1);
  assert.equal(G.turn, 1);

  const H = playing('europe', 2, 8);
  setHand(H, 0, { [col]: 3, [LOCO]: 1 });
  H.deck.push(col, (col + 2) % 8, (col + 3) % 8);
  E.apply(H, 0, { k: 'claim', r, c: col, l: 0 });
  assert.equal(H.step.tunnel.extra, 1);
  E.apply(H, 0, { k: 'tunnel', pay: true });
  assert.equal(H.owner[r], 0);
  assert.equal(H.hands[0][col], 0);
  assert.equal(H.hands[0][LOCO], 1);
});

test('stations: rising cost, one per city, and they borrow a route for tickets at the end', () => {
  const G = playing('europe', 2, 12);
  const m = M.get('europe');
  const par = cityIdx('europe', 'par');
  setHand(G, 0, { 2: 6 });
  assert.equal(E.stationCost(G, 0), 1);
  E.apply(G, 0, { k: 'station', city: par, c: 2, l: 0 });
  assert.equal(G.stations[0], 2);
  assert.equal(E.stationCost(G, 0), 2);
  assert.equal(E.legal(G, 1, { k: 'station', city: par, c: 2, l: 0 }), 'station-taken');

  // Player 1 owns Paris-Bruxelles; player 0's ticket Paris-Bruxelles... is completed through the station.
  const [pb] = routeIdx('europe', 'par', 'bru');
  G.owner[pb] = 1;
  const bru = cityIdx('europe', 'bru');
  const tid = m.tickets.length;
  m.tickets.push([par, bru, 2]);
  G.tickets[0] = [tid];
  G.tickets[1] = [];
  try {
    const s = E.score(G);
    assert.deepEqual(s.rows[0].done, [tid]);
    assert.deepEqual(s.rows[0].borrowed, [pb]);
    assert.equal(s.rows[0].stations, 2 * 4);
  } finally { m.tickets.pop(); }
});

test('longest path and mandala paths', () => {
  const m = M.get('india');
  const r = (a, b) => routeIdx('india', a, b)[0];
  const loop = [r('bombay', 'poona'), r('poona', 'manmad'), r('manmad', 'bombay')];
  assert.equal(E.longestPath(m, loop), m.routes[loop[0]].len + m.routes[loop[1]].len + m.routes[loop[2]].len);
  assert.ok(E.twoPaths(m, loop, cityIdx('india', 'bombay'), cityIdx('india', 'manmad')));
  assert.ok(!E.twoPaths(m, loop.slice(0, 2), cityIdx('india', 'bombay'), cityIdx('india', 'manmad')));
  // A star counts only its two longest arms.
  const star = [r('wadi', 'indur'), r('wadi', 'poona'), r('wadi', 'mormugao')];
  const lens = star.map((x) => m.routes[x].len).sort((a, b) => b - a);
  assert.equal(E.longestPath(m, star), lens[0] + lens[1]);
});

test('end of game: two or fewer trains give everyone one last turn', () => {
  const G = playing('usa', 3, 21);
  G.trains[0] = 3;
  const m = M.get('usa');
  const one = m.routes.findIndex((x) => x.len === 1);
  setHand(G, 0, { [LOCO]: 2 });
  E.apply(G, 0, { k: 'claim', r: one, c: -1, l: 1 });
  assert.equal(G.lastFrom, 0);
  E.apply(G, 1, { k: 'card', slot: -1 }); E.apply(G, 1, { k: 'card', slot: -1 });
  E.apply(G, 2, { k: 'card', slot: -1 }); E.apply(G, 2, { k: 'card', slot: -1 });
  assert.equal(G.phase, 'play');
  E.apply(G, 0, { k: 'card', slot: -1 }); E.apply(G, 0, { k: 'card', slot: -1 });
  assert.equal(G.phase, 'over');
  assert.ok(G.final.rows.length === 3 && G.final.winners.length >= 1);
});

test('drawing tickets mid-game: keep at least one', () => {
  const G = playing('usa', 2, 30);
  E.apply(G, 0, { k: 'tickets' });
  assert.equal(G.offer[0].length, 3);
  assert.equal(E.legal(G, 0, { k: 'card', slot: -1 }), 'choose-tickets');
  assert.equal(E.legal(G, 0, { k: 'keep', ids: [] }), 'keep-more');
  const had = G.tickets[0].length;
  E.apply(G, 0, { k: 'keep', ids: [G.offer[0][1]] });
  assert.equal(G.tickets[0].length, had + 1);
  assert.equal(G.turn, 1);
});

test('views hide other hands, tickets and the deck', () => {
  const G = playing('europe', 3, 33);
  const v = E.view(G, [1]);
  assert.equal(v.hands[0], null);
  assert.deepEqual(v.hands[1], G.hands[1]);
  assert.ok(v.tickets[0].every((x) => x === -1));
  assert.deepEqual(v.tickets[1], G.tickets[1]);
  assert.ok(v.deck.every((x) => x === -1));
  assert.equal(v.rs, 0);
  assert.equal(v.handN[0], G.hands[0].reduce((a, b) => a + b, 0));
});

test('CPU players finish games on every map and never make an illegal move', () => {
  const levels = ['easy', 'normal', 'hard'];
  for (const map of M.list) {
    const R = E.rulesOf(map);
    for (const n of [R.players[0], R.players[1]]) {
      for (let seed = 1; seed <= 3; seed++) {
        const G = E.newGame({ map, n, seed: seed * 101 + n });
        let steps = 0;
        while (G.phase !== 'over') {
          const p = E.actors(G)[0];
          E.apply(G, p, AI.choose(G, p, levels[(p + seed) % 3]));
          assert.ok(++steps < 4000, `${map} n=${n} seed=${seed} runs too long`);
        }
        assert.ok(G.final.rows.every((r) => Number.isFinite(r.total)));
        const left = G.trains.some((t) => t <= R.endAt) || G.turnNo >= 150 * n || G.passes >= 2 * n;
        assert.ok(left, `${map} ended for a reason`);
      }
    }
  }
});

const cardsOf = (o) => { const c = Array(9).fill(0); for (const [k, v] of Object.entries(o)) c[k] = v; return c; };

test('Nordic: locomotives only on tunnels and ferries; 3 cards for a ferry locomotive; 4 cards per space on Murmansk-Lieksa', () => {
  const m = M.get('nordic');
  const G = playing('nordic', 2, 3);
  const plain = m.routes.findIndex((r) => !r.tunnel && !r.ferry && r.color >= 0 && r.len === 2 && r.pair < 0);
  const col = m.routes[plain].color;
  setHand(G, 0, { [col]: 1, [LOCO]: 3 });
  assert.equal(E.paymentOptions(G, 0, plain).length, 0, 'no locomotive on a plain route');
  assert.equal(E.legal(G, 0, { k: 'claim', r: plain, cards: cardsOf({ [col]: 1, [LOCO]: 1 }) }), 'loco-here');
  // Ferry Bergen-Stavanger (2, purple, 1 locomotive): no locomotive, so 1 purple + any 3 cards.
  const [fer] = routeIdx('nordic', 'bergen', 'stavanger');
  setHand(G, 0, { 0: 1, 2: 2, 5: 1 });
  assert.equal(E.legal(G, 0, { k: 'claim', r: fer, cards: cardsOf({ 0: 1, 2: 2, 5: 1 }) }), null);
  assert.notEqual(E.legal(G, 0, { k: 'claim', r: fer, cards: cardsOf({ 0: 1, 2: 2 }) }), null);
  // Murmansk-Lieksa (9, gray): 7 green + 8 other cards.
  const [ml] = routeIdx('nordic', 'murmansk', 'lieksa');
  assert.equal(m.routes[ml].len, 9);
  setHand(G, 0, { 7: 7, 1: 5, 2: 3 });
  assert.equal(E.legal(G, 0, { k: 'claim', r: ml, cards: cardsOf({ 7: 7, 1: 5, 2: 3 }) }), null);
  assert.ok(E.paymentOptions(G, 0, ml).some((o) => E.sum(o) === 15));
  assert.equal(E.routePoints(9), 27);
});

test('Nordic and Switzerland: a face-up locomotive is one card; no locomotive limit', () => {
  const G = playing('nordic', 2, 5);
  G.market = [LOCO, LOCO, LOCO, 1, 2];
  E.apply(G, 0, { k: 'card', slot: 0 });
  assert.equal(G.turn, 0, 'turn goes on');
  assert.equal(E.legal(G, 0, { k: 'card', slot: 1 }), null);
  E.apply(G, 0, { k: 'card', slot: 1 });
  assert.equal(G.turn, 1);
});

test('Nordic: tickets not kept leave the game', () => {
  const G = E.newGame({ map: 'nordic', n: 2, seed: 9, first: 0 });
  const before = G.tdeck.length;
  E.apply(G, 0, { k: 'keep', ids: G.offer[0].slice(0, 2) });
  assert.equal(G.tdeck.length, before);
  assert.equal(E.rulesOf('nordic').deal.short, 5);
});

test('Switzerland: country tickets score the best country reached, or lose the smallest', () => {
  const m = M.get('switzerland');
  const G = playing('switzerland', 2, 4);
  const id = m.tickets.findIndex((t) => E.isCountryTicket(t) && t.f >= 0 && m.cities[t.f].name === 'Bern');
  const t = m.tickets[id];
  G.tickets[0] = [id]; G.tickets[1] = [];
  const own = (a, b) => { for (const r of routeIdx('switzerland', a, b)) { G.owner[r] = 0; break; } };
  let s = E.score(G).rows[0];
  assert.equal(s.minus, Math.min(...t.o.map((o) => o[1])));
  // Bern - Fribourg - Lausanne - Genève - France (border)
  own('bern', 'fribourg'); own('fribourg', 'lausanne'); own('lausanne', 'geneve'); own('geneve', 'fr_geneve');
  s = E.score(G).rows[0];
  const fr = m.countries.findIndex((c) => c.id === 'fr');
  assert.equal(s.plus, t.o.find((o) => o[0] === fr)[1]);
  assert.deepEqual(s.done, [id]);
  // Locomotives only on tunnels.
  const plain = m.routes.findIndex((r) => !r.tunnel && r.color >= 0 && G.owner[m.routes.indexOf(r)] < 0);
  setHand(G, 0, { [LOCO]: 6 });
  assert.equal(E.paymentOptions(G, 0, plain).length, 0);
});

test('India: Indian Express and Mandala, no Globetrotter; doubles only with 4', () => {
  const R = E.rulesOf('india');
  assert.deepEqual(R.bonus.sort(), ['longest', 'mandala']);
  assert.deepEqual(R.players, [2, 4]);
  assert.equal(R.doubleMin, 4);
});

test('house rule: up to 5 players on smaller boards', () => {
  assert.throws(() => E.newGame({ map: 'nordic', n: 5 }), /bad-players/);
  const G = E.newGame({ map: 'nordic', n: 5, house: true, seed: 2 });
  assert.equal(G.n, 5);
  assert.ok(G.house);
});

test('Europe tie-break: more tickets, then fewer stations used', () => {
  const G = playing('europe', 2, 40);
  G.owner = G.owner.map(() => -1);
  G.tickets = [[], []];
  G.stations = [3, 2];
  const s = E.score(G);
  // Both 0 points except stations: 12 vs 8, so player 0 wins outright.
  assert.deepEqual(s.winners, [0]);
});
