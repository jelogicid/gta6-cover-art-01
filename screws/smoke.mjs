// Build support: serves app/ on a loopback port and opens it in headless Chromium, printing console errors and
// saving a raw screenshot. Used to smoke-test before the final screenshot run.
import { chromium } from '/home/mjasb/Documents/animated-short/node_modules/playwright-core/index.mjs';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const root = new URL('../app/', import.meta.url).pathname;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.ttf': 'font/ttf' };

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    let p = normalize(join(root, decodeURIComponent(url.pathname)));
    if (!p.startsWith(normalize(root))) throw new Error('outside');
    let s = await stat(p).catch(() => null);
    if (s && s.isDirectory()) p = join(p, 'index.html');
    const body = await readFile(p);
    res.writeHead(200, { 'content-type': types[extname(p)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const base = `http://127.0.0.1:${port}/`;

const browser = await chromium.launch({ executablePath: '/home/mjasb/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
const requests = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
page.on('request', (r) => requests.push(r.url()));

await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.screenshot({ path: new URL('../screws/raw-editor.png', import.meta.url).pathname });

console.log('errors:', errors);
console.log('non-local requests:', requests.filter((u) => !u.startsWith(base)));
await browser.close();
server.close();
