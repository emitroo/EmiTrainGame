/* Phone-to-phone networking for Emi Train Game (shared design with EBriscola).
 *
 * Transport: one WebRTC data channel per guest phone (works in Chrome on Android and Safari on iOS).
 * Pairing, two ways:
 *   - QR (offline): host shows an offer code, guest scans it and shows an answer code, host scans that.
 *     No server and no internet: both phones only need to share a Wi-Fi network or hotspot.
 *   - Room code (internet): a PeerJS signalling server relays the connection setup, then game traffic
 *     goes directly between the phones.
 */
(function (root) {
  'use strict';

  const PROTOCOL = 1;
  // Deployment overrides (src/config.js): a self-hosted signalling server and relay, e.g. on AWS.
  const CFG = root.EMT_CONFIG || {};
  const DEFAULT_BROKER = CFG.broker || 'wss://0.peerjs.com/peerjs?key=peerjs';
  const STUN = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' }];
  // Relay (TURN) servers for online games, used only when two phones cannot reach each other directly,
  // which is common when both are on mobile data. Metered.ca account of the game's owner.
  // These are visible to anyone who opens the page: limit or rotate them in the Metered dashboard.
  const TURN_USER = '27324b23faaae7d28cd39449', TURN_PASS = 'cixkNKYCrqW/8iZg';
  const TURN = [{
    urls: [
      'turn:global.relay.metered.ca:80',
      'turn:global.relay.metered.ca:80?transport=tcp',
      'turn:global.relay.metered.ca:443',
      'turns:global.relay.metered.ca:443?transport=tcp',
    ],
    username: TURN_USER, credential: TURN_PASS,
  }];
  const ONLINE_ICE = STUN.concat([{ urls: 'stun:stun.relay.metered.ca:80' }], Array.isArray(CFG.iceServers) && CFG.iceServers.length ? CFG.iceServers : TURN);

  /** Test switch: ?relay=1 forces online connections through the TURN relay, as on a blocking network. */
  function relayOnly() {
    try { return new URLSearchParams(location.search).get('relay') === '1'; } catch (e) { return false; }
  }

  /** Pull TURN server details out of whatever a provider shows (JSON, or a JavaScript iceServers snippet).
   *  Returns RTCIceServer entries, or null if no TURN URL with credentials was found. */
  function parseIceConfig(text) {
    text = String(text || '');
    const urls = text.match(/turns?:[^\s"',\]\}]+/g);
    const user = /username["']?\s*[:=]\s*["']([^"']+)["']/.exec(text);
    const cred = /credential["']?\s*[:=]\s*["']([^"']+)["']/.exec(text);
    if (!urls || !user || !cred) return null;
    return [{ urls: Array.from(new Set(urls)), username: user[1], credential: cred[1] }];
  }

  // ---------- compact codes for QR / copy-paste ----------
  const b64url = {
    enc(bytes) {
      let s = '';
      for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
      return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    },
    dec(str) {
      const s = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
      const out = new Uint8Array(s.length);
      for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
      return out;
    },
  };

  async function pipeBytes(bytes, stream) {
    const res = new Response(new Blob([bytes]).stream().pipeThrough(stream));
    return new Uint8Array(await res.arrayBuffer());
  }

  function compressionFormat() {
    if (typeof CompressionStream === 'undefined') return null;
    for (const f of ['deflate-raw', 'deflate']) {
      try { new CompressionStream(f); return f; } catch (e) { /* unsupported */ }
    }
    return null;
  }

  /** Object -> short ASCII code. Format: T1.<r|d|j>.<base64url> (EBriscola uses B1, so the two games never mix up codes). */
  async function pack(obj) {
    const bytes = new TextEncoder().encode(JSON.stringify(obj));
    const fmt = compressionFormat();
    if (fmt) {
      const z = await pipeBytes(bytes, new CompressionStream(fmt));
      return `T1.${fmt === 'deflate-raw' ? 'r' : 'd'}.${b64url.enc(z)}`;
    }
    return `T1.j.${b64url.enc(bytes)}`;
  }

  async function unpack(code) {
    const m = /^T1\.([rdj])\.([A-Za-z0-9_-]+)$/.exec(String(code).trim().replace(/\s+/g, ''));
    if (!m) throw new Error('bad-code');
    let bytes = b64url.dec(m[2]);
    if (m[1] !== 'j') {
      if (typeof DecompressionStream === 'undefined') throw new Error('no-decompress');
      bytes = await pipeBytes(bytes, new DecompressionStream(m[1] === 'r' ? 'deflate-raw' : 'deflate'));
    }
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  // Drop SDP lines a data-channel-only session does not need, to keep QR codes small.
  function slimSdp(sdp) {
    return sdp.split(/\r\n/).filter((l) => {
      if (/^a=(extmap-allow-mixed|msid-semantic)/.test(l)) return false;
      if (/^a=candidate:/.test(l) && / tcp /i.test(l)) return false;
      return true;
    }).join('\r\n');
  }

  // Both link types ping every 4 s and give up after 15 s of silence.
  function startKeepalive(link) {
    link.lastSeen = Date.now();
    link.pingTimer = setInterval(() => {
      if (Date.now() - link.lastSeen > 15000) { link.close('timeout'); return; }
      link.send({ t: 'ping' });
    }, 4000);
  }

  // ---------- one peer connection with a JSON data channel ----------
  class Link {
    constructor(opts) {
      opts = opts || {};
      this.trickle = !!opts.trickle;
      this.pc = new RTCPeerConnection({ iceServers: opts.ice || [], iceTransportPolicy: opts.relayOnly ? 'relay' : 'all' });
      this.handlers = {};
      this.pending = [];
      this.open = false;
      this.closed = false;
      this.lastSeen = Date.now();
      this.pc.onicecandidate = (e) => { if (e.candidate && e.candidate.candidate && this.trickle) this.emit('candidate', e.candidate); };
      this.pc.onconnectionstatechange = () => {
        const s = this.pc.connectionState;
        if (s === 'failed' || s === 'closed') this.close('pc-' + s);
      };
      this.pc.ondatachannel = (e) => this.bind(e.channel);
    }
    on(ev, fn) { this.handlers[ev] = fn; return this; }
    emit(ev, a, b) { const f = this.handlers[ev]; if (f) { try { f(a, b); } catch (e) { console.error(e); } } }
    bind(dc) {
      this.dc = dc;
      dc.onopen = () => {
        if (this.open) return;
        this.open = true;
        startKeepalive(this);
        this.emit('open');
      };
      dc.onmessage = (e) => {
        this.lastSeen = Date.now();
        let m;
        try { m = JSON.parse(e.data); } catch (err) { return; }
        if (m && m.t !== 'ping') this.emit('message', m);
      };
      dc.onclose = () => this.close('dc-close');
      if (dc.readyState === 'open') dc.onopen();
    }
    send(m) {
      if (this.dc && this.dc.readyState === 'open') {
        try { this.dc.send(JSON.stringify(m)); return true; } catch (e) { return false; }
      }
      return false;
    }
    /** Resolves once the send buffer is below max bytes, so large transfers don't starve game messages. */
    async drain(max = 262144) {
      while (this.dc && this.dc.readyState === 'open' && this.dc.bufferedAmount > max) await new Promise((r) => setTimeout(r, 40));
      return !!(this.dc && this.dc.readyState === 'open');
    }
    gathered(ms) {
      if (this.pc.iceGatheringState === 'complete') return Promise.resolve();
      return new Promise((res) => {
        const tm = setTimeout(res, ms);
        this.pc.addEventListener('icegatheringstatechange', () => {
          if (this.pc.iceGatheringState === 'complete') { clearTimeout(tm); res(); }
        });
      });
    }
    async createOffer() {
      this.bind(this.pc.createDataChannel('emitrain', { ordered: true }));
      await this.pc.setLocalDescription(await this.pc.createOffer());
      if (!this.trickle) await this.gathered(5000);
      return slimSdp(this.pc.localDescription.sdp);
    }
    async createAnswer(offerSdp) {
      await this.pc.setRemoteDescription({ type: 'offer', sdp: offerSdp });
      await this.flush();
      await this.pc.setLocalDescription(await this.pc.createAnswer());
      if (!this.trickle) await this.gathered(5000);
      return slimSdp(this.pc.localDescription.sdp);
    }
    async acceptAnswer(answerSdp) {
      await this.pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });
      await this.flush();
    }
    async addCandidate(c) {
      if (!this.pc.remoteDescription) { this.pending.push(c); return; }
      try { await this.pc.addIceCandidate(c); } catch (e) { /* stale candidate */ }
    }
    async flush() {
      const list = this.pending.splice(0);
      for (const c of list) { try { await this.pc.addIceCandidate(c); } catch (e) { /* ignore */ } }
    }
    /** Resolves when the channel opens, rejects on close or timeout. */
    whenOpen(ms) {
      if (this.open) return Promise.resolve();
      return new Promise((res, rej) => {
        const tm = setTimeout(() => rej(new Error('timeout')), ms);
        const prevOpen = this.handlers.open, prevClose = this.handlers.close;
        this.handlers.open = () => { clearTimeout(tm); this.handlers.open = prevOpen; if (prevOpen) prevOpen(); res(); };
        this.handlers.close = (r) => { clearTimeout(tm); this.handlers.close = prevClose; if (prevClose) prevClose(r); rej(new Error(r || 'closed')); };
      });
    }
    close(reason) {
      if (this.closed) return;
      this.closed = true;
      this.open = false;
      clearInterval(this.pingTimer);
      try { if (this.dc) this.dc.close(); } catch (e) { /* ignore */ }
      try { this.pc.close(); } catch (e) { /* ignore */ }
      this.emit('close', reason);
    }
  }

  // ---------- signalling message shapes ----------
  // The public PeerJS server only relays messages shaped like the official PeerJS client's, and drops the
  // connection of anyone sending anything else. These builders produce exactly those shapes.
  const signal = {
    connectionId: () => 'dc_' + Math.random().toString(36).slice(2, 12),
    offer: (sdp, connectionId, metadata) => ({
      sdp: { type: 'offer', sdp }, type: 'data', connectionId, browser: 'chrome', label: connectionId,
      reliable: true, serialization: 'json', metadata,
    }),
    answer: (sdp, connectionId) => ({ sdp: { type: 'answer', sdp }, type: 'data', connectionId, browser: 'chrome' }),
    candidate: (c, connectionId) => ({
      candidate: { candidate: c.candidate, sdpMid: c.sdpMid, sdpMLineIndex: c.sdpMLineIndex }, type: 'data', connectionId,
    }),
  };

  // ---------- PeerJS-compatible signalling client ----------
  class Broker {
    constructor(id, url) {
      this.id = id;
      this.url = url || DEFAULT_BROKER;
      this.handlers = {};
      this.ws = null;
      this.closed = false;
    }
    on(ev, fn) { this.handlers[ev] = fn; return this; }
    emit(ev, a) { const f = this.handlers[ev]; if (f) { try { f(a); } catch (e) { console.error(e); } } }
    connect(ms) {
      return new Promise((res, rej) => {
        const token = Math.random().toString(36).slice(2, 12);
        const sep = this.url.includes('?') ? '&' : '?';
        let ws;
        try { ws = new WebSocket(`${this.url}${sep}id=${encodeURIComponent(this.id)}&token=${token}&version=1.5.4`); }
        catch (e) { rej(new Error('broker-unreachable')); return; }
        this.ws = ws;
        let opened = false;
        const tm = setTimeout(() => { if (!opened) { try { ws.close(); } catch (e) { /* ignore */ } rej(new Error('broker-unreachable')); } }, ms || 8000);
        ws.onmessage = (e) => {
          let m;
          try { m = JSON.parse(e.data); } catch (err) { return; }
          if (m.type === 'OPEN') {
            opened = true; clearTimeout(tm);
            this.hb = setInterval(() => this.raw({ type: 'HEARTBEAT' }), 5000);
            res();
          } else if (m.type === 'ID-TAKEN' || (m.type === 'ERROR' && !opened)) {
            clearTimeout(tm); rej(new Error(m.type === 'ID-TAKEN' ? 'id-taken' : 'broker-error'));
            try { ws.close(); } catch (err) { /* ignore */ }
          } else {
            this.emit('message', m);
          }
        };
        ws.onerror = () => { if (!opened) { clearTimeout(tm); rej(new Error('broker-unreachable')); } };
        ws.onclose = () => {
          clearInterval(this.hb);
          if (!opened) { clearTimeout(tm); rej(new Error('broker-unreachable')); return; }
          if (!this.closed) this.emit('drop');
        };
      });
    }
    raw(m) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(m)); }
    send(type, dst, payload) { this.raw({ type, dst, payload }); }
    close() { this.closed = true; clearInterval(this.hb); try { if (this.ws) this.ws.close(); } catch (e) { /* ignore */ } }
  }

  // ---------- QR ----------
  function qrSvg(text) {
    const qr = root.qrcode(0, 'L');
    qr.addData(text, 'Byte');
    qr.make();
    return qr.createSvgTag({ cellSize: 4, margin: 3, scalable: true });
  }

  /** Start the camera into `video` and call onText for every QR code seen. Returns {stop, active}. */
  async function startScanner(video, onText) {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    video.setAttribute('playsinline', '');
    video.muted = true;
    video.srcObject = stream;
    try { await video.play(); } catch (e) { /* autoplay quirks: frames still arrive */ }
    let detector = null;
    if ('BarcodeDetector' in root) {
      try {
        const formats = await root.BarcodeDetector.getSupportedFormats();
        if (formats.includes('qr_code')) detector = new root.BarcodeDetector({ formats: ['qr_code'] });
      } catch (e) { detector = null; }
    }
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    let running = true, timer = null;
    async function tick() {
      if (!running) return;
      try {
        if (video.readyState >= 2 && video.videoWidth) {
          let text = null;
          if (detector) {
            const found = await detector.detect(video);
            if (found.length) text = found[0].rawValue;
          } else {
            const scale = Math.min(1, 720 / Math.max(video.videoWidth, video.videoHeight));
            canvas.width = Math.round(video.videoWidth * scale);
            canvas.height = Math.round(video.videoHeight * scale);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const hit = root.jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
            if (hit) text = hit.data;
          }
          if (text && running) onText(text);
        }
      } catch (e) { /* keep scanning */ }
      if (running) timer = setTimeout(tick, 140);
    }
    tick();
    return {
      stream,
      stop() {
        running = false;
        clearTimeout(timer);
        stream.getTracks().forEach((t) => t.stop());
        video.srcObject = null;
      },
    };
  }

  function deviceId() {
    const KEY = 'emitrain.dev';
    let id = null;
    try { id = localStorage.getItem(KEY); } catch (e) { /* ignore */ }
    if (!id) {
      id = Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 10);
      try { localStorage.setItem(KEY, id); } catch (e) { /* ignore */ }
    }
    return id;
  }

  const ROOM_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  function roomCode() {
    const b = crypto.getRandomValues(new Uint8Array(5));
    return Array.from(b, (x) => ROOM_ALPHABET[x % ROOM_ALPHABET.length]).join('');
  }
  const normaliseRoom = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
  const roomPeerId = (code) => `emitrain-${code}`;

  function brokerUrl() {
    try {
      const q = new URLSearchParams(location.search).get('broker');
      if (q) return q;
    } catch (e) { /* ignore */ }
    return DEFAULT_BROKER;
  }

  root.TrainNet = {
    PROTOCOL, STUN, ONLINE_ICE, parseIceConfig, relayOnly, Link, Broker, signal, pack, unpack, qrSvg, startScanner, deviceId, roomCode, normaliseRoom, roomPeerId, brokerUrl,
    supported: () => typeof RTCPeerConnection !== 'undefined',
  };
})(typeof self !== 'undefined' ? self : this);
