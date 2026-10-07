/* The board: an SVG map that can be panned and pinch-zoomed, with taps on routes and cities.
 * Static layers (sea, land, routes, cities) are drawn once per map; claims, stations and highlights are redrawn
 * on every update in a separate layer. Hit testing is geometric, so tapping works at any zoom level. */
(function (root) {
  'use strict';

  // The Europe board's palette: lilac, white, sky blue, yellow, orange, slate black, red and lime green; silver gray.
  // Player trains as in the box: red, blue, green, yellow, black.
  const CARD_COLORS = ['#b17cc8', '#f5f4ef', '#2e9ad6', '#f1d33b', '#ec962b', '#3b3e44', '#cf2f2b', '#74b342'];
  const GRAY = '#c9c9c4';
  const PLAYER_COLORS = ['#d8352b', '#2c62c8', '#2c9b4c', '#f2c41c', '#34312d'];
  const PLAYER_DARK = ['#6e1610', '#14336f', '#14532a', '#7a5d00', '#0d0c0b'];
  const NS = 'http://www.w3.org/2000/svg';
  const FRAME = 34; // the board's border, carrying the score track (for a 1000-unit board; scaled with the map)
  const frameOf = (m) => Math.round(FRAME * Math.max(m.w, m.h) / 1000);

  const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const slotRect = (s, cls, fill, extra) => `<rect class="${cls}" x="${-s[3] / 2}" y="-4" width="${s[3]}" height="8" rx="1.8" transform="translate(${s[0]} ${s[1]}) rotate(${s[2]})" fill="${fill}"${extra || ''}/>`;

  // Small symbols on each route space (one per colour, as on the board, so colours are readable for everyone).
  const SYMBOLS = [
    'M0-3.2 3.2 0 0 3.2-3.2 0z', 'M0-2.9a2.9 2.9 0 110 5.8 2.9 2.9 0 010-5.8zm0 1.4a1.5 1.5 0 100 3 1.5 1.5 0 000-3z',
    'M0-3.2 3 2.4H-3z', 'M0-3.4l1 2.2 2.4.3-1.8 1.6.5 2.4L0 2 -2.1 3.1l.5-2.4-1.8-1.6 2.4-.3z', 'M0-2.4a2.4 2.4 0 110 4.8 2.4 2.4 0 010-4.8z',
    'M-2.5-2.5h5v5h-5z', 'M0 3-2.8 0A1.6 1.6 0 010-2.2 1.6 1.6 0 012.8 0z', 'M0-3.2a1.4 1.4 0 011.2 2.2 1.4 1.4 0 11-.6 2.3V3h-1.2V1.3a1.4 1.4 0 11-.6-2.3A1.4 1.4 0 010-3.2z',
  ];
  const LOCO_MINI = 'M-4.6 2 -3.4.4h.6V-.6h4.6V2zM-2.6-.6V-2.4h1.2V-.6zM1.8-2.6h2.6V2H1.8z';

  // Textures of the printed board: icy swirls on the sea, mottled parchment on the land; amber city balls.
  const DEFS = `<defs>
    <pattern id="sea-swirl" width="140" height="90" patternUnits="userSpaceOnUse">
      <path d="M6 20c10-9 22-9 30 0s20 8 28-1M74 54c9-8 20-8 28 0s19 7 26-1M18 70c7-6 15-6 21 0M96 18c6-5 13-5 18 0" fill="none" stroke="#fff" stroke-width="1.3" stroke-linecap="round" opacity=".75"/>
      <path d="M40 40c8-6 16-6 23 0M110 78c6-5 12-5 17 0M0 52c5-4 10-4 14 0" fill="none" stroke="#b7ccd6" stroke-width=".9" stroke-linecap="round" opacity=".8"/>
    </pattern>
    <radialGradient id="mottle"><stop offset="0" stop-color="#a98256" stop-opacity=".26"/><stop offset="1" stop-color="#a98256" stop-opacity="0"/></radialGradient>
    <radialGradient id="mottle-l"><stop offset="0" stop-color="#fff8e8" stop-opacity=".5"/><stop offset="1" stop-color="#fff8e8" stop-opacity="0"/></radialGradient>
    <pattern id="parchment" width="220" height="200" patternUnits="userSpaceOnUse">
      <circle cx="40" cy="50" r="46" fill="url(#mottle)"/><circle cx="160" cy="30" r="38" fill="url(#mottle-l)"/><circle cx="130" cy="130" r="56" fill="url(#mottle)"/>
      <circle cx="30" cy="160" r="40" fill="url(#mottle-l)"/><circle cx="200" cy="170" r="34" fill="url(#mottle)"/><circle cx="90" cy="100" r="28" fill="url(#mottle-l)"/>
      <path d="M20 120l8-6 7 5 9-8M150 70l6-5 6 4 7-6M70 180l7-5 6 4" fill="none" stroke="#9c7a52" stroke-width=".8" opacity=".35"/>
    </pattern>
    <radialGradient id="city-ball" cx="38%" cy="35%" r="70%"><stop offset="0" stop-color="#ffe7a3"/><stop offset=".45" stop-color="#f49a1f"/><stop offset="1" stop-color="#9e4a08"/></radialGradient>
    <radialGradient id="medal" cx="40%" cy="35%" r="75%"><stop offset="0" stop-color="#3b7396"/><stop offset=".6" stop-color="#1b4a68"/><stop offset="1" stop-color="#0f2c40"/></radialGradient>
    <pattern id="frame-pat" width="14" height="14" patternUnits="userSpaceOnUse"><rect width="14" height="14" fill="#f2e9d6"/><path d="M7 2.5 9.5 7 7 11.5 4.5 7z" fill="#b5532c" opacity=".55"/><circle cx="0" cy="0" r="1.4" fill="#b5532c" opacity=".45"/><circle cx="14" cy="14" r="1.4" fill="#b5532c" opacity=".45"/></pattern>
    <radialGradient id="vignette" cx="50%" cy="50%" r="72%"><stop offset="65%" stop-color="#5b3a1a" stop-opacity="0"/><stop offset="100%" stop-color="#5b3a1a" stop-opacity="0.18"/></radialGradient>
    <linearGradient id="car-sheen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.35"/><stop offset="0.45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.18"/></linearGradient>
    ${SYMBOLS.map((d, k) => `<symbol id="sym${k}" viewBox="-5 -5 10 10" overflow="visible"><path d="${d}"/></symbol>`).join('')}
    <symbol id="sym-loco" viewBox="-5 -5 10 10" overflow="visible"><path d="${LOCO_MINI}"/></symbol>
  </defs>`;

  /** The board's frame: a patterned border with the 0-99 score track of navy medallions. */
  function frame(m) {
    const W = m.w, H = m.h, F = frameOf(m), t = F / 2;
    const x0 = -t, y0 = -t, x1 = W + t, y1 = H + t, sides = [x1 - x0, y1 - y0, x1 - x0, y1 - y0];
    const per = sides.reduce((a, b) => a + b, 0), step = per / 100, r = Math.min(F * 0.38, step * 0.4);
    let s = `<path class="frame-band" fill-rule="evenodd" d="M${-F} ${-F}H${W + F}V${H + F}H${-F}Z M0 0V${H}H${W}V0Z"/>`
      + `<rect x="${-F + 1.5}" y="${-F + 1.5}" width="${W + 2 * F - 3}" height="${H + 2 * F - 3}" class="frame-out"/><rect x="-1" y="-1" width="${W + 2}" height="${H + 2}" class="frame-in"/>`;
    const pos = [];
    for (let i = 0; i < 100; i++) {
      let d = i * step, x, y;
      if (d < sides[0]) { x = x0 + d; y = y0; } else if ((d -= sides[0]) < sides[1]) { x = x1; y = y0 + d; } else if ((d -= sides[1]) < sides[2]) { x = x1 - d; y = y1; } else { d -= sides[2]; x = x0; y = y1 - d; }
      pos.push([x, y]);
    }
    pos.forEach(([x, y], i) => {
      s += `<g class="medal" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><circle r="${r.toFixed(1)}"/><text y="${(r * 0.36).toFixed(1)}" font-size="${(r * 0.95).toFixed(1)}">${i}</text></g>`;
    });
    return { svg: s, pos, r };
  }

  /** A sea corner free of routes and cities for the route-points cartouche. */
  function cartouche(m) {
    const w = 150, h = 116, pad = 14;
    const spots = [[pad, pad], [m.w - w - pad, pad], [pad, m.h - h - pad], [m.w - w - pad, m.h - h - pad], [m.w / 2 - w / 2, pad]];
    let best = null, bs = Infinity;
    for (const [x, y] of spots) {
      let sc = 0;
      for (const c of m.cities) if (c.x > x - 16 && c.x < x + w + 16 && c.y > y - 16 && c.y < y + h + 16) sc += 10;
      for (const r of m.routes) for (const q of r.slots) if (q[0] > x - 8 && q[0] < x + w + 8 && q[1] > y - 8 && q[1] < y + h + 8) sc += 3;
      if (sc < bs) { bs = sc; best = [x, y]; }
    }
    if (bs > 6) return '';
    const lens = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((k) => m.routes.some((r) => r.len === k));
    const pts = [0, 1, 2, 4, 7, 10, 15, 18, 21, 27];
    const rowH = (h - 16) / lens.length;
    let s = `<g class="cartouche" transform="translate(${best[0]} ${best[1]})"><rect width="${w}" height="${h}" rx="6" class="ct-box"/><rect x="4" y="4" width="${w - 8}" height="${h - 8}" rx="4" class="ct-in"/>`;
    lens.forEach((k, i) => {
      const y = 10 + i * rowH + rowH / 2;
      s += `<text x="12" y="${y + 3.5}" class="ct-n">${k}</text>`;
      for (let j = 0; j < k; j++) s += `<rect x="${24 + j * 9.4}" y="${y - 3}" width="8" height="6" rx="1" class="ct-car"/>`;
      s += `<text x="${w - 12}" y="${y + 3.5}" class="ct-p">${pts[k]}</text>`;
    });
    return s + '</g>';
  }

  // Pastel washes for countries, like the hand-tinted maps of the period (Natural Earth's 7-colour scheme).
  const TINTS = ['#e9d2a0', '#dfd8a8', '#e6c9a6', '#d8cfa0', '#ead9b4', '#d9c49a', '#e3d5a9'];
  // Little flags for border crossings into neighbouring countries.
  const FLAGS = {
    fr: [['#2b4fa3', '#f4f1e6', '#c8372d'], 'v'], it: [['#3d8b4a', '#f4f1e6', '#c8372d'], 'v'],
    de: [['#1f1d1b', '#c8372d', '#e2b33a'], 'h'], at: [['#c8372d', '#f4f1e6', '#c8372d'], 'h'],
  };
  function flag(x, y, code) {
    const [cols, dir] = FLAGS[code] || [['#bbb', '#eee', '#bbb'], 'v'];
    let s = `<g class="flag" transform="translate(${x} ${y})"><path d="M-6 6V-12" class="pole"/>`;
    cols.forEach((c, i) => { s += dir === 'v' ? `<rect x="${-6 + i * 4.4}" y="-12" width="4.4" height="9" fill="${c}"/>` : `<rect x="-6" y="${-12 + i * 3}" width="13.2" height="3" fill="${c}"/>`; });
    return s + '<rect x="-6" y="-12" width="13.2" height="9" class="flag-edge"/><circle r="3.4" class="flag-foot"/></g>';
  }

  /** Static SVG for a map. small = a thumbnail without labels. */
  function baseSvg(m, small) {
    let s = small ? '' : DEFS + `<clipPath id="board-clip"><rect width="${m.w}" height="${m.h}"/></clipPath><rect x="-1000" y="-1000" width="${m.w + 2000}" height="${m.h + 2000}" class="table"/><g clip-path="url(#board-clip)">`;
    s += `<rect width="${m.w}" height="${m.h}" class="sea"/>`;
    if (!small) s += `<rect width="${m.w}" height="${m.h}" fill="url(#sea-swirl)"/><path class="coast-glow" d="${m.land}"/>`;
    s += `<path class="land" d="${m.land}"/>`;
    (m.tints || []).forEach((d, k) => { if (d) s += `<path class="tint" d="${d}" fill="${TINTS[k]}"/>`; });
    if (!small) s += `<path d="${m.land}" fill="url(#parchment)"/>`;
    s += `<path class="lake" d="${m.lakes}"/>`;
    if (!small) s += `<path class="border" d="${m.borders}"/><rect width="${m.w}" height="${m.h}" fill="url(#vignette)" pointer-events="none"/></g>${cartouche(m)}`;
    s += '<g class="routes">';
    m.routes.forEach((r) => {
      if (!small) s += `<polyline class="guide" points="${r.hit.map((p) => p.join(',')).join(' ')}"/>`;
      const fill = r.color < 0 ? GRAY : CARD_COLORS[r.color];
      r.slots.forEach((sl, k) => {
        s += slotRect(sl, 'slot' + (r.tunnel ? ' tunnel' : '') + (r.color === 1 ? ' white' : '') + (r.color < 0 ? ' gray' : ''), fill);
        if (small) return;
        const g = `transform="translate(${sl[0]} ${sl[1]}) rotate(${sl[2]})"`;
        if (r.ferry && k < r.ferry) s += `<use href="#sym-loco" x="-4" y="-4" width="8" height="8" ${g} class="sym-loco"/>`;
        else if (r.color >= 0) s += `<use href="#sym${r.color}" x="-2.3" y="-2.3" width="4.6" height="4.6" ${g} class="sym${r.color === 1 || r.color === 3 ? ' dark' : ''}"/>`;
      });
    });
    s += '</g><g class="cities">';
    const codes = (m.countries || []).map((c) => c.id);
    m.cities.forEach((c) => {
      if (c.country != null) { s += small ? `<circle class="city" cx="${c.x}" cy="${c.y}" r="4"/>` : flag(c.x, c.y, codes[c.country]); return; }
      s += small ? `<circle class="city" cx="${c.x}" cy="${c.y}" r="6"/>`
        : `<circle class="city-halo" cx="${c.x}" cy="${c.y}" r="13"/><circle class="city-ball" cx="${c.x}" cy="${c.y}" r="5.8"/><circle cx="${c.x - 1.8}" cy="${c.y - 2}" r="1.5" class="city-shine"/>`;
    });
    s += '</g>';
    if (!small) {
      s += '<g class="labels">';
      m.cities.forEach((c) => { s += `<text x="${c.lx}" y="${c.ly}"${c.country != null ? ' class="ctry"' : ''}>${esc(c.name)}</text>`; });
      s += '</g>';
      const fr = frame(m);
      s += `<g class="frame">${fr.svg}</g>`;
    }
    return s;
  }

  function thumb(m) {
    return `<svg viewBox="0 0 ${m.w} ${m.h}" class="map-thumb" aria-hidden="true">${baseSvg(m, true)}</svg>`;
  }

  class Board {
    constructor(host, handlers) {
      this.host = host;
      this.handlers = handlers || {};
      this.map = null;
      this.view = null;
      this.pointers = new Map();
      host.innerHTML = '';
      this.svg = document.createElementNS(NS, 'svg');
      this.svg.setAttribute('class', 'board-svg');
      this.svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      host.appendChild(this.svg);
      this.bind();
      if (typeof ResizeObserver !== 'undefined') {
        this.ro = new ResizeObserver(() => this.apply());
        this.ro.observe(host);
      }
    }

    setMap(m) {
      if (this.map && this.map.id === m.id && this.svg.firstChild) return;
      this.map = m;
      this.svg.innerHTML = `<g class="base">${baseSvg(m, false)}</g><g class="dyn"></g><g class="track"></g>`;
      this.dyn = this.svg.querySelector('.dyn');
      this.trackLayer = this.svg.querySelector('.track');
      this.track = frame(m);
      this.fit();
    }

    /** state: { owner: [], stationAt: [], selRoute, selCities: [], hiRoutes: [], flash, colorsOf(p) } */
    update(st) {
      if (!this.map) return;
      const m = this.map;
      let s = '';
      const hi = new Set(st.hiRoutes || []);
      m.routes.forEach((r, i) => {
        if (hi.has(i) && st.owner[i] < 0) r.slots.forEach((sl) => { s += slotRect(sl, 'slot-hi', 'none'); });
      });
      m.routes.forEach((r, i) => {
        const o = st.owner[i];
        if (o < 0) return;
        const fl = st.flash === i ? ' flash' : '';
        r.slots.forEach((sl) => {
          s += slotRect(sl, 'car' + fl, PLAYER_COLORS[o], ` stroke="${PLAYER_DARK[o]}"`);
          s += slotRect(sl, 'car-sheen', 'url(#car-sheen)');
          // A little wagon: window band, roof line and wheels.
          const hl = sl[3] / 2;
          s += `<g transform="translate(${sl[0]} ${sl[1]}) rotate(${sl[2]})" class="car-detail" fill="${PLAYER_DARK[o]}"><rect x="${-hl + 2.6}" y="-2.4" width="${sl[3] - 5.2}" height="2.2" rx=".6" fill="#fff" opacity=".42"/><path d="M${-hl + 1.4} -3.3H${hl - 1.4}" stroke="${PLAYER_DARK[o]}" stroke-width=".7" opacity=".7"/><circle cx="${-hl + 3.2}" cy="3.6" r="1.5"/><circle cx="${hl - 3.2}" cy="3.6" r="1.5"/></g>`;
        });
      });
      if (st.selRoute != null && st.selRoute >= 0) {
        m.routes[st.selRoute].slots.forEach((sl) => { s += slotRect(sl, 'slot-sel', 'none'); });
      }
      (st.stationAt || []).forEach((o, c) => {
        if (o < 0) return;
        const ct = m.cities[c];
        s += `<g class="station" transform="translate(${ct.x} ${ct.y - 11})"><path d="M-6 4V-2L0 -7L6 -2V4Z" fill="${PLAYER_COLORS[o]}" stroke="${PLAYER_DARK[o]}"/></g>`;
      });
      (st.selCities || []).forEach((c) => {
        const ct = m.cities[c];
        if (ct) s += `<circle class="city-sel" cx="${ct.x}" cy="${ct.y}" r="13"/>`;
      });
      this.dyn.innerHTML = s;
      // Score markers on the track (laps past 100 wrap around, as on the board).
      let t = '';
      (st.scores || []).forEach((sc, p) => {
        const [x, y] = this.track.pos[((sc % 100) + 100) % 100];
        const same = st.scores.slice(0, p).filter((o) => ((o % 100) + 100) % 100 === ((sc % 100) + 100) % 100).length;
        t += `<circle class="marker" cx="${x + same * 4.5}" cy="${y - same * 4.5}" r="${this.track.r * 0.62}" fill="${PLAYER_COLORS[p]}" stroke="${PLAYER_DARK[p]}"/>`;
      });
      this.trackLayer.innerHTML = t;
    }

    // ---------- view box ----------
    /** The drawable area: the map plus its frame. */
    bounds() { const m = this.map, F = frameOf(m); return { x: -F, y: -F, w: m.w + 2 * F, h: m.h + 2 * F }; }
    /** Start view: the whole board in landscape; on a tall phone screen, zoomed in a little so the map fills more. */
    fit() {
      if (!this.map) return;
      const b = this.bounds(), r = this.host.getBoundingClientRect(), asp = r.width / (r.height || 1);
      const contain = Math.max(b.w, b.h * asp);
      const w = asp < 0.85 ? Math.max(b.h * asp, contain / 1.45) : contain;
      this.view = { x: b.x + (b.w - w) / 2, y: b.y, w, h: b.h };
      this.apply();
      this.view.y = b.y + (b.h - this.view.h) / 2;
      this.apply();
    }
    /** Container aspect decides the viewBox height for the current width. */
    apply() {
      if (!this.view || !this.map) return;
      const r = this.host.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const v = this.view, b = this.bounds();
      // Zoom between "whole board" and 6x; never pan the board off screen.
      const fitW = Math.max(b.w, b.h * (r.width / r.height));
      v.w = Math.max(fitW / 6, Math.min(fitW, v.w));
      v.h = v.w * (r.height / r.width);
      if (v.w >= b.w) v.x = b.x + (b.w - v.w) / 2; else v.x = Math.min(Math.max(v.x, b.x), b.x + b.w - v.w);
      if (v.h >= b.h) v.y = b.y + (b.h - v.h) / 2; else v.y = Math.min(Math.max(v.y, b.y), b.y + b.h - v.h);
      this.svg.setAttribute('viewBox', `${v.x} ${v.y} ${v.w} ${v.h}`);
      this.scale = r.width / v.w;
      // Labels grow a little when zoomed out so they stay legible on a phone.
      const k = Math.min(1.6, Math.max(1, 1.0 / Math.sqrt(this.scale)));
      this.svg.style.setProperty('--lbl', String(k));
    }
    zoomAt(factor, cx, cy) {
      const v = this.view;
      if (!v) return;
      const p = this.toMap(cx, cy);
      const nw = v.w / factor;
      v.x = p.x - (p.x - v.x) * (nw / v.w);
      v.y = p.y - (p.y - v.y) * (nw / v.w);
      v.w = nw;
      this.apply();
    }
    zoomBy(factor) {
      const r = this.host.getBoundingClientRect();
      this.zoomAt(factor, r.left + r.width / 2, r.top + r.height / 2);
    }
    /** Centre the view on some cities (zooming in a little if the whole map is showing). */
    focus(cities) {
      if (!this.map || !cities.length) return;
      const xs = cities.map((c) => this.map.cities[c].x), ys = cities.map((c) => this.map.cities[c].y);
      const v = this.view;
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
      const span = Math.max(Math.max(...xs) - Math.min(...xs), (Math.max(...ys) - Math.min(...ys)) * (v.w / v.h)) + 120;
      if (span < v.w) v.w = Math.max(span, v.w * 0.6);
      v.x = cx - v.w / 2;
      v.y = cy - (v.w * (v.h / v.w)) / 2;
      this.apply();
    }
    toMap(cx, cy) {
      const r = this.svg.getBoundingClientRect(), v = this.view;
      const s = Math.min(r.width / v.w, r.height / v.h);
      const ox = r.left + (r.width - v.w * s) / 2, oy = r.top + (r.height - v.h * s) / 2;
      return { x: v.x + (cx - ox) / s, y: v.y + (cy - oy) / s };
    }

    // ---------- input ----------
    bind() {
      const svg = this.svg;
      svg.addEventListener('pointerdown', (e) => {
        svg.setPointerCapture(e.pointerId);
        this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: Date.now() });
        if (this.pointers.size === 2) this.pinch = this.pinchState();
        this.moved = this.pointers.size > 1 ? true : false;
      });
      svg.addEventListener('pointermove', (e) => {
        const pt = this.pointers.get(e.pointerId);
        if (!pt || !this.view) return;
        const dx = e.clientX - pt.x, dy = e.clientY - pt.y;
        pt.x = e.clientX; pt.y = e.clientY;
        if (Math.hypot(e.clientX - pt.x0, e.clientY - pt.y0) > 8) this.moved = true;
        if (this.pointers.size === 1 && this.moved) {
          this.view.x -= dx / this.scale; this.view.y -= dy / this.scale;
          this.apply();
        } else if (this.pointers.size === 2 && this.pinch) {
          const now = this.pinchState();
          if (this.pinch.d > 0 && now.d > 0) this.zoomAt(now.d / this.pinch.d, now.cx, now.cy);
          this.view.x -= (now.cx - this.pinch.cx) / this.scale; this.view.y -= (now.cy - this.pinch.cy) / this.scale;
          this.apply();
          this.pinch = now;
        }
      });
      const up = (e) => {
        const pt = this.pointers.get(e.pointerId);
        this.pointers.delete(e.pointerId);
        if (this.pointers.size < 2) this.pinch = null;
        if (pt && !this.moved && e.type === 'pointerup' && Date.now() - pt.t0 < 600) this.tap(e.clientX, e.clientY);
      };
      svg.addEventListener('pointerup', up);
      svg.addEventListener('pointercancel', up);
      svg.addEventListener('wheel', (e) => {
        e.preventDefault();
        this.zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY);
      }, { passive: false });
      svg.addEventListener('dblclick', (e) => { e.preventDefault(); this.zoomAt(1.8, e.clientX, e.clientY); });
    }
    pinchState() {
      const [a, b] = Array.from(this.pointers.values());
      return { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
    }
    /** Nearest city or route within reach of a tap; cities win when the tap is on one. */
    hitTest(cx, cy) {
      const m = this.map, p = this.toMap(cx, cy), reach = 22 / this.scale + 4;
      let city = -1, cd = Infinity;
      m.cities.forEach((c, i) => { const d = Math.hypot(c.x - p.x, c.y - p.y); if (d < cd) { cd = d; city = i; } });
      let route = -1, rd = Infinity;
      m.routes.forEach((r, i) => {
        for (const s of r.slots) {
          const c = Math.cos((s[2] * Math.PI) / 180), si = Math.sin((s[2] * Math.PI) / 180);
          const lx = (p.x - s[0]) * c + (p.y - s[1]) * si, ly = -(p.x - s[0]) * si + (p.y - s[1]) * c;
          const d = Math.hypot(Math.max(0, Math.abs(lx) - s[3] / 2), Math.max(0, Math.abs(ly) - 4));
          if (d < rd) { rd = d; route = i; }
        }
      });
      if (city >= 0 && cd < Math.max(10, reach * 0.8) && cd <= rd + 4) return { city };
      if (route >= 0 && rd < reach) return { route };
      if (city >= 0 && cd < reach) return { city };
      return null;
    }
    tap(cx, cy) {
      if (!this.map) return;
      const hit = this.hitTest(cx, cy);
      if (hit && hit.route != null && this.handlers.route) this.handlers.route(hit.route);
      else if (hit && hit.city != null && this.handlers.city) this.handlers.city(hit.city);
      else if (this.handlers.empty) this.handlers.empty();
    }
  }

  root.TrainBoard = { Board, thumb, baseSvg, CARD_COLORS, PLAYER_COLORS, PLAYER_DARK, GRAY, FRAME, frameOf };
})(typeof self !== 'undefined' ? self : this);
