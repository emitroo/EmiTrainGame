/* Emi Train Game: UI, game flow, pass-and-play and phone-to-phone multiplayer.
 *
 * Three ways to play, chosen on the home screen (same model as EBriscola):
 *   - On this device: pass-and-play and CPU players.
 *   - Online: the host opens a lobby with a 5-letter code; others join with the code.
 *   - Nearby, no internet: the host adds phones one at a time by swapping QR codes on a shared Wi-Fi/hotspot.
 * Multiplayer model: the host phone runs the engine and sends every guest phone a redacted view (its own cards and
 * tickets only). Guests send back the actions they choose; the host checks them with the engine.
 */
(function () {
  'use strict';
  const E = window.TrainEngine, AI = window.TrainAI, MAPS = window.TrainMaps, B = window.TrainBoard, I18N = window.TrainI18n;
  const N = window.TrainNet && window.TrainNet.supported() && !window.EMT_NO_NET ? window.TrainNet : null;
  const CFG = window.EMT_CONFIG || {};
  const STORE = 'emitrain.v1';
  const SITE = CFG.site || location.host + location.pathname.replace(/index\.html$/, '');
  const MAX_SEATS = 5;
  const LOCO = E.LOCO;

  // ---------- persistence ----------
  const store = {
    load() { try { return JSON.parse(localStorage.getItem(STORE) || 'null'); } catch (e) { return null; } },
    save(v) { try { localStorage.setItem(STORE, JSON.stringify(v)); } catch (e) { /* storage unavailable: play on without saving */ } },
  };
  const blankSeat = (extra) => Object.assign({ name: '', cpu: false, level: 'normal', remote: null, open: false }, extra || {});
  const seatsInit = (open) => Array.from({ length: MAX_SEATS }, (_, p) => blankSeat(open ? { open: p > 0 } : p > 0 ? { cpu: true } : {}));
  const DEFAULTS = {
    lang: (navigator.language || 'en').toLowerCase().startsWith('it') ? 'it' : 'en',
    map: 'europe', n: 3, seats: seatsInit(false),
    lobby: { n: 2, map: 'europe', seats: seatsInit(true) },
    hideHands: true, speed: 'normal', sound: true, house: true,
    myName: '', knownDevs: {}, hostMode: null, room: null, lastRoom: null, turn: '',
  };
  const S = { settings: JSON.parse(JSON.stringify(DEFAULTS)), session: null, savedSession: null };
  // session: { cfg: { n, map, seats }, G (engine state, or a redacted view on guests), opts? }

  const ui = {
    screen: 'home', viewer: -1, handoff: null, sheet: null, peek: false,
    sel: null, selCities: [], flash: null, toast: null, toastTimer: null, lastSeq: 0,
    gen: 0, cpuTimer: null, sent: false, error: '', joinStatus: '', joinCode: '', keep: null, board: null,
  };
  const net = {
    role: null, // null (this phone runs the game) | 'guest'
    devices: {}, // host: dev -> { dev, name, link, online, via }
    room: null, // host, online lobby: { code, broker, status: 'opening' | 'open' | 'error', err }
    pair: null, // open QR pairing screen state
    guest: null, // guest: { link, mode, code, hostName, status, lobby }
    joining: false,
    lastSent: {},
  };
  const DEV = N ? N.deviceId() : 'local';
  function persist() { store.save({ settings: S.settings, session: net.role === 'guest' ? S.savedSession : S.session }); }

  // ---------- helpers ----------
  const $ = (sel) => document.querySelector(sel);
  const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  function t(key, vars) {
    const dict = I18N[S.settings.lang] || I18N.en;
    let s = dict[key] != null ? dict[key] : I18N.en[key] != null ? I18N.en[key] : key;
    if (vars && typeof s === 'string') s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? vars[k] : ''));
    return s;
  }
  const SPEED = { slow: 1.6, normal: 1, fast: 0.5 };
  const spd = () => (ui.testFast ? 0.03 : SPEED[S.settings.speed] || 1);
  const isGuest = () => net.role === 'guest';
  const deviceList = () => Object.values(net.devices);
  const hasDevices = () => deviceList().length > 0;
  const devOnline = (dev) => !!(net.devices[dev] && net.devices[dev].online);
  const devName = (dev) => (net.devices[dev] && net.devices[dev].name) || S.settings.knownDevs[dev] || t('phone');
  const hosting = () => !!S.settings.hostMode;
  /** The seat configuration being edited: the lobby when hosting, the one-device setup otherwise. */
  const src = () => (hosting() ? S.settings.lobby : S.settings);
  function onlineIce() {
    const extra = N && S.settings.turn ? N.parseIceConfig(S.settings.turn) : null;
    return extra ? N.ONLINE_ICE.concat(extra) : N.ONLINE_ICE;
  }

  const cfg = () => S.session.cfg;
  const G = () => S.session.G;
  const MAP = () => MAPS.get(cfg().map);
  const seatOf = (p) => cfg().seats[p];
  const opt = (k) => (isGuest() && S.session && S.session.opts ? S.session.opts[k] : S.settings[k]);
  /** Player counts: the board's official range, extended to 5 when the house rule is on. */
  const officialRange = (id) => E.rulesOf(id).players;
  const mapRange = (id) => { const r = officialRange(id); return S.settings.house ? [r[0], Math.max(r[1], E.rulesOf(id).maxPlayers)] : r; };
  function nameFrom(seats, p) {
    const s = seats[p];
    const nm = (s.name || '').trim();
    return nm || (s.cpu ? t('cpu_name', { n: p + 1 }) : t('seat', { n: p + 1 }));
  }
  function setupName(c, p) {
    const s = c.seats[p];
    const nm = (s.name || '').trim();
    if (nm) return nm;
    if (s.cpu) return t('cpu_name', { n: p + 1 });
    if (s.remote) return devName(s.remote);
    if (s.open) return t('open_seat');
    if (hosting() && c === S.settings.lobby && S.settings.myName.trim()) return S.settings.myName.trim();
    return t('seat', { n: p + 1 });
  }
  const name = (p) => (p >= 0 ? nameFrom(cfg().seats, p) : '');
  function isLocal(p) {
    const s = seatOf(p);
    if (isGuest()) return s.remote === 'me';
    return !s.cpu && !s.remote;
  }
  function localSeats() {
    const out = [];
    for (let p = 0; p < cfg().n; p++) if (isLocal(p)) out.push(p);
    return out;
  }
  function hostName() {
    const L = S.settings.lobby;
    for (let p = 0; p < L.n; p++) {
      const s = L.seats[p];
      if (!s.cpu && !s.remote && !s.open && s.name.trim()) return s.name.trim();
    }
    return S.settings.myName.trim() || t('host_tag');
  }
  const cityName = (c) => MAP().cities[c].name;
  const routeName = (r) => { const rt = MAP().routes[r]; return `${cityName(rt.a)} – ${cityName(rt.b)}`; };
  const colorName = (c) => (c === LOCO ? t('loco') : c < 0 ? t('gray') : t('col_' + E.COLORS[c]));
  const pdot = (p) => `<span class="pdot" style="background:${B.PLAYER_COLORS[p]}"></span>`;

  const ART = window.TrainArt;
  const TRAIN_ICON = ART.LOCO;
  const COLOR_GLYPH = ['◆', '○', '▲', '★', '●', '■', '♥', '♣', '∞'];
  /** A train card. size: '' | 'sm' | 'xs' */
  function cardHTML(c, count, size, extra) {
    const cls = c === LOCO ? 'loco' : c < 0 ? 'none' : 'k' + c;
    const n = count != null ? `<b class="cnt">${count}</b>` : '';
    return `<span class="tc ${cls} ${size || ''}" title="${esc(c >= 0 ? colorName(c) : '')}"${extra || ''}>${c >= 0 ? ART.icon(c) + `<i class="glyph">${COLOR_GLYPH[c]}</i>` : ''}${n}</span>`;
  }
  /** A payment (cards array): one card chip per colour used, locomotives last. */
  const payHTML = (cards) => [0, 1, 2, 3, 4, 5, 6, 7, LOCO].filter((k) => cards[k] > 0).map((k) => cardHTML(k, cards[k], 'sm')).join('');
  /** Cities a ticket involves (a country ticket: its start and every border crossing it can end at). */
  function ticketCities(tk) {
    const m = MAP();
    if (!E.isCountryTicket(tk)) return [tk[0], tk[1]];
    return E.nodesOf(m, tk.f).concat(...tk.o.map(([c]) => E.nodesOf(m, -(c + 1))));
  }

  const ICON = {
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
    globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z"/></svg>',
    wifi: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 9a14 14 0 0119 0M5.5 12.5a9.5 9.5 0 0113 0M8.7 16a5 5 0 016.6 0"/><circle cx="12" cy="19.3" r="1" fill="currentColor"/></svg>',
    device: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M10.5 18.5h3"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    minus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 12h14"/></svg>',
    fit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
    ticket: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 7h18v3a2 2 0 000 4v3H3v-3a2 2 0 000-4z"/><path d="M9 7v10" stroke-dasharray="2 2"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    station: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 20v-9l8-7 8 7v9z"/></svg>',
  };

  // ---------- sound & screen ----------
  let actx = null;
  function tone(freq, dur, type, vol, delay) {
    if (!S.settings.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const t0 = actx.currentTime + (delay || 0);
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type || 'triangle'; o.frequency.value = freq;
      g.gain.setValueAtTime(vol || 0.08, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(actx.destination); o.start(t0); o.stop(t0 + dur + 0.02);
    } catch (e) { /* audio unavailable */ }
  }
  const sfx = {
    card: () => tone(420, 0.06, 'triangle', 0.07),
    claim: () => { tone(392, 0.09, 'square', 0.04); tone(523, 0.12, 'square', 0.04, 0.09); tone(659, 0.16, 'square', 0.035, 0.18); },
    turn: () => tone(660, 0.08, 'sine', 0.05),
    bad: () => tone(160, 0.18, 'sawtooth', 0.04),
    end: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'sine', 0.06, i * 0.12)); },
  };
  let wakeLock = null;
  async function keepAwake() {
    try { if ('wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } } catch (e) { /* refused */ }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && (S.session || hasDevices() || isGuest() || hosting())) keepAwake();
  });

  // ================= SETUP SCREENS =================
  const seg = (act, opts, cur, cls) => `<div class="seg ${cls || ''}" role="group">${opts.map(([v, l, dis]) => `<button type="button" data-act="${act}" data-v="${v}" aria-pressed="${String(cur) === String(v)}"${dis ? ' disabled' : ''}>${esc(l)}</button>`).join('')}</div>`;
  const sw = (id, key) => `<span class="switch"><input type="checkbox" id="${id}" data-set="${key}" ${S.settings[key] ? 'checked' : ''}><span></span></span>`;
  const brand = (sub) => `<header class="brand"><div><h1 class="wordmark">Emi <span>Train Game</span></h1><p class="wordmark-sub">${sub}</p></div><div class="brand-train">${TRAIN_ICON}</div></header>`;
  const backBar = (act, label) => `<button class="back-link" data-act="${act}">${ICON.left}<span>${label}</span></button>`;
  const langSeg = () => seg('lang', [['en', 'English'], ['it', 'Italiano']], S.settings.lang);

  function renderSetup() {
    document.documentElement.lang = S.settings.lang;
    if (isGuest()) { renderLobby(); return; }
    if (ui.screen === 'local') renderLocal();
    else if (ui.screen === 'host' && hosting()) renderHost();
    else if (ui.screen === 'join') renderJoin();
    else { ui.screen = 'home'; renderHome(); }
    broadcastLobby();
  }

  function resumeBanner() {
    if (!S.session || !S.session.G) return '';
    const c = S.session.cfg, m = MAPS.get(c.map);
    const names = c.seats.slice(0, c.n).map((_, p) => nameFrom(c.seats, p)).join(', ');
    return `<button class="resume" data-act="resume"><span><strong>${t('resume')}</strong><span>${esc(t('resume_d', { map: m ? m.name : '', names }))}</span></span><span aria-hidden="true">&rsaquo;</span></button>`;
  }

  function renderHome() {
    const net1 = N ? `
      <section class="mode-card"><div class="mode-head"><span class="mode-icon">${ICON.globe}</span><h2>${t('home_online_t')}</h2></div>
        <p class="hint">${t('home_online_d')}</p>
        <div class="btn-pair"><button class="btn btn-primary" data-act="host-online">${t('host_online')}</button><button class="btn btn-ink" data-act="join-online">${t('join_code')}</button></div></section>
      <section class="mode-card"><div class="mode-head"><span class="mode-icon">${ICON.wifi}</span><h2>${t('home_nearby_t')}</h2></div>
        <p class="hint">${t('home_nearby_d')}</p>
        <div class="btn-pair"><button class="btn btn-primary" data-act="host-nearby">${t('host_nearby')}</button><button class="btn btn-ink" data-act="join-nearby">${t('join_nearby')}</button></div></section>` : '';
    $('#setup').innerHTML = `<div class="setup-wrap">
      ${brand(t('tagline'))}
      ${resumeBanner()}
      <section class="mode-card"><div class="mode-head"><span class="mode-icon">${ICON.device}</span><h2>${t('home_local_t')}</h2></div>
        <p class="hint">${t('home_local_d')}</p>
        <button class="btn btn-primary" data-act="go-local">${t('play_here')}</button></section>
      ${net1}
      <div class="home-foot">${langSeg()}<button class="linkish" data-act="rules">${t('rules')}</button></div>
    </div>`;
  }

  function seatRows(c, hostMode) {
    const devs = deviceList();
    let rows = '';
    for (let p = 0; p < c.n; p++) {
      const s = c.seats[p];
      let kinds, kind, extra = '';
      if (hostMode) {
        kinds = [['h', t('this_phone')], ['o', t('phone')], ['c', t('cpu')]];
        kind = s.cpu ? 'c' : s.open || s.remote ? 'o' : 'h';
      } else {
        kinds = [['h', t('human')], ['c', t('cpu')]];
        kind = s.cpu ? 'c' : 'h';
      }
      if (kind === 'c') extra = `<select id="seat-level-${p}" data-level="${p}" aria-label="CPU">${['easy', 'normal', 'hard'].map((l) => `<option value="${l}" ${s.level === l ? 'selected' : ''}>${t(l)}</option>`).join('')}</select>`;
      else if (kind === 'o') {
        const ids = devs.map((x) => x.dev);
        if (s.remote && !ids.includes(s.remote)) ids.push(s.remote);
        extra = `<select id="seat-dev-${p}" data-dev="${p}" aria-label="${t('phone')}"><option value="" ${s.remote ? '' : 'selected'}>${t('waiting_player')}</option>${ids.map((id) => `<option value="${esc(id)}" ${s.remote === id ? 'selected' : ''}>${esc(devName(id))}${devOnline(id) ? '' : ' (' + t('st_offline') + ')'}</option>`).join('')}</select>`;
      }
      const status = kind === 'o' ? `<span class="sdot ${s.remote ? (devOnline(s.remote) ? 'on' : 'off') : 'wait'}"></span>` : '';
      rows += `<div class="seat-row"><span class="dot" style="background:${B.PLAYER_COLORS[p]}">${p + 1}</span>
        <input id="seat-name-${p}" data-name="${p}" maxlength="16" autocomplete="off" placeholder="${esc(setupName(c, p))}" value="${esc(s.name)}">
        <div class="seat-ctrl">${seg('seat-kind-' + p, kinds, kind)}${extra}${status}</div></div>`;
    }
    return rows;
  }

  function playersPanel(hostMode) {
    const c = src(), [lo, hi] = mapRange(c.map);
    const counts = [2, 3, 4, 5].map((k) => [k, String(k), k < lo || k > hi]);
    return `<div class="panel"><div class="panel-head"><h2>${t('players')}</h2></div>
      ${seg('n', counts, c.n)}
      <div class="seats${hostMode ? ' stacked' : ''}">${seatRows(c, hostMode)}</div>
      ${ui.error ? `<p class="error" role="alert">${esc(ui.error)}</p>` : ''}
    </div>`;
  }

  function mapPanel(mapId, canChange) {
    const m = MAPS.get(mapId), [lo, hi] = officialRange(mapId), house = mapRange(mapId)[1] > hi;
    const inner = `${B.thumb(m)}<span class="map-meta"><strong>${esc(m.name)}</strong><span>${esc(t('blurb_' + m.id) !== 'blurb_' + m.id ? t('blurb_' + m.id) : m.blurb)}</span><span class="map-players">${t('players_range', { a: lo, b: hi })}${house ? ' · ' + t('house_to', { n: mapRange(mapId)[1] }) : ''}</span>${canChange ? `<em>${t('change')}</em>` : ''}</span>`;
    return `<div class="panel"><div class="panel-head"><h2>${t('map')}</h2></div>
      ${canChange ? `<button class="map-choice" data-act="maps">${inner}</button>` : `<div class="map-choice">${inner}</div>`}</div>`;
  }

  function optionsPanel(local) {
    return `<div class="panel"><h2>${t('options')}</h2>
      ${local ? `<div class="opt"><label for="o-hide">${t('opt_hide')}</label>${sw('o-hide', 'hideHands')}<p class="hint">${t('opt_hide_d')}</p></div>` : ''}
      ${isGuest() ? '' : `<div class="opt"><label for="o-house">${t('opt_house')}</label>${sw('o-house', 'house')}<p class="hint">${t('opt_house_d')}</p></div>`}
      <div class="opt"><span class="lbl">${t('opt_speed')}</span>${seg('speed', [['slow', t('slow')], ['normal', t('normal')], ['fast', t('fast')]], S.settings.speed)}</div>
      <div class="opt"><label for="o-sound">${t('opt_sound')}</label>${sw('o-sound', 'sound')}</div>
      <div class="opt"><span class="lbl">${t('lang')}</span>${langSeg()}</div>
    </div>`;
  }

  function renderLocal() {
    $('#setup').innerHTML = `<div class="setup-wrap">
      ${backBar('go-home', t('back'))}
      ${brand(t('home_local_t'))}
      ${resumeBanner()}
      ${mapPanel(S.settings.map, true)}
      ${playersPanel(false)}
      ${optionsPanel(true)}
      <p class="center"><button class="linkish on-dark" data-act="rules">${t('rules')}</button></p>
    </div>
    <div class="deal-bar"><button class="btn btn-primary" data-act="deal">${t('start')}</button></div>`;
  }

  let roomQrCache = { code: null, svg: '' };
  const joinUrl = (code) => location.origin + location.pathname + '?join=' + code;

  function invitePanel() {
    const mode = S.settings.hostMode;
    if (mode === 'online') {
      const r = net.room;
      let body;
      if (!r || r.status === 'opening') body = `<p class="pair-status">${t('room_opening')}</p>`;
      else if (r.status === 'error') body = `<p class="error">${esc(r.err)}</p><button class="btn btn-primary" data-act="room-retry">${t('connect')}</button>`;
      else {
        if (roomQrCache.code !== r.code) roomQrCache = { code: r.code, svg: N.qrSvg(joinUrl(r.code)) };
        body = `<div class="room-box"><span class="kicker">${t('lobby_code')}</span><div class="room-code" id="room-code">${r.code}</div>
          <p class="hint">${esc(t('invite_d', { url: SITE }))}</p>
          <div class="qr-box small">${roomQrCache.svg}</div><p class="hint">${t('invite_qr')}</p>
          <button class="btn btn-ghost" data-act="share-link" id="share-btn">${t('share')}</button></div>`;
      }
      const relay = S.settings.turn ? N.parseIceConfig(S.settings.turn) : null;
      body += `<details class="relay-box"${S.settings.turn && !relay ? ' open' : ''}><summary>${t('relay_t')}</summary>
        <p class="hint">${t('relay_d')}</p>
        <textarea id="turn-text" rows="4" spellcheck="false" placeholder="turn:… username … credential …">${esc(S.settings.turn)}</textarea>
        <div class="btn-row"><button class="btn btn-ghost" data-act="turn-clear">${t('remove')}</button><button class="btn btn-primary" data-act="turn-save">${t('relay_save')}</button></div>
        <p class="pair-status" id="turn-status">${relay ? esc(t('relay_ok', { n: relay[0].urls.length })) : S.settings.turn ? esc(t('relay_bad')) : ''}</p></details>`;
      return `<div class="panel"><div class="panel-head"><h2>${t('invite_t')}</h2><span class="mode-badge">${ICON.globe}${t('badge_online')}</span></div>${body}</div>`;
    }
    return `<div class="panel"><div class="panel-head"><h2>${t('add_t')}</h2><span class="mode-badge">${ICON.wifi}${t('badge_nearby')}</span></div>
      <ol class="steps"><li>${t('near_s1')}</li><li>${t('near_s2')}</li><li>${t('near_s3')}</li></ol>
      <button class="btn btn-primary" data-act="pair-qr">${t('add_phone')}</button></div>`;
  }

  function renderHost() {
    $('#setup').innerHTML = `<div class="setup-wrap">
      ${backBar('host-end', t('end_lobby'))}
      ${brand(t('hosting'))}
      ${resumeBanner()}
      ${invitePanel()}
      ${mapPanel(S.settings.lobby.map, true)}
      ${playersPanel(true)}
      ${optionsPanel(false)}
    </div>
    <div class="deal-bar"><button class="btn btn-primary" data-act="deal">${t('start')}</button></div>`;
  }

  function renderJoin() {
    $('#setup').innerHTML = `<div class="setup-wrap">
      ${backBar('go-home', t('back'))}
      ${brand(t('join_online_t'))}
      <div class="panel join-panel">
        <label class="field"><span>${t('your_name')}</span><input id="my-name" data-myname maxlength="16" autocomplete="off" autocapitalize="words" value="${esc(S.settings.myName)}"></label>
        <label class="field"><span>${t('lobby_code')}</span><input id="pj-room" class="code-input" maxlength="5" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABCDE" value="${esc(ui.joinCode || '')}"></label>
        <button class="btn btn-primary" data-act="join-room" id="join-btn" ${net.joining ? 'disabled' : ''}>${t(net.joining ? 'joining' : 'join')}</button>
        <p class="pair-status" id="pj-room-status" role="status">${ui.joinStatus ? esc(ui.joinStatus) : ''}</p>
        <p class="hint">${t('join_online_d')}</p>
      </div>
    </div>`;
  }

  function renderLobby() {
    const gst = net.guest, lob = gst.lobby;
    const host = (lob && lob.host) || gst.hostName || t('host_tag');
    let seats = '';
    if (lob) {
      seats = lob.seats.map((s, p) => `<div class="lobby-seat"><span class="dot" style="background:${B.PLAYER_COLORS[p]}">${p + 1}</span><span class="nm${s.open ? ' muted' : ''}">${esc(s.open ? t('waiting_player') : s.name)}</span>${s.cpu ? `<span class="badge">${t('cpu')}</span>` : ''}${s.host ? `<span class="badge">${t('host_tag')}</span>` : ''}${s.mine ? `<span class="badge mine">${t('you_tag')}</span>` : ''}</div>`).join('');
    }
    const badge = gst.mode === 'room' ? `<span class="mode-badge">${ICON.globe}${t('badge_online')}${gst.code ? ' · ' + esc(gst.code) : ''}</span>` : `<span class="mode-badge">${ICON.wifi}${t('badge_nearby')}</span>`;
    $('#setup').innerHTML = `<div class="setup-wrap">
      ${brand(esc(t('lobby_joined', { name: host })))}
      ${guestBanner()}
      <div class="panel"><div class="panel-head"><h2>${t('players')}</h2>${badge}</div>
        <div class="lobby-seats">${seats}</div>
        <p class="pair-status">${esc(t('lobby_wait', { name: host }))}</p>
        <label class="field"><span>${t('your_name')}</span><input id="my-name" data-myname maxlength="16" autocomplete="off" autocapitalize="words" value="${esc(S.settings.myName)}"></label>
      </div>
      ${lob && MAPS.get(lob.map) ? mapPanel(lob.map, false) : ''}
      <div class="panel"><h2>${t('options')}</h2>
        <div class="opt"><label for="o-sound">${t('opt_sound')}</label>${sw('o-sound', 'sound')}</div>
        <div class="opt"><span class="lbl">${t('lang')}</span>${langSeg()}</div>
      </div>
      <p class="center"><button class="btn btn-ghost on-dark" data-act="guest-leave">${t('leave')}</button></p>
    </div>`;
  }

  function guestBanner() {
    const gst = net.guest;
    if (!gst || gst.status !== 'lost') return '';
    if (gst.mode === 'room') return `<div class="netbanner">${t('lost')} ${t('reconnecting')}</div>`;
    return `<div class="netbanner">${t('lost')} ${t('repair_hint')}<button class="btn btn-light" data-act="join-nearby">${t('scan_again')}</button></div>`;
  }

  // ================= GAME SCREEN =================
  function showScreen(which) {
    $('#setup').hidden = which !== 'setup';
    $('#game').hidden = which !== 'game';
    if (which === 'setup') { renderSetup(); renderLayer(); } else render();
  }

  function render() {
    renderLayer();
    if (!S.session || !S.session.G || $('#game').hidden) return;
    renderGame();
  }

  /** The seat whose hand is shown: the chosen local viewer, or nobody behind a pass-the-phone screen. */
  function viewerSeat() { return ui.handoff ? -1 : ui.viewer; }
  function myTurn() {
    const g = G(), v = viewerSeat();
    return v >= 0 && g.phase === 'play' && g.turn === v && !(isGuest() && ui.sent);
  }

  function ensureGameSkeleton() {
    if ($('#board')) return;
    $('#game').innerHTML = `
      <div class="topbar"><button class="icon-btn" data-act="menu" aria-label="${t('menu')}">${ICON.menu}</button><div class="players" id="players"></div></div>
      <div class="board-wrap"><div id="board" class="board"></div>
        <div class="zoom"><button class="icon-btn" data-act="zoom-in" aria-label="${t('zoom_in')}">${ICON.plus}</button><button class="icon-btn" data-act="zoom-out" aria-label="${t('zoom_out')}">${ICON.minus}</button><button class="icon-btn" data-act="zoom-fit" aria-label="${t('zoom_fit')}">${ICON.fit}</button></div>
        <div class="banner" id="banner" role="status"></div><div class="toast-wrap" id="toast"></div></div>
      <div class="tray" id="tray"></div>`;
    ui.board = new B.Board($('#board'), {
      route: (r) => { ui.sel = r; ui.selCities = []; ui.sheet = { type: 'route', r }; render(); },
      city: (c) => { ui.sel = null; ui.selCities = [c]; ui.sheet = { type: 'city', c }; render(); },
      empty: () => { if (ui.sel != null || ui.selCities.length) { ui.sel = null; ui.selCities = []; render(); } },
    });
  }

  function renderGame() {
    ensureGameSkeleton();
    const g = G(), m = MAP(), v = viewerSeat();
    ui.board.setMap(m);
    ui.board.update({ owner: g.owner, stationAt: g.stationAt, selRoute: ui.sel, selCities: ui.selCities, flash: ui.flash, scores: Array.from({ length: g.n }, (_, p) => E.routeScore(g, p)) });

    // Players strip.
    const R = E.rulesOf(g);
    $('#players').innerHTML = Array.from({ length: g.n }, (_, p) => {
      const s = seatOf(p);
      const off = s.off || (!isGuest() && s.remote && !devOnline(s.remote));
      const now = (g.phase === 'play' && g.turn === p) || (g.phase === 'setup' && g.offer[p]);
      const tickets = g.ticketN ? g.ticketN[p] : g.tickets[p].length;
      return `<div class="pchip${now ? ' now' : ''}${p === v ? ' me' : ''}" style="--pc:${B.PLAYER_COLORS[p]}">
        <span class="pname">${esc(name(p))}${s.cpu ? ' <small>CPU</small>' : ''}${off ? ' <small class="off">' + t('st_offline') + '</small>' : ''}</span>
        <span class="pstats"><b class="pscore">${E.routeScore(g, p)}</b><span title="${t('trains')}">${TRAIN_ICON}${g.trains[p]}</span><span title="${t('cards')}">▮${E.handSize(g, p)}</span><span title="${t('tickets')}">${ICON.ticket}${tickets}</span>${R.stations ? `<span title="${t('stations')}">${ICON.station}${g.stations[p]}</span>` : ''}</span></div>`;
    }).join('');

    // Banner.
    $('#banner').innerHTML = bannerText();
    $('#banner').className = 'banner' + (myTurn() ? ' go' : '') + (g.lastFrom >= 0 && g.phase === 'play' ? ' last' : '');

    // Tray: market + deck + tickets, then the viewer's hand.
    const canDraw = myTurn() && !g.offer[v] && (!g.step || g.step.drew);
    const market = g.market.map((c, i) => {
      const ok = canDraw && E.canTakeCard(g, i);
      return `<button class="mk" data-act="take" data-v="${i}" ${ok ? '' : 'disabled'} aria-label="${esc(c >= 0 ? colorName(c) : t('empty'))}">${cardHTML(c)}</button>`;
    }).join('');
    const deckOk = canDraw && E.canTakeCard(g, -1);
    const tixOk = myTurn() && !g.step && !g.offer[v] && g.tdeck.length > 0;
    let hand = '';
    if (v >= 0 && g.hands[v]) {
      const h = g.hands[v];
      hand = [0, 1, 2, 3, 4, 5, 6, 7, LOCO].filter((c) => h[c] > 0).map((c) => cardHTML(c, h[c])).join('') || `<span class="hint on-dark">${t('no_cards')}</span>`;
    }
    const mine = v >= 0 ? g.tickets[v] || [] : [];
    const done = mine.filter((id) => id >= 0 && E.ticketDone(g, v, id)).length;
    $('#tray').innerHTML = `
      <div class="market-row">${market}
        <button class="deck-btn" data-act="take" data-v="-1" ${deckOk ? '' : 'disabled'}><span class="tc back">${TRAIN_ICON}</span><small>${t('deck')} ${E.deckLeft(g)}</small></button>
        <button class="deck-btn tix" data-act="draw-tickets" ${tixOk ? '' : 'disabled'}><span class="tk-back">${ICON.ticket}</span><small>${t('tickets')} ${g.tdeck.length}</small></button>
      </div>
      <div class="hand-row">${v >= 0 ? `<div class="hand">${hand}</div><button class="my-tix" data-act="my-tickets">${ICON.ticket}<span>${done}/${mine.length}</span></button>` : `<div class="hand"><span class="hint on-dark">${t('hand_hidden')}</span></div>`}</div>`;

    // Toast.
    $('#toast').innerHTML = ui.toast ? `<div class="toast" key="${ui.toast.k}">${ui.toast.html}</div>` : '';
  }

  function bannerText() {
    const g = G(), v = viewerSeat();
    const last = g.lastFrom >= 0 && g.phase === 'play' ? `<b class="last-tag">${t('last_round')}</b> ` : '';
    if (g.phase === 'over') return t('game_over');
    if (g.phase === 'setup') {
      if (v >= 0 && g.offer[v]) return `<b>${t('choose_tickets')}</b>`;
      return t('waiting_tickets');
    }
    const p = g.turn;
    if (isGuest() && ui.sent && p === v) return last + t('sending');
    if (p === v) {
      if (g.offer[v]) return last + `<b>${t('choose_tickets')}</b>`;
      if (g.step && g.step.tunnel) return last + `<b>${t('tunnel_decide')}</b>`;
      if (g.step && g.step.drew) return last + `<b>${t('one_more')}</b>`;
      return last + `<b>${t('your_turn')}</b> ${E.rulesOf(g).stations ? t('your_turn_st') : t('your_turn_d')}`;
    }
    const s = seatOf(p);
    return last + pdot(p) + esc(t(s.cpu ? 'cpu_thinking' : 'turn_of', { name: name(p) }));
  }

  // ---------- toasts from the game log ----------
  function logText(e) {
    const g = G(), nm = esc(name(e.p));
    switch (e.k) {
      case 'card': return e.c >= 0 ? `${pdot(e.p)}${nm} ${t('log_took')} ${cardHTML(e.c, null, 'xs')}` : `${pdot(e.p)}${nm} ${t('log_blind')}`;
      case 'claim': return `${pdot(e.p)}${nm} ${t('log_claim')} <b>${esc(routeName(e.r))}</b> +${e.pts}`;
      case 'tunnel': return `${pdot(e.p)}${esc(t('log_tunnel', { route: routeName(e.r), n: e.extra }))} ${e.rev.map((c) => cardHTML(c, null, 'xs')).join('')}`;
      case 'tunnel-no': return `${pdot(e.p)}${esc(t('log_tunnel_no', { name: name(e.p), route: routeName(e.r) }))}`;
      case 'ticket-draw': return `${pdot(e.p)}${esc(t('log_tdraw', { name: name(e.p) }))}`;
      case 'keep': return `${pdot(e.p)}${esc(t('log_keep', { name: name(e.p), n: e.n, of: e.of }))}`;
      case 'station': return `${pdot(e.p)}${esc(t('log_station', { name: name(e.p), city: cityName(e.city) }))}`;
      case 'last-round': return `<b>${esc(t('log_last', { name: name(e.p), n: g.trains[e.p] }))}</b>`;
      case 'pass': return `${pdot(e.p)}${esc(t('log_pass', { name: name(e.p) }))}`;
      case 'over': return `<b>${t('game_over')}</b>`;
      default: return '';
    }
  }
  /** Show what happened since this phone last looked: a toast, a sound, a flash on the claimed route. */
  function noticeLog(quiet) {
    const g = G();
    const fresh = g.log.filter((e) => e.s > ui.lastSeq);
    ui.lastSeq = g.seq;
    if (quiet || !fresh.length) return;
    const interesting = fresh.filter((e) => !(e.k === 'card' && e.p === viewerSeat()) && e.k !== 'over');
    const e = interesting[interesting.length - 1] || fresh[fresh.length - 1];
    for (const x of fresh) {
      if (x.k === 'claim') { ui.flash = x.r; sfx.claim(); }
      else if (x.k === 'card') sfx.card();
      else if (x.k === 'tunnel' || x.k === 'tunnel-no') sfx.bad();
      else if (x.k === 'over') sfx.end();
    }
    if (e && e.k !== 'over') showToast(logText(e));
  }
  function showToast(html) {
    clearTimeout(ui.toastTimer);
    ui.toast = { html, k: Date.now() };
    ui.toastTimer = setTimeout(() => { ui.toast = null; ui.flash = null; if (S.session && S.session.G && !$('#game').hidden) renderGame(); }, 2600 * Math.max(0.8, spd()));
  }

  // ---------- sheets and overlays ----------
  function renderLayer() {
    const L = $('#layer');
    if (S.session && S.session.G && !$('#game').hidden) autoSheet();
    if (ui.handoff) {
      const p = ui.handoff.p, g = G();
      const what = g.phase === 'setup' ? t('ho_tickets') : g.offer[p] ? t('ho_tickets') : t('ho_turn');
      L.innerHTML = `<div class="overlay handoff" data-act="reveal" role="dialog" aria-label="${esc(t('pass_to'))}">
        <div class="ho-train">${TRAIN_ICON}</div>
        <p class="ho-kicker">${t('pass_to')}</p><p class="ho-name" style="color:${B.PLAYER_COLORS[p]}">${esc(name(p))}</p>
        <p class="ho-info">${what}</p>
        <button class="btn btn-light" data-act="reveal">${t('tap_reveal')}</button></div>`;
      return;
    }
    if (!ui.sheet || ui.peek) {
      L.innerHTML = ui.peek && ui.sheet ? `<button class="peek-back btn btn-primary" data-act="unpeek">${t(ui.sheet.type === 'offer' ? 'back_tickets' : 'back_tunnel')}</button>` : '';
      return;
    }
    const sh = ui.sheet;
    const closable = !['offer', 'tunnel', 'summary'].includes(sh.type);
    const head = (title, extra) => `<div class="sheet-head"><h2>${title}</h2>${extra || ''}${closable ? `<button class="close-btn" data-act="close" aria-label="${t('close')}">${ICON.close}</button>` : ''}</div>`;
    let body = '';
    const g = S.session && S.session.G;
    switch (sh.type) {
      case 'rules': body = head(t('rules')) + rulesHTML(); break;
      case 'maps': body = head(t('choose_map')) + `<div class="map-grid">${MAPS.list.map((id) => { const m = MAPS.get(id), [lo, hi] = officialRange(id); return `<button class="map-tile" data-act="pick-map" data-v="${id}" aria-pressed="${id === src().map}">${B.thumb(m)}<strong>${esc(m.name)}</strong><span>${esc(t('blurb_' + id) !== 'blurb_' + id ? t('blurb_' + id) : m.blurb)}</span><span class="map-players">${t('players_range', { a: lo, b: hi })}</span></button>`; }).join('')}</div>`; break;
      case 'menu': body = menuHTML(head); break;
      case 'phones': body = head(t('phones')) + phonesHTML(); break;
      case 'confirm': body = `<p class="confirm-text">${t(sh.text)}</p><div class="btn-row"><button class="btn btn-ghost" data-act="close">${t('cancel')}</button><button class="btn btn-primary" data-act="${sh.act}">${t(sh.yes)}</button></div>`; break;
      case 'notice': body = `<p class="confirm-text">${esc(sh.text)}</p><button class="btn btn-primary" data-act="close">${t('ok')}</button>`; break;
      case 'route': body = routeSheet(head, sh.r); break;
      case 'city': body = citySheet(head, sh.c); break;
      case 'offer': body = offerSheet(head); break;
      case 'tunnel': body = tunnelSheet(head); break;
      case 'my-tickets': body = myTicketsSheet(head); break;
      case 'log': body = head(t('log')) + `<ul class="log-list">${g.log.slice().reverse().map((e) => `<li>${logText(e)}</li>`).join('')}</ul>`; break;
      case 'summary': body = summaryHTML(); break;
      default: body = '';
    }
    const bottom = ['route', 'city', 'my-tickets'].includes(sh.type) ? ' bottom' : '';
    L.innerHTML = `<div class="overlay${bottom}" ${closable ? 'data-act="backdrop"' : ''}><div class="sheet sheet-${sh.type}" role="dialog" aria-modal="true">${body}</div></div>`;
  }

  /** Sheets the game itself opens: choosing tickets, deciding on a tunnel, the final scores. */
  function autoSheet() {
    const g = G(), v = viewerSeat();
    const type = ui.sheet && ui.sheet.type;
    if (g.phase === 'over') { if (type !== 'summary' && !['rules', 'log', 'menu', 'confirm'].includes(type)) { ui.sheet = { type: 'summary' }; ui.peek = false; } return; }
    if (type === 'summary') ui.sheet = null;
    const wantOffer = v >= 0 && g.offer[v] && !(isGuest() && ui.sent);
    const wantTunnel = v >= 0 && g.phase === 'play' && g.turn === v && g.step && g.step.tunnel && !(isGuest() && ui.sent);
    if (wantOffer) {
      if (type !== 'offer') { ui.sheet = { type: 'offer' }; ui.peek = false; }
      const key = g.offer[v].join(',');
      if (!ui.keep || ui.keep.key !== key) ui.keep = { key, ids: new Set() };
    } else if (wantTunnel) {
      if (type !== 'tunnel') { ui.sheet = { type: 'tunnel' }; ui.peek = false; }
    } else if (type === 'offer' || type === 'tunnel') { ui.sheet = null; ui.peek = false; }
  }

  function ticketRow(id, opts) {
    const m = MAP(), tk = m.tickets[id];
    const done = opts && opts.done;
    if (E.isCountryTicket(tk)) {
      const from = tk.f >= 0 ? m.cities[tk.f].name : m.countries[-tk.f - 1].name;
      const to = tk.o.map(([c, pts]) => `<span class="tk-opt">${esc(m.countries[c].name)} <b>${pts}</b></span>`).join('');
      return `<span class="ticket country${done ? ' done' : ''}"><span class="tk-cities">${esc(from)} <i>→</i> <span class="tk-opts">${to}</span></span>${done ? `<span class="tk-ok">${ICON.check}</span>` : ''}</span>`;
    }
    return `<span class="ticket${tk[3] ? ' long' : ''}${done ? ' done' : ''}"><span class="tk-cities">${esc(m.cities[tk[0]].name)} <i>→</i> ${esc(m.cities[tk[1]].name)}</span><b class="tk-pts">${tk[2]}</b>${done ? `<span class="tk-ok">${ICON.check}</span>` : ''}</span>`;
  }

  function offerSheet(head) {
    const g = G(), v = viewerSeat(), offer = g.offer[v], min = g.keepMin[v];
    const k = ui.keep.ids;
    const rows = offer.map((id) => `<button class="ticket-pick" data-act="keep-toggle" data-v="${id}" aria-pressed="${k.has(id)}"><span class="tick">${k.has(id) ? ICON.check : ''}</span>${ticketRow(id)}<span class="show" data-act="ticket-show" data-v="${id}">${t('show')}</span></button>`).join('');
    return head(t('choose_tickets'), `<span class="hint">${t('keep_min', { n: min })}</span>`) + `<p class="hint">${t('tickets_d')}</p><div class="ticket-list">${rows}</div>
      <div class="btn-row"><button class="btn btn-ghost" data-act="peek">${t('look_map')}</button><button class="btn btn-primary" data-act="keep-ok" ${k.size >= min ? '' : 'disabled'}>${t('keep_n', { n: k.size })}</button></div>`;
  }

  function myTicketsSheet(head) {
    const g = G(), v = viewerSeat();
    const mine = (g.tickets[v] || []).filter((id) => id >= 0);
    const rows = mine.map((id) => `<button class="ticket-pick" data-act="ticket-show" data-v="${id}">${ticketRow(id, { done: E.ticketDone(g, v, id) })}</button>`).join('');
    return head(t('my_tickets')) + (rows ? `<div class="ticket-list">${rows}</div><p class="hint">${t('my_tickets_d')}</p>` : `<p class="hint">${t('no_tickets')}</p>`);
  }

  function routeSheet(head, r) {
    const g = G(), m = MAP(), rt = m.routes[r], v = viewerSeat(), R = E.rulesOf(g);
    const tags = [`<span class="chip">${t('len_n', { n: rt.len })}</span>`, `<span class="chip">${cardHTML(rt.color < 0 ? -1 : rt.color, null, 'xs')} ${esc(colorName(rt.color))}</span>`, `<span class="chip">${t('pts_n', { n: E.routePoints(rt.len) })}</span>`];
    if (rt.tunnel) tags.push(`<span class="chip warn">${t('tunnel')}</span>`);
    if (rt.ferry) tags.push(`<span class="chip warn">${t('ferry_n', { n: rt.ferry })}</span>`);
    if (rt.pair >= 0) tags.push(`<span class="chip">${t('double')}</span>`);
    let body = `<div class="chips">${tags.join('')}</div>`;
    const o = g.owner[r];
    if (o >= 0) body += `<p class="owner">${pdot(o)}${esc(t('owned_by', { name: name(o) }))}</p>`;
    else if (v < 0) body += '';
    else {
      const why = E.routeBlock(g, v, r);
      const opts = myTurn() && !g.step && !g.offer[v] ? E.paymentOptions(g, v, r) : [];
      if (why) body += `<p class="hint">${esc(t('why_' + why, { n: R.doubleMin }))}</p>`;
      else if (!myTurn() || g.step || g.offer[v]) body += `<p class="hint">${t('not_now')}</p>`;
      else if (!opts.length) body += `<p class="hint">${t('need_cards', { n: rt.len, col: colorName(rt.color) })}${rt.ferry ? ' ' + t('need_ferry', { n: rt.ferry }) : ''}</p>`;
      else {
        ui.payOpts = opts;
        body += `<p class="hint">${t(rt.tunnel ? 'pay_tunnel' : 'pay_with')}</p><div class="pay-opts">${opts.map((x, i) => `<button class="pay" data-act="claim" data-r="${r}" data-i="${i}" data-cards="${x.join(',')}">${payHTML(x)}</button>`).join('')}</div>`;
      }
    }
    const myT = v >= 0 ? (g.tickets[v] || []).filter((id) => id >= 0 && ticketCities(m.tickets[id]).some((c) => c === rt.a || c === rt.b)) : [];
    if (myT.length) body += `<div class="ticket-list small">${myT.map((id) => ticketRow(id, { done: E.ticketDone(g, v, id) })).join('')}</div>`;
    return head(esc(routeName(r))) + body;
  }

  function citySheet(head, c) {
    const g = G(), m = MAP(), v = viewerSeat(), R = E.rulesOf(g);
    let body = '';
    const st = g.stationAt[c];
    if (R.stations) {
      if (st >= 0) body += `<p class="owner">${pdot(st)}${esc(t('station_of', { name: name(st) }))}</p>`;
      else if (v >= 0) {
        const why = E.stationBlock(g, v, c);
        const opts = myTurn() && !g.step && !g.offer[v] ? E.stationOptions(g, v, c) : [];
        const cost = why ? 0 : E.stationCost(g, v);
        body += `<p class="hint">${t('station_d', { pts: R.stationPoints })}</p>`;
        if (why) body += `<p class="hint">${esc(t('why_' + why))}</p>`;
        else if (!myTurn() || g.step || g.offer[v]) body += `<p class="hint">${t('station_cost', { n: cost })} ${t('not_now')}</p>`;
        else if (!opts.length) body += `<p class="hint">${t('station_cost', { n: cost })} ${t('need_station_cards')}</p>`;
        else body += `<p class="hint">${t('station_cost', { n: cost })}</p><div class="pay-opts">${opts.map((x) => `<button class="pay" data-act="station" data-city="${c}" data-cards="${x.join(',')}">${ICON.station}${payHTML(x)}</button>`).join('')}</div>`;
      }
    }
    const routes = m.routes.map((rt, r) => ((rt.a === c || rt.b === c) ? r : -1)).filter((r) => r >= 0);
    body += `<div class="city-routes">${routes.map((r) => { const rt = m.routes[r], o = g.owner[r]; return `<button class="city-route" data-act="pick-route" data-v="${r}">${o >= 0 ? pdot(o) : cardHTML(rt.color < 0 ? -1 : rt.color, null, 'xs')}<span>${esc(cityName(rt.a === c ? rt.b : rt.a))}</span><small>${rt.len}${rt.tunnel ? ' · ' + t('tunnel') : ''}${rt.ferry ? ' · ' + t('ferry') : ''}</small></button>`; }).join('')}</div>`;
    const myT = v >= 0 ? (g.tickets[v] || []).filter((id) => id >= 0 && ticketCities(m.tickets[id]).includes(c)) : [];
    if (myT.length) body += `<div class="ticket-list small">${myT.map((id) => ticketRow(id, { done: E.ticketDone(g, v, id) })).join('')}</div>`;
    return head(esc(cityName(c))) + body;
  }

  function tunnelSheet(head) {
    const g = G(), v = viewerSeat(), T = g.step.tunnel;
    const opts = E.tunnelOptions(g, v);
    return head(t('tunnel_t', { route: esc(routeName(T.r)) })) + `<div class="reveal">${T.rev.map((c) => cardHTML(c)).join('')}</div>
      <p class="confirm-text">${t(T.c < 0 ? 'tunnel_need_loco' : 'tunnel_need', { n: T.extra, col: colorName(T.c) })}</p>
      ${opts.length ? `<div class="pay-opts">${opts.map((x) => `<button class="pay" data-act="tunnel-pay" data-cards="${x.join(',')}">${payHTML(x)}</button>`).join('')}</div>` : `<p class="hint">${t('tunnel_cant')}</p>`}
      <div class="btn-row"><button class="btn btn-ghost" data-act="peek">${t('look_map')}</button><button class="btn btn-ink" data-act="tunnel-no">${t('tunnel_give_up')}</button></div>`;
  }

  function summaryHTML() {
    const g = G(), F = g.final, m = MAP();
    if (!F) return '';
    const win = F.winners.map((p) => name(p)).join(' & ');
    const rows = F.rows.slice().sort((a, b) => b.total - a.total).map((r) => {
      const bon = Object.entries(r.bonus).map(([k, pts]) => `<span class="chip gold">${t('bonus_' + k)} +${pts}</span>`).join('');
      const tix = r.done.map((id) => ticketRow(id, { done: true })).join('') + r.failed.map((id) => ticketRow(id).replace('class="ticket', 'class="ticket failed')).join('');
      return `<div class="side${F.winners.includes(r.p) ? ' won' : ''}">
        <div class="side-top"><strong>${pdot(r.p)}${esc(name(r.p))}</strong><span class="big">${r.total}</span></div>
        <table class="vals"><tr><td>${t('sc_routes')}</td><td>${r.routes}</td></tr>
          <tr><td>${t('sc_tickets', { a: r.done.length, b: r.done.length + r.failed.length })}</td><td>+${r.plus} / −${r.minus}</td></tr>
          ${E.rulesOf(g).stations ? `<tr><td>${t('sc_stations')}</td><td>${r.stations}</td></tr>` : ''}
          <tr><td>${t('sc_longest')}</td><td>${r.longest}</td></tr>
          ${r.mandalas ? `<tr><td>${t('sc_mandalas')}</td><td>${r.mandalas}</td></tr>` : ''}</table>
        ${bon ? `<div class="chips">${bon}</div>` : ''}
        <details><summary>${t('tickets')}</summary><div class="ticket-list small">${tix}</div></details></div>`;
    }).join('');
    const actions = isGuest()
      ? `<p class="pair-status">${esc(t('wait_host', { name: net.guest.hostName || t('host_tag') }))}</p><button class="btn btn-ghost" data-act="ask-leave">${t('leave')}</button>`
      : `<div class="btn-row"><button class="btn btn-ghost" data-act="quit">${t('to_setup')}</button><button class="btn btn-primary" data-act="new-game">${t('play_again')}</button></div>`;
    const top = Math.max(...F.rows.map((r) => r.total));
    const broken = F.winners.length === 1 && F.rows.filter((r) => r.total === top).length > 1;
    return `<div class="result-banner"><span class="kicker">${esc(m.name)} · ${t('game_over')}</span><h2>${esc(t(F.winners.length > 1 ? 'tie' : 'wins', { name: win }))}</h2>${broken ? `<p class="hint">${esc(t('r_tie_' + E.rulesOf(g).tie.join('_')))}</p>` : ''}</div>
      <div class="sides">${rows}</div>
      <button class="btn btn-ghost" data-act="peek">${t('look_map')}</button>${actions}`;
  }

  function menuHTML(head) {
    const items = [`<button class="btn btn-light" data-act="close">${t('resume_play')}</button>`];
    if (S.session && S.session.G) {
      items.push(`<button class="btn btn-light" data-act="show-log">${t('log')}</button>`);
      if (viewerSeat() >= 0) items.push(`<button class="btn btn-light" data-act="my-tickets">${t('my_tickets')}</button>`);
    }
    items.push(`<button class="btn btn-light" data-act="rules">${t('rules')}</button>`);
    items.push(`<button class="btn btn-light" data-act="toggle-sound">${t(S.settings.sound ? 'sound_off' : 'sound_on')}</button>`);
    if (!isGuest() && hosting()) items.push(`<button class="btn btn-light" data-act="phones">${t('phones')}</button>`);
    if (!isGuest() && localSeats().length > 1) items.push(`<button class="btn btn-light" data-act="toggle-hide">${t(S.settings.hideHands ? 'hide_off' : 'hide_on')}</button>`);
    if (isGuest()) items.push(`<button class="btn btn-ghost" data-act="ask-leave">${t('leave')}</button>`);
    else items.push(`<button class="btn btn-ghost" data-act="ask-quit">${t('quit')}</button>`);
    return head(t('menu')) + `<div class="btn-col">${items.join('')}</div>`;
  }

  function phonesHTML() {
    const rows = deviceList().map((d) => `<div class="dev-row"><span class="sdot ${d.online ? 'on' : 'off'}"></span>
      <span class="dev-meta"><strong>${esc(d.name || t('phone'))}</strong><span>${t(d.online ? 'st_online' : 'st_offline')}</span></span>
      <button class="close-btn" data-act="dev-remove" data-v="${esc(d.dev)}" aria-label="${t('remove')}">${ICON.close}</button></div>`).join('');
    const add = S.settings.hostMode === 'nearby'
      ? `<button class="btn btn-primary" data-act="pair-qr">${t('add_phone')}</button>`
      : net.room && net.room.status === 'open' ? `<p class="hint">${esc(t('rejoin_code', { code: net.room.code }))}</p>` : '';
    return `<div class="devs">${rows || `<p class="hint">${t('no_phones')}</p>`}</div>${add}`;
  }

  function rulesHTML() {
    const id = S.session && S.session.G ? S.session.cfg.map : src().map;
    const m = MAPS.get(id), R = E.rulesOf(id);
    const special = [];
    if (R.locoUse === 'tunnelFerry') special.push(t('r_loco_tf'));
    if (R.locoUse === 'tunnel') special.push(t('r_loco_t'));
    if (R.locoDrawFree) special.push(t('r_loco_draw'));
    if (R.ferrySub) special.push(t('r_ferry_sub', { n: R.ferrySub }));
    if (m.routes.some((r) => r.sub)) special.push(t('r_sub', { n: m.routes.find((r) => r.sub).sub }));
    if (m.countries && m.countries.length) special.push(t('r_countries'));
    if (R.ticketReturn === 'box') special.push(t('r_return_box'));
    special.push(t('r_players', { a: R.players[0], b: R.players[1], trains: R.trains }));
    if (R.stations) special.push(t('r_stations', { n: R.stations, pts: R.stationPoints }));
    if (m.routes.some((r) => r.tunnel)) special.push(t('r_tunnels'));
    if (m.routes.some((r) => r.ferry)) special.push(t('r_ferries'));
    special.push(t('r_doubles', { n: R.doubleMin }));
    if (R.bonus.includes('longest')) special.push(t('r_longest', { pts: R.bonusPoints }));
    if (R.bonus.includes('globetrotter')) special.push(t('r_globe', { pts: R.bonusPoints }));
    if (R.bonus.includes('mandala')) special.push(t('r_mandala'));
    special.push(t('r_tie_' + R.tie.join('_')));
    const deal = R.deal.long ? t('r_deal_long', { long: R.deal.long, short: R.deal.short, keep: R.deal.keep }) : t('r_deal', { n: R.deal.short, keep: R.deal.keep });
    return t('rules_html', { trains: R.trains, deal, end: R.endAt })
      + `<h3>${esc(m.name)}</h3><ul>${special.map((x) => `<li>${x}</li>`).join('')}</ul>`
      + `<h3>${t('r_points')}</h3><table class="vals pts-table"><tr>${[1, 2, 3, 4, 5, 6, 7, 8, 9].filter((k) => m.routes.some((r) => r.len === k)).map((k) => `<td>${k}</td>`).join('')}</tr><tr>${[1, 2, 3, 4, 5, 6, 7, 8, 9].filter((k) => m.routes.some((r) => r.len === k)).map((k) => `<td><b>${E.routePoints(k)}</b></td>`).join('')}</tr></table>`;
  }

  // ================= LOCAL GAME FLOW =================
  function startMatch(again) {
    const c = again ? null : src(), host = hosting();
    let seats, n, map;
    if (again) {
      ({ n, map } = cfg());
      seats = cfg().seats.map((s) => Object.assign({}, s));
    } else {
      n = c.n; map = c.map;
      seats = c.seats.slice(0, n).map((s, p) => {
        const remote = host ? s.remote || null : null;
        const local = !s.cpu && !remote && !(host && s.open);
        return {
          name: (s.name.trim() || (remote ? devName(remote) : host && local ? setupName(c, p) : '')).slice(0, 16),
          cpu: !!s.cpu && !remote, level: s.level || 'normal', remote, open: host && s.open && !remote && !s.cpu,
        };
      });
      const err = (msg) => { ui.error = msg; renderSetup(); };
      const [lo, hi] = mapRange(map);
      if (n < lo || n > hi) return err(t('players_err', { a: lo, b: hi }));
      const openIdx = seats.findIndex((s) => s.open);
      if (openIdx >= 0) return err(t('open_seat_err', { n: openIdx + 1 }));
      if (!seats.some((s) => !s.cpu)) return err(t('need_human'));
      if (seats.some((s) => s.remote && !devOnline(s.remote))) return err(t('need_device'));
      seats.forEach((s) => { delete s.open; });
    }
    ui.error = '';
    stopFlow();
    S.session = { cfg: { n, map, seats }, G: E.newGame({ map, n, house: S.settings.house }) };
    ui.viewer = -1; ui.handoff = null; ui.sheet = null; ui.peek = false; ui.sel = null; ui.selCities = []; ui.toast = null; ui.keep = null;
    ui.lastSeq = S.session.G.seq;
    persist();
    showScreen('game');
    if (ui.board) ui.board.fit();
    keepAwake();
    advance();
  }

  const needsHandoff = () => opt('hideHands') && localSeats().length > 1;

  /** After every change on the phone that runs the game: save, update guests, and start whoever moves next. */
  function advance() {
    if (!S.session || !S.session.G || isGuest()) return;
    const g = G();
    noticeLog();
    persist();
    broadcastView();
    clearTimeout(ui.cpuTimer);
    const gen = ui.gen;
    if (g.phase === 'over') { ui.handoff = null; if (ui.viewer < 0) ui.viewer = localSeats()[0] != null ? localSeats()[0] : -1; render(); return; }
    const acts = E.actors(g);
    // CPU players move after a short pause (all at once while choosing their first tickets).
    const cpu = acts.find((p) => seatOf(p).cpu);
    if (cpu != null) {
      const step = g.step && g.step.drew ? 0.55 : g.phase === 'setup' ? 0.3 : 1;
      ui.cpuTimer = setTimeout(() => {
        if (gen !== ui.gen || !S.session || S.session.G !== g) return;
        let a;
        try { a = AI.choose(g, cpu, seatOf(cpu).level); E.apply(g, cpu, a); } catch (e) { console.error(e, a); try { E.apply(g, cpu, { k: 'pass' }); } catch (e2) { /* stuck */ } }
        advance();
      }, (650 + Math.random() * 300) * spd() * step);
    }
    // Local humans: show the right hand, behind a pass-the-phone screen if several people share this phone.
    const locals = acts.filter((p) => isLocal(p));
    if (locals.length) {
      const target = locals.includes(ui.viewer) && !ui.handoff ? ui.viewer : ui.handoff && locals.includes(ui.handoff.p) ? ui.handoff.p : locals[0];
      if (needsHandoff() && target !== ui.viewer) {
        if (!ui.handoff || ui.handoff.p !== target) { ui.handoff = { p: target, ready: Date.now() + 450 }; ui.viewer = -1; ui.sheet = null; ui.sel = null; }
      } else if (!needsHandoff()) {
        if (ui.viewer !== target) { ui.viewer = target; if (g.phase === 'play') sfx.turn(); }
      }
    } else if (ui.viewer < 0 && !ui.handoff) {
      const ls = localSeats();
      if (ls.length === 1 || !needsHandoff()) ui.viewer = ls[0] != null ? ls[0] : -1;
    }
    render();
  }

  /** A local player (or, on the host, a guest phone) takes action a for seat p. */
  function doAct(p, a) {
    try { E.apply(G(), p, a); } catch (e) {
      showToast(esc(t('err_' + e.message) !== 'err_' + e.message ? t('err_' + e.message) : t('err_generic')));
      sfx.bad();
      render();
      return false;
    }
    advance();
    return true;
  }

  /** The viewer's own action from the UI: applied here, or sent to the host from a guest phone. */
  function act(a) {
    const v = viewerSeat();
    if (v < 0) return;
    ui.sheet = null; ui.peek = false; ui.sel = null;
    if (isGuest()) {
      if (ui.sent) return;
      if (guestSend({ t: 'act', seat: v, a })) { ui.sent = true; render(); }
      return;
    }
    if (!isLocal(v)) return;
    doAct(v, a);
  }

  function stopFlow() {
    ui.gen++;
    clearTimeout(ui.cpuTimer);
  }

  function resume() {
    if (!S.session || !S.session.G) return;
    ui.viewer = -1; ui.handoff = null; ui.sheet = null; ui.peek = false; ui.sel = null; ui.selCities = []; ui.toast = null;
    ui.lastSeq = G().seq;
    showScreen('game');
    if (ui.board) ui.board.fit();
    advance();
  }

  function quitToSetup() {
    stopFlow(); S.session = null; ui.sheet = null; ui.handoff = null; persist(); showScreen('setup');
  }

  // ================= HOSTING =================
  function startHosting(mode) {
    if (S.settings.hostMode && S.settings.hostMode !== mode) endHosting();
    if (!S.settings.hostMode) {
      const L = S.settings.lobby;
      L.n = 2;
      L.map = S.settings.map;
      L.seats = Array.from({ length: MAX_SEATS }, (_, p) => blankSeat({ open: p > 0, name: p === 0 ? S.settings.myName : '' }));
    }
    S.settings.hostMode = mode;
    ui.screen = 'host';
    ui.error = '';
    persist();
    showScreen('setup');
    if (mode === 'online' && !net.room) openRoom(S.settings.room);
    keepAwake();
  }

  function endHosting() {
    for (const d of deviceList()) {
      if (d.link) { d.link.on('close', null); d.link.send({ t: 'bye' }); const l = d.link; setTimeout(() => l.close('host-ended'), 200); }
    }
    net.devices = {};
    closeRoom();
    S.settings.hostMode = null;
    if (S.session && S.session.cfg.seats.some((s) => s.remote)) S.session = null; // a networked game cannot continue
    ui.screen = 'home';
    persist();
    showScreen('setup');
  }

  function sendTo(d, msg) { if (d && d.link && d.online) d.link.send(msg); }

  function lobbyFor(dev) {
    const L = S.settings.lobby;
    return {
      t: 'lobby', host: hostName(), started: !!(S.session && S.session.G), n: L.n, map: L.map, mode: S.settings.hostMode, code: net.room && net.room.code,
      seats: L.seats.slice(0, L.n).map((s, p) => ({
        name: setupName(L, p), cpu: !!s.cpu && !s.remote, mine: s.remote === dev, open: !!s.open && !s.remote && !s.cpu,
        host: !s.cpu && !s.remote && !s.open,
      })),
    };
  }

  function broadcastLobby() {
    if (isGuest() || !hosting() || (S.session && S.session.G)) return;
    for (const d of deviceList()) sendTo(d, lobbyFor(d.dev));
  }

  function viewFor(dev) {
    const c = cfg();
    const mine = [];
    for (let p = 0; p < c.n; p++) if (c.seats[p].remote === dev) mine.push(p);
    const seats = c.seats.map((s) => ({
      name: s.name, cpu: s.cpu, level: s.level,
      remote: s.remote === dev ? 'me' : s.remote ? 'x' : null,
      off: s.remote && s.remote !== dev ? !devOnline(s.remote) : false,
    }));
    return { t: 'view', host: hostName(), G: E.view(G(), mine), cfg: { n: c.n, map: c.map, seats }, opts: { hideHands: S.settings.hideHands } };
  }

  function broadcastView() {
    if (isGuest() || !S.session || !S.session.G) return;
    for (const d of deviceList()) {
      if (!d.online) continue;
      if (!cfg().seats.some((s) => s.remote === d.dev)) continue;
      const msg = viewFor(d.dev);
      const key = JSON.stringify(msg);
      if (net.lastSent[d.dev] === key) continue;
      net.lastSent[d.dev] = key;
      d.link.send(msg);
    }
  }

  function sendState(d) {
    net.lastSent[d.dev] = null;
    if (S.session && S.session.G && S.session.cfg.seats.some((s) => s.remote === d.dev)) sendTo(d, viewFor(d.dev));
    else sendTo(d, lobbyFor(d.dev));
  }

  /** Wait for a guest's hello on a freshly opened link, then register the phone. */
  function adoptLink(link, via) {
    let adopted = false;
    link.on('message', (m) => {
      if (adopted || m.t !== 'hello') return;
      if (m.v !== N.PROTOCOL) { link.send({ t: 'error', code: 'ver' }); setTimeout(() => link.close('version'), 300); return; }
      adopted = true;
      registerDevice(link, via, String(m.dev || '').slice(0, 24), String(m.name || '').slice(0, 16));
    });
  }

  function registerDevice(link, via, dev, nm) {
    if (!hosting()) { link.send({ t: 'bye' }); setTimeout(() => link.close('not-hosting'), 200); return; }
    const prev = net.devices[dev];
    if (prev && prev.link && prev.link !== link) { prev.link.on('close', null); prev.link.close('replaced'); }
    const d = { dev, name: nm || (prev && prev.name) || '', link, online: true, via };
    net.devices[dev] = d;
    if (d.name) S.settings.knownDevs[dev] = d.name;
    link.on('message', (m) => onHostMessage(d, m));
    link.on('close', () => {
      if (d.link !== link) return;
      d.online = false; d.link = null;
      onDevicesChanged();
    });
    link.send({ t: 'welcome', host: hostName() });
    // A new phone takes the first open seat; the lobby grows (up to the map's limit) if every seat is taken.
    if (!(S.session && S.session.G)) {
      const L = S.settings.lobby, hi = mapRange(L.map)[1];
      if (!L.seats.slice(0, L.n).some((s) => s.remote === dev)) {
        let p = L.seats.slice(0, L.n).findIndex((s) => s.open && !s.remote && !s.cpu);
        if (p < 0 && L.n < hi) { p = L.n; L.n++; L.seats[p] = blankSeat({ open: true }); }
        if (p >= 0) L.seats[p].remote = dev;
      }
    }
    persist();
    if (net.pair && net.pair.kind === 'host-qr' && net.pair.link === link) pairDone(d);
    onDevicesChanged();
    sendState(d);
    keepAwake();
  }

  function onDevicesChanged() {
    if (!$('#setup').hidden) renderSetup();
    else { render(); broadcastView(); }
  }

  function onHostMessage(d, m) {
    switch (m.t) {
      case 'hello':
        d.link.send({ t: 'welcome', host: hostName() });
        sendState(d);
        break;
      case 'name':
        d.name = String(m.name || '').slice(0, 16);
        if (d.name) S.settings.knownDevs[d.dev] = d.name;
        persist();
        onDevicesChanged();
        break;
      case 'act': {
        const g = S.session && S.session.G, p = m.seat | 0;
        if (!g || !cfg().seats[p] || cfg().seats[p].remote !== d.dev || !m.a) return;
        try { E.apply(g, p, m.a); } catch (e) {
          sendTo(d, { t: 'err', code: e.message });
          net.lastSent[d.dev] = null;
          sendTo(d, viewFor(d.dev));
          return;
        }
        advance();
        break;
      }
      case 'leave':
        d.link.close('left');
        break;
      default:
    }
  }

  function removeDevice(dev) {
    const d = net.devices[dev];
    if (d && d.link) { d.link.on('close', null); d.link.send({ t: 'bye' }); const l = d.link; setTimeout(() => l.close('removed'), 200); }
    delete net.devices[dev];
    S.settings.lobby.seats.forEach((s) => { if (s.remote === dev) s.remote = null; });
    persist();
    onDevicesChanged();
  }

  // ---------- host: online lobby (room code) ----------
  async function openRoom(code, attempt) {
    attempt = attempt || 0;
    const fresh = !code;
    code = code || N.roomCode();
    if (net.room && net.room.broker) net.room.broker.close();
    net.room = { code, status: 'opening', broker: null };
    onDevicesChanged();
    const broker = new N.Broker(N.roomPeerId(code), N.brokerUrl());
    try {
      await broker.connect(8000);
    } catch (e) {
      if (!net.room || net.room.code !== code) return;
      if (e.message === 'id-taken') {
        if (fresh && attempt < 3) return openRoom(null, attempt + 1);
        // Our previous connection may still be registered on the server for a few seconds.
        if (attempt < 20) { setTimeout(() => { if (net.room && net.room.code === code) openRoom(code, attempt + 1); }, 3000); return; }
      }
      net.room = { code, status: 'error', err: t('broker_fail') };
      onDevicesChanged();
      return;
    }
    if (!net.room || net.room.code !== code || !hosting()) { broker.close(); return; }
    net.room = { code, status: 'open', broker };
    S.settings.room = code;
    persist();
    const pending = {};
    broker.on('message', async (m) => {
      const pl = m.payload;
      if (m.type === 'OFFER' && pl && pl.sdp && pl.sdp.sdp) {
        if (!pl.metadata || pl.metadata.v !== N.PROTOCOL) return;
        const link = new N.Link({ trickle: true, ice: onlineIce(), relayOnly: N.relayOnly() });
        pending[m.src] = link;
        link.on('candidate', (c) => broker.send('CANDIDATE', m.src, N.signal.candidate(c, pl.connectionId)));
        adoptLink(link, 'room');
        try {
          const sdp = await link.createAnswer(pl.sdp.sdp);
          broker.send('ANSWER', m.src, N.signal.answer(sdp, pl.connectionId));
          await link.whenOpen(30000);
        } catch (e) { link.close('failed'); }
        if (pending[m.src] === link) delete pending[m.src];
      } else if (m.type === 'CANDIDATE' && pending[m.src] && pl && pl.candidate) {
        pending[m.src].addCandidate(pl.candidate);
      }
    });
    broker.on('drop', () => {
      if (net.room && net.room.code === code) setTimeout(() => { if (net.room && net.room.code === code) openRoom(code, 1); }, 2000);
    });
    onDevicesChanged();
  }

  function closeRoom() {
    if (net.room && net.room.broker) net.room.broker.close();
    net.room = null;
    S.settings.room = null;
    persist();
  }

  async function shareInvite(btn) {
    const r = net.room;
    if (!r || r.status !== 'open') return;
    const url = joinUrl(r.code);
    const text = `Emi Train Game: ${t('lobby_code')} ${r.code}`;
    try {
      if (navigator.share) { await navigator.share({ title: 'Emi Train Game', text, url }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(url); btn.textContent = t('link_copied'); } catch (e) { btn.textContent = url; }
  }

  // ================= NEARBY: QR PAIRING =================
  const pairLayer = () => $('#pair-layer');
  function closePair() {
    const P = net.pair;
    if (!P) return;
    if (P.scanner) P.scanner.stop();
    if (P.link && !P.adopted && !P.link.open) P.link.close('cancelled');
    clearTimeout(P.doneTimer);
    net.pair = null;
    pairLayer().innerHTML = '';
  }
  function pairSet(id, html) { const el = document.getElementById(id); if (el) el.innerHTML = html; }
  function pairShow(id, show) { const el = document.getElementById(id); if (el) el.hidden = !show; }

  // Host side: step 1 shows our code, step 2 scans the guest's reply.
  async function hostPairQR() {
    closePair();
    if (ui.sheet && ui.sheet.type === 'phones') { ui.sheet = null; render(); }
    const P = net.pair = { kind: 'host-qr', link: null, scanner: null, busy: false, step: 1 };
    pairLayer().innerHTML = `<div class="overlay"><div class="sheet pair" role="dialog" aria-modal="true">
      <div class="sheet-head"><h2>${t('add_phone')}</h2><button class="close-btn" data-act="pair-close" aria-label="${t('close')}">${ICON.close}</button></div>
      <div id="hq-step1" class="pair-step"><span class="stepper">${t('step_of', { i: 1 })}</span><h3>${t('hq_s1')}</h3><p class="hint">${t('hq_s1_d')}</p>
        <div class="qr-box" id="pq-qr"><span class="hint">${t('connecting')}</span></div>
        <button class="btn btn-primary" data-act="pair-next">${t('hq_next')}</button></div>
      <div id="hq-step2" class="pair-step" hidden><span class="stepper">${t('step_of', { i: 2 })}</span><h3>${t('hq_s2')}</h3><p class="hint">${t('hq_s2_d')}</p></div>
      <div class="cam peek" id="hq-cam"><video id="pq-video" playsinline muted></video></div>
      <p class="pair-status" id="pq-status" role="status"></p>
      <div id="hq-back" hidden><button class="btn btn-ghost" data-act="pair-back">${t('hq_back')}</button></div>
      <details><summary>${t('trouble')}</summary>
        <div class="codebox"><textarea id="pq-mycode" readonly rows="3"></textarea><button class="btn btn-ghost" data-act="copy" data-v="pq-mycode">${t('copy')}</button></div>
        <label class="field"><span>${t('paste_reply')}</span><textarea id="pq-paste" rows="3"></textarea></label>
        <button class="btn btn-primary" data-act="pair-paste">${t('connect')}</button>
      </details></div></div>`;
    // Camera first, even though its picture is only shown in step 2: with camera access granted,
    // browsers share the phone's real LAN address, which makes the offline connection more reliable.
    try {
      P.scanner = await N.startScanner($('#pq-video'), (text) => hostGotReply(P, text));
      if (net.pair !== P) { P.scanner.stop(); return; }
    } catch (e) {
      if (net.pair !== P) return;
      P.camError = true;
    }
    try {
      const link = P.link = new N.Link({ trickle: false });
      adoptLink(link, 'qr');
      const sdp = await link.createOffer();
      const code = await N.pack({ k: 'o', v: N.PROTOCOL, s: sdp, h: hostName() });
      if (net.pair !== P) { link.close('cancelled'); return; }
      pairSet('pq-qr', N.qrSvg(code));
      const ta = $('#pq-mycode'); if (ta) ta.value = code;
    } catch (e) {
      pairSet('pq-status', t('pair_fail'));
    }
  }

  function hostPairStep(step) {
    const P = net.pair;
    if (!P || P.kind !== 'host-qr') return;
    P.step = step;
    pairShow('hq-step1', step === 1);
    pairShow('hq-step2', step === 2);
    pairShow('hq-back', step === 2);
    const cam = $('#hq-cam');
    if (cam) cam.classList.toggle('peek', step === 1);
    pairSet('pq-status', step === 2 ? (P.camError ? t('cam_denied') : t('cam_on')) : '');
  }

  async function hostGotReply(P, text) {
    if (net.pair !== P || P.busy || !P.link) return;
    P.busy = true; // the camera reports the same code several times a second: claim the attempt before any await
    let obj;
    try { obj = await N.unpack(text); } catch (e) { P.busy = false; if (P.step === 2) pairSet('pq-status', t('bad_code')); return; }
    if (obj.k !== 'a') { P.busy = false; return; } // probably our own code reflected back; keep scanning
    if (obj.v !== N.PROTOCOL) { P.busy = false; pairSet('pq-status', t('ver_mismatch')); return; }
    if (P.step !== 2) hostPairStep(2);
    pairSet('pq-status', t('connecting'));
    try {
      await P.link.acceptAnswer(obj.s);
      await P.link.whenOpen(20000);
      P.adopted = true; // registerDevice finishes the pairing once the guest says hello
    } catch (e) {
      if (net.pair !== P) return;
      P.busy = false;
      pairSet('pq-status', `${t('pair_fail')} <button class="btn btn-ghost" data-act="pair-qr">${t('add_phone')}</button>`);
    }
  }

  function pairDone(d) {
    const P = net.pair;
    if (!P) return;
    if (P.scanner) { P.scanner.stop(); P.scanner = null; }
    P.adopted = true;
    pairShow('hq-step1', false); pairShow('hq-step2', false); pairShow('hq-back', false); pairShow('hq-cam', false);
    pairSet('pq-status', `<span class="ok-mark">✓</span>${esc(t('joined_ok', { name: d.name || t('phone') }))}`);
    P.doneTimer = setTimeout(() => { if (net.pair === P) closePair(); }, 1100);
  }

  // Guest side: step 1 scans the host's code, step 2 shows our reply.
  function openNearbyJoin() {
    closePair();
    const P = net.pair = { kind: 'join', link: null, scanner: null, busy: false };
    pairLayer().innerHTML = `<div class="overlay"><div class="sheet pair" role="dialog" aria-modal="true">
      <div class="sheet-head"><h2>${t('join_nearby_t')}</h2><button class="close-btn" data-act="pair-close" aria-label="${t('close')}">${ICON.close}</button></div>
      <p class="hint">${t('join_nearby_d')}</p>
      <label class="field"><span>${t('your_name')}</span><input id="pj-name" data-myname maxlength="16" autocomplete="off" autocapitalize="words" value="${esc(S.settings.myName)}"></label>
      <div id="nj-step1" class="pair-step"><span class="stepper">${t('step_of', { i: 1 })}</span><h3>${t('nj_s1')}</h3><p class="hint">${t('nj_s1_d')}</p>
        <div class="cam" id="pj-cam"><video id="pj-video" playsinline muted></video></div></div>
      <div id="nj-step2" class="pair-step" hidden><span class="stepper">${t('step_of', { i: 2 })}</span><h3>${t('nj_s2')}</h3>
        <div class="qr-box" id="pj-reply"></div></div>
      <p class="pair-status" id="pj-status" role="status">${t('cam_start')}</p>
      <details><summary>${t('trouble')}</summary>
        <label class="field"><span>${t('paste_host')}</span><textarea id="pj-paste" rows="3"></textarea></label>
        <button class="btn btn-primary" data-act="join-paste">${t('use_code')}</button>
        <div id="pj-mycode-wrap" hidden><label class="field"><span>${t('your_reply')}</span></label><div class="codebox"><textarea id="pj-mycode" readonly rows="3"></textarea><button class="btn btn-ghost" data-act="copy" data-v="pj-mycode">${t('copy')}</button></div></div>
      </details>
    </div></div>`;
    startJoinCamera(P);
  }

  async function startJoinCamera(P) {
    try {
      P.scanner = await N.startScanner($('#pj-video'), (text) => guestGotOffer(P, text));
      if (net.pair !== P) { P.scanner.stop(); return; }
      if (!P.busy) pairSet('pj-status', t('cam_on'));
    } catch (e) {
      if (net.pair !== P) return;
      pairSet('pj-status', t('cam_denied'));
      pairShow('pj-cam', false);
    }
  }

  async function guestGotOffer(P, text) {
    if (net.pair !== P || P.busy) return;
    P.busy = true;
    let obj;
    try { obj = await N.unpack(text); } catch (e) { P.busy = false; pairSet('pj-status', t('bad_code')); return; }
    if (obj.k !== 'o') { P.busy = false; pairSet('pj-status', t('bad_code')); return; }
    if (obj.v !== N.PROTOCOL) { P.busy = false; pairSet('pj-status', t('ver_mismatch')); return; }
    pairSet('pj-status', t('connecting'));
    try {
      const link = P.link = new N.Link({ trickle: false });
      // The answer is created while the camera is still on, for the same LAN-address reason as on the host.
      const sdp = await link.createAnswer(obj.s);
      if (P.scanner) { P.scanner.stop(); P.scanner = null; }
      const code = await N.pack({ k: 'a', v: N.PROTOCOL, s: sdp, d: DEV, n: S.settings.myName });
      pairShow('nj-step1', false);
      pairSet('pj-reply', N.qrSvg(code));
      pairShow('nj-step2', true);
      const ta = $('#pj-mycode'); if (ta) ta.value = code;
      pairShow('pj-mycode-wrap', true);
      pairSet('pj-status', t('nj_wait'));
      await link.whenOpen(180000);
      if (net.pair !== P) return;
      P.adopted = true;
      closePair();
      becomeGuest(link, 'qr', obj.h, null);
    } catch (e) {
      if (net.pair !== P) return;
      P.busy = false;
      pairSet('pj-status', t('pair_fail'));
    }
  }

  // ================= ONLINE: JOIN WITH A CODE =================
  /** Join an online lobby by code: direct when possible, through the TURN relay when networks block that.
   *  With `silent`, used for automatic reconnection. */
  async function joinRoom(code, silent) {
    code = N.normaliseRoom(code);
    const status = (k) => { if (!silent) { ui.joinStatus = t(k); pairSet('pj-room-status', esc(ui.joinStatus)); } };
    if (code.length !== 5) { status('room_fail'); return false; }
    if (!silent) { net.joining = true; ui.joinCode = code; const b = $('#join-btn'); if (b) { b.disabled = true; b.textContent = t('joining'); } }
    const done = (ok) => {
      if (!silent) { net.joining = false; const b = $('#join-btn'); if (b) { b.disabled = false; b.textContent = t('join'); } }
      return ok;
    };
    status('connecting');
    const hostId = N.roomPeerId(code);
    const broker = new N.Broker(`et-${DEV}-${Math.random().toString(36).slice(2, 6)}`, N.brokerUrl());
    try { await broker.connect(8000); } catch (e) { status('broker_fail'); return done(false); }

    const cid = N.signal.connectionId();
    const link = new N.Link({ trickle: true, ice: onlineIce(), relayOnly: N.relayOnly() });
    let answered = false, expired = false;
    link.on('candidate', (c) => broker.send('CANDIDATE', hostId, N.signal.candidate(c, cid)));
    broker.on('message', (m) => {
      if (m.type === 'EXPIRE') { expired = true; link.close('expired'); return; }
      if (m.src !== hostId || !m.payload) return;
      if (m.type === 'ANSWER' && m.payload.sdp && m.payload.sdp.sdp) {
        answered = true;
        link.acceptAnswer(m.payload.sdp.sdp).catch(() => link.close('bad-answer'));
      } else if (m.type === 'CANDIDATE' && m.payload.candidate) {
        link.addCandidate(m.payload.candidate);
      }
    });
    try {
      const sdp = await link.createOffer();
      broker.send('OFFER', hostId, N.signal.offer(sdp, cid, { v: N.PROTOCOL, dev: DEV }));
      await link.whenOpen(20000); // long enough for a connection through the TURN relay
    } catch (e) {
      const ice = link.pc.iceConnectionState;
      link.close('failed');
      broker.close();
      status(expired || !answered ? 'room_fail' : 'p2p_fail'); // no answer at all means nobody is hosting that code
      if (!silent && answered) pairSet('pj-room-status', `${esc(ui.joinStatus)}<small class="diag">ICE: ${esc(ice)}</small>`);
      return done(false);
    }
    broker.close();
    S.settings.lastRoom = code;
    persist();
    becomeGuest(link, 'room', null, code);
    return done(true);
  }

  // ================= GUEST =================
  function becomeGuest(link, mode, hostNm, code) {
    if (!isGuest()) { S.savedSession = S.session; stopFlow(); }
    net.role = 'guest';
    const prevLobby = net.guest && net.guest.lobby;
    net.guest = { link, mode, code, hostName: hostNm || (net.guest && net.guest.hostName) || '', status: 'online', lobby: prevLobby || null };
    const gst = net.guest;
    link.on('message', onGuestMessage);
    link.on('close', () => { if (net.guest === gst && gst.link === link) onGuestLost(); });
    // Say hello until the host answers: the first message on a fresh channel is occasionally lost.
    const hello = () => {
      if (net.guest !== gst || gst.link !== link || gst.welcomed || link.closed) return;
      link.send({ t: 'hello', v: N.PROTOCOL, dev: DEV, name: S.settings.myName });
      setTimeout(hello, 1000);
    };
    hello();
    if (!S.session || !S.session.opts) { S.session = null; ui.sheet = null; showScreen('setup'); } else render();
    keepAwake();
  }

  function onGuestLost() {
    const gst = net.guest;
    if (!gst) return;
    gst.status = 'lost'; gst.link = null; gst.welcomed = false;
    ui.sent = false;
    if (!$('#setup').hidden) renderSetup(); else render();
    if (gst.mode === 'room') retryRoom(gst);
  }

  async function retryRoom(gst) {
    while (net.guest === gst && gst.status === 'lost') {
      const ok = await joinRoom(gst.code, true);
      if (ok) return;
      await sleep(4000);
    }
  }

  function leaveGuest(notice) {
    const gst = net.guest;
    S.settings.lastRoom = null;
    if (gst && gst.link) { gst.link.send({ t: 'leave' }); const l = gst.link; setTimeout(() => l.close('left'), 150); }
    net.role = null;
    net.guest = null;
    S.session = S.savedSession;
    S.savedSession = null;
    ui.viewer = -1; ui.handoff = null; ui.sheet = notice ? { type: 'notice', text: notice } : null; ui.sent = false;
    ui.screen = 'home';
    persist();
    showScreen('setup');
    render();
  }

  function onGuestMessage(m) {
    const gst = net.guest;
    if (!gst) return;
    switch (m.t) {
      case 'welcome': gst.hostName = m.host; gst.status = 'online'; gst.welcomed = true; if (!$('#setup').hidden) renderSetup(); else render(); break;
      case 'lobby':
        gst.lobby = m;
        gst.hostName = m.host;
        if (!m.started || (S.session && S.session.G)) {
          S.session = null;
          ui.handoff = null; ui.sheet = null; ui.viewer = -1;
          showScreen('setup');
        }
        break;
      case 'view': applyView(m); break;
      case 'err': ui.sent = false; showToast(esc(t('err_' + m.code) !== 'err_' + m.code ? t('err_' + m.code) : t('err_generic'))); sfx.bad(); render(); break;
      case 'bye': leaveGuest(); break;
      case 'error': if (m.code === 'ver') leaveGuest(t('ver_mismatch')); break;
      default:
    }
  }

  function applyView(m) {
    const first = !S.session || !S.session.G || $('#game').hidden || (S.session.G.map !== m.G.map) || m.G.seq < ui.lastSeq;
    net.guest.hostName = m.host;
    S.session = { cfg: m.cfg, G: m.G, opts: m.opts };
    ui.sent = false;
    const locals = localSeats();
    if (!locals.includes(ui.viewer)) ui.viewer = locals[0] != null ? locals[0] : -1;
    const acts = E.actors(m.G).filter((p) => locals.includes(p));
    if (acts.length && !acts.includes(ui.viewer)) ui.viewer = acts[0];
    if (first) {
      ui.lastSeq = m.G.seq; ui.sheet = null; ui.sel = null; ui.selCities = [];
      showScreen('game');
      if (ui.board) ui.board.fit();
    } else {
      const wasMine = ui.wasMyTurn;
      noticeLog();
      if (myTurn() && !wasMine) sfx.turn();
    }
    ui.wasMyTurn = myTurn();
    render();
  }

  function guestSend(msg) {
    const gst = net.guest;
    return !!(gst && gst.link && gst.link.send(msg));
  }

  // ================= EVENTS =================
  function setSeatKind(p, kind) {
    const c = src(), s = c.seats[p];
    if (kind === 'c') { s.cpu = true; s.remote = null; s.open = false; }
    else if (kind === 'h') { s.cpu = false; s.remote = null; s.open = false; }
    else if (kind === 'o') {
      s.cpu = false; s.open = true;
      if (!s.remote) {
        const used = new Set(c.seats.slice(0, c.n).map((x) => x.remote).filter(Boolean));
        const free = deviceList().find((d) => d.online && !used.has(d.dev));
        s.remote = free ? free.dev : null;
      }
    }
  }

  async function copyFrom(id) {
    const ta = document.getElementById(id);
    if (!ta || !ta.value) return;
    try { await navigator.clipboard.writeText(ta.value); } catch (e) { ta.select(); try { document.execCommand('copy'); } catch (err) { /* ignore */ } }
  }

  function showTicketOnMap(id) {
    const cs = ticketCities(MAP().tickets[id]);
    ui.selCities = cs;
    ui.sel = null;
    if (ui.sheet && (ui.sheet.type === 'offer' || ui.sheet.type === 'tunnel')) ui.peek = true;
    else ui.sheet = null;
    render();
    if (ui.board) ui.board.focus(cs);
  }

  document.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-act]');
    if (!el) return;
    const a = el.dataset.act, v = el.dataset.v, st = S.settings;
    if (a === 'backdrop' && ev.target !== el) return; // clicks inside the sheet
    if (a.startsWith('seat-kind-')) {
      setSeatKind(+a.slice(10), v);
      ui.error = '';
      persist(); renderSetup(); return;
    }
    switch (a) {
      // ----- navigation -----
      case 'go-home': ui.screen = 'home'; ui.error = ''; ui.joinStatus = ''; renderSetup(); return;
      case 'go-local': ui.screen = 'local'; ui.error = ''; renderSetup(); return;
      case 'host-online': startHosting('online'); return;
      case 'host-nearby': startHosting('nearby'); return;
      case 'join-online': ui.screen = 'join'; ui.joinStatus = ''; renderSetup(); return;
      case 'join-nearby': openNearbyJoin(); return;
      case 'host-end':
        if (hasDevices()) { ui.sheet = { type: 'confirm', text: 'confirm_end', yes: 'end_lobby', act: 'host-end-yes' }; render(); }
        else endHosting();
        return;
      case 'host-end-yes': ui.sheet = null; render(); endHosting(); return;
      // ----- setup -----
      case 'n': { const c = src(), [lo, hi] = mapRange(c.map); c.n = Math.max(lo, Math.min(hi, +v)); ui.error = ''; break; }
      case 'speed': st.speed = v; break;
      case 'lang': st.lang = v; break;
      case 'deal': persist(); startMatch(false); return;
      case 'resume': resume(); return;
      case 'maps': ui.sheet = { type: 'maps' }; render(); return;
      case 'pick-map': {
        const c = src(), [lo, hi] = mapRange(v);
        c.map = v;
        if (!hosting()) st.map = v;
        c.n = Math.max(lo, Math.min(hi, c.n));
        ui.sheet = null; ui.error = '';
        persist(); renderSetup(); render(); return;
      }
      case 'rules': ui.sheet = { type: 'rules' }; render(); return;
      // ----- game: board and tray -----
      case 'zoom-in': if (ui.board) ui.board.zoomBy(1.5); return;
      case 'zoom-out': if (ui.board) ui.board.zoomBy(1 / 1.5); return;
      case 'zoom-fit': if (ui.board) ui.board.fit(); return;
      case 'take': act({ k: 'card', slot: +v }); return;
      case 'draw-tickets': act({ k: 'tickets' }); return;
      case 'claim': act({ k: 'claim', r: +el.dataset.r, cards: el.dataset.cards.split(',').map(Number) }); return;
      case 'station': act({ k: 'station', city: +el.dataset.city, cards: el.dataset.cards.split(',').map(Number) }); return;
      case 'tunnel-pay': act({ k: 'tunnel', pay: true, cards: el.dataset.cards.split(',').map(Number) }); return;
      case 'tunnel-no': act({ k: 'tunnel', pay: false }); return;
      case 'pick-route': ui.sel = +v; ui.selCities = []; ui.sheet = { type: 'route', r: +v }; render(); return;
      case 'keep-toggle': {
        if (ev.target.closest('[data-act="ticket-show"]')) return;
        const id = +v;
        if (ui.keep.ids.has(id)) ui.keep.ids.delete(id); else ui.keep.ids.add(id);
        render(); return;
      }
      case 'ticket-show': ev.stopPropagation(); showTicketOnMap(+v); return;
      case 'keep-ok': act({ k: 'keep', ids: Array.from(ui.keep.ids) }); return;
      case 'my-tickets': ui.sheet = { type: 'my-tickets' }; ui.selCities = []; render(); return;
      case 'peek': ui.peek = true; render(); return;
      case 'unpeek': ui.peek = false; ui.selCities = []; render(); return;
      // ----- game: menu -----
      case 'menu': ui.sheet = { type: 'menu' }; render(); return;
      case 'phones': ui.sheet = { type: 'phones' }; render(); return;
      case 'show-log': ui.sheet = { type: 'log' }; render(); return;
      case 'close': case 'backdrop': ui.sheet = null; ui.sel = null; render(); return;
      case 'toggle-sound': st.sound = !st.sound; persist(); render(); return;
      case 'toggle-hide': st.hideHands = !st.hideHands; persist(); ui.sheet = null; advance(); return;
      case 'ask-quit': ui.sheet = { type: 'confirm', text: 'confirm_quit', yes: 'yes_quit', act: 'quit' }; render(); return;
      case 'ask-leave': ui.sheet = { type: 'confirm', text: 'confirm_leave', yes: 'leave', act: 'guest-leave' }; render(); return;
      case 'quit': quitToSetup(); return;
      case 'new-game': startMatch(true); return;
      case 'guest-leave': leaveGuest(); return;
      case 'reveal': {
        const h = ui.handoff;
        if (!h || Date.now() < h.ready) return;
        ui.viewer = h.p; ui.handoff = null;
        if (G().phase === 'play' && G().turn === h.p) sfx.turn();
        render();
        return;
      }
      // ----- connections -----
      case 'pair-qr': hostPairQR(); return;
      case 'pair-next': hostPairStep(2); return;
      case 'pair-back': hostPairStep(1); return;
      case 'pair-close': closePair(); return;
      case 'pair-paste': { const P = net.pair; const ta = $('#pq-paste'); if (P && ta && ta.value.trim()) { if (P.step !== 2) hostPairStep(2); hostGotReply(P, ta.value); } return; }
      case 'copy': copyFrom(v); el.textContent = t('copied'); return;
      case 'room-retry': openRoom(S.settings.room); return;
      case 'turn-save': { const ta = $('#turn-text'); S.settings.turn = ta ? ta.value.trim() : ''; persist(); renderSetup(); return; }
      case 'turn-clear': S.settings.turn = ''; persist(); renderSetup(); return;
      case 'share-link': shareInvite(el); return;
      case 'dev-remove': removeDevice(v); return;
      case 'join-paste': { const P = net.pair; const ta = $('#pj-paste'); if (P && ta && ta.value.trim()) guestGotOffer(P, ta.value); return; }
      case 'join-room': { const inp = $('#pj-room'); if (inp && !net.joining) joinRoom(inp.value, false); return; }
      default: return;
    }
    persist();
    renderSetup();
  });

  document.addEventListener('input', (ev) => {
    const el = ev.target;
    if (el.dataset.name != null) {
      const p = +el.dataset.name, s = src().seats[p];
      s.name = el.value;
      if (hosting() && !s.cpu && !s.remote && !s.open) S.settings.myName = el.value.slice(0, 16);
      persist();
    } else if (el.dataset.myname != null) {
      S.settings.myName = el.value.slice(0, 16);
      persist();
    } else if (el.id === 'pj-room') {
      el.value = N.normaliseRoom(el.value);
      ui.joinCode = el.value;
    }
  });
  document.addEventListener('change', (ev) => {
    const el = ev.target;
    if (el.dataset.set) {
      S.settings[el.dataset.set] = el.checked;
      if (el.dataset.set === 'house') {
        // Turning the house rule off brings the player count back inside the board's official range.
        for (const c of [S.settings, S.settings.lobby]) { const [lo, hi] = mapRange(c.map); c.n = Math.max(lo, Math.min(hi, c.n)); }
        renderSetup();
      }
      persist(); broadcastLobby();
    }
    else if (el.dataset.level != null) { src().seats[+el.dataset.level].level = el.value; persist(); }
    else if (el.dataset.dev != null) { const s = src().seats[+el.dataset.dev]; s.remote = el.value || null; s.open = true; persist(); renderSetup(); }
    else if (el.dataset.name != null) broadcastLobby();
    else if (el.dataset.myname != null && isGuest()) guestSend({ t: 'name', name: S.settings.myName });
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      if (net.pair) closePair();
      else if (ui.sheet && !['offer', 'tunnel', 'summary'].includes(ui.sheet.type)) { ui.sheet = null; ui.sel = null; render(); }
    }
    if (ev.key === 'Enter' && ev.target.id === 'pj-room' && !net.joining) joinRoom(ev.target.value, false);
  });

  // ================= BOOT =================
  function start() {
    const saved = store.load();
    if (saved && saved.settings) {
      S.settings = Object.assign(JSON.parse(JSON.stringify(DEFAULTS)), saved.settings);
      const fix = (c, open) => {
        if (!c || !Array.isArray(c.seats)) return false;
        while (c.seats.length < MAX_SEATS) c.seats.push(blankSeat(open ? { open: true } : { cpu: true }));
        c.seats = c.seats.map((s) => blankSeat(s));
        if (!MAPS.get(c.map)) c.map = 'europe';
        return true;
      };
      if (!fix(S.settings, false)) { S.settings.seats = seatsInit(false); S.settings.map = 'europe'; }
      S.settings.seats.forEach((s) => { s.remote = null; s.open = false; });
      if (!fix(S.settings.lobby, true)) S.settings.lobby = JSON.parse(JSON.stringify(DEFAULTS.lobby));
      if (!S.settings.knownDevs) S.settings.knownDevs = {};
      if (saved.session && saved.session.G && saved.session.G.v === 2 && MAPS.get(saved.session.G.map)) S.session = saved.session;
    }
    if (!N) S.settings.hostMode = null;
    ui.screen = S.settings.hostMode ? 'host' : 'home';
    let join = null;
    if (N) {
      try {
        const q = new URLSearchParams(location.search);
        join = q.get('join');
        if (join) { q.delete('join'); history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash); }
      } catch (e) { /* ignore */ }
    }
    if (join && !S.settings.hostMode) { ui.screen = 'join'; ui.joinCode = N.normaliseRoom(join); }
    else if (!S.settings.hostMode && S.settings.lastRoom && N) { ui.screen = 'join'; ui.joinCode = S.settings.lastRoom; }
    showScreen('setup');
    if (S.settings.hostMode === 'online') openRoom(S.settings.room); // reopen so guests can reconnect after a reload
  }

  // Test hook: lets automated tests drive pairing and inspect state without cameras.
  window.__emitrain = { net, S, ui, joinRoom, openRoom, hostPairQR, openNearbyJoin, E, AI };
  start();
})();
