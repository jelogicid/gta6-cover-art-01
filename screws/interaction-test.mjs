// Build support, never shipped: drives the editor like a person would — layouts, grade, pan, zoom, typing, undo,
// file upload, drag-and-drop, all three exports — and reports console errors. Run: node screws/interaction-test.mjs
import { chromium } from '/home/mjasb/Documents/animated-short/node_modules/playwright-core/index.mjs';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const root = normalize(new URL('../app/', import.meta.url).pathname);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.ttf': 'font/ttf' };
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://local');
    let p = normalize(join(root, decodeURIComponent(url.pathname)));
    if (!p.startsWith(root)) throw new Error('outside app/');
    const s = await stat(p).catch(() => null);
    if (s && s.isDirectory()) p = join(p, 'index.html');
    res.writeHead(200, { 'content-type': types[extname(p)] || 'application/octet-stream' });
    res.end(await readFile(p));
  } catch {
    res.writeHead(404).end('not found');
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch({ executablePath: '/home/mjasb/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));

await page.goto(base, { waitUntil: 'load' });
await page.waitForFunction(() => document.getElementById('status').textContent.includes('Sample photos'), null, { timeout: 15000 });

const out = {};
out.pool = await page.locator('#pool .thumb').count();
out.layouts = await page.locator('#layouts .chip').count();
out.grades = await page.locator('#palettes .swatch').count();
out.canvasBytes = await page.evaluate(() => document.getElementById('preview').toDataURL().length);

for (const key of ['quad', 'six', 'nine', 'hero', 'tilt']) {
  await page.click(`#layouts .chip[data-layout="${key}"]`);
  out[`panels_${key}`] = await page.evaluate(() => window.__studio.state.panels.length);
}
await page.click('#layouts .chip[data-layout="hero"]');
await page.click('#palettes .swatch[data-palette="gold"]');

// drag the hero panel to pan it
const box = await page.locator('#preview').boundingBox();
const before = await page.evaluate(() => window.__studio.state.panels[0].cx);
await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.55);
await page.mouse.down();
await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.55, { steps: 8 });
await page.mouse.up();
const after = await page.evaluate(() => window.__studio.state.panels[0].cx);
out.pan = { before: +before.toFixed(3), after: +after.toFixed(3), moved: before !== after };

// wheel zoom
const z0 = await page.evaluate(() => window.__studio.state.panels[0].zoom);
await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.55);
await page.mouse.wheel(0, -300);
await page.waitForTimeout(120);
const z1 = await page.evaluate(() => window.__studio.state.panels[0].zoom);
out.zoom = { before: +z0.toFixed(2), after: +z1.toFixed(2), grew: z1 > z0 };

// type a title, undo it
await page.fill('#title', 'Test Run');
await page.locator('#title').blur();
await page.click('#undo');
out.undoTitle = await page.inputValue('#title');
await page.click('#redo');
out.redoTitle = await page.inputValue('#title');

// upload a local photo from disk — read as an object URL, never uploaded; the pool gains exactly one entry
const beforeUpload = await page.locator('#pool .thumb').count();
await page.setInputFiles('#file', new URL('../app/samples/low-tide.jpg', import.meta.url).pathname);
await page.waitForFunction(
  (n) => document.querySelectorAll('#pool .thumb').length === n + 1,
  beforeUpload,
  { timeout: 10000 },
);
out.poolAfterUpload = await page.locator('#pool .thumb').count();
out.uploadAdded = out.poolAfterUpload - beforeUpload;

// use for all, reset crop
await page.click('#all-panels');
await page.click('#reset-panel');
out.zoomAfterReset = await page.evaluate(() => window.__studio.state.panels[window.__studio.state.selected].zoom);

// exports
out.exports = [];
for (const key of ['square', 'portrait', 'wide']) {
  const dl = page.waitForEvent('download');
  await page.click(`#exports [data-size="${key}"]`);
  const d = await dl;
  const buf = await readFile(await d.path());
  out.exports.push({ key, name: d.suggestedFilename(), bytes: buf.length, png: buf.slice(1, 4).toString() === 'PNG', w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) });
}
out.status = await page.textContent('#status');
out.errors = errors;
console.log(JSON.stringify(out, null, 2));
await browser.close();
server.close();
