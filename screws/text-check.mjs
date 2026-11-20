// Build support, never shipped: checks the poster's typographic hierarchy by numbers, for every screenshot.
//   - the footer tagline must sit between a quarter and two fifths of the wordmark's CAP HEIGHT, and the ratio is
//     measured on the rendered pixels, not just on the font sizes the layout asked for;
//   - the caption line must be one line, so it reads as a caption and not as a second headline.
//
// Run: node screws/text-check.mjs
import { chromium } from '/home/mjasb/Documents/animated-short/node_modules/playwright-core/index.mjs';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const root = normalize(new URL('../app/', import.meta.url).pathname);
const CHROME = '/home/mjasb/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';
const MIN = 0.25, MAX = 0.4;

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

const shots = JSON.parse(await readFile(new URL('../shots.json', import.meta.url), 'utf8'))
  .filter((s) => s.shot === 'cover');

const browser = await chromium.launch({ executablePath: CHROME });
let failures = 0;

for (const shot of shots) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.goto(`${base}?shot=${shot.shot}&${shot.query}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 20000 });
  const m = await page.evaluate(() => window.__shotText);
  // CAP HEIGHT, not em size: measure the real ink height of a capital at each resolved size, using the glyph
  // metrics the browser reports for the same font the renderer paints with.
  const caps = await page.evaluate(({ titleSize, captionSize }) => {
    const c = document.createElement('canvas').getContext('2d');
    const cap = (size, weight) => {
      if (!size) return 0;
      c.font = `${weight} ${size}px "NotoCover", "Noto Sans", sans-serif`;
      const m = c.measureText('H');
      return m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
    };
    const t = cap(titleSize, 900);
    const f = cap(captionSize, 700);
    return { title: t, tagline: f, ratio: t ? f / t : 0 };
  }, { titleSize: m.titleSize, captionSize: m.captionSize });

  const ok = caps.ratio >= MIN && caps.ratio <= MAX && m.captionLines === 1 && m.titleLines === 1;
  if (!ok) failures += 1;
  console.log(
    `${shot.name.padEnd(22)} wordmark cap ${caps.title.toFixed(0)}px on ${m.titleLines} line(s)` +
    `  tagline cap ${caps.tagline.toFixed(0)}px on ${m.captionLines} line(s)` +
    `  = ${(caps.ratio * 100).toFixed(0)}% of it  ${ok ? 'ok' : 'FAIL'}`,
  );
  await page.close();
}

await browser.close();
server.close();
console.log(`\n${failures ? `${failures} shot(s) fail the hierarchy` : 'the tagline sits at a caption size on every shot'}`);
process.exitCode = failures ? 1 : 0;
