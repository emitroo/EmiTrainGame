# Emi Train Game

A route-building train game after the board game Ticket to Ride, for 2 to 5 players, on one phone passed around or
on separate phones. Same design as [EBriscola](https://github.com/emitroo/EBriscola): one web page, no app store, no
accounts, works offline once loaded.

**Play:** https://emitroo.github.io/EmiTrainGame/

## Maps and rules

Five official boards, each with its own rules. Europe is the default.

| Map | Players | Trains | Board | Rules on this map |
| --- | --- | --- | --- | --- |
| **Europe** | 2–5 | 45 | 47 cities, 101 routes, 46 tickets | Tunnels, ferries, 3 stations; 1 long + 3 short tickets (keep 2); longest path +10 |
| **USA** | 2–5 | 45 | 36 cities, 100 routes, 30 tickets | The original rules; 3 tickets (keep 2); longest path +10 |
| **Nordic Countries** | 2–3 | 40 | 39 cities, 81 routes, 46 tickets | Locomotives only on tunnels and ferries; a face-up locomotive is one card; any 3 cards for a ferry locomotive; any 4 cards per space on the 9-car Murmansk–Lieksa; 5 tickets (keep 2), returned tickets leave the game; Globetrotter +10 |
| **India** | 2–4 | 45 | 39 cities, 108 routes, 58 tickets | Ferries; 4 tickets (keep 2); Indian Express (longest path) +10; Mandala bonus 5/10/20/30/40 |
| **Switzerland** | 2–3 | 40 | 34 cities + 17 border crossings, 88 routes, 46 tickets | Locomotives only on tunnels; a face-up locomotive is one card; country tickets; 5 tickets (keep 2); longest path +10 |

Common rules, as in the published games: 4 train cards and 5 face-up; draw 2 cards (a face-up locomotive is the
whole turn, and never the second card, except where noted); three face-up locomotives clear the market; claim a route
with cards of its colour (gray: any one colour); draw 3 tickets and keep at least 1; double routes closed below the
board's player threshold (Europe/USA/India 4, Nordic/Switzerland 3) and never both to one player; tunnels turn over 3
cards; ferries need locomotives; the last round starts when a player ends a turn with 2 or fewer trains; route scores
1, 2, 4, 7, 10, 15, 18, 21, 27; tie-breaks as on each board (most tickets, then fewest stations on Europe, then longest
path).

**Up to 5 players on every map:** a house rule (on by default, switch it off in Options) lets the smaller boards take
up to 5 players. Turned off, each board allows only its official player count.

### How the boards were checked

Each board's cities, routes (length, colour, tunnel, ferry, locomotives), tickets and points come from public data,
cross-checked against each other and against photos of the published boards:

- **Europe:** three data sets ([leonsi7](https://github.com/leonsi7/ticket-to-ride-europe),
  [alphajuliet](https://github.com/alphajuliet/ticket-to-ride), [pepijndevos](https://gist.github.com/pepijndevos/980430));
  the two places where they disagree are settled by the printed ticket values.
- **USA:** [Rob217/TicketToRideAnalysis](https://github.com/Rob217/TicketToRideAnalysis); every route colour checked
  against a board photo; every colour totals 27 cars, as on the board.
- **Nordic Countries, India, Switzerland:** the
  [Ticket to Ride wiki](https://ticket-to-ride.fandom.com/)'s city/route/ticket lists (with each city's position on the
  board) and the official rulebooks; checked against board photos. India's colours total exactly 20 cars each.

Nordic, India and Switzerland use the cities' positions on the published boards, with real coastlines bent to fit;
Europe and USA use real positions. All artwork is original (Natural Earth geography, own SVG trains and cards).

## Hosting: GitHub Pages

The built `index.html` is committed and GitHub Pages serves the repo as is (Settings → Pages → Deploy from a branch,
`claude/emi-train-game-09t9sr` or `main` once merged, folder `/ (root)`), so every push redeploys
https://emitroo.github.io/EmiTrainGame/ within a minute or two.

On each phone, open the URL once and install it: Chrome → menu → **Install app**; Safari → Share → **Add to Home
Screen**. After that it opens offline. After an update the app fetches the new version in the background and reloads into it within a few seconds
(unless a game is on screen, in which case the next launch shows it).

**Claiming a route:** tap one city, then the next city along the route; the route between them opens with the ways you
can pay. Its routes light up after the first tap, and the map stays tappable while a route is open, so a wrong pick is
fixed by tapping another city. You can also tap a route directly. The bar that appears after the first tap has the
**Station** button for that city.

Phones work in both orientations. Portrait: players on top, map in the middle (zoomed to fill; pinch and drag), cards
and hand at the bottom. Landscape: three columns, with players and the turn prompt on the left, the map at full height in
the middle, and face-up cards, decks and hand on the right. Tablets and desktops show the map with a card column.

The board is drawn after the printed Europe board: icy sea with swirls, mottled parchment land, sepia borders,
brown-edged route spaces with colour symbols, amber city markers, the route-points table, and the 0-99 score track of
navy medallions around the edge with each player's marker on it.

## Play on separate phones

Same as EBriscola: **On this device**, **Online** and **Nearby, no internet**. One person hosts; their phone runs the
game and every other phone only receives its own cards and tickets.

- **Online:** Host → Online → **Host a game** shows a 5-letter code, a QR and a share link. Others: Online → **Join with
  a code**. Phones are introduced through the free public PeerJS server; game traffic then goes phone to phone, or
  through the built-in TURN relay (Metered.ca, shared with EBriscola) when mobile networks block direct links. A
  dropped phone rejoins by itself; after a reload the join screen has the last code filled in.
- **Nearby, no internet:** everyone on the same Wi-Fi or the host's hotspot. Host → Nearby → **Host**, then **Add a
  phone**; the friend picks Nearby → **Join** and the two phones swap QR codes. Copy-and-paste codes work without a camera.
- **CPU players** (Easy / Normal / Hard) can fill any seat, on one phone or in a multiplayer lobby.

## Later: private hosting on AWS (not needed now)

[`aws/`](aws/README.md) holds a ready, unused setup for a second, private copy on AWS (S3 + CloudFront with a $1
budget and automatic cut-off) and an optional self-hosted signalling server. Nothing there runs until someone deploys
it; GitHub Pages is the home of the game.

## Development

```
npm test        # rules (every map's variations), scoring, board data and CPU games
npm run maps    # maps-src/*.mjs -> src/maps.js (downloads Natural Earth geography once into .cache/)
npm run build   # bundles src/ into index.html and sw.js (commit both)
```

Browser tests (pass-and-play on every map, online, TURN relay, reconnect, nearby pairing) are in `test/e2e/`.

- `maps-src/`: one file per board: cities, routes, tickets, rules and sources. `tools/mapgen.mjs` lays out the routes,
  warps the geography to the board and checks tickets against shortest paths.
- `src/engine.js`: rules (pure functions, seeded and serialisable state); `src/ai.js`: CPU players
- `src/board.js`: SVG map, pan/zoom, taps; `src/trains.js`: locomotive and wagon art; `src/app.js`, `src/style.css`,
  `src/i18n.js`: UI and game flow
- `src/net.js`: WebRTC link, PeerJS signalling, QR pairing (from EBriscola); `src/config.js`: hooks for an own
  signalling server or TURN relay
- `src/vendor/`: [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) (MIT) and
  [jsQR](https://github.com/cozmo/jsQR) (Apache-2.0)

Ticket to Ride is a trademark of Days of Wonder. This is an unofficial fan project for personal play.
