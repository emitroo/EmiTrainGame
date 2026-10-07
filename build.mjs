// Bundles src/ into a single self-contained index.html (offline PWA) and sw.js.
// Usage: node build.mjs   (run `node tools/mapgen.mjs` first if maps-src/ changed)
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const css = read('./src/style.css');
const body = read('./src/body.html');
const files = ['vendor/qrcode.min.js', 'vendor/jsQR.min.js', 'config.js', 'maps.js', 'engine.js', 'ai.js', 'trains.js', 'board.js', 'i18n.js', 'net.js', 'app.js'];
const scripts = files.map((f) => read('./src/' + f)).join('\n;\n');
// Keep a literal "</script" out of inline code.
const js = scripts.replace(/<\/script/gi, '<\\/script');

const description = 'Emi Train Game: build railways across Europe, North America, the Nordic countries, Britain and India. 2 to 5 players on one phone or several, online or offline, with CPU players.';

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#2a1410">
<meta name="description" content="${description}">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Emi Trains">
<title>Emi Train Game</title>
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="icon-180.png">
<style>
${css}
body { touch-action: manipulation; }
</style>
</head>
<body>
${body}
<script>
${js}
</script>
<script>
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  // A new version activates in the background; reload into it unless a game is on screen.
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    const game = document.getElementById('game');
    if (!hadController || reloading || (game && !game.hidden)) return;
    reloading = true;
    location.reload();
  });
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').then((r) => r.update()).catch(() => {}));
}
</script>
</body>
</html>
`;

writeFileSync(new URL('./index.html', import.meta.url), html);
// Service worker cache name follows the content so phones pick up new versions.
const version = createHash('sha1').update(html).digest('hex').slice(0, 10);
writeFileSync(new URL('./sw.js', import.meta.url), read('./src/sw.template.js').replace('__VERSION__', version));
console.log(`index.html ${(html.length / 1024).toFixed(1)} KB, sw version ${version}`);
