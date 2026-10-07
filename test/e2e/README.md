# Browser tests

These drive the real app in headless Chromium with simulated phones (Pixel 7 and iPhone 13 profiles). The test plays
through the UI: the CPU logic picks each move and the test taps the real buttons (routes and cities through the
board's tap handlers). They run in GitHub Actions (`.github/workflows/e2e.yml`); they are not part of `npm test`
because they need Playwright.

```
npm run build
python3 -m http.server 8765                 # from the repo root
node test/e2e/peer-server.js                # optional local signalling server (npm i peer express)
export BROKER="ws://localhost:9000/peerjs?key=peerjs"   # omit to use 0.peerjs.com

node test/e2e/one-phone.js europe 2 3       # map, people on this phone, players (rest are CPUs)
node test/e2e/two-phones.js online          # host + guest by lobby code, plus a CPU; checks no hidden info leaks
node test/e2e/two-phones.js online relay    # same, forced through the TURN relay
node test/e2e/two-phones.js nearby          # nearby QR pairing (codes pasted: headless browsers have no camera)
node test/e2e/reconnect.js                  # guest reloads mid-game and rejoins its seat
```

Screenshots go to `$OUT` (default: the system temp directory).
