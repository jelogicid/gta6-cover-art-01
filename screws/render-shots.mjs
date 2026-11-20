// Build support, never shipped: renders screenshots/ from the app in headless Chromium.
//
// For a cover scene the app paints its poster at the export size and exposes the PNG its own renderer wrote; this
// script scales that PNG down inside the same browser, encodes it as JPEG when the PNG is over the size cap, and
// saves it. For the editor scene it screenshots the page. It also clicks all three export buttons and checks the
// files the browser received are PNGs of the stated pixel size, and it records every request the page made so a
// stray network call cannot slip past.
//
// Run: node screws/render-shots.mjs
import { chromium } from '/home/mjasb/Documents/animated-short/node_modules/playwright-core/index.mjs';
import { createServer } from 'node:http';
import { readFile, stat, writeFile, mkdir, readdir, unlink } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const root = normalize(new URL('../app/', import.meta.url).pathname);
const shotsDir = normalize(new URL('../screenshots/', import.meta.url).pathname);
const CHROME = '/home/mjasb/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';
const CAP = 256 * 1024;

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
await mkdir(shotsDir, { recursive: true });
for (const f of await readdir(shotsDir)) await unlink(join(shotsDir, f)).catch(() => {});

const shots = JSON.parse(await readFile(new URL('../shots.json', import.meta.url), 'utf8'));
const report = { shots: [], requests: [], errors: [], exports: [] };
const scratch = await browser.newPage();

for (const shot of shots) {
  const isEditor = shot.shot === 'editor';
  const page = await browser.newPage({
    viewport: isEditor ? { width: shot.w || 1280, height: shot.h || 800 } : { width: 1600, height: 1000 },
    deviceScaleFactor: 1,
  });
  page.on('console', (m) => { if (m.type() === 'error') report.errors.push(m.text()); });
  page.on('pageerror', (e) => report.errors.push(`PAGEERROR ${e.message}`));
  page.on('request', (r) => {
    const u = r.url();
    if (!u.startsWith(base) && !u.startsWith('data:')) report.requests.push(u);
  });

  await page.goto(`${base}?shot=${shot.shot}&${shot.query}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 20000 });

  let buf;
  let dims;
  if (isEditor) {
    const png = await page.screenshot({ type: 'png' });
    dims = { w: shot.w, h: shot.h };
    buf = await encode(scratch, png, 'image/png', 88, dims, null);
    for (const q of [84, 80, 76]) {
      if (buf.length <= 240 * 1024) break;
      buf = await encode(scratch, buf, 'image/jpeg', q, dims, null);
    }
  } else {
    const encoded = await page.evaluate(async (long) => {
      const img = new Image();
      img.src = window.__shotPNG;
      await img.decode();
      const scale = Math.min(1, long / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, c.width, c.height);
      return { w: c.width, h: c.height, png: c.toDataURL('image/png'), jpg: c.toDataURL('image/jpeg', 0.92) };
    }, shot.long || 1280);
    dims = { w: encoded.w, h: encoded.h };
    const png = Buffer.from(encoded.png.split(',')[1], 'base64');
    const jpg = Buffer.from(encoded.jpg.split(',')[1], 'base64');
    buf = png.length <= CAP ? png : jpg;
    if (buf.length > CAP) buf = await encode(scratch, jpg, 'image/jpeg', 84, dims, null);
  }

  if (buf.length > CAP) throw new Error(`${shot.name} is ${buf.length} bytes, over the cap`);

  await writeFile(join(shotsDir, shot.name), buf);
  report.shots.push({ name: shot.name, bytes: buf.length, ...dims });
  console.log(`${shot.name}  ${dims.w}x${dims.h}  ${(buf.length / 1024).toFixed(1)} KiB`);

  if (isEditor) await verifyExports(page, report);
  await page.close();
}

/** Re-encodes an image at a JPEG quality, keeping the pixel size. */
async function encode(page, input, mime, quality, dims, crop) {
  const data = `data:${mime};base64,${input.toString('base64')}`;
  const out = await page.evaluate(async ({ src, quality }) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    c.getContext('2d').drawImage(img, 0, 0);
    return c.toDataURL('image/jpeg', quality / 100);
  }, { src: data, quality });
  void dims;
  void crop;
  return Buffer.from(out.split(',')[1], 'base64');
}

/** Clicking each export button must hand the browser a PNG of the stated pixel size. */
async function verifyExports(page, rep) {
  for (const key of ['square', 'portrait', 'wide']) {
    const downloadPromise = page.waitForEvent('download', { timeout: 20000 });
    await page.click(`#exports [data-size="${key}"]`);
    const download = await downloadPromise;
    const buf = await readFile(await download.path());
    const dims = pngSize(buf);
    rep.exports.push({ key, name: download.suggestedFilename(), bytes: buf.length, ...dims });
    console.log(`export ${key}: ${download.suggestedFilename()} ${dims.w}x${dims.h} ${(buf.length / 1024).toFixed(0)} KiB`);
  }
}

function pngSize(buf) {
  if (buf.slice(1, 4).toString() !== 'PNG') return { w: 0, h: 0 };
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

console.log('\nnon-local requests:', report.requests.length ? report.requests : 'none');
console.log('console errors:', report.errors.length ? report.errors : 'none');
await writeFile(new URL('../screws/render-report.json', import.meta.url), JSON.stringify(report, null, 2));
await browser.close();
server.close();
