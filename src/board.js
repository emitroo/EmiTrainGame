/* The board: an SVG map that can be panned and pinch-zoomed, with taps on routes and cities.
 * Static layers (sea, land, routes, cities) are drawn once per map; claims, stations and highlights are redrawn
 * on every update in a separate layer. Hit testing is geometric, so tapping works at any zoom level. */
(function (root) {
  'use strict';

  // Route and card colours in the muted tones of a printed 1900s board; player trains as in the box: red, blue, green, yellow, black.
  const CARD_COLORS = ['#c46a9e', '#f1ece0', '#3b6ea8', '#e4bc3a', '#dc7f2e', '#2b2723', '#b8342b', '#4b8a45'];
  const GRAY = '#a49b88';
  const PLAYER_COLORS = ['#d23b2f', '#2f64c4', '#2f9a4f', '#efc126', '#3a3631'];
  const PLAYER_DARK = ['#6e1610', '#14336f', '#14532a', '#7a5d00', '#0d0c0b'];
  const NS = 'http://www.w3.org/2000/svg';

  const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const slotRect = (s, cls, fill, extra) => `<rect class="${cls}" x="${-s[3] / 2}" y="-4" width="${s[3]}" height="8" rx="1.6" transform="translate(${s[0]} ${s[1]}) rotate(${s[2]})" fill="${fill}"${extra || ''}/>`;

  // Engraved-map textures: wavy hatching for the sea, a light stipple for the land, and a compass rose.
  const DEFS = `<defs>
    <pattern id="sea-hatch" width="24" height="9" patternUnits="userSpaceOnUse"><path d="M0 5q3-2.2 6 0t6 0 6 0 6 0" fill="none" stroke="#5f7f86" stroke-width="0.55" opacity="0.5"/></pattern>
    <pattern id="land-stipple" width="11" height="11" patternUnits="userSpaceOnUse"><circle cx="2" cy="3" r="0.55" fill="#8a6a3a" opacity="0.22"/><circle cx="7.5" cy="8" r="0.45" fill="#8a6a3a" opacity="0.18"/><circle cx="9" cy="2.5" r="0.35" fill="#8a6a3a" opacity="0.15"/></pattern>
    <radialGradient id="vignette" cx="50%" cy="50%" r="75%"><stop offset="60%" stop-color="#3b2410" stop-opacity="0"/><stop offset="100%" stop-color="#3b2410" stop-opacity="0.32"/></radialGradient>
    <linearGradient id="car-sheen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.35"/><stop offset="0.45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.18"/></linearGradient>
  </defs>`;
  function compass(x, y, r) {
    const pt = (a, d) => [x + Math.sin(a) * d, y - Math.cos(a) * d].map((v) => v.toFixed(1)).join(',');
    let s = `<g class="compass"><circle cx="${x}" cy="${y}" r="${r}" class="c-ring"/><circle cx="${x}" cy="${y}" r="${r * 0.78}" class="c-ring2"/>`;
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4, long = k % 2 === 0, d = long ? r * 1.05 : r * 0.62;
      s += `<path d="M${pt(a, d)}L${pt(a + 0.32, r * 0.16)}L${x},${y}Z" class="c-dark"/><path d="M${pt(a, d)}L${pt(a - 0.32, r * 0.16)}L${x},${y}Z" class="c-light"/>`;
    }
    return s + `<text x="${x}" y="${y - r * 1.2}" class="c-n">N</text></g>`;
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
    let s = small ? '' : DEFS;
    s += `<rect x="-200" y="-200" width="${m.w + 400}" height="${m.h + 400}" class="sea"/>`;
    if (!small) s += `<rect x="-200" y="-200" width="${m.w + 400}" height="${m.h + 400}" fill="url(#sea-hatch)"/><path class="coast-glow" d="${m.land}"/>`;
    s += `<path class="land" d="${m.land}"/>`;
    (m.tints || []).forEach((d, k) => { if (d) s += `<path class="tint" d="${d}" fill="${TINTS[k]}"/>`; });
    if (!small) s += `<path d="${m.land}" fill="url(#land-stipple)"/>`;
    s += `<path class="lake" d="${m.lakes}"/>`;
    if (!small) s += `<path class="border" d="${m.borders}"/><rect x="-200" y="-200" width="${m.w + 400}" height="${m.h + 400}" fill="url(#vignette)" pointer-events="none"/>${compass(m.w * 0.07, m.h * 0.11, Math.min(m.w, m.h) * 0.045)}`;
    s += '<g class="routes">';
    m.routes.forEach((r) => {
      if (!small) s += `<polyline class="guide" points="${r.hit.map((p) => p.join(',')).join(' ')}"/>`;
      const fill = r.color < 0 ? GRAY : CARD_COLORS[r.color];
      r.slots.forEach((sl, k) => {
        s += slotRect(sl, 'slot' + (r.tunnel ? ' tunnel' : '') + (r.color === 1 ? ' white' : ''), fill);
        if (!small && r.ferry && k < r.ferry) s += `<g transform="translate(${sl[0]} ${sl[1]}) rotate(${sl[2]})" class="ferry-mark"><circle r="2.6"/><path d="M-1.5 0h3M0 -1.5v3"/></g>`;
      });
    });
    s += '</g><g class="cities">';
    const codes = (m.countries || []).map((c) => c.id);
    m.cities.forEach((c) => {
      if (c.country != null) { s += small ? `<circle class="city" cx="${c.x}" cy="${c.y}" r="4"/>` : flag(c.x, c.y, codes[c.country]); return; }
      s += small ? `<circle class="city" cx="${c.x}" cy="${c.y}" r="6"/>` : `<circle class="city-out" cx="${c.x}" cy="${c.y}" r="8.2"/><circle class="city" cx="${c.x}" cy="${c.y}" r="5.6"/>`;
    });
    s += '</g>';
    if (!small) {
      s += '<g class="labels">';
      m.cities.forEach((c) => { s += `<text x="${c.lx}" y="${c.ly}"${c.country != null ? ' class="ctry"' : ''}>${esc(c.name)}</text>`; });
      s += '</g>';
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
      this.svg.innerHTML = `<g class="base">${baseSvg(m, false)}</g><g class="dyn"></g>`;
      this.dyn = this.svg.querySelector('.dyn');
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
        if (ct) s += `<circle class="city-sel" cx="${ct.x}" cy="${ct.y}" r="11"/>`;
      });
      this.dyn.innerHTML = s;
    }

    // ---------- view box ----------
    /** Start view: the whole map, zoomed in a little on tall phone screens so the map fills more of it. */
    fit() {
      const m = this.map;
      if (!m) return;
      const r = this.host.getBoundingClientRect();
      const contain = Math.max(m.w, m.h * (r.width / (r.height || 1)));
      const cover = Math.min(m.w, m.h * (r.width / (r.height || 1)));
      const w = Math.max(cover, contain / 1.35);
      this.view = { x: (m.w - w) / 2, y: 0, w, h: m.h };
      this.apply();
      this.view.y = (m.h - this.view.h) / 2;
      this.apply();
    }
    /** Container aspect decides the viewBox height for the current width. */
    apply() {
      if (!this.view || !this.map) return;
      const r = this.host.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const v = this.view, m = this.map;
      // Zoom between "whole map" and 6x; never pan the map off screen.
      const fitW = Math.max(m.w, m.h * (r.width / r.height));
      v.w = Math.max(fitW / 6, Math.min(fitW, v.w));
      v.h = v.w * (r.height / r.width);
      if (v.w >= m.w) v.x = (m.w - v.w) / 2; else v.x = Math.min(Math.max(v.x, 0), m.w - v.w);
      if (v.h >= m.h) v.y = (m.h - v.h) / 2; else v.y = Math.min(Math.max(v.y, 0), m.h - v.h);
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

  root.TrainBoard = { Board, thumb, baseSvg, CARD_COLORS, PLAYER_COLORS, PLAYER_DARK, GRAY };
})(typeof self !== 'undefined' ? self : this);
