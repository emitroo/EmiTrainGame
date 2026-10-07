/* CPU players. choose(G, p, level) returns one legal action for player p, who must be one of E.actors(G).
 *
 * Every level plans the same way: the cheapest paths (in trains still to lay) joining the cities of its unfinished
 * tickets, reusing its own routes and earlier paths. It then claims a planned route when it holds the cards, or draws
 * the colours that plan still needs. Levels differ in ticket choices, card drawing and endgame play:
 *   easy   keeps the fewest tickets, draws loosely, never takes more tickets or builds stations;
 *   normal takes more tickets once its plan is done, uses stations to get past a blocked route;
 *   hard   chooses tickets for overlap, grabs locomotives, races to finish and spends spare trains on points.
 */
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const AI = factory(isNode ? require('./engine.js') : root.TrainEngine);
  if (isNode) module.exports = AI;
  else root.TrainAI = AI;
})(typeof self !== 'undefined' ? self : this, function (E) {
  'use strict';
  const LOCO = E.LOCO, GRAY = E.GRAY;

  // Small deterministic jitter per game state, so CPU turns don't use the game's own random generator.
  function jitter(G, p, salt) {
    let h = (G.seq * 2654435761 + p * 40503 + salt * 97) >>> 0;
    h ^= h >>> 15; h = Math.imul(h, 2246822519); h ^= h >>> 13;
    return (h >>> 0) / 4294967296;
  }

  /** Cost in trains of each route for player p: 0 if theirs, Infinity if unusable. */
  function routeCosts(G, p, borrowOk) {
    const m = E.mapOf(G);
    const myStations = new Set(G.stationAt.map((o, c) => (o === p ? c : -1)).filter((c) => c >= 0));
    return m.routes.map((rt, r) => {
      const o = G.owner[r];
      if (o === p) return 0;
      if (o >= 0) {
        if (myStations.has(rt.a) || myStations.has(rt.b)) return 0.5; // usable through one of our stations
        return borrowOk ? rt.len + 4 : Infinity;
      }
      if (E.routeBlock(G, p, r) === 'double-own' || E.routeBlock(G, p, r) === 'double-closed') return Infinity;
      return rt.len + (rt.tunnel ? 0.6 : 0) + (rt.ferry || 0) * 0.5;
    });
  }

  /** Dijkstra from a to b over route costs; returns { cost, routes } or null. */
  function cheapest(m, cost, a, b) {
    const n = m.cities.length, dist = Array(n).fill(Infinity), via = Array(n).fill(-1), done = new Uint8Array(n);
    const adj = adjacency(m);
    dist[a] = 0;
    for (;;) {
      let u = -1;
      for (let i = 0; i < n; i++) if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
      if (u < 0 || u === b) break;
      done[u] = 1;
      for (const [v, r] of adj[u]) {
        const d = dist[u] + cost[r];
        if (d < dist[v]) { dist[v] = d; via[v] = r; }
      }
    }
    if (dist[b] === Infinity) return null;
    const routes = [];
    for (let c = b; c !== a;) { const r = via[c]; routes.push(r); const rt = m.routes[r]; c = rt.a === c ? rt.b : rt.a; }
    return { cost: dist[b], routes };
  }
  const adjCache = new Map();
  function adjacency(m) {
    if (adjCache.has(m.id)) return adjCache.get(m.id);
    const adj = m.cities.map(() => []);
    m.routes.forEach((rt, r) => { adj[rt.a].push([rt.b, r]); adj[rt.b].push([rt.a, r]); });
    adjCache.set(m.id, adj);
    return adj;
  }

  /** Plan: unclaimed routes on the paths for p's unfinished tickets (most valuable first, sharing paths). */
  function plan(G, p, tickets) {
    const m = E.mapOf(G);
    const cost = routeCosts(G, p, false);
    const ids = (tickets || G.tickets[p]).filter((id) => id >= 0).slice().sort((x, y) => m.tickets[y][2] - m.tickets[x][2]);
    const need = new Set(), hopeless = [];
    let trains = 0;
    for (const id of ids) {
      const t = m.tickets[id];
      const res = cheapest(m, cost, t[0], t[1]);
      if (!res) { hopeless.push(id); continue; }
      for (const r of res.routes) if (G.owner[r] < 0 && !need.has(r)) { need.add(r); trains += m.routes[r].len; cost[r] = 0; }
    }
    return { need: Array.from(need), hopeless, trains, cost };
  }

  /** How many more cards of each colour the plan still needs (gray routes counted separately). */
  function colourNeeds(G, p, routes) {
    const m = E.mapOf(G), want = Array(9).fill(0);
    let gray = 0;
    for (const r of routes) { const rt = m.routes[r]; if (rt.color === GRAY) gray += rt.len; else want[rt.color] += rt.len; }
    const hand = G.hands[p];
    const deficit = want.map((w, c) => Math.max(0, w - hand[c]));
    return { want, deficit, gray };
  }

  // ---------- tickets ----------
  function chooseTickets(G, p, level) {
    const m = E.mapOf(G), offer = G.offer[p], min = G.keepMin[p];
    const R = E.rulesOf(G);
    if (level === 'easy') {
      const sorted = offer.slice().sort((x, y) => m.tickets[x][2] - m.tickets[y][2]);
      return { k: 'keep', ids: sorted.slice(0, min) };
    }
    const owned = G.tickets[p].filter((x) => x >= 0);
    // Greedily add the ticket that raises the planned trains least per point, while the plan still fits.
    const chosen = [];
    const midGame = G.phase === 'play';
    const budget = G.trains[p] - (midGame ? 6 : 14);
    const maxRatio = midGame ? 0.6 : 0.7;
    const pool = offer.slice();
    while (pool.length) {
      const cur = plan(G, p, owned.concat(chosen)).trains;
      let best = null;
      for (const id of pool) {
        const pl = plan(G, p, owned.concat(chosen, [id]));
        const dead = pl.hopeless.includes(id);
        const ratio = dead ? Infinity : (pl.trains - cur) / m.tickets[id][2];
        if (!best || ratio < best.ratio || (ratio === best.ratio && m.tickets[id][2] < m.tickets[best.id][2])) best = { id, ratio, trains: dead ? Infinity : pl.trains };
      }
      const mustTake = chosen.length < min;
      const fits = best.trains <= budget && best.ratio <= maxRatio;
      if (!mustTake && !fits) break;
      chosen.push(best.id);
      pool.splice(pool.indexOf(best.id), 1);
      if (!mustTake && G.phase === 'play' && chosen.length >= 2) break;
    }
    return { k: 'keep', ids: chosen };
  }

  // ---------- paying ----------
  /** Best payment: fewest locomotives, then the colour the rest of the plan needs least. */
  function bestPay(G, p, opts, needs) {
    const hand = G.hands[p];
    let best = null, bs = Infinity;
    for (const o of opts) {
      const spare = o.c >= 0 ? hand[o.c] - (needs ? needs.want[o.c] : 0) : 0;
      const s = o.l * 10 - spare + (o.c < 0 ? 5 : 0);
      if (s < bs) { bs = s; best = o; }
    }
    return best;
  }

  // ---------- main ----------
  function choose(G, p, level) {
    level = level || 'normal';
    const m = E.mapOf(G), R = E.rulesOf(G);
    if (G.offer[p]) return chooseTickets(G, p, level);
    const step = G.step;

    if (step && step.tunnel) {
      const T = step.tunnel, hand = G.hands[p];
      const have = (T.c >= 0 ? hand[T.c] : 0) + hand[LOCO];
      const ok = T.c >= 0 ? have >= T.extra : hand[LOCO] >= T.extra;
      return ok ? { k: 'tunnel', pay: true } : { k: 'tunnel', pay: false };
    }

    const pl = plan(G, p);
    const needs = colourNeeds(G, p, pl.need);

    if (step && step.drew) return drawCard(G, p, level, needs, true) || { k: 'pass' };

    const lastRound = G.lastFrom >= 0;
    const raceOn = lastRound || Math.min(...G.trains) <= 7;

    // 1. Claim a planned route we can pay for: longest first (hardest to collect cards for).
    // A tunnel only with spare matching cards in hand, or the CPU can keep failing the same tunnel.
    const spareFor = (r, o) => (o.c >= 0 ? G.hands[p][o.c] : 0) + G.hands[p][LOCO] - m.routes[r].len;
    const claimable = pl.need.map((r) => ({ r, opts: E.paymentOptions(G, p, r) }))
      .filter((x) => x.opts.length && (!m.routes[x.r].tunnel || raceOn || x.opts.some((o) => spareFor(x.r, o) >= 1)));
    if (claimable.length && (level !== 'easy' || jitter(G, p, 1) < 0.8)) {
      claimable.sort((x, y) => m.routes[y.r].len - m.routes[x.r].len || (m.routes[x.r].color === GRAY) - (m.routes[y.r].color === GRAY));
      // Hard: first the route whose loss would hurt most (fewest good detours), before someone takes it.
      if (level === 'hard' && claimable.length > 1) {
        const crit = (r) => {
          const saved = G.owner[r];
          G.owner[r] = (p + 1) % G.n;
          const alt = plan(G, p);
          G.owner[r] = saved;
          return alt.hopeless.length * 50 + alt.trains - pl.trains;
        };
        claimable.forEach((x) => { x.crit = crit(x.r); });
        claimable.sort((x, y) => y.crit - x.crit || m.routes[y.r].len - m.routes[x.r].len);
      }
      const pick = claimable[0];
      const pay = bestPay(G, p, pick.opts, colourNeeds(G, p, pl.need.filter((r) => r !== pick.r)));
      return { k: 'claim', r: pick.r, c: pay.c, l: pay.l };
    }

    // 2. A blocked ticket: build a station next to the route that gets us past the block.
    if (level !== 'easy' && R.stations && G.stations[p] > 0 && pl.hopeless.length) {
      const cost = routeCosts(G, p, true);
      for (const id of pl.hopeless) {
        const t = m.tickets[id], res = cheapest(m, cost, t[0], t[1]);
        if (!res) continue;
        const borrowed = res.routes.filter((r) => G.owner[r] >= 0 && G.owner[r] !== p);
        if (borrowed.length !== 1) continue;
        const rt = m.routes[borrowed[0]];
        for (const city of [rt.a, rt.b]) {
          const opts = E.stationOptions(G, p, city);
          if (opts.length) { const pay = bestPay(G, p, opts, needs); return { k: 'station', city, c: pay.c, l: pay.l }; }
        }
      }
    }

    // 3. Plan finished: take more tickets while there are trains to spare, or spend trains on points.
    const planDone = pl.need.length === 0;
    const othersLeft = Math.min(...G.trains.filter((_, q) => q !== p));
    if (planDone && level !== 'easy' && !raceOn && G.trains[p] >= 18 && othersLeft >= 14 && G.tdeck.length) return { k: 'tickets' };
    if (planDone || raceOn) {
      const spend = bestPointsClaim(G, p, pl.need, raceOn || planDone ? 1 : 3);
      if (spend) return spend;
    }

    // 4. Draw cards for the plan.
    const draw = drawCard(G, p, level, needs, false);
    if (draw) return draw;

    // 5. Nothing to draw: claim anything affordable, take tickets, or pass.
    const any = bestPointsClaim(G, p, pl.need, 1);
    if (any) return any;
    if (G.tdeck.length) return { k: 'tickets' };
    if (R.stations && G.stations[p] > 0) {
      for (let c = 0; c < m.cities.length; c++) { const o = E.stationOptions(G, p, c); if (o.length) return { k: 'station', city: c, c: o[0].c, l: o[0].l }; }
    }
    return { k: 'pass' };
  }

  /** Highest-scoring affordable route of at least minLen, preferring ones that touch our network. */
  function bestPointsClaim(G, p, planned, minLen) {
    const m = E.mapOf(G);
    const mine = new Set();
    G.owner.forEach((o, r) => { if (o === p) { mine.add(m.routes[r].a); mine.add(m.routes[r].b); } });
    let best = null, bs = -Infinity;
    m.routes.forEach((rt, r) => {
      if (rt.len < minLen) return;
      const opts = E.paymentOptions(G, p, r);
      if (!opts.length) return;
      if (rt.tunnel && !opts.some((o) => (o.c >= 0 ? G.hands[p][o.c] : 0) + G.hands[p][LOCO] > rt.len) && G.lastFrom < 0) return;
      const pay = bestPay(G, p, opts, colourNeeds(G, p, planned.filter((x) => x !== r)));
      const s = E.routePoints(rt.len) + (mine.has(rt.a) || mine.has(rt.b) ? 2 : 0) - pay.l * 2 + (planned.includes(r) ? 5 : 0);
      if (s > bs) { bs = s; best = { k: 'claim', r, c: pay.c, l: pay.l }; }
    });
    return best;
  }

  function drawCard(G, p, level, needs, second) {
    const market = G.market;
    const can = (slot) => E.canTakeCard(G, slot);
    // Face-up colour we need most.
    let bestSlot = -2, bestNeed = 0;
    market.forEach((c, i) => {
      if (c < 0 || c === LOCO || !can(i)) return;
      let v = needs.deficit[c];
      if (!v && needs.gray) v = 0.5;
      if (level === 'easy') v += jitter(G, p, i) * 2;
      if (v > bestNeed) { bestNeed = v; bestSlot = i; }
    });
    if (bestSlot >= 0) return { k: 'card', slot: bestSlot };
    if (!second && level !== 'easy') {
      const loco = market.findIndex((c, i) => c === LOCO && can(i));
      const totalDeficit = needs.deficit.reduce((s, x) => s + x, 0) + needs.gray;
      if (loco >= 0 && totalDeficit >= 6 && jitter(G, p, 9) < (level === 'hard' ? 0.7 : 0.5)) return { k: 'card', slot: loco };
    }
    if (can(-1)) return { k: 'card', slot: -1 };
    const anyFace = market.findIndex((c, i) => c >= 0 && can(i));
    if (anyFace >= 0) return { k: 'card', slot: anyFace };
    return null;
  }

  return { choose, plan, cheapest, routeCosts, chooseTickets };
});
