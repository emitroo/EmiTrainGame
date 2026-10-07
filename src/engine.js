/* Emi Train Game rules engine. Pure logic, no DOM. Works in the browser (window.TrainEngine) and in Node (module.exports).
 *
 * Train cards are colour indices 0..7 (see COLORS) and 8 for a locomotive (wild). A hand is an array of 9 counts, and
 * so is every payment: the exact cards a player puts down.
 * Routes have colour -1 (gray: any single colour) or 0..7; tunnels may cost extra cards; ferries need locomotives.
 * Each map's rules (maps-src/*.mjs) switch on its own variations, e.g. Nordic Countries: locomotives only on tunnels
 * and ferries, any 3 cards for a ferry locomotive, any 4 cards for one card on Murmansk-Lieksa.
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
    ticketReturn: 'bottom', // or 'box': tickets not kept leave the game
    locoUse: 'any', // 'any' | 'tunnelFerry' | 'tunnel': where locomotives may stand in for a colour
    locoDrawFree: false, // true: a face-up locomotive counts as one card (and may be the second)
    ferrySub: 0, // any N cards may replace one ferry locomotive
    bonus: ['longest'], bonusPoints: 10, tie: ['tickets', 'longest'],
    locos: 14, perColor: 12, hand: 4, market: 5, endAt: 2, maxPlayers: 5,
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
  const zero = () => Array(9).fill(0);
  const cardsOk = (c) => Array.isArray(c) && c.length === 9 && c.every((x) => Number.isInteger(x) && x >= 0);
  const hasCards = (hand, cards) => cards.every((x, k) => hand[k] >= x);

  // ---------- tickets ----------
  // City ticket: [a, b, points, long?]. Country ticket: { f: city or -(country+1), o: [[country, points]...] }.
  const isCountryTicket = (t) => !Array.isArray(t);
  const nodesOf = (m, ref) => (ref >= 0 ? [ref] : m.countries[-ref - 1].nodes);
  /** Highest points a ticket can give (for display and planning). */
  const ticketPoints = (t) => (isCountryTicket(t) ? Math.max(...t.o.map((o) => o[1])) : t[2]);
  const isLongTicket = (t) => !isCountryTicket(t) && !!t[3];

  // ---------- setup ----------
  /** New game. opts: { map, n, seed, first, house } (house: allow up to 5 players on any map). */
  function newGame(opts) {
    const m = mapOf(opts.map);
    if (!m) fail('bad-map');
    const n = opts.n | 0;
    const R0 = Object.assign({}, DEFAULT_RULES, m.rules || {});
    const hi = opts.house ? Math.max(R0.players[1], R0.maxPlayers) : R0.players[1];
    if (n < R0.players[0] || n > hi) fail('bad-players');
    const G = {
      v: 2, map: m.id, n, house: !!opts.house && n > R0.players[1], rs: (opts.seed == null ? Math.floor(Math.random() * 2 ** 32) : opts.seed) >>> 0,
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
    m.tickets.forEach((t, i) => (isLongTicket(t) ? G.ldeck : G.tdeck).push(i));
    shuffle(G, G.tdeck);
    shuffle(G, G.ldeck);
    G.turn = opts.first != null ? opts.first % n : Math.floor(rnd(G) * n);
    for (let p = 0; p < n; p++) {
      G.hands.push(zero());
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

  /** Fill empty market slots; three or more face-up locomotives replace the whole row (a few tries at most),
   *  except on maps where a face-up locomotive is just one card. */
  function refillMarket(G) {
    const reset = !rulesOf(G).locoDrawFree;
    for (let tries = 0; tries < 4; tries++) {
      for (let i = 0; i < G.market.length; i++) if (G.market[i] < 0) G.market[i] = drawFromDeck(G);
      if (!reset || G.market.filter((c) => c === LOCO).length < 3) return;
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
    return !(c === LOCO && G.step && G.step.drew && !rulesOf(G).locoDrawFree);
  }
  function anyCardTakeable(G) {
    if (canTakeCard(G, -1)) return true;
    for (let i = 0; i < G.market.length; i++) if (canTakeCard(G, i)) return true;
    return false;
  }

  // ---------- routes and payments ----------
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

  /** May locomotives stand in for the coloured cards of this route? (Ferry locomotive spaces always take them.) */
  function locoAllowed(R, rt) {
    if (R.locoUse === 'tunnel') return !!rt.tunnel;
    if (R.locoUse === 'tunnelFerry') return !!(rt.tunnel || rt.ferry);
    return true;
  }

  /** Does `cards` pay exactly for route rt? Returns { c } (the colour used, -1 for locomotives only) or null.
   *  Spaces: (len - ferry) colour spaces take the colour or (where allowed) locomotives, or with rt.sub any `sub`
   *  cards; ferry spaces take a locomotive, or with R.ferrySub any `ferrySub` cards. */
  function payCheck(R, rt, cards) {
    if (!cardsOk(cards)) return null;
    const f = rt.ferry || 0, k = rt.len - f, L = cards[LOCO], total = sum(cards);
    const locoOK = locoAllowed(R, rt), fs = f ? R.ferrySub || 0 : 0, sub = rt.sub || 0;
    const colours = rt.color >= 0 ? [rt.color] : [0, 1, 2, 3, 4, 5, 6, 7];
    for (const c of colours) {
      const C = cards[c], O = total - L - C;
      for (let lf = 0; lf <= Math.min(L, f); lf++) {
        const r = f - lf;
        if (r && !fs) continue;
        for (let lk = 0; lk <= (locoOK ? L - lf : 0) && lk <= k; lk++) {
          const cc = Math.min(C, k - lk), g = k - lk - cc;
          if (g && !sub) continue;
          if ((L - lf - lk) + (C - cc) + O === fs * r + sub * g) return { c: cc > 0 ? c : -1 };
        }
      }
    }
    return null;
  }

  /** Take n cards from what is left of the hand, spending the least useful first (big stacks of other colours). */
  function takeSpare(hand, cards, n, keepColour) {
    const left = hand.map((x, k) => x - cards[k]);
    const order = [0, 1, 2, 3, 4, 5, 6, 7].filter((k) => k !== keepColour).sort((a, b) => left[b] - left[a]).concat(keepColour >= 0 ? [keepColour] : [], [LOCO]);
    for (const k of order) {
      while (n > 0 && left[k] > 0) { cards[k]++; left[k]--; n--; }
    }
    return n === 0;
  }

  /** Sensible ways to pay for a route from a hand: per colour, as many of that colour as possible, then
   *  locomotives where allowed, then substitutes; plus locomotives only. Each option is a cards array. */
  function payOptionsFor(R, rt, hand) {
    const out = [], seen = new Set();
    const f = rt.ferry || 0, k = rt.len - f, locoOK = locoAllowed(R, rt), fs = f ? R.ferrySub || 0 : 0, sub = rt.sub || 0;
    const add = (cards) => {
      const key = cards.join();
      if (seen.has(key) || !hasCards(hand, cards) || !payCheck(R, rt, cards)) return;
      seen.add(key); out.push(cards);
    };
    const colours = rt.color >= 0 ? [rt.color] : [0, 1, 2, 3, 4, 5, 6, 7];
    for (const c of colours) {
      if (!hand[c] && rt.color < 0) continue;
      const cards = zero();
      const lf = Math.min(hand[LOCO], f);
      cards[LOCO] += lf;
      const cc = Math.min(hand[c], k);
      cards[c] += cc;
      let need = k - cc;
      const lk = locoOK ? Math.min(hand[LOCO] - lf, need) : 0;
      cards[LOCO] += lk; need -= lk;
      if (need && !sub) continue;
      if ((f - lf) && !fs) continue;
      if (!takeSpare(hand, cards, fs * (f - lf) + sub * need, c)) continue;
      add(cards);
    }
    if (locoOK || f === rt.len) { const cards = zero(); cards[LOCO] = rt.len; add(cards); }
    return out.sort((a, b) => sum(a) - sum(b) || a[LOCO] - b[LOCO]);
  }

  function paymentOptions(G, p, r) {
    const rt = mapOf(G).routes[r], hand = G.hands[p];
    if (!hand || routeBlock(G, p, r)) return [];
    return payOptionsFor(rulesOf(G), rt, hand);
  }

  // ---------- stations ----------
  function stationCost(G, p) { return rulesOf(G).stations - G.stations[p] + 1; }
  function stationBlock(G, p, city) {
    if (!rulesOf(G).stations) return 'no-stations';
    if (G.stations[p] <= 0) return 'no-stations-left';
    if (G.stationAt[city] == null) return 'bad-city';
    if (mapOf(G).cities[city].country != null) return 'bad-city';
    if (G.stationAt[city] >= 0) return 'station-taken';
    return null;
  }
  const stationRoute = (G, p) => ({ len: stationCost(G, p), color: GRAY });
  function stationOptions(G, p, city) {
    if (!G.hands[p] || stationBlock(G, p, city)) return [];
    return payOptionsFor(rulesOf(G), stationRoute(G, p), G.hands[p]);
  }

  // ---------- tunnels ----------
  /** Ways to pay a tunnel's extra cards: the colour used, or locomotives (only locomotives if only those were used). */
  function tunnelOptions(G, p) {
    const T = G.step && G.step.tunnel, hand = G.hands[p];
    if (!T || !hand) return [];
    const out = [];
    if (T.c < 0) { if (hand[LOCO] >= T.extra) { const c = zero(); c[LOCO] = T.extra; out.push(c); } return out; }
    for (let l = Math.max(0, T.extra - hand[T.c]); l <= Math.min(T.extra, hand[LOCO]); l++) { const c = zero(); c[T.c] = T.extra - l; c[LOCO] = l; out.push(c); }
    return out;
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
  /** Old-style payment { c, l } (colour + locomotives) as a cards array, so saved games and simple callers still work. */
  function legacyCards(a, len) {
    if (cardsOk(a.cards)) return a.cards;
    const cards = zero(), l = a.l | 0, c = a.c == null ? -1 : a.c | 0;
    if (l < 0 || l > len || (len - l > 0 && !(c >= 0 && c < 8))) return null;
    cards[LOCO] = l;
    if (len - l > 0) cards[c] = len - l;
    return cards;
  }

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
        const wholeTurn = slot >= 0 && c === LOCO && !R.locoDrawFree;
        if (first && !wholeTurn) {
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
        const paid = legacyCards(a, rt.len);
        if (!paid) fail('bad-pay');
        if (!hasCards(G.hands[p], paid)) fail('cards');
        const ok = payCheck(R, rt, paid);
        if (!ok) fail(rt.ferry && paid[LOCO] < rt.ferry && !R.ferrySub ? 'ferry' : rt.color >= 0 && paid.some((x, k) => x && k !== rt.color && k !== LOCO) && !rt.sub ? 'color' : !locoAllowed(R, rt) && paid[LOCO] > (rt.ferry || 0) ? 'loco-here' : 'bad-pay');
        for (let k = 0; k < 9; k++) G.hands[p][k] -= paid[k];
        if (rt.tunnel) {
          const rev = [];
          for (let k = 0; k < 3; k++) { const x = drawFromDeck(G); if (x >= 0) rev.push(x); }
          const extra = rev.filter((x) => x === LOCO || (ok.c >= 0 && x === ok.c)).length;
          if (extra === 0) {
            G.discard.push(...rev);
            return completeClaim(G, p, r, paid, { rev });
          }
          G.step = { tunnel: { r, c: ok.c, paid, extra, rev } };
          return note(G, { p, k: 'tunnel', r, rev, extra });
        }
        return completeClaim(G, p, r, paid, null);
      }
      case 'tunnel': {
        if (!step || !step.tunnel) fail('no-tunnel');
        const T = step.tunnel;
        if (!a.pay) {
          for (let k = 0; k < 9; k++) G.hands[p][k] += T.paid[k];
          G.discard.push(...T.rev);
          const e = note(G, { p, k: 'tunnel-no', r: T.r });
          endTurn(G);
          return e;
        }
        let extra = cardsOk(a.cards) ? a.cards : null;
        if (!extra) {
          const hand = G.hands[p];
          const l = T.c < 0 ? T.extra : a.l == null ? Math.max(0, T.extra - hand[T.c]) : a.l | 0;
          extra = zero(); extra[LOCO] = l; if (T.c >= 0) extra[T.c] = T.extra - l;
        }
        if (sum(extra) !== T.extra || extra.some((x, k) => x && k !== LOCO && k !== T.c) || extra.some((x) => x < 0)) fail('bad-pay');
        if (!hasCards(G.hands[p], extra)) fail('cards');
        const paid = T.paid.slice();
        for (let k = 0; k < 9; k++) { G.hands[p][k] -= extra[k]; paid[k] += extra[k]; }
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
        const cost = stationCost(G, p);
        const paid = legacyCards(a, cost);
        if (!paid || !hasCards(G.hands[p], paid) || !payCheck(R, stationRoute(G, p), paid)) fail(paid && !hasCards(G.hands[p], paid) ? 'cards' : 'bad-pay');
        for (let k = 0; k < 9; k++) { G.hands[p][k] -= paid[k]; for (let j = 0; j < paid[k]; j++) G.discard.push(k); }
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
    // Returned tickets go under the pile (or out of the game on some maps); returned long tickets always leave.
    for (const x of offer) if (!keep.includes(x) && !isLongTicket(m.tickets[x]) && R.ticketReturn !== 'box') G.tdeck.unshift(x);
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
  const joined = (m, u, refA, refB) => {
    const roots = new Set(nodesOf(m, refA).map((x) => ufFind(u, x)));
    return nodesOf(m, refB).some((x) => roots.has(ufFind(u, x)));
  };

  /** A ticket's result on a network: { v: points won (negative if failed), done, opt (country reached) }. */
  function ticketResult(m, t, u) {
    if (!isCountryTicket(t)) { const ok = joined(m, u, t[0], t[1]); return { v: ok ? t[2] : -t[2], done: ok }; }
    let best = null;
    for (const [c, pts] of t.o) if (joined(m, u, t.f, -(c + 1)) && (!best || pts > best[1])) best = [c, pts];
    if (best) return { v: best[1], done: true, opt: best[0] };
    return { v: -Math.min(...t.o.map((o) => o[1])), done: false };
  }

  /** Ticket status on p's own network (stations not counted): used for the live ticket list. */
  function ticketDone(G, p, id) {
    const m = mapOf(G);
    return ticketResult(m, m.tickets[id], components(m, ownRoutes(G, p))).done;
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
        const res = ticketResult(m, m.tickets[id], u);
        s += res.v;
        if (res.done) done.push(id);
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

  /** Full scores. Per player: routes, tickets (+done / -failed), stations, bonuses, total; winners after tie-breaks. */
  function score(G) {
    const m = mapOf(G), R = rulesOf(G);
    const rows = [];
    for (let p = 0; p < G.n; p++) {
      const own = ownRoutes(G, p);
      const routes = own.reduce((s, r) => s + routePoints(m.routes[r].len), 0);
      const st = bestStations(G, p, own);
      const done = st.res.done;
      const u = components(m, own.concat(st.borrowed));
      const failed = G.tickets[p].filter((id) => !done.includes(id));
      const plus = done.reduce((s, id) => s + ticketResult(m, m.tickets[id], u).v, 0);
      const minus = -failed.reduce((s, id) => s + ticketResult(m, m.tickets[id], u).v, 0);
      const longest = longestPath(m, own);
      const mandalas = R.bonus.includes('mandala') ? done.filter((id) => {
        const t = m.tickets[id];
        return !isCountryTicket(t) && twoPaths(m, own, t[0], t[1]);
      }).length : 0;
      rows.push({
        p, routes, plus, minus, done, failed, borrowed: st.borrowed,
        stations: G.stations[p] * R.stationPoints, stationsLeft: G.stations[p], longest, mandalas, bonus: {}, total: 0,
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
    // Ties: the map's tie-breaks in order (most tickets done, fewest stations used, longest path).
    const keyOf = (x) => [x.total].concat(R.tie.map((k) => (k === 'tickets' ? x.done.length : k === 'stations' ? x.stationsLeft : x.longest)));
    const cmp = (a, b) => { const ka = keyOf(a), kb = keyOf(b); for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return kb[i] - ka[i]; return 0; };
    const order = rows.slice().sort(cmp);
    const winners = order.filter((x) => cmp(x, order[0]) === 0).map((x) => x.p);
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
    routeBlock, locoAllowed, payCheck, paymentOptions, payOptionsFor, stationCost, stationBlock, stationOptions, tunnelOptions,
    isCountryTicket, nodesOf, ticketPoints, ticketResult, ticketDone, longestPath, twoPaths, components, ufFind, ownRoutes,
    score, routeScore, view, handSize, deckLeft, clone, sum,
  };
});
