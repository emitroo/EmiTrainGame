# Emi Train Game

A route-building train game for 2 to 5 players, after the board game Ticket to Ride, on one phone passed around or on
separate phones. Same design as [EBriscola](https://github.com/emitroo/EBriscola): one web page, no app store, no
accounts, works offline once loaded.

Live at https://emitroo.github.io/EmiTrainGame/ once GitHub Pages is switched on (below).

## Features

- **Five maps**, chosen in setup. Europe is the default.
  - **Europe**: the classic Europe board's 47 cities, 101 routes and 46 destination tickets, with tunnels, ferries and
    stations. 2–5 players, 45 trains, 1 long + 3 short tickets (keep 2), longest-path bonus.
  - **North America**: the coast-to-coast classic. 2–5 players, longest-path bonus.
  - **Nordic Countries**: 2–3 players, 40 trains, ferries, fjord tunnels, a 9-car route, Globetrotter bonus.
  - **Britain & Ireland**: short, tactical routes; Irish Sea and Channel ferries; 35 trains; 2–4 players.
  - **India**: Mandala bonus for joining a ticket's cities by two separate paths, plus Globetrotter. 2–4 players.
- **Rules**: draw 2 cards (a face-up locomotive is the whole turn), claim a route, or draw tickets; three face-up
  locomotives clear the market; double routes closed below 4 players (Nordic: 3); tunnels turn over 3 cards; ferries
  need locomotives; stations borrow one opponent route each at the end (best choice picked automatically); last round
  at 2 trains.
- **One phone for everyone** with a pass-the-phone screen that hides each hand (can be turned off), or **separate
  phones**, **CPU players** (Easy / Normal / Hard) in any seat, or a mix.
- **Belle Époque look** after the Europe box: parchment map with engraved sea and real coastlines (Natural Earth),
  burgundy and gold, printed-card style train cards with a symbol per colour for colour-blind players. Pinch-zoom and
  pan the map; tap a route to claim it, tap a city to build a station.
- English and Italian. Autosaves: closing the browser mid-game loses nothing.

The Europe board's cities, connections, lengths, tunnels/ferries and ticket values were checked against two public
data sets (see `maps-src/europe.mjs`); route colours are from the board as best known and are balanced 20–23 cars per
colour. The other four maps are original networks over real geography with each region's signature rule; they are
not copies of the published boards. All artwork is original.

## Put it online

The built `index.html` is committed, so GitHub Pages serves the repo as it is:
repo **Settings → Pages → Build and deployment → Source: Deploy from a branch**, branch
`claude/emi-train-game-09t9sr` (or `main` after merging), folder `/ (root)`. Every push redeploys.

On each phone, open the URL once and install it: Chrome → menu → **Install app**; Safari → Share → **Add to Home
Screen**. After that it opens offline.

AWS hosting (private copy, optional private signalling server) is scaffolded in [`aws/`](aws/README.md).

## Play on separate phones

Same three choices as EBriscola: **On this device**, **Online** and **Nearby, no internet**. In both multiplayer modes
one person hosts; their phone runs the game and every other phone only sees its own cards and tickets.

- **Online:** Host → Online → **Host a game** shows a 5-letter code, a QR and a share link. Others: Online → **Join with
  a code**. Connection setup goes through the free public PeerJS server; game traffic goes directly between phones,
  or through the built-in TURN relay (Metered.ca, shared with EBriscola) when mobile networks block direct links. A
  dropped phone rejoins by itself; after a reload the join screen has the last code filled in.
- **Nearby, no internet:** everyone on the same Wi-Fi or the host's hotspot. Host → Nearby → **Host**, then **Add a
  phone**; the friend chooses Nearby → **Join** and the two phones swap QR codes (two scans). Copy-and-paste codes
  work when there is no camera.

## Development

```
npm test        # rules engine, scoring, maps and CPU games on every map
npm run maps    # maps-src/*.mjs -> src/maps.js (downloads Natural Earth coastlines once into .cache/)
npm run build   # bundles src/ into index.html and sw.js (commit both)
npm run site    # build + copy the deployable files to _site/
```

Browser tests (pass-and-play on every map, online, TURN relay, reconnect, nearby pairing) are in `test/e2e/`.

- `maps-src/`: one file per region: real city coordinates, route list, tickets, rules. Adding a region is a new file.
- `tools/mapgen.mjs`: lays out routes and cars, balances colours, generates or checks tickets, clips coastlines.
- `src/engine.js`: rules (pure functions, seeded and serialisable state); `src/ai.js`: CPU players
- `src/board.js`: SVG map, pan/zoom, tap hit-testing; `src/app.js`, `src/style.css`, `src/i18n.js`: UI and game flow
- `src/net.js`: WebRTC link, PeerJS signalling, QR pairing codes (from EBriscola); `src/config.js`: deployment hooks
  (own signalling server, own TURN relay)
- `src/vendor/`: [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) (MIT) and
  [jsQR](https://github.com/cozmo/jsQR) (Apache-2.0)

Ticket to Ride is a trademark of Days of Wonder. This is an unofficial fan project for personal play.
