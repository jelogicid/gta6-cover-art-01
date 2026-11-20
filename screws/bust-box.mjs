// Build support, never shipped: prints where the app drew the hero cut-out and how big it is, for the pixel
// measurements in rim-check.py. Runs the app's own heroBustBox, so the two cannot drift apart.
//
// Run: node screws/bust-box.mjs "<shot query>"
import { chromium } from '/home/mjasb/Documents/animated-short/node_modules/playwright-core/index.mjs';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const root = normalize(new URL('../app/', import.meta.url).pathname);
const CHROME = '/home/mjasb/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';
const query = process.argv[2] || 'layout=hero&palette=vice&size=wide';

const types = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.ttf': 'font/ttf',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://local');
    let p = normalize(join(root, decodeURIComponent(url.pathname)));
    if (!p.startsWith(root)) throw new Error('outside app/');
    const s = await stat(p).catch(() => null);
    if (s && s.isDirectory()) p = join(p, 'index.html');
    const body = await readFile(p);
    res.writeHead(200, { 'content-type': types[extname(p)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await page.goto(`${base}?shot=cover&${query}`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 20000 });
const box = await page.evaluate(() => window.__shotBust);
await browser.close();
server.close();
if (!box) {
  console.error('no hero cut-out in this scene');
  process.exitCode = 1;
} else {
  console.log(JSON.stringify(box));
}
