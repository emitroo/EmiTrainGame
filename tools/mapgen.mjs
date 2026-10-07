// Builds src/maps.js from the region specs in maps-src/.
//
// A spec lists real cities (longitude/latitude) and the route network as text lines. This script:
//   - projects the cities (Mercator) onto a 1000-unit-wide board and nudges apart any that would overlap;
//   - fills in route lengths from real distances, and colours balanced across the eight card colours;
//   - lays out the train-car slots of every route (bending routes that would cross a city, offsetting doubles);
//   - generates the destination tickets from shortest paths (points = trains on the shortest path);
//   - clips Natural Earth coastlines, lakes and borders to the board (public domain, naturalearthdata.com).
// Usage: node tools/mapgen.mjs        (downloads the Natural Earth files into .cache/ne on first run)
//
// Route line format:  <city> <city> [length] [colour | colour/colour] [t] [fN] [x2] [b±N]
// City entry: [name, longitude, latitude, dx?, dy?] (dx/dy nudge the dot in board units).
//   length   trains (default: from distance and the spec's kmPerTrain)
//   colour   purple white blue yellow orange black red green, or gray; default: balanced automatically
//   t        tunnel;  fN  ferry needing N locomotives;  x2  double route;  b±N  bend the route sideways by N units
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const ROOT = new URL('../', import.meta.url);
const COLORS = ['purple', 'white', 'blue', 'yellow', 'orange', 'black', 'red', 'green'];
const GRAY = -1;
const W = 1000;
const CITY_R = 7;
const CAR_W = 8;
const GAP = 2.2;
const DOUBLE_OFF = 5.4;
const MIN_CITY_DIST = 30;

// ---------- Natural Earth ----------
const NE = new URL('.cache/ne/', ROOT);
const NE_FILES = ['ne_50m_land', 'ne_50m_lakes', 'ne_50m_admin_0_boundary_lines_land'];
function ensureNe() {
  mkdirSync(NE, { recursive: true });
  for (const f of NE_FILES) {
    const p = new URL(f + '.geojson', NE);
    if (existsSync(p)) continue;
    console.log('downloading', f);
    execFileSync('curl', ['-sSfL', '-o', p.pathname, `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/${f}.geojson`]);
  }
  const load = (f) => JSON.parse(readFileSync(new URL(f + '.geojson', NE), 'utf8')).features;
  return { land: load(NE_FILES[0]), lakes: load(NE_FILES[1]), borders: load(NE_FILES[2]) };
}

// ---------- geometry helpers ----------
const rad = (d) => (d * Math.PI) / 180;
const mercY = (lat) => (Math.log(Math.tan(Math.PI / 4 + rad(Math.max(-85, Math.min(85, lat))) / 2)) * 180) / Math.PI;
function km(a, b) {
  const R = 6371, dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const r1 = (v) => Math.round(v * 10) / 10;

function makeProjection(bbox) {
  const [lon0, lat0, lon1, lat1] = bbox;
  const y0 = mercY(lat1), y1 = mercY(lat0);
  const s = W / (lon1 - lon0);
  return { s, h: Math.round((y0 - y1) * s), p: (lon, lat) => [(lon - lon0) * s, (y0 - mercY(lat)) * s] };
}

// Sutherland-Hodgman clip of a closed ring to the rectangle [x0,x1]x[y0,y1].
function clipRing(ring, x0, y0, x1, y1) {
  const edges = [
    [(p) => p[0] >= x0, (a, b) => { const t = (x0 - a[0]) / (b[0] - a[0]); return [x0, a[1] + t * (b[1] - a[1])]; }],
    [(p) => p[0] <= x1, (a, b) => { const t = (x1 - a[0]) / (b[0] - a[0]); return [x1, a[1] + t * (b[1] - a[1])]; }],
    [(p) => p[1] >= y0, (a, b) => { const t = (y0 - a[1]) / (b[1] - a[1]); return [a[0] + t * (b[0] - a[0]), y0]; }],
    [(p) => p[1] <= y1, (a, b) => { const t = (y1 - a[1]) / (b[1] - a[1]); return [a[0] + t * (b[0] - a[0]), y1]; }],
  ];
  let out = ring;
  for (const [inside, cut] of edges) {
    const src = out; out = [];
    if (!src.length) break;
    for (let i = 0; i < src.length; i++) {
      const cur = src[i], prev = src[(i + src.length - 1) % src.length];
      if (inside(cur)) { if (!inside(prev)) out.push(cut(prev, cur)); out.push(cur); }
      else if (inside(prev)) out.push(cut(prev, cur));
    }
  }
  return out;
}

// Liang-Barsky clip of a polyline to the rectangle; returns a list of polylines.
function clipLine(line, x0, y0, x1, y1) {
  const out = []; let cur = [];
  const seg = (a, b) => {
    let t0 = 0, t1 = 1;
    const dx = b[0] - a[0], dy = b[1] - a[1];
    for (const [p, q] of [[-dx, a[0] - x0], [dx, x1 - a[0]], [-dy, a[1] - y0], [dy, y1 - a[1]]]) {
      if (p === 0) { if (q < 0) return null; continue; }
      const r = q / p;
      if (p < 0) { if (r > t1) return null; if (r > t0) t0 = r; } else { if (r < t0) return null; if (r < t1) t1 = r; }
    }
    return [[a[0] + t0 * dx, a[1] + t0 * dy], [a[0] + t1 * dx, a[1] + t1 * dy], t0 > 0, t1 < 1];
  };
  for (let i = 1; i < line.length; i++) {
    const c = seg(line[i - 1], line[i]);
    if (!c) { if (cur.length > 1) out.push(cur); cur = []; continue; }
    if (c[2] || !cur.length) { if (cur.length > 1) out.push(cur); cur = [c[0]]; }
    cur.push(c[1]);
    if (c[3]) { out.push(cur); cur = []; }
  }
  if (cur.length > 1) out.push(cur);
  return out;
}

// Douglas-Peucker simplification.
function simplify(pts, tol, closed) {
  if (pts.length < 4) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1e-9;
    let best = -1, bi = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / L;
      if (d > best) { best = d; bi = i; }
    }
    if (best > tol) { keep[bi] = 1; stack.push([a, bi], [bi, b]); }
  }
  const out = pts.filter((_, i) => keep[i]);
  return closed && out.length < 3 ? [] : out;
}
// Closed ring: split at the point farthest from the start so neither half begins and ends at the same point.
function simplifyRing(ring, tol) {
  let far = 0, best = -1;
  ring.forEach((p, i) => { const d = Math.hypot(p[0] - ring[0][0], p[1] - ring[0][1]); if (d > best) { best = d; far = i; } });
  if (far === 0) return [];
  const a = simplify(ring.slice(0, far + 1), tol, false), b = simplify(ring.slice(far).concat([ring[0]]), tol, false);
  return a.concat(b.slice(1, -1));
}
const ringArea = (r) => { let s = 0; for (let i = 0; i < r.length; i++) { const a = r[i], b = r[(i + 1) % r.length]; s += a[0] * b[1] - b[0] * a[1]; } return Math.abs(s / 2); };
const fmt = (v) => String(Math.round(v * 10) / 10);
const pathOf = (rings, closed) => rings.map((r) => 'M' + r.map((p) => fmt(p[0]) + ' ' + fmt(p[1])).join('L') + (closed ? 'Z' : '')).join('');

function geoLayers(ne, proj, bbox, h) {
  const pad = 160, [x0, y0, x1, y1] = [-pad, -pad, W + pad, h + pad];
  const [lon0, lat0, lon1, lat1] = bbox;
  const near = (coords) => coords.some(([lon, lat]) => lon > lon0 - 40 && lon < lon1 + 40 && lat > lat0 - 25 && lat < lat1 + 25);
  const polys = (features, minArea) => {
    const rings = [];
    for (const f of features) {
      const g = f.geometry; if (!g) continue;
      const list = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
      for (const poly of list) for (const ring of poly) {
        if (!near(ring)) continue;
        const pr = clipRing(ring.map(([lon, lat]) => proj.p(lon, lat)), x0, y0, x1, y1);
        if (pr.length < 3 || ringArea(pr) < minArea) continue;
        const s = simplifyRing(pr, 0.7);
        if (s.length >= 3) rings.push(s);
      }
    }
    return rings;
  };
  const lines = (features) => {
    const out = [];
    for (const f of features) {
      const g = f.geometry; if (!g) continue;
      const list = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : [];
      for (const l of list) {
        if (!near(l)) continue;
        for (const part of clipLine(l.map(([lon, lat]) => proj.p(lon, lat)), x0, y0, x1, y1)) {
          const s = simplify(part, 0.7, false);
          if (s.length > 1) out.push(s);
        }
      }
    }
    return out;
  };
  const bigLakes = ne.lakes.filter((f) => (f.properties.scalerank | 0) <= 3);
  return { land: pathOf(polys(ne.land, 4), true), lakes: pathOf(polys(bigLakes, 20), true), borders: pathOf(lines(ne.borders), false) };
}

// ---------- route parsing ----------
function parseRoutes(text, cityIds) {
  const out = [];
  text.split('\n').forEach((raw, ln) => {
    const line = raw.replace(/#.*/, '').trim();
    if (!line) return;
    const tok = line.split(/\s+/);
    const [a, b] = tok;
    for (const c of [a, b]) if (!cityIds.has(c)) throw new Error(`line ${ln + 1}: unknown city ${c}`);
    const r = { a, b, len: null, colors: [], tunnel: false, ferry: 0, double: false, bend: 0 };
    for (const t of tok.slice(2)) {
      if (/^\d+$/.test(t)) r.len = +t;
      else if (t === 't') r.tunnel = true;
      else if (/^f\d$/.test(t)) r.ferry = +t.slice(1);
      else if (t === 'x2') r.double = true;
      else if (/^b[+-]\d+$/.test(t)) r.bend = +t.slice(1);
      else {
        const cs = t.split('/').map((c) => (c === 'gray' || c === 'g' ? GRAY : c === '?' ? null : COLORS.indexOf(c)));
        if (cs.some((c) => c !== null && c !== GRAY && c < 0)) throw new Error(`line ${ln + 1}: bad token ${t}`);
        r.colors = cs;
      }
    }
    out.push(r);
  });
  return out;
}

const hash = (s) => { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---------- curve sampling ----------
function curve(A, B, bend) {
  const mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2;
  const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy);
  const nx = -dy / L, ny = dx / L;
  const C = [mx + nx * bend * 2, my + ny * bend * 2]; // quadratic control point: apex sits `bend` units off the chord
  const pts = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40, u = 1 - t;
    pts.push([u * u * A[0] + 2 * u * t * C[0] + t * t * B[0], u * u * A[1] + 2 * u * t * C[1] + t * t * B[1]]);
  }
  return pts;
}
function offsetPolyline(pts, off) {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
    return [p[0] - (dy / L) * off, p[1] + (dx / L) * off];
  });
}
function along(pts, d) {
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (d <= L || i === pts.length - 1) {
      const t = Math.min(1, d / (L || 1));
      return { x: a[0] + t * (b[0] - a[0]), y: a[1] + t * (b[1] - a[1]), ang: Math.atan2(b[1] - a[1], b[0] - a[0]) };
    }
    d -= L;
  }
}
const polyLen = (pts) => pts.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0);
const distToSeg = (p, a, b) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
};
const distToPoly = (p, pts) => { let m = Infinity; for (let i = 1; i < pts.length; i++) m = Math.min(m, distToSeg(p, pts[i - 1], pts[i])); return m; };

// Oriented-rectangle overlap (separating axis), slots are [x, y, angleRad, len].
function slotsOverlap(s, t) {
  const corners = (q) => {
    const c = Math.cos(q[2]), si = Math.sin(q[2]), hl = q[3] / 2, hw = CAR_W / 2;
    return [[-hl, -hw], [hl, -hw], [hl, hw], [-hl, hw]].map(([u, v]) => [q[0] + u * c - v * si, q[1] + u * si + v * c]);
  };
  const A = corners(s), B = corners(t);
  for (const q of [s, t]) for (const ang of [q[2], q[2] + Math.PI / 2]) {
    const ax = Math.cos(ang), ay = Math.sin(ang);
    const pa = A.map((p) => p[0] * ax + p[1] * ay), pb = B.map((p) => p[0] * ax + p[1] * ay);
    if (Math.max(...pa) < Math.min(...pb) + 0.6 || Math.max(...pb) < Math.min(...pa) + 0.6) return false;
  }
  return true;
}

// ---------- build one map ----------
function build(spec, ne) {
  const proj = makeProjection(spec.bbox);
  const ids = Object.keys(spec.cities);
  const idx = new Map(ids.map((id, i) => [id, i]));
  const cities = ids.map((id) => {
    const [name, lon, lat, dx, dy] = spec.cities[id];
    const [px, py] = proj.p(lon, lat);
    const x = px + (dx || 0), y = py + (dy || 0); // optional nudge in board units, for crowded corners
    return { id, name, lon, lat, x, y, x0: x, y0: y };
  });
  // Push apart cities that are too close to tap or label.
  for (let it = 0; it < 60; it++) {
    let moved = false;
    for (let i = 0; i < cities.length; i++) for (let j = i + 1; j < cities.length; j++) {
      const a = cities[i], b = cities[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.01;
      if (d >= MIN_CITY_DIST) continue;
      const push = (MIN_CITY_DIST - d) / 2 + 0.1;
      a.x -= (dx / d) * push; a.y -= (dy / d) * push; b.x += (dx / d) * push; b.y += (dy / d) * push;
      moved = true;
    }
    if (!moved) break;
  }
  const warnings = [];
  for (const c of cities) {
    const d = Math.hypot(c.x - c.x0, c.y - c.y0);
    if (d > 6) warnings.push(`moved ${c.id} by ${d.toFixed(1)}`);
  }

  // Routes: expand doubles, lengths from distance.
  const parsed = parseRoutes(spec.routes, new Set(ids));
  const routes = [];
  for (const p of parsed) {
    const A = cities[idx.get(p.a)], B = cities[idx.get(p.b)];
    const len = p.len || Math.max(1, Math.min(8, Math.round(km(A, B) / spec.kmPerTrain)));
    const base = { a: idx.get(p.a), b: idx.get(p.b), len, tunnel: p.tunnel, ferry: p.ferry, bend: p.bend, pair: -1 };
    if (p.ferry && p.ferry > len) throw new Error(`${p.a}-${p.b}: ferry needs more locomotives than its length`);
    if (p.double) {
      const i = routes.length;
      routes.push(Object.assign({}, base, { color: p.colors[0] !== undefined ? p.colors[0] : (p.ferry ? GRAY : null), pair: i + 1, side: -1 }));
      routes.push(Object.assign({}, base, { color: p.colors[1] !== undefined ? p.colors[1] : (p.ferry ? GRAY : null), pair: i, side: 1 }));
    } else {
      routes.push(Object.assign({}, base, { color: p.colors[0] !== undefined ? p.colors[0] : (p.ferry ? GRAY : null), side: 0 }));
    }
  }
  const seen = new Set();
  for (const r of routes) {
    const k = [r.a, r.b].sort().join('-') + ':' + r.side;
    if (seen.has(k)) throw new Error(`${spec.id}: duplicate route ${ids[r.a]}-${ids[r.b]}`);
    seen.add(k);
  }

  // Colours: a share of single routes stays gray; the rest are balanced by total trains per colour, avoiding
  // the same colour twice on a double route or on routes that meet at a city.
  const R = rng(hash(spec.id));
  const auto = routes.filter((r) => r.color === null);
  const singles = auto.filter((r) => r.pair < 0).sort((x, y) => hash(spec.id + x.a + '-' + x.b) - hash(spec.id + y.a + '-' + y.b));
  const grayShare = spec.grayShare != null ? spec.grayShare : 0.24;
  const wantGray = Math.round(routes.filter((r) => r.pair < 0).length * grayShare) - routes.filter((r) => r.color === GRAY && r.pair < 0).length;
  for (let i = 0; i < Math.max(0, wantGray) && i < singles.length; i++) if (singles[i].len <= 4 || i % 3 === 0) singles[i].color = GRAY;
  const used = Array(8).fill(0);
  for (const r of routes) if (r.color != null && r.color >= 0) used[r.color] += r.len;
  const order = routes.map((r, i) => i).filter((i) => routes[i].color === null).sort((x, y) => routes[y].len - routes[x].len || x - y);
  for (const i of order) {
    const r = routes[i];
    let best = -1, bestScore = Infinity;
    for (let c = 0; c < 8; c++) {
      let sc = used[c] + R() * 1.5;
      if (r.pair >= 0 && routes[r.pair].color === c) sc += 1e6;
      for (const o of routes) if (o !== r && o.color === c && (o.a === r.a || o.a === r.b || o.b === r.a || o.b === r.b)) sc += 5;
      if (sc < bestScore) { bestScore = sc; best = c; }
    }
    r.color = best;
    used[best] += r.len;
  }

  // Geometry: curves first, then where each route's cars start and end at its two cities.
  const P = (i) => [cities[i].x, cities[i].y];
  for (const r of routes) {
    const A = P(r.a), B = P(r.b);
    let bend = r.bend;
    if (!bend) {
      // Bend away from any city the straight line would run over.
      for (let it = 0; it < 6; it++) {
        const pts = curve(A, B, bend);
        let worst = null;
        cities.forEach((c, k) => {
          if (k === r.a || k === r.b) return;
          const d = distToPoly([c.x, c.y], pts);
          if (d < CITY_R + 10 && (!worst || d < worst.d)) worst = { d, c };
        });
        if (!worst) break;
        const dx = B[0] - A[0], dy = B[1] - A[1];
        const side = (worst.c.x - A[0]) * -dy + (worst.c.y - A[1]) * dx > 0 ? -1 : 1;
        bend += side * (CITY_R + 12 - worst.d + 4);
      }
    }
    r.center = curve(A, B, bend);
    r.path = r.side ? offsetPolyline(r.center, r.side * DOUBLE_OFF) : r.center;
  }
  // Routes leaving a city at a narrow angle start their cars further out, where they no longer touch.
  const headings = (city) => routes.map((r, i) => {
    if (r.a !== city && r.b !== city) return null;
    const pts = r.a === city ? r.center : r.center.slice().reverse();
    return { i, ang: Math.atan2(pts[3][1] - pts[0][1], pts[3][0] - pts[0][0]), w: r.pair >= 0 ? CAR_W + 2 * DOUBLE_OFF : CAR_W };
  }).filter(Boolean);
  const startAt = new Map();
  cities.forEach((c, ci) => {
    const hs = headings(ci);
    for (const h of hs) {
      let need = CITY_R + 2.5;
      for (const o of hs) {
        if (o.i === h.i || o.i === routes[h.i].pair) continue;
        let d = Math.abs(h.ang - o.ang); if (d > Math.PI) d = 2 * Math.PI - d;
        if (d >= Math.PI / 2) continue;
        need = Math.max(need, ((h.w + o.w) / 2 + 1.5) / Math.sin(Math.max(d, 0.05)));
      }
      startAt.set(h.i + ':' + ci, need);
    }
  });
  for (const r of routes) {
    const pts = r.path, total = polyLen(pts);
    const i = routes.indexOf(r);
    const cap = total * 0.3;
    const sA = Math.min(cap, startAt.get(i + ':' + r.a)), sB = Math.min(cap, startAt.get(i + ':' + r.b));
    const usable = total - sA - sB;
    const car = (usable - (r.len - 1) * GAP) / r.len;
    if (car < 9) warnings.push(`crowded ${ids[r.a]}-${ids[r.b]} car ${car.toFixed(1)}`);
    // Long stretches keep cars at a sensible size and spread them out with wider gaps.
    const carL = Math.min(car, r.len === 1 ? 36 : 34);
    const gap = r.len > 1 ? (usable - carL * r.len) / (r.len - 1) : 0;
    const d0 = sA + (r.len === 1 ? usable / 2 : carL / 2);
    r.slots = [];
    for (let k = 0; k < r.len; k++) {
      const q = along(pts, d0 + k * (carL + gap));
      r.slots.push([q.x, q.y, q.ang, carL]);
    }
  }
  // Report overlapping cars from different routes.
  for (let i = 0; i < routes.length; i++) for (let j = i + 1; j < routes.length; j++) {
    if (routes[i].pair === j) continue;
    const hit = routes[i].slots.some((s) => routes[j].slots.some((t) => slotsOverlap(s, t)));
    if (hit) warnings.push(`overlap ${ids[routes[i].a]}-${ids[routes[i].b]} x ${ids[routes[j].a]}-${ids[routes[j].b]}`);
  }

  // Shortest paths in trains (Floyd-Warshall).
  const n = cities.length;
  const D = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 0 : Infinity)));
  for (const r of routes) { D[r.a][r.b] = Math.min(D[r.a][r.b], r.len); D[r.b][r.a] = D[r.a][r.b]; }
  for (let k = 0; k < n; k++) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (D[i][k] + D[k][j] < D[i][j]) D[i][j] = D[i][k] + D[k][j];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (D[i][j] === Infinity) throw new Error(`${spec.id}: ${ids[i]} and ${ids[j]} are not connected`);
  const direct = new Set(routes.map((r) => r.a + '-' + r.b).concat(routes.map((r) => r.b + '-' + r.a)));

  // Tickets: evenly spread values across the range, spreading cities around.
  const T = spec.tickets;
  const uses = Array(n).fill(0);
  const chosen = new Set();
  const tickets = [];
  const pick = (count, lo, hi, long) => {
    const cands = [];
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (D[i][j] >= lo && D[i][j] <= hi && !direct.has(i + '-' + j)) cands.push([i, j, D[i][j]]);
    if (!cands.length) throw new Error(`${spec.id}: no ticket candidates in ${lo}-${hi}`);
    const longUsed = new Set();
    for (let k = 0; k < count; k++) {
      const target = lo + ((hi - lo) * (k + 0.5)) / count;
      let best = null, bestScore = Infinity;
      for (const c of cands) {
        const key = c[0] + '-' + c[1];
        if (chosen.has(key)) continue;
        if (long && (longUsed.has(c[0]) || longUsed.has(c[1]))) continue;
        const sc = Math.abs(c[2] - target) * 1.2 + (uses[c[0]] + uses[c[1]]) * 2.2 + R() * 2.5;
        if (sc < bestScore) { bestScore = sc; best = c; }
      }
      if (!best) break;
      chosen.add(best[0] + '-' + best[1]);
      uses[best[0]]++; uses[best[1]]++;
      if (long) { longUsed.add(best[0]); longUsed.add(best[1]); }
      tickets.push({ a: best[0], b: best[1], pts: best[2], long: !!long });
    }
  };
  if (T.list) {
    // A fixed ticket deck: points as printed; flag any that differ from the shortest path, which catches route typos.
    for (const [a, b, pts, long] of T.list) {
      const ia = idx.get(a), ib = idx.get(b);
      if (ia == null || ib == null) throw new Error(`${spec.id}: ticket ${a}-${b} names an unknown city`);
      if (D[ia][ib] !== pts) warnings.push(`ticket ${a}-${b}: ${pts} pts, shortest path ${D[ia][ib]}`);
      tickets.push({ a: ia, b: ib, pts, long: !!long });
    }
  }
  if (T.long) pick(T.long, T.longRange[0], T.longRange[1], true);
  for (const [cnt, lo, hi] of T.bands || []) pick(cnt, lo, hi, false);
  tickets.sort((x, y) => (x.long - y.long) || x.pts - y.pts || x.a - y.a);

  // City labels: try eight spots around each city and keep the least crowded.
  const fs = 11;
  const placed = [];
  const allSlots = routes.flatMap((r) => r.path.filter((_, k) => k % 2 === 0));
  const labels = cities.map((c) => {
    const w = c.name.length * fs * 0.56 + 4, h = fs + 2;
    let best = null, bestScore = Infinity;
    const spots = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]];
    spots.forEach(([sx, sy], k) => {
      const cx = c.x + sx * (CITY_R + 3 + (sx ? w / 2 : 0)), cy = c.y + sy * (CITY_R + 3 + h / 2) + (sy === 0 ? 0 : 0);
      const box = [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2];
      let sc = k * 0.3;
      if (box[0] < 0 || box[2] > W || box[1] < 0 || box[3] > proj.h) sc += 100;
      for (const s of allSlots) if (s[0] > box[0] - 4 && s[0] < box[2] + 4 && s[1] > box[1] - 4 && s[1] < box[3] + 4) sc += 3;
      for (const o of cities) if (o !== c && o.x > box[0] - CITY_R && o.x < box[2] + CITY_R && o.y > box[1] - CITY_R && o.y < box[3] + CITY_R) sc += 20;
      for (const b of placed) if (!(box[2] < b[0] || box[0] > b[2] || box[3] < b[1] || box[1] > b[3])) sc += 25;
      if (sc < bestScore) { bestScore = sc; best = { box, x: cx, y: cy + fs * 0.36 }; }
    });
    placed.push(best.box);
    return [r1(best.x), r1(best.y)];
  });

  const geo = geoLayers(ne, proj, spec.bbox, proj.h);
  const colorTrains = Array(8).fill(0);
  routes.forEach((r) => { if (r.color >= 0) colorTrains[r.color] += r.len; });

  return {
    warnings,
    stats: { cities: n, routes: routes.length, trains: routes.reduce((s, r) => s + r.len, 0), gray: routes.filter((r) => r.color === GRAY).length, colorTrains, tickets: tickets.length },
    data: {
      id: spec.id, name: spec.name, blurb: spec.blurb, rules: spec.rules || {}, w: W, h: proj.h,
      land: geo.land, lakes: geo.lakes, borders: geo.borders,
      cities: cities.map((c, i) => ({ id: c.id, name: c.name, x: r1(c.x), y: r1(c.y), lx: labels[i][0], ly: labels[i][1] })),
      routes: routes.map((r) => ({
        a: r.a, b: r.b, len: r.len, color: r.color, tunnel: r.tunnel || undefined, ferry: r.ferry || undefined, pair: r.pair,
        slots: r.slots.map((s) => [r1(s[0]), r1(s[1]), Math.round((s[2] * 180) / Math.PI), r1(s[3])]),
        hit: [r.path[0], r.path[10], r.path[20], r.path[30], r.path[40]].map((p) => [r1(p[0]), r1(p[1])]),
      })),
      tickets: tickets.map((t) => (t.long ? [t.a, t.b, t.pts, 1] : [t.a, t.b, t.pts])),
    },
  };
}

// ---------- main ----------
const ne = ensureNe();
const order = ['europe', 'usa', 'nordic', 'britain', 'india'];
const files = readdirSync(new URL('maps-src/', ROOT)).filter((f) => f.endsWith('.mjs')).map((f) => f.replace('.mjs', ''));
const ids = order.filter((id) => files.includes(id)).concat(files.filter((f) => !order.includes(f)).sort());
const all = {};
let problems = 0;
for (const id of ids) {
  const spec = (await import(new URL(`maps-src/${id}.mjs`, ROOT))).default;
  const { data, warnings, stats } = build(spec, ne);
  all[id] = data;
  console.log(`${id}: ${JSON.stringify(stats)}`);
  for (const w of warnings) { console.log('  ! ' + w); if (!/^moved/.test(w)) problems++; }
}
const json = JSON.stringify(all);
const out = `/* Generated by tools/mapgen.mjs from maps-src/*.mjs. Do not edit by hand.
 * Coastlines, lakes and borders: Natural Earth 1:50m (public domain). */
(function (root, factory) {
  const M = factory();
  if (typeof module === 'object' && module.exports) module.exports = M;
  else root.TrainMaps = M;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const MAPS = ${json};
  const list = ${JSON.stringify(ids)};
  return { list, get: (id) => MAPS[id] || null, all: MAPS };
});
`;
writeFileSync(new URL('src/maps.js', ROOT), out);
console.log(`src/maps.js ${(out.length / 1024).toFixed(1)} KB${problems ? `, ${problems} layout warnings` : ''}`);
