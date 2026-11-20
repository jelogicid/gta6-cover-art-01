// Build support, never shipped: paints the three procedural sample scenes (own art) into app/samples/.
// Run: node screws/gen-samples.mjs
import { chromium } from '/home/mjasb/Documents/animated-short/node_modules/playwright-core/index.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'app', 'samples');
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  executablePath: '/home/mjasb/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',
});
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
await page.goto('about:blank');
await page.addScriptTag({ path: join(here, 'painters.js') });

const jobs = [
  ['sunset-palms.jpg', 'sunsetPalms', 1600, 1200],
  ['night-drive.jpg', 'nightDrive', 1600, 1200],
  ['poolside.jpg', 'poolside', 1600, 1200],
];

for (const [name, fn, w, h] of jobs) {
  const dataUrl = await page.evaluate(({ fn, w, h }) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    window.paintScene(fn, ctx, w, h, window.mulberrySeed(4080));
    return c.toDataURL('image/jpeg', 0.9);
  }, { fn, w, h });
  const buf = Buffer.from(dataUrl.split(',')[1], 'base64');
  writeFileSync(join(out, name), buf);
  console.log(name, buf.length, 'bytes');
}

await browser.close();
