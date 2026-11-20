// The renderer. One function draws a whole cover poster at any pixel size, from the edit state: backdrop, header
// band, panel grid with a per-panel colour grade, lettering plates and footer credits. The preview and every export
// call the same drawCover, so what the page shows is what the PNG holds.

export const PALETTES = {
  vice: {
    label: 'Vice Sunset',
    deep: '#180a2c', deep2: '#070f2b', accent: '#ff2f6d', accent2: '#ff8a3c',
    teal: '#25d0c0', cream: '#f8e7cd', ink: '#0e0616',
    grade: ['#0a1a4a', '#6f1a67', '#ff5a34', '#ffd08a'],
  },
  neon: {
    label: 'Neon Night',
    deep: '#080318', deep2: '#120636', accent: '#00e6ff', accent2: '#ff2bd6',
    teal: '#22ffd5', cream: '#e9fbff', ink: '#04010d',
    grade: ['#050b2e', '#2a0a6e', '#d217a0', '#8ef7ff'],
  },
  gold: {
    label: 'Gold Coast',
    deep: '#1d1208', deep2: '#0d0703', accent: '#ffb03a', accent2: '#ff5b2b',
    teal: '#7ec9a8', cream: '#fff1d6', ink: '#120a04',
    grade: ['#261005', '#7a2a10', '#ff8a2b', '#ffe6a8'],
  },
  tide: {
    label: 'Tidal Teal',
    deep: '#03201f', deep2: '#061018', accent: '#19e0b0', accent2: '#ffd166',
    teal: '#4ff0d8', cream: '#f2fbf4', ink: '#02100f',
    grade: ['#03283a', '#0a6a72', '#38d3a8', '#f6f3b0'],
  },
};

export const LAYOUTS = {
  quad: {
    label: 'Four Up',
    cells: [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]],
  },
  six: {
    label: 'Six Up',
    cells: [
      [0, 0, 1 / 3, 0.5], [1 / 3, 0, 1 / 3, 0.5], [2 / 3, 0, 1 / 3, 0.5],
      [0, 0.5, 1 / 3, 0.5], [1 / 3, 0.5, 1 / 3, 0.5], [2 / 3, 0.5, 1 / 3, 0.5],
    ],
  },
  nine: {
    label: 'Nine Up',
    cells: Array.from({ length: 9 }, (_, i) => [(i % 3) / 3, Math.floor(i / 3) / 3, 1 / 3, 1 / 3]),
  },
  hero: {
    label: 'Hero + Three',
    cells: [[0, 0, 0.63, 1], [0.63, 0, 0.37, 1 / 3], [0.63, 1 / 3, 0.37, 1 / 3], [0.63, 2 / 3, 0.37, 1 / 3]],
  },
  tilt: {
    label: 'Tilted Snaps',
    cells: [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]],
    tilt: true,
  },
};

export const PANEL_WORDS = [
  'SUNSET STRIP', 'THE PIER', 'GOLD COAST', 'NIGHT MOVES', 'LOW TIDE',
  'PALM AVENUE', 'HIGH NOON', 'VICE NIGHTS', 'THE GETAWAY',
];

export const SIZES = {
  square: { label: 'Square', w: 1080, h: 1080, tag: '1080 x 1080' },
  portrait: { label: 'Portrait', w: 1080, h: 1350, tag: '1080 x 1350' },
  wide: { label: 'Landscape', w: 1920, h: 1080, tag: '1920 x 1080' },
};

const FONT_FAMILY = '"NotoCover", "Noto Sans", sans-serif';
const CONDENSE = 0.79;
// The footer caption's measure as a share of the footer's width. Shared by the renderer and the metrics so the
// size a check reads is the size that was painted: a line set to the full sheet reads as a display line.
const CAPTION_MEASURE = 0.84;
const noise = makeNoiseTile();
const dots = makeDotTile();

export async function loadCoverFont() {
  if (!document.fonts || !document.fonts.load) return;
  await Promise.all([
    document.fonts.load(`900 120px ${FONT_FAMILY}`),
    document.fonts.load(`700 40px ${FONT_FAMILY}`),
  ]);
  await document.fonts.ready;
}

/** The panel rectangles for a layout in canvas pixels: gutters already applied and the tilt cards placed. */
export function panelRects(state, W, H) {
  const isWide = W / H > 1.4;
  const isPortrait = W / H < 0.92;
  const m = Math.min(W, H) * (isWide ? 0.028 : isPortrait ? 0.045 : 0.038);
  const headerH = H * (isWide ? 0.285 : isPortrait ? 0.175 : 0.225);
  const footerH = H * (isWide ? 0.185 : isPortrait ? 0.115 : 0.135);
  const top = m * 0.75 + headerH + m * 0.85;
  const bottom = H - m * 1.1 - footerH - m * 0.62;
  const area = { x: m, y: top, w: W - 2 * m, h: Math.max(H * 0.25, bottom - top) };
  const layout = LAYOUTS[state.layout] || LAYOUTS.quad;
  const g = Math.max(3, Math.min(W, H) * (isWide ? 0.007 : 0.009));

  if (layout.tilt) {
    const cards = [];
    const rotations = [-6.5, 5.2, -4.4, 6.8];
    const cw = area.w * 0.47, ch = area.h * 0.45;
    for (let i = 0; i < 4; i++) {
      const col = i % 2, row = (i / 2) | 0;
      cards.push({
        x: area.x + area.w * (0.025 + col * 0.5) + (col ? -cw * 0.04 : cw * 0.02),
        y: area.y + area.h * (0.02 + row * 0.49) + (row ? -ch * 0.03 : ch * 0.01),
        w: cw, h: ch, rot: rotations[i] * Math.PI / 180,
      });
    }
    return { area, gutter: g, panels: cards, tilt: true };
  }

  const panels = layout.cells.map(([cx, cy, cw, ch]) => ({
    x: area.x + cx * area.w + g / 2,
    y: area.y + cy * area.h + g / 2,
    w: cw * area.w - g,
    h: ch * area.h - g,
    rot: 0,
  }));
  return { area, gutter: g, panels, tilt: false };
}

/**
 * Draws the whole poster. `selection` (index) is editor-only chrome and never rendered for an export.
 */
export function drawCover(canvas, state, opts = {}) {
  const W = canvas.width, H = canvas.height;
  const ctx = canvas.getContext('2d', { alpha: false });
  const pal = PALETTES[state.palette] || PALETTES.vice;
  const isWide = W / H > 1.4;
  const isPortrait = W / H < 0.92;
  const m = Math.min(W, H) * (isWide ? 0.028 : isPortrait ? 0.045 : 0.038);

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;

  paintBackdrop(ctx, W, H, pal, state.seed || 7);

  const layout = LAYOUTS[state.layout] || LAYOUTS.quad;
  const geo = panelRects(state, W, H);
  const headerH = H * (isWide ? 0.285 : isPortrait ? 0.175 : 0.225);
  const footerH = H * (isWide ? 0.185 : isPortrait ? 0.115 : 0.135);
  const header = { x: m, y: m * 0.75, w: W - 2 * m, h: headerH };
  const footer = { x: m, y: H - m * 1.1 - footerH, w: W - 2 * m, h: footerH };

  if (layout.tilt) paintTiltBackdrop(ctx, geo.area, state, pal, geo);
  drawPanels(ctx, geo, state, pal, Math.min(W, H));

  // one warm wash over the whole grid, so the panels share a single grade
  const wash = ctx.createLinearGradient(0, geo.area.y, 0, geo.area.y + geo.area.h);
  wash.addColorStop(0, hexAlpha(pal.accent, 0.1));
  wash.addColorStop(0.55, hexAlpha(pal.accent2, 0.06));
  wash.addColorStop(1, hexAlpha(pal.accent2, 0.2));
  const unify = ctx.createLinearGradient(geo.area.x, geo.area.y, geo.area.x + geo.area.w, geo.area.y + geo.area.h);
  unify.addColorStop(0, pal.grade[0]);
  unify.addColorStop(0.45, pal.grade[1]);
  unify.addColorStop(0.8, pal.grade[2]);
  unify.addColorStop(1, pal.grade[3]);
  ctx.save();
  ctx.globalCompositeOperation = 'color';
  ctx.globalAlpha = 0.24;
  ctx.fillStyle = unify;
  ctx.fillRect(geo.area.x, geo.area.y, geo.area.w, geo.area.h);
  ctx.globalCompositeOperation = 'soft-light';
  ctx.globalAlpha = 1;
  ctx.fillStyle = wash;
  ctx.fillRect(geo.area.x, geo.area.y, geo.area.w, geo.area.h);
  ctx.restore();

  // the grade sits over the photographs only; the seal sits over the grid, labels ink on top of it
  if (!layout.tilt) {
    for (let i = 0; i < geo.panels.length; i++) panelFrame(ctx, geo.panels[i], pal);
  }
  drawSeal(ctx, geo, state, pal, W, H);
  if (!layout.tilt) {
    for (let i = 0; i < geo.panels.length; i++) {
      panelLettering(ctx, geo.panels[i], state.panels[i] || {}, i, pal, Math.min(W, H));
    }
  }

  const titleSize = drawHeader(ctx, header, state, pal, isWide);
  drawHeroBust(ctx, geo, state, pal);
  drawFooter(ctx, footer, state, pal, isWide, titleSize);
  filmGrain(ctx, W, H, state.seed || 7);

  // edge vignette ties the whole sheet together
  const vig = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.78);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.42)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  if (opts.selection != null && geo.panels[opts.selection]) {
    drawSelection(ctx, geo.panels[opts.selection], opts.selection, pal);
  }
  ctx.restore();
}

function paintBackdrop(ctx, W, H, pal, seed) {
  const sky = ctx.createLinearGradient(0, 0, W * 0.25, H);
  sky.addColorStop(0, pal.deep);
  sky.addColorStop(0.55, pal.deep2);
  sky.addColorStop(1, pal.ink);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W * 0.86, H * 0.04, 0, W * 0.86, H * 0.04, Math.max(W, H) * 0.62);
  glow.addColorStop(0, hexAlpha(pal.accent2, 0.5));
  glow.addColorStop(0.35, hexAlpha(pal.accent, 0.2));
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  const low = ctx.createRadialGradient(W * 0.14, H * 1.02, 0, W * 0.14, H * 1.02, Math.max(W, H) * 0.5);
  low.addColorStop(0, hexAlpha(pal.teal, 0.28));
  low.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = low;
  ctx.fillRect(0, 0, W, H);

  // fine pinstripes, the print texture under everything
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.strokeStyle = pal.cream;
  ctx.lineWidth = Math.max(1, W * 0.0008);
  const step = Math.max(6, W * 0.014);
  for (let x = -H; x < W + H; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + H * 0.35, H);
    ctx.stroke();
  }
  ctx.restore();

  // a big ghost sun behind the header
  ctx.save();
  ctx.globalAlpha = 0.18;
  const sun = ctx.createRadialGradient(W * 0.76, H * 0.05, 0, W * 0.76, H * 0.05, Math.min(W, H) * 0.34);
  sun.addColorStop(0, pal.accent2);
  sun.addColorStop(0.55, hexAlpha(pal.accent, 0.35));
  sun.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function paintTiltBackdrop(ctx, area, state, pal, geo) {
  const p = state.panels[0] || {};
  const photo = state.photos && state.photos.find((ph) => ph.id === p.photo);
  const pad = Math.max(area.w, area.h) * 0.06;
  const full = { x: area.x - pad, y: area.y - pad, w: area.w + pad * 2, h: area.h + pad * 2, rot: 0 };
  ctx.save();
  if (photo && photo.img && photo.img.naturalWidth) {
    clipRect(ctx, full, () => drawPhoto(ctx, photo.img, full, p, pal, 11));
  } else {
    ctx.fillStyle = pal.deep2;
    ctx.fillRect(full.x, full.y, full.w, full.h);
  }
  ctx.fillStyle = 'rgba(6,3,14,0.55)';
  ctx.fillRect(full.x, full.y, full.w, full.h);
  // soft spotlight behind the snapshot pile
  const spot = ctx.createRadialGradient(area.x + area.w * 0.5, area.y + area.h * 0.45, 0,
    area.x + area.w * 0.5, area.y + area.h * 0.45, area.w * 0.7);
  spot.addColorStop(0, hexAlpha(pal.accent2, 0.22));
  spot.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = spot;
  ctx.fillRect(full.x, full.y, full.w, full.h);
  ctx.restore();
  void geo;
}

function drawPanels(ctx, geo, state, pal, base) {
  const tilt = geo.tilt;
  for (let i = 0; i < geo.panels.length; i++) {
    const rect = geo.panels[i];
    const panel = state.panels[i] || {};
    const photo = state.photos && state.photos.find((ph) => ph.id === panel.photo);
    const draw = () => {
      if (tilt) {
        drawSnapshotCard(ctx, rect, photo, panel, pal, i);
        return;
      }
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = Math.max(6, rect.w * 0.035);
      ctx.shadowOffsetY = Math.max(2, rect.h * 0.012);
      ctx.fillStyle = pal.ink;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.restore();

      clipRect(ctx, rect, () => {
        if (photo && photo.img && photo.img.naturalWidth) {
          drawPhoto(ctx, photo.img, rect, panel, pal, i);
        } else {
          ctx.fillStyle = pal.deep2;
          ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
        }
        panelFinish(ctx, rect, pal, i);
      });
      panelFrame(ctx, rect, pal);
      panelLettering(ctx, rect, panel, i, pal, base);
    };
    if (rect.rot) {
      ctx.save();
      const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
      ctx.translate(cx, cy);
      ctx.rotate(rect.rot);
      ctx.translate(-cx, -cy);
      draw();
      ctx.restore();
    } else {
      draw();
    }
  }
}

function drawSnapshotCard(ctx, rect, photo, panel, pal, index) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = rect.w * 0.06;
  ctx.shadowOffsetY = rect.w * 0.02;
  const border = Math.max(6, rect.w * 0.035);
  ctx.fillStyle = pal.cream;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();

  const inner = {
    x: rect.x + border, y: rect.y + border,
    w: rect.w - border * 2, h: rect.h - border * 2.6,
  };
  clipRect(ctx, inner, () => {
    if (photo && photo.img && photo.img.naturalWidth) {
      drawPhoto(ctx, photo.img, inner, panel, pal, index);
    } else {
      ctx.fillStyle = pal.deep2;
      ctx.fillRect(inner.x, inner.y, inner.w, inner.h);
    }
    panelFinish(ctx, inner, pal, index);
  });

  const label = (panel.label || PANEL_WORDS[index % PANEL_WORDS.length]);
  ctx.fillStyle = pal.ink;
  ctx.font = `900 ${Math.max(9, rect.w * 0.045)}px ${FONT_FAMILY}`;
  ctx.textAlign = 'left';
  ctx.letterSpacing = `${Math.max(1, rect.w * 0.004)}px`;
  ctx.fillText(label, inner.x, rect.y + rect.h - border * 0.85);
  ctx.letterSpacing = '0px';
  ctx.textAlign = 'right';
  ctx.fillStyle = hexAlpha(pal.accent, 0.9);
  ctx.fillText(String(index + 1).padStart(2, '0'), inner.x + inner.w, rect.y + rect.h - border * 0.85);
}

function drawPhoto(ctx, img, rect, panel, pal, index) {
  const t = photoTransform(img, rect, panel);
  const x = t.x, y = t.y, dw = t.dw, dh = t.dh;

  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.filter = 'contrast(1.14) saturate(0.92)';
  ctx.drawImage(img, x, y, dw, dh);
  ctx.filter = 'none';

  // duotone: hue and saturation from the palette, luminance from the photograph
  const tone = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
  tone.addColorStop(0, pal.grade[0]);
  tone.addColorStop(0.42, pal.grade[1]);
  tone.addColorStop(0.78, pal.grade[2]);
  tone.addColorStop(1, pal.grade[3]);
  ctx.globalCompositeOperation = 'color';
  ctx.globalAlpha = 0.82;
  ctx.fillStyle = tone;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

  // warm light from the bottom, cool light from the top
  const warm = ctx.createLinearGradient(0, rect.y + rect.h * 0.35, 0, rect.y + rect.h);
  warm.addColorStop(0, 'rgba(0,0,0,0)');
  warm.addColorStop(1, hexAlpha(pal.accent2, 0.5));
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = warm;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

  const cool = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h * 0.6);
  cool.addColorStop(0, hexAlpha(pal.grade[0], 0.55));
  cool.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = cool;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

  // dodge the middle so the subject reads, burn the corners
  const light = ctx.createRadialGradient(
    rect.x + rect.w * (0.5 + (index % 2 ? -0.12 : 0.12)), rect.y + rect.h * 0.42, 0,
    rect.x + rect.w * 0.5, rect.y + rect.h * 0.5, Math.max(rect.w, rect.h) * 0.72);
  light.addColorStop(0, 'rgba(255,240,210,0.22)');
  light.addColorStop(0.6, 'rgba(0,0,0,0)');
  light.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.globalCompositeOperation = 'soft-light';
  ctx.globalAlpha = 1;
  ctx.fillStyle = light;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

  ctx.restore();
}

function photoTransform(img, rect, panel) {
  const zoom = Math.max(1, panel.zoom || 1);
  const base = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight);
  const scale = base * zoom;
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  const fx = clamp(panel.cx ?? 0.5, rect.w / (2 * dw), 1 - rect.w / (2 * dw));
  const fy = clamp(panel.cy ?? 0.45, rect.h / (2 * dh), 1 - rect.h / (2 * dh));
  return { x: rect.x + rect.w / 2 - fx * dw, y: rect.y + rect.h / 2 - fy * dh, dw, dh, scale };
}

function panelFinish(ctx, rect, pal, index) {
  // halftone print screen
  ctx.save();
  ctx.globalAlpha = 0.06;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = ctx.createPattern(dots, 'repeat');
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();

  // scanlines
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = pal.ink;
  const step = Math.max(3, rect.h * 0.012);
  for (let y = rect.y; y < rect.y + rect.h; y += step) ctx.fillRect(rect.x, y, rect.w, Math.max(1, step * 0.28));
  ctx.restore();
  void index;
}

function panelFrame(ctx, rect, pal) {
  const lw = Math.max(1, Math.min(rect.w, rect.h) * 0.008);
  ctx.save();
  ctx.strokeStyle = hexAlpha(pal.cream, 0.92);
  ctx.lineWidth = lw;
  ctx.strokeRect(rect.x + lw / 2, rect.y + lw / 2, rect.w - lw, rect.h - lw);
  ctx.strokeStyle = hexAlpha(pal.ink, 0.85);
  ctx.lineWidth = lw * 2.4;
  ctx.strokeRect(rect.x - lw * 1.2, rect.y - lw * 1.2, rect.w + lw * 2.4, rect.h + lw * 2.4);
  ctx.restore();
}

function panelLettering(ctx, rect, panel, index, pal, base) {
  const fs = clamp(base * 0.019, 11, 34);
  const tabW = fs * 1.5, tabH = fs * 1.18;

  // number tab, top left, the same size on every panel
  if (rect.w > tabW * 1.6 && rect.h > tabH * 1.8) {
    ctx.fillStyle = pal.cream;
    ctx.fillRect(rect.x + fs * 0.6, rect.y + fs * 0.6, tabW, tabH);
    ctx.fillStyle = pal.ink;
    ctx.font = `900 ${fs * 0.68}px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(index + 1).padStart(2, '0'), rect.x + fs * 0.6 + tabW / 2, rect.y + fs * 0.6 + tabH * 0.56);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  if (rect.w < fs * 8 || rect.h < fs * 4.2) return;
  const label = panel.label || PANEL_WORDS[index % PANEL_WORDS.length];
  ctx.font = `900 ${fs}px ${FONT_FAMILY}`;
  ctx.letterSpacing = `${fs * 0.02}px`;
  const tw = ctx.measureText(label).width * CONDENSE;
  const padX = fs * 0.55, ph = fs * 1.55;
  const px = rect.x + fs * 0.6;
  const py = rect.y + rect.h - ph - fs * 0.6;
  ctx.fillStyle = hexAlpha(pal.ink, 0.9);
  ctx.fillRect(px, py, tw + padX * 2 + fs * 0.5, ph);
  ctx.fillStyle = pal.accent;
  ctx.fillRect(px, py, fs * 0.22, ph);
  ctx.fillStyle = pal.cream;
  ctx.save();
  ctx.translate(px + padX + fs * 0.45, py + ph * 0.73);
  ctx.scale(CONDENSE, 1);
  ctx.fillText(label, 0, 0);
  ctx.restore();
  ctx.letterSpacing = '0px';
}

function drawHeader(ctx, header, state, pal, isWide) {
  const title = (state.title || 'UNTITLED').toUpperCase();
  const kickerSize = Math.max(10, header.h * 0.078);
  const pad = header.h * 0.018;
  const barH = header.h * 0.026;
  const barY = header.y + header.h - barH;

  // sun rays behind the lettering
  ctx.save();
  ctx.beginPath();
  ctx.rect(header.x, header.y, header.w, header.h);
  ctx.clip();
  ctx.globalAlpha = 0.11;
  ctx.strokeStyle = pal.cream;
  const ox = header.x + header.w * 0.82, oy = header.y - header.h * 0.8;
  for (let i = 0; i < 26; i++) {
    const a = -Math.PI * 0.12 + (i / 25) * Math.PI * 0.92;
    ctx.lineWidth = header.h * (0.006 + (i % 3) * 0.006);
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(ox + Math.cos(a) * header.w * 1.4, oy + Math.sin(a) * header.w * 1.4);
    ctx.stroke();
  }
  ctx.restore();

  // top rule and kicker
  ctx.fillStyle = pal.accent;
  ctx.fillRect(header.x, header.y + pad, header.h * 0.035, kickerSize * 1.5);
  ctx.fillStyle = pal.cream;
  ctx.fillRect(header.x + header.h * 0.06, header.y + pad + kickerSize * 0.9, header.w - header.h * 0.06, Math.max(1, header.h * 0.004));

  ctx.font = `900 ${kickerSize}px ${FONT_FAMILY}`;
  ctx.letterSpacing = `${kickerSize * 0.28}px`;
  ctx.fillStyle = pal.cream;
  ctx.globalAlpha = 0.92;
  ctx.fillText('A PALM COAST PICTURE', header.x, header.y + pad + kickerSize * 0.82);
  ctx.textAlign = 'right';
  ctx.fillStyle = pal.cream;
  ctx.globalAlpha = 1;
  ctx.fillText('ISSUE 01  /  2026', header.x + header.w, header.y + pad + kickerSize * 0.82);
  ctx.textAlign = 'left';
  ctx.globalAlpha = 1;
  ctx.letterSpacing = '0px';

  // title, fitted, up to two lines; the bar under it stays clear of the descenders
  const maxW = header.w;
  const availH = barY - (header.y + pad + kickerSize * 2.1) - header.h * 0.02;
  const fit = fitTitle(ctx, title, maxW, availH, isWide);
  const lineH = fit.size * 0.87;
  const blockH = lineH * fit.lines.length;
  const baseline = barY - header.h * 0.045;

  for (let i = 0; i < fit.lines.length; i++) {
    const line = fit.lines[i];
    const y = baseline - (fit.lines.length - 1 - i) * lineH;
    drawBigText(ctx, line, header.x, y, fit.size, pal);
  }
  void blockH;
  void isWide;

  // underline: a heavy accent bar and a thin cream rule
  ctx.fillStyle = pal.accent;
  ctx.fillRect(header.x, barY, header.w * 0.34, barH);
  ctx.fillStyle = pal.cream;
  ctx.globalAlpha = 0.5;
  ctx.fillRect(header.x + header.w * 0.34 + header.h * 0.02, barY + barH * 0.35, header.w * 0.66 - header.h * 0.02, Math.max(1, barH * 0.22));
  ctx.globalAlpha = 1;

  // the wordmark's cap height, so the footer caption can be set against it rather than against the sheet
  return { size: fit.size, barY };
}

function fitTitle(ctx, text, maxW, availH, isWide) {
  const start = availH * (isWide ? 1.34 : 1.24);
  const one = fitSize(ctx, text, maxW, start);
  if (one.size >= start * 0.7 || !text.includes(' ')) {
    return { lines: [text], size: one.size };
  }
  const words = text.split(/\s+/);
  const twoLineCap = Math.min(start * 0.72, availH * 0.56);
  let best = null;
  for (let split = 1; split < words.length; split++) {
    const a = words.slice(0, split).join(' ');
    const b = words.slice(split).join(' ');
    const sizeA = fitSize(ctx, a, maxW, twoLineCap).size;
    const sizeB = fitSize(ctx, b, maxW, twoLineCap).size;
    const size = Math.min(sizeA, sizeB, twoLineCap);
    if (!best || size > best.size) best = { lines: [a, b], size };
  }
  return best || { lines: [text], size: one.size };
}

function fitSize(ctx, text, maxW, maxSize) {
  let size = maxSize;
  ctx.font = `900 ${size}px ${FONT_FAMILY}`;
  const ratio = (maxW * 0.97) / Math.max(1, ctx.measureText(text).width * CONDENSE);
  size = Math.min(maxSize, size * ratio);
  return { size };
}

function drawBigText(ctx, text, x, baseline, size, pal) {
  ctx.save();
  ctx.font = `900 ${size}px ${FONT_FAMILY}`;
  ctx.letterSpacing = `${-size * 0.012}px`;
  ctx.translate(x, baseline);
  ctx.scale(CONDENSE, 1);

  ctx.globalAlpha = 0.85;
  ctx.fillStyle = pal.accent;
  ctx.fillText(text, size * 0.035, size * 0.045);

  ctx.globalAlpha = 1;
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = size * 0.07;
  ctx.shadowOffsetY = size * 0.04;
  ctx.lineJoin = 'round';
  ctx.lineWidth = size * 0.028;
  ctx.strokeStyle = pal.ink;
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = pal.cream;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

/**
 * The lettering's own numbers, so a build script can hold the hierarchy to a ratio rather than to an impression:
 * the wordmark's fitted size and the footer caption's size as a share of it. Both are recomputed with the same
 * font and the same width budget the renderer uses.
 */
export function footerMetrics(state, W, H) {
  const isWide = W / H > 1.4;
  const isPortrait = W / H < 0.92;
  const m = Math.min(W, H) * (isWide ? 0.028 : isPortrait ? 0.045 : 0.038);
  const headerH = H * (isWide ? 0.285 : isPortrait ? 0.175 : 0.225);
  const footerH = H * (isWide ? 0.185 : isPortrait ? 0.115 : 0.135);
  const header = { x: m, y: m * 0.75, w: W - 2 * m, h: headerH };
  const footer = { x: m, y: H - m * 1.1 - footerH, w: W - 2 * m, h: footerH };

  const title = (state.title || 'UNTITLED').toUpperCase();
  const kickerSize = Math.max(10, header.h * 0.078);
  const pad = header.h * 0.018;
  const barH = header.h * 0.026;
  const barY = header.y + header.h - barH;
  const availH = barY - (header.y + pad + kickerSize * 2.1) - header.h * 0.02;

  const c = document.createElement('canvas').getContext('2d');
  c.font = `900 100px ${FONT_FAMILY}`;
  const fit = fitTitle(c, title, header.w, availH, isWide);

  const caption = (state.caption || '').toUpperCase();
  const creditsW = footer.w * (isWide ? 0.26 : 0.3);
  const c2 = document.createElement('canvas').getContext('2d');
  const led = captionLayout(c2, caption, footer.w * CAPTION_MEASURE, fit.size, footer.h);
  return {
    titleSize: fit.size, titleLines: fit.lines.length,
    captionSize: led.size, captionLines: led.lines.length, ratio: led.size / fit.size,
    footerH, creditsW,
  };
}

/**
 * The footer caption's size, tracking and lines: tracked caps at about a third of the wordmark's cap height, on a
 * row of its own above the credits. The legal line gets a reserved row at the bottom, so a two-line caption is
 * sized to what is actually left rather than being allowed to run into the fine print. Used by the renderer and by
 * the metrics the build scripts check, so the two cannot disagree.
 */
function captionLayout(ctx, caption, room, titleSize, footerH) {
  if (!caption) return { size: 0, tracking: 0.14, lines: [] };
  const legalRow = Math.max(11, footerH * 0.17);
  const padTop = footerH * 0.13;
  const blockH = Math.max(footerH * 0.3, footerH - legalRow - padTop);
  const target = Math.min(titleSize * 0.26, blockH / 1.16, footerH * 0.42);

  // Tracking is decoration, size is hierarchy: tighten the tracking to hold one line before giving up any height.
  for (const tracking of [0.14, 0.1, 0.06, 0.03]) {
    const lines = wrapCaption(ctx, caption, room, target, 99, tracking);
    if (lines.length === 1) return { size: target, tracking, lines, legalRow };
  }
  // One line is the point of a caption, so a long one is set a little smaller rather than broken in two — as long
  // as it still reads as a caption and not as a second headline.
  const full = measureTracked(ctx, caption, target, 0.03);
  const fit = target * (room / full);
  if (fit >= target * 0.62) {
    // the measure and the wrapper must agree, so trust the wrapper: shave until it reports one line
    let size = fit;
    for (let i = 0; i < 12; i++) {
      if (wrapCaption(ctx, caption, room, size, 99, 0.03).length === 1) break;
      size *= 0.985;
    }
    return { size, tracking: 0.03, lines: wrapCaption(ctx, caption, room, size, 99, 0.03), legalRow };
  }
  // It genuinely needs two lines: size it to the row it has, so both lines and the legal row fit.
  const size = Math.min(target, blockH / 2.16);
  return { size, tracking: 0.03, lines: wrapCaption(ctx, caption, room, size, 2, 0.03), legalRow };
}

function measureTracked(ctx, text, size, tracking = 0.14) {
  ctx.save();
  ctx.font = `700 ${size}px ${FONT_FAMILY}`;
  ctx.letterSpacing = `${size * tracking}px`;
  const w = ctx.measureText(text).width + size * tracking * text.length;
  ctx.restore();
  return w;
}

function drawFooter(ctx, footer, state, pal, isWide, title) {
  const caption = (state.caption || '').toUpperCase();
  const titleCap = (title && title.size) || footer.h * 1.1;
  const rightW = footer.w * (isWide ? 0.26 : 0.3);
  const ruleY = footer.y;
  ctx.fillStyle = hexAlpha(pal.cream, 0.65);
  ctx.fillRect(footer.x, ruleY, footer.w, Math.max(1, footer.h * 0.012));
  ctx.fillStyle = pal.accent;
  ctx.fillRect(footer.x, ruleY, footer.w * 0.18, Math.max(2, footer.h * 0.03));

  // The caption is a caption, not a second title: it sits on the row immediately above the credits, at a third of
  // the wordmark's cap height, so the rule above belongs to the grid and not to the line. Sizing comes first
  // because the credits' baseline sets where the caption's own baseline lands.
  // The caption's measure is capped well short of the sheet: a line that spans the full width reads as a display
  // line at any point size, which is exactly what the wordmark must not have beside it.
  const led = captionLayout(ctx, caption, footer.w * CAPTION_MEASURE, titleCap, footer.h);
  const capSize = led.size;
  const lines = led.lines;
  const legalY = footer.y + footer.h - Math.max(3, led.legalRow * 0.32);
  const lineH = capSize * 1.16;
  // Sit the caption on the credits' own row: ordinary spacing, so it reads as the line above the fine print
  // rather than as a headline pinned to the rule at the top of the footer.
  const capBaseline = legalY - Math.max(capSize * 0.62, footer.h * 0.1);

  ctx.save();
  ctx.font = `700 ${capSize}px ${FONT_FAMILY}`;
  ctx.letterSpacing = `${capSize * led.tracking}px`;
  ctx.fillStyle = hexAlpha(pal.cream, 0.84);
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], footer.x, capBaseline - (lines.length - 1 - i) * lineH);
  }
  ctx.restore();
  ctx.letterSpacing = '0px';

  // bottom row: the legal shirttail on the left, the credits and the barcode on the right
  const legal = 'A COAST PICTURE  ·  ALL PERSONS AND PLACES FICTIONAL  ·  ISSUE 01';
  const creditsW = footer.w * (isWide ? 0.26 : 0.3);
  const legalRoom = footer.w - creditsW - footer.h * 0.3;
  let fine = Math.max(7, footer.h * 0.085);
  ctx.font = `700 ${fine}px ${FONT_FAMILY}`;
  ctx.letterSpacing = `${fine * 0.1}px`;
  const legalW = ctx.measureText(legal).width + fine * 0.1 * legal.length;
  if (legalW > legalRoom) {
    fine *= legalRoom / legalW;
    ctx.font = `700 ${fine}px ${FONT_FAMILY}`;
    ctx.letterSpacing = `${fine * 0.1}px`;
  }
  ctx.fillStyle = hexAlpha(pal.cream, 0.46);
  ctx.fillText(legal, footer.x, legalY);
  ctx.letterSpacing = '0px';

  // credits block on the right, on the bottom row, sized to fit its column
  let fs = Math.max(8, footer.h * 0.105);
  ctx.letterSpacing = `${fs * 0.14}px`;
  ctx.font = `900 ${fs}px ${FONT_FAMILY}`;
  const topLine = 'COAST STUDIO';
  const measured = ctx.measureText(topLine).width + fs * 0.14 * topLine.length;
  if (measured > creditsW * 0.62) fs *= (creditsW * 0.62) / measured;
  ctx.textAlign = 'right';
  ctx.font = `900 ${fs}px ${FONT_FAMILY}`;
  ctx.letterSpacing = `${fs * 0.14}px`;
  ctx.fillStyle = pal.accent2;
  ctx.fillText(topLine, footer.x + footer.w, legalY - fs * 1.25);
  ctx.fillStyle = hexAlpha(pal.cream, 0.7);
  ctx.letterSpacing = `${fs * 0.1}px`;
  ctx.fillText('CUT ON A SUNSET / MMXXVI', footer.x + footer.w, legalY);
  ctx.letterSpacing = '0px';
  ctx.textAlign = 'left';

  // barcode: a print mark, not a scannable code, tucked left of the credits
  const bars = 20;
  const bw = creditsW * 0.2;
  const bx = footer.x + footer.w - creditsW * 1.02 - bw;
  const bh = Math.max(6, footer.h * 0.13);
  const by = legalY - bh;
  for (let i = 0; i < bars; i++) {
    const w = bw / bars;
    ctx.globalAlpha = i % 3 === 0 ? 0.8 : 0.4;
    ctx.fillStyle = pal.cream;
    ctx.fillRect(bx + i * w, by, w * (i % 4 === 0 ? 0.75 : 0.45), bh);
  }
  ctx.globalAlpha = 1;
}

/** Wraps a caption into at most `max` lines at a given size, so a long one keeps its size instead of shrinking. */
function wrapCaption(ctx, text, maxW, size, max, tracking = 0.14) {
  ctx.save();
  ctx.font = `700 ${size}px ${FONT_FAMILY}`;
  ctx.letterSpacing = `${size * tracking}px`;
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    const w = ctx.measureText(next).width + size * tracking * next.length;
    if (line && w > maxW && lines.length + 1 < max) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  ctx.letterSpacing = '0px';
  ctx.restore();
  return lines;
}

function drawSelection(ctx, rect, index, pal) {
  ctx.save();
  const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
  if (rect.rot) {
    ctx.translate(cx, cy);
    ctx.rotate(rect.rot);
    ctx.translate(-cx, -cy);
  }
  const lw = Math.max(2, Math.min(rect.w, rect.h) * 0.008);
  ctx.strokeStyle = pal.accent;
  ctx.lineWidth = lw;
  ctx.setLineDash([]);
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  const hs = Math.max(7, Math.min(rect.w, rect.h) * 0.028);
  ctx.fillStyle = pal.cream;
  for (const [hx, hy] of [[rect.x, rect.y], [rect.x + rect.w, rect.y], [rect.x, rect.y + rect.h], [rect.x + rect.w, rect.y + rect.h]]) {
    ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs);
  }

  // a small editor tag, so the outline never reads as part of the artwork
  const fs = Math.max(9, Math.min(rect.w, rect.h) * 0.032);
  ctx.font = `900 ${fs}px ${FONT_FAMILY}`;
  ctx.letterSpacing = `${fs * 0.12}px`;
  const label = `SELECTED ${String(index + 1).padStart(2, '0')}`;
  const tw = ctx.measureText(label).width + fs * 1.1;
  const th = fs * 1.8;
  const tx = rect.x + rect.w - tw - fs * 0.5;
  const ty = rect.y + fs * 0.5;
  ctx.fillStyle = pal.ink;
  ctx.fillRect(tx, ty, tw, th);
  ctx.strokeStyle = pal.accent;
  ctx.lineWidth = Math.max(1, lw * 0.5);
  ctx.strokeRect(tx, ty, tw, th);
  ctx.fillStyle = pal.cream;
  ctx.textBaseline = 'middle';
  ctx.fillText(label, tx + fs * 0.55, ty + th * 0.54);
  ctx.textBaseline = 'alphabetic';
  ctx.letterSpacing = '0px';
  ctx.restore();
}

/**
 * Where the hero cut-out sits on the sheet and how big its silhouette is: the same numbers drawHeroBust uses, so a
 * build script can measure the rim and the shadow on the pixels they were painted into.
 */
export function heroBustBox(state, W, H) {
  if (!state || state.layout !== 'hero') return null;
  const geo = panelRects(state, W, H);
  if (!geo.panels.length) return null;
  const panel = state.panels[0] || {};
  const photo = state.photos && state.photos.find((p) => p.id === panel.photo);
  if (!photo || !photo.img || !photo.img.naturalWidth || !photo.face) return null;
  const rect = geo.panels[0];
  const t = photoTransform(photo.img, rect, panel);
  const face = photo.face;
  const head = photo.head || face;
  const faceX = t.x + (face.x + face.w / 2) * t.dw;
  const faceY = t.y + (face.y + face.h * 0.44) * t.dh;
  // The matte reaches a set distance up the sheet, not a fraction of the head box: the silhouette inside it is cut
  // from the photograph's own luminance, so the extra height is empty sky and adds nothing, while the real hair
  // inside it is what crosses the letters. Sizing from the head box left the crown short on a tall panel.
  const apex = rect.y - H * (W / H > 1.4 ? 0.208 : 0.155);
  const rx = clamp(head.w * t.dw * 0.62, rect.w * 0.10, rect.w * 0.24);
  const ry = clamp(faceY - apex, rect.h * 0.16, rect.h * 1.1);
  return {
    cx: clamp(faceX, rect.x + rx * 0.6, rect.x + rect.w - rx * 0.6),
    cy: faceY, rx, ry, rect,
  };
}

function drawHeroBust(ctx, geo, state, pal) {
  if (geo.tilt || state.layout !== 'hero' || !geo.panels.length) return;
  const panel = state.panels[0] || {};
  const photo = state.photos && state.photos.find((p) => p.id === panel.photo);
  if (!photo || !photo.img || !photo.img.naturalWidth || !photo.face) return;
  const rect = geo.panels[0];

  // only the part above the frame is drawn; the panel below keeps its own photo, so no duplicate
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, ctx.canvas.width, rect.y + 2);
  ctx.clip();

  const t = photoTransform(photo.img, rect, panel);
  const box = heroBustBox(state, ctx.canvas.width, ctx.canvas.height);
  const rx = box.rx, ry = box.ry;
  const cx = box.cx, cy = box.cy;
  const pad = Math.ceil(Math.max(rx, ry) * 0.06);

  const cw = Math.ceil(rx * 2 + pad * 2);
  const ch = Math.ceil(ry * 2 + pad * 2);
  const off = document.createElement('canvas');
  off.width = cw;
  off.height = ch;
  const octx = off.getContext('2d');
  octx.translate(pad + rx - cx, pad + ry - cy);
  octx.filter = 'contrast(1.14) saturate(0.92)';
  octx.drawImage(photo.img, t.x, t.y, t.dw, t.dh);
  octx.filter = 'none';

  // the panel's grade, drawn with the panel's own world-space gradients so the cut-out matches it exactly
  const bx0 = cx - rx - pad, by0 = cy - ry - pad;
  const bw = 2 * rx + 2 * pad, bh = 2 * ry + 2 * pad;
  const tone = octx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
  tone.addColorStop(0, pal.grade[0]);
  tone.addColorStop(0.42, pal.grade[1]);
  tone.addColorStop(0.78, pal.grade[2]);
  tone.addColorStop(1, pal.grade[3]);
  octx.globalCompositeOperation = 'color';
  octx.globalAlpha = 0.82;
  octx.fillStyle = tone;
  octx.fillRect(bx0, by0, bw, bh);

  const warm = octx.createLinearGradient(0, rect.y + rect.h * 0.35, 0, rect.y + rect.h);
  warm.addColorStop(0, 'rgba(0,0,0,0)');
  warm.addColorStop(1, hexAlpha(pal.accent2, 0.5));
  octx.globalCompositeOperation = 'screen';
  octx.globalAlpha = 0.7;
  octx.fillStyle = warm;
  octx.fillRect(bx0, by0, bw, bh);

  const cool = octx.createLinearGradient(0, rect.y, 0, rect.y + rect.h * 0.6);
  cool.addColorStop(0, hexAlpha(pal.grade[0], 0.55));
  cool.addColorStop(1, 'rgba(0,0,0,0)');
  octx.globalCompositeOperation = 'multiply';
  octx.globalAlpha = 0.55;
  octx.fillStyle = cool;
  octx.fillRect(bx0, by0, bw, bh);

  const light = octx.createRadialGradient(
    rect.x + rect.w * 0.62, rect.y + rect.h * 0.42, 0,
    rect.x + rect.w * 0.5, rect.y + rect.h * 0.5, Math.max(rect.w, rect.h) * 0.72);
  light.addColorStop(0, 'rgba(255,240,210,0.22)');
  light.addColorStop(0.6, 'rgba(0,0,0,0)');
  light.addColorStop(1, 'rgba(0,0,0,0.5)');
  octx.globalCompositeOperation = 'soft-light';
  octx.globalAlpha = 1;
  octx.fillStyle = light;
  octx.fillRect(bx0, by0, bw, bh);

  octx.save();
  octx.globalAlpha = 0.06;
  octx.globalCompositeOperation = 'overlay';
  octx.fillStyle = octx.createPattern(dots, 'repeat');
  octx.fillRect(bx0, by0, bw, bh);
  octx.restore();
  octx.save();
  octx.globalAlpha = 0.08;
  octx.fillStyle = pal.ink;
  const step = Math.max(3, rect.h * 0.012);
  for (let y = by0; y < by0 + bh; y += step) octx.fillRect(bx0, y, bw, Math.max(1, step * 0.28));
  octx.restore();

  const unify = octx.createLinearGradient(geo.area.x, geo.area.y, geo.area.x + geo.area.w, geo.area.y + geo.area.h);
  unify.addColorStop(0, pal.grade[0]);
  unify.addColorStop(0.45, pal.grade[1]);
  unify.addColorStop(0.8, pal.grade[2]);
  unify.addColorStop(1, pal.grade[3]);
  octx.globalCompositeOperation = 'color';
  octx.globalAlpha = 0.24;
  octx.fillStyle = unify;
  octx.fillRect(bx0, by0, bw, bh);

  const wash2 = octx.createLinearGradient(0, geo.area.y, 0, geo.area.y + geo.area.h);
  wash2.addColorStop(0, hexAlpha(pal.accent, 0.1));
  wash2.addColorStop(0.55, hexAlpha(pal.accent2, 0.06));
  wash2.addColorStop(1, hexAlpha(pal.accent2, 0.2));
  octx.globalCompositeOperation = 'soft-light';
  octx.globalAlpha = 1;
  octx.fillStyle = wash2;
  octx.fillRect(bx0, by0, bw, bh);

  // The silhouette is cut from the photograph's own luminance, not from a geometric ellipse. An ellipse always
  // carries whatever is inside it, so its apex brought the bright sky down with the hair and the sky, not her hair,
  // is what crossed the letters. Her hair is the dark mass against that sky, so luminance is the real silhouette;
  // a generous ellipse only bounds it to the region around her head.
  const matte = document.createElement('canvas');
  matte.width = cw;
  matte.height = ch;
  const mctx = matte.getContext('2d');
  mctx.translate(pad + rx - cx, pad + ry - cy);
  mctx.drawImage(photo.img, t.x, t.y, t.dw, t.dh);
  const shot = mctx.getImageData(0, 0, cw, ch);
  const sd = shot.data;
  for (let i = 0; i < sd.length; i += 4) {
    const lum = 0.2126 * sd[i] + 0.7152 * sd[i + 1] + 0.0722 * sd[i + 2];
    // soft threshold: hair and the dark tee are opaque, sky and sand fall away
    sd[i + 3] = Math.round(255 * clamp((168 - lum) / 62, 0, 1));
    sd[i] = 255; sd[i + 1] = 255; sd[i + 2] = 255;
  }
  mctx.putImageData(shot, 0, 0);

  // bound it to her head: the ellipse is wider and taller than the head so the crown is never clipped
  mctx.globalCompositeOperation = 'destination-in';
  mctx.save();
  mctx.setTransform(1, 0, 0, 1, 0, 0);
  mctx.translate(pad + rx, pad + ry);
  mctx.scale(1, ry / rx);
  const bound = mctx.createRadialGradient(0, 0, rx * 0.86, 0, 0, rx);
  bound.addColorStop(0, 'rgba(255,255,255,1)');
  bound.addColorStop(1, 'rgba(255,255,255,0)');
  mctx.fillStyle = bound;
  mctx.beginPath();
  mctx.arc(0, 0, rx, 0, Math.PI * 2);
  mctx.fill();
  mctx.restore();
  mctx.globalCompositeOperation = 'source-over';

  octx.setTransform(1, 0, 0, 1, 0, 0);
  octx.globalCompositeOperation = 'destination-in';
  octx.globalAlpha = 1;
  octx.drawImage(matte, 0, 0);

  // a soft dark cast shadow, thrown down and to the right, so the bust sits in front of the band
  const sh = document.createElement('canvas');
  sh.width = cw;
  sh.height = ch;
  const sctx = sh.getContext('2d');
  const offX = Math.max(3, rx * 0.11);
  const offY = Math.max(3, ry * 0.10);
  sctx.filter = `blur(${Math.max(2, rx * 0.045)}px)`;
  sctx.globalAlpha = 0.9;
  sctx.drawImage(matte, offX, offY);
  sctx.filter = 'none';
  sctx.globalAlpha = 1;
  sctx.globalCompositeOperation = 'source-in';
  sctx.fillStyle = '#080208';
  sctx.fillRect(0, 0, cw, ch);

  // the rim: the matte minus a copy of itself shifted down-right, so what is left hugs the top-left edge
  const rim = document.createElement('canvas');
  rim.width = cw;
  rim.height = ch;
  const rctx = rim.getContext('2d');
  const px = Math.max(2.5, ctx.canvas.width * 0.0018);
  rctx.drawImage(matte, 0, 0);
  rctx.globalCompositeOperation = 'destination-out';
  rctx.drawImage(matte, px, px * 0.85);
  rctx.globalCompositeOperation = 'source-in';
  rctx.fillStyle = '#fff6e8';
  rctx.fillRect(0, 0, cw, ch);
  // keep the light on the sunlit side only: strong at the top-left, gone by the lower-right
  rctx.globalCompositeOperation = 'destination-in';
  const fall = rctx.createLinearGradient(0, 0, cw * 0.85, ch * 0.95);
  fall.addColorStop(0, 'rgba(255,255,255,1)');
  fall.addColorStop(0.55, 'rgba(255,255,255,0.55)');
  fall.addColorStop(1, 'rgba(255,255,255,0)');
  rctx.fillStyle = fall;
  rctx.fillRect(0, 0, cw, ch);

  const ox = cx - rx - pad, oy = cy - ry - pad;
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.drawImage(sh, ox, oy);
  ctx.drawImage(off, ox, oy);
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = 0.9;
  ctx.drawImage(rim, ox, oy);
  ctx.restore();
  ctx.restore();
}

function drawSeal(ctx, geo, state, pal, W, H) {
  const r = Math.min(W, H) * 0.082;
  let fx = 0.5, fy = 0.5;
  // The seal is a sticker on the grid, never on a subject: on the hero sheet it sits on the hero's lower-right
  // corner, on the six-up sheet on the central gutter where it covers four empty corners rather than a panel's
  // subject. On the four-up sheet the centre is the only seam that has room for it.
  if (state.layout === 'hero') { fx = 0.575; fy = 0.925; }
  if (state.layout === 'six') { fx = 0.5; fy = 0.5; }
  const cx = geo.area.x + geo.area.w * fx;
  const cy = geo.area.y + geo.area.h * fy;

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = r * 0.3;
  ctx.shadowOffsetY = r * 0.08;
  ctx.fillStyle = pal.cream;
  const scallops = 42;
  for (let i = 0; i < scallops; i++) {
    const a = (i / scallops) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.9, r * 0.125, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.94, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = pal.accent;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.84, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = pal.cream;
  ctx.lineWidth = r * 0.018;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.7, 0, Math.PI * 2);
  ctx.stroke();

  drawArcText(ctx, 'PALM COAST', cx, cy, r * 0.62, -Math.PI * 0.76, -Math.PI * 0.24, r * 0.12, pal.cream);

  // star
  ctx.fillStyle = pal.cream;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 ? r * 0.09 : r * 0.21;
    const px = cx + Math.cos(a) * rad;
    const py = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();

  const line = `FESTIVAL ${state.sealYear || 2026}`;
  const fs = r * 0.1;
  ctx.font = `900 ${fs}px ${FONT_FAMILY}`;
  ctx.letterSpacing = `${fs * 0.08}px`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = pal.cream;
  ctx.fillText(line, cx, cy + r * 0.47);
  ctx.letterSpacing = '0px';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

function drawArcText(ctx, text, cx, cy, radius, from, to, size, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `900 ${size}px ${FONT_FAMILY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const chars = Array.from(text);
  const widths = chars.map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) || 1;
  let run = 0;
  for (let i = 0; i < chars.length; i++) {
    const mid = (run + widths[i] / 2) / total;
    run += widths[i];
    const a = from + (to - from) * mid;
    ctx.save();
    ctx.translate(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius);
    ctx.rotate(a + Math.PI / 2);
    ctx.fillText(chars[i], 0, 0);
    ctx.restore();
  }
  ctx.restore();
}

function filmGrain(ctx, W, H, seed) {
  ctx.save();
  ctx.globalAlpha = 0.065;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = ctx.createPattern(noise, 'repeat');
  ctx.translate((seed * 37) % 128, (seed * 91) % 128);
  ctx.fillRect(-128, -128, W + 256, H + 256);
  ctx.restore();
}

function clipRect(ctx, rect, fn) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  fn();
  ctx.restore();
}

function makeNoiseTile() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  const img = x.createImageData(128, 128);
  let s = 4080;
  for (let i = 0; i < img.data.length; i += 4) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const v = 96 + (s >>> 24) * 0.25;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  return c;
}

function makeDotTile() {
  const c = document.createElement('canvas');
  c.width = c.height = 6;
  const x = c.getContext('2d');
  x.fillStyle = '#000';
  x.fillRect(0, 0, 6, 6);
  x.fillStyle = '#fff';
  x.beginPath();
  x.arc(3, 3, 1.35, 0, Math.PI * 2);
  x.fill();
  return c;
}

function hexAlpha(hex, a) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((ch) => ch + ch).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
