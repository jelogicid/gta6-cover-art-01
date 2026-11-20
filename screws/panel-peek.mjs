// Build support, never shipped: renders a cover at full export size and writes each panel out as its own image,
// so a panel can be judged at the size it is actually painted rather than at screenshot scale.
//
// Run: node screws/panel-peek.mjs "layout=hero&palette=vice&size=wide&title=Sunset%20Heist&caption=Palm%20Coast%20Never%20Sleeps&photos=gold-hour,the-car,palm-line,low-tide" [outdir]
import { chromium } from '/home/mjasb/Documents/animated-short/node_modules/playwright-core/index.mjs';
import { createServer } from 'node:http';
import { readFile, stat, writeFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const root = normalize(new URL('../app/', import.meta.url).pathname);
const CHROME = '/home/mjasb/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';
const query = process.argv[2] || 'layout=hero&palette=vice&size=wide';
const outDir = normalize(process.argv[3] || new URL('../screws/peek/', import.meta.url).pathname);

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

const parts = await page.evaluate(() => {
  const img = new Image();
  img.src = window.__shotPNG;
  return img.decode().then(() => {
    const out = [];
    const geo = window.__shotGeo;
    const panels = window.__studioState.panels;
    for (let i = 0; i < geo.panels.length; i++) {
      const r = geo.panels[i];
      const pad = 6;
      const c = document.createElement('canvas');
      c.width = Math.round(r.w + pad * 2);
      c.height = Math.round(r.h + pad * 2);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#101018';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, r.x, r.y, r.w, r.h, pad, pad, r.w, r.h);
      out.push({
        name: `panel-${String(i + 1).padStart(2, '0')}-${panels[i].photo}.png`,
        data: c.toDataURL('image/png'),
      });
    }
    const full = document.createElement('canvas');
    full.width = img.width;
    full.height = img.height;
    full.getContext('2d').drawImage(img, 0, 0);
    out.push({ name: 'cover-full.png', data: full.toDataURL('image/png') });
    return out;
  });
});

await mkdir(outDir, { recursive: true });
for (const part of parts) {
  const buf = Buffer.from(part.data.split(',')[1], 'base64');
  await writeFile(join(outDir, part.name), buf);
  console.log(`${join(outDir, part.name)}  ${(buf.length / 1024).toFixed(0)} KiB`);
}

await browser.close();
server.close();
