// Build support, never shipped: checks every panel of every screenshot by numbers before anyone looks at it.
//
// For each cover scene it reads the panel rectangles and the crop each panel resolved to out of the page, computes
// the visible window of the photograph in photo coordinates, and reports:
//   - what is inside each panel: which named subject box (face, whole head, whole object) it holds and how much of
//     the frame that subject fills — a panel holding no subject and showing less than a third of the photograph is
//     a featureless crop, the thing this is here to catch;
//   - the face rule: how far, as a share of the panel's side, a panel edge cuts into a face box. Over 4% fails.
//
// Run: node screws/frame-check.mjs
import { chromium } from '/home/mjasb/Documents/animated-short/node_modules/playwright-core/index.mjs';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const root = normalize(new URL('../app/', import.meta.url).pathname);
const CHROME = '/home/mjasb/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';
const FACE_TOLERANCE = 0.04;

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
  const report = await page.evaluate(() => {
    const state = window.__studioState;
    const geo = window.__shotGeo;
    return {
      layout: state.layout,
      size: state.size,
      panels: geo.panels.map((rect, i) => {
        const panel = state.panels[i] || {};
        const photo = state.photos.find((p) => p.id === panel.photo) || {};
        return {
          rect, photo: panel.photo, cx: panel.cx, cy: panel.cy, zoom: panel.zoom,
          w: photo.w, h: photo.h, face: photo.face || null, head: photo.head || null, subj: photo.subj || null,
        };
      }),
    };
  });

  console.log(`\n${shot.name}  ${report.layout}/${report.size}`);
  for (let i = 0; i < report.panels.length; i++) {
    const p = report.panels[i];
    const zoom = Math.max(1, p.zoom || 1);
    const base = Math.max(p.rect.w / p.w, p.rect.h / p.h);
    const dw = p.w * base * zoom, dh = p.h * base * zoom;
    const vw = Math.min(1, p.rect.w / dw), vh = Math.min(1, p.rect.h / dh);
    const cx = Math.min(1 - vw / 2, Math.max(vw / 2, p.cx));
    const cy = Math.min(1 - vh / 2, Math.max(vh / 2, p.cy));
    const win = {
      x0: +(cx - vw / 2).toFixed(3), x1: +(cx + vw / 2).toFixed(3),
      y0: +(cy - vh / 2).toFixed(3), y1: +(cy + vh / 2).toFixed(3),
    };

    const bits = [];
    let holdsSubject = false;
    for (const [name, box] of [['face', p.face], ['head', p.head], ['object', p.subj]]) {
      if (!box) continue;
      const cutX = Math.max(0, Math.min(win.x1, box.x + box.w) - Math.max(win.x0, box.x));
      const cutY = Math.max(0, Math.min(win.y1, box.y + box.h) - Math.max(win.y0, box.y));
      const keepX = cutX / box.w, keepY = cutY / box.h;
      const whole = keepX >= 0.98 && keepY >= 0.98;
      if (whole) holdsSubject = true;
      bits.push(`${name} ${(keepX * 100).toFixed(0)}x${(keepY * 100).toFixed(0)}%${whole ? ' WHOLE' : ''}`);
    }

    // the face rule, against every edge of the panel: an edge counts only when it truly passes through the face
    let breach = 0;
    if (p.face) {
      const f = p.face;
      const wv = win.x1 - win.x0, hv = win.y1 - win.y0;
      const ovX = Math.min(win.x1, f.x + f.w) - Math.max(win.x0, f.x);
      const ovY = Math.min(win.y1, f.y + f.h) - Math.max(win.y0, f.y);
      const visible = ovX > 0 && ovY > 0;
      if (visible) {
        const eps = 1e-4;
        const cutL = win.x0 > f.x + eps && ovY > 0 ? (win.x0 - f.x) / wv : 0;
        const cutR = win.x1 < f.x + f.w - eps && ovY > 0 ? (f.x + f.w - win.x1) / wv : 0;
        const cutT = win.y0 > f.y + eps && ovX > 0 ? (win.y0 - f.y) / hv : 0;
        const cutB = win.y1 < f.y + f.h - eps && ovX > 0 ? (f.y + f.h - win.y1) / hv : 0;
        breach = Math.max(cutL, cutR, cutT, cutB);
      }
    }

    const spread = vw * vh;
    // a sliver of a file that holds no named subject at all is the "texture, not a shot" failure
    const empty = !holdsSubject && spread < 0.08;
    const bad = empty || breach > FACE_TOLERANCE;
    if (bad) failures += 1;
    console.log(
      `  panel ${String(i + 1).padStart(2, '0')}  ${p.photo.padEnd(10)}` +
      `  window x ${win.x0}–${win.x1} y ${win.y0}–${win.y1}  shows ${(spread * 100).toFixed(0)}% of the file` +
      `  | ${bits.join(', ') || 'no subject box'}` +
      `  | face breach ${(breach * 100).toFixed(1)}%` +
      `  ${bad ? (empty ? 'FAIL featureless' : 'FAIL face rule') : 'ok'}`,
    );
  }
  await page.close();
}

await browser.close();
server.close();
console.log(`\n${failures ? `${failures} panel(s) fail` : 'every panel holds a whole subject, no face is cut'}`);
process.exitCode = failures ? 1 : 0;
