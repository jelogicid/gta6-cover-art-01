// The edit state and its undo history: which photos are in the pool, which photo fills each panel and how it is
// cropped, the title, the caption, the layout, the palette and the post size. Everything the renderer needs, nothing
// it does not, so a snapshot is a small JSON string.
//
// The crop is the part that decides whether the art reads, so it is not guessed at paint time: every sample photo
// carries the boxes of what is in it (face, head, object, measured off the file by eye), and every layout carries
// hand-picked frames — cx, cy and zoom per panel per post size — resolved here, once, when a photo lands in a panel.

import { LAYOUTS, SIZES, panelRects } from './render.js';

/**
 * What is in each photograph, in normalised photo coordinates (0–1 from the top left).
 *   face  the box the face rule protects: a panel edge may never cross it
 *   head  the whole-head box a panel should hold, hair or hat included
 *   subj  the whole-object box a detail panel must hold
 * A box touching x=0 is already cut by the photograph itself (a half head in the file), so no panel may show it.
 */
export const SUBJECTS = {
  'gold-hour': {
    face: { x: 0.29, y: 0.145, w: 0.42, h: 0.30 },
    head: { x: 0.25, y: 0.07, w: 0.50, h: 0.45 },
  },
  'palm-line': {
    face: { x: 0, y: 0.16, w: 0.34, h: 0.50 },
    head: { x: 0, y: 0.12, w: 0.37, h: 0.58 },
  },
  'the-car': {
    // The chrome lever handle is the one whole object in the file: fully inside the frame with margin on all
    // sides and a landscape shape that suits a rail cell. The side mirror spills past the left edge.
    subj: { x: 0.625, y: 0.665, w: 0.165, h: 0.075 },
  },
  pier: {
    face: { x: 0.265, y: 0.15, w: 0.28, h: 0.205 },
    head: { x: 0.18, y: 0.015, w: 0.44, h: 0.37 },
  },
  'low-tide': {
    subj: { x: 0.75, y: 0.22, w: 0.16, h: 0.33 },
  },
  'the-rod': {
    face: { x: 0, y: 0.02, w: 0.25, h: 0.29 },
    subj: { x: 0.62, y: 0.60, w: 0.20, h: 0.21 },
  },
};

export const SAMPLES = [
  { id: 'gold-hour', name: 'Gold Hour', url: 'samples/gold-hour.jpg', label: 'GOLD HOUR', w: 1200, h: 916 },
  { id: 'palm-line', name: 'Palm Line', url: 'samples/palm-line.jpg', label: 'PALM LINE', w: 1000, h: 1136 },
  { id: 'the-car', name: 'The Car', url: 'samples/the-car.jpg', label: 'THE CAR', w: 1000, h: 1235 },
  { id: 'pier', name: 'The Pier', url: 'samples/pier.jpg', label: 'THE PIER', w: 720, h: 720 },
  { id: 'low-tide', name: 'Low Tide', url: 'samples/low-tide.jpg', label: 'LOW TIDE', w: 1200, h: 567 },
  { id: 'the-rod', name: 'The Rod', url: 'samples/the-rod.jpg', label: 'THE ROD', w: 1000, h: 1190 },
].map((s) => ({ ...s, ...(SUBJECTS[s.id] || {}) }));

/**
 * Hand-picked frames, one per sample photo per post size, for a panel of the size that post size usually gives
 * (roughly 2.2:1 on the landscape sheet, 1.2:1 on the portrait one, 1.5:1 on the square one). These are the
 * fallback: a layout whose panels are much wider or taller than that overrides them below.
 */
export const PHOTO_FRAMES = {
  'gold-hour': {
    wide: { cx: 0.5, cy: 0.335, zoom: 1 },
    portrait: { cx: 0.5, cy: 0.5, zoom: 1.04 },
    square: { cx: 0.5, cy: 0.44, zoom: 1 },
  },
  // her face sits on the file's left edge, so every frame of this photo is the palm boulevard beside it
  'palm-line': {
    wide: { cx: 0.722, cy: 0.62, zoom: 1.8 },
    portrait: { cx: 0.722, cy: 0.58, zoom: 1.8 },
    square: { cx: 0.722, cy: 0.6, zoom: 1.8 },
  },
  // the whole object is the chrome mirror on the red door, with the hand resting above it
  'the-car': {
    wide: { cx: 0.5, cy: 0.52, zoom: 1 },
    portrait: { cx: 0.45, cy: 0.5, zoom: 1.25 },
    square: { cx: 0.5, cy: 0.52, zoom: 1 },
  },
  pier: {
    wide: { cx: 0.42, cy: 0.227, zoom: 1 },
    portrait: { cx: 0.45, cy: 0.42, zoom: 1 },
    square: { cx: 0.45, cy: 0.34, zoom: 1 },
  },
  // the whole object is the gold-spooled reel under his hands
  'low-tide': {
    wide: { cx: 0.5, cy: 0.5, zoom: 1 },
    portrait: { cx: 0.7, cy: 0.5, zoom: 1 },
    square: { cx: 0.62, cy: 0.5, zoom: 1 },
  },
  // his face is cut by the file's left edge too, so the frame is the reel and the hand on the grip
  'the-rod': {
    wide: { cx: 0.6875, cy: 0.68, zoom: 1.6 },
    portrait: { cx: 0.6875, cy: 0.65, zoom: 1.6 },
    square: { cx: 0.6875, cy: 0.66, zoom: 1.6 },
  },
};

/**
 * Frames per layout: one named preset per layout and post size, one entry per panel, each nailed to the photo it
 * was framed for. A panel holding a different photo falls back to that photo's own frame above.
 */
export const LAYOUT_FRAMES = {
  // The hero panel is the big band; the right column is three near-4:3 cells, so each one can hold a whole head or
  // a whole object rather than a slice of one. One nameable subject per cell: her face, the fisherman's head, the
  // reel in his fist, the chrome mirror on the red door.
  hero: {
    wide: [
      { photo: 'gold-hour', cx: 0.5, cy: 0.3, zoom: 1 },
      { photo: 'pier', cx: 0.4, cy: 0.3, zoom: 1.3 },
      { photo: 'low-tide', cx: 0.83, cy: 0.385, zoom: 2.4 },
      { photo: 'the-car', cx: 0.7075, cy: 0.7025, zoom: 2.2 },
    ],
    portrait: [
      { photo: 'gold-hour', cx: 0.52, cy: 0.68, zoom: 1.2 },
      { photo: 'pier', cx: 0.5, cy: 0.33, zoom: 1.15 },
      { photo: 'the-car', cx: 0.21, cy: 0.57, zoom: 1.9 },
      { photo: 'low-tide', cx: 0.78, cy: 0.45, zoom: 1.5 },
    ],
    square: [
      { photo: 'gold-hour', cx: 0.5, cy: 0.42, zoom: 1 },
      { photo: 'pier', cx: 0.5, cy: 0.24, zoom: 1 },
      { photo: 'the-car', cx: 0.45, cy: 0.5, zoom: 1.25 },
      { photo: 'low-tide', cx: 0.66, cy: 0.44, zoom: 1.25 },
    ],
  },
  quad: {
    wide: [
      { photo: 'gold-hour', cx: 0.5, cy: 0.33, zoom: 1 },
      { photo: 'palm-line', cx: 0.6, cy: 0.55, zoom: 1.5 },
      { photo: 'the-car', cx: 0.5, cy: 0.52, zoom: 1 },
      { photo: 'pier', cx: 0.5, cy: 0.227, zoom: 1 },
    ],
    portrait: [
      { photo: 'gold-hour', cx: 0.5, cy: 0.5, zoom: 1.05 },
      { photo: 'palm-line', cx: 0.706, cy: 0.55, zoom: 1.7 },
      { photo: 'the-car', cx: 0.45, cy: 0.5, zoom: 1.2 },
      { photo: 'pier', cx: 0.5, cy: 0.42, zoom: 1 },
    ],
    square: [
      { photo: 'gold-hour', cx: 0.5, cy: 0.385, zoom: 1 },
      { photo: 'palm-line', cx: 0.722, cy: 0.6, zoom: 1.75 },
      { photo: 'the-car', cx: 0.5, cy: 0.52, zoom: 1 },
      { photo: 'pier', cx: 0.45, cy: 0.3, zoom: 1 },
    ],
  },
  six: {
    wide: [
      { photo: 'gold-hour', cx: 0.5, cy: 0.35, zoom: 1 },
      { photo: 'palm-line', cx: 0.69, cy: 0.6, zoom: 1.75 },
      { photo: 'the-car', cx: 0.44, cy: 0.53, zoom: 1.2 },
      { photo: 'pier', cx: 0.45, cy: 0.28, zoom: 1 },
      { photo: 'low-tide', cx: 0.62, cy: 0.45, zoom: 1.35 },
      { photo: 'the-rod', cx: 0.6875, cy: 0.66, zoom: 1.7 },
    ],
    portrait: [
      { photo: 'gold-hour', cx: 0.5, cy: 0.5, zoom: 1.05 },
      { photo: 'palm-line', cx: 0.7, cy: 0.58, zoom: 1.75 },
      { photo: 'the-car', cx: 0.45, cy: 0.5, zoom: 1.2 },
      { photo: 'pier', cx: 0.5, cy: 0.4, zoom: 1 },
      { photo: 'low-tide', cx: 0.68, cy: 0.5, zoom: 1 },
      { photo: 'the-rod', cx: 0.6875, cy: 0.65, zoom: 1.65 },
    ],
    square: [
      { photo: 'gold-hour', cx: 0.55, cy: 0.5, zoom: 1 },
      { photo: 'palm-line', cx: 0.722, cy: 0.55, zoom: 1.75 },
      { photo: 'the-car', cx: 0.45, cy: 0.52, zoom: 1.25 },
      { photo: 'pier', cx: 0.5, cy: 0.42, zoom: 1 },
      { photo: 'low-tide', cx: 0.75, cy: 0.42, zoom: 1.45 },
      { photo: 'the-rod', cx: 0.66, cy: 0.66, zoom: 1.55 },
    ],
  },
};

export const DEFAULTS = {
  layout: 'hero',
  palette: 'vice',
  size: 'wide',
  title: 'Sunset Heist',
  caption: 'Palm Coast Never Sleeps',
};

export function createState() {
  return {
    ...DEFAULTS,
    seed: 7,
    photos: [],
    panels: [],
    selected: 0,
  };
}

/** The panel rectangles a layout draws at a post size, so a frame can be measured before it is painted. */
function panelBox(layout, size, slot) {
  const sz = SIZES[size] || SIZES.wide;
  const geo = panelRects({ layout: LAYOUTS[layout] ? layout : 'quad' }, sz.w, sz.h);
  return geo.panels[slot] || null;
}

/** The hand-picked frame for this photo in this panel, or the photo's own frame for a panel of this post size. */
export function resolveFrame(photo, where) {
  const layoutFrames = LAYOUT_FRAMES[where.layout];
  const slot = layoutFrames && layoutFrames[where.size] && layoutFrames[where.size][where.slot];
  if (slot && slot.photo === photo.id) return slot;
  const own = PHOTO_FRAMES[photo.id];
  return (own && own[where.size]) || null;
}

/**
 * Visible window of the photograph inside a panel, in photo coordinates, for a cx/cy/zoom and a panel aspect.
 * Mirrors photoTransform in render.js; the two must agree or a frame means nothing.
 */
export function visibleWindow(photo, box, crop) {
  const iw = photo.w, ih = photo.h;
  const zoom = Math.max(1, crop.zoom || 1);
  const base = Math.max(box.w / iw, box.h / ih);
  const scale = base * zoom;
  const dw = iw * scale, dh = ih * scale;
  const vw = Math.min(1, box.w / dw), vh = Math.min(1, box.h / dh);
  const cx = clamp(crop.cx ?? 0.5, vw / 2, 1 - vw / 2);
  const cy = clamp(crop.cy ?? 0.45, vh / 2, 1 - vh / 2);
  return { x0: cx - vw / 2, x1: cx + vw / 2, y0: cy - vh / 2, y1: cy + vh / 2, vw, vh, dw, dh };
}

/**
 * The face rule: no panel edge may pass through a face. A frame satisfies it either by holding the face whole or
 * by keeping it out of frame entirely. Holding it whole is the better picture, so it is tried first — and if the
 * panel is too shallow to hold a face that size, the frame is pushed to one side of it instead of cutting it.
 * The boxes are clipped to the file first: a face the photograph itself cuts still has a visible region, and the
 * panel must not cut that region either.
 */
function holdFace(crop, photo, box) {
  const raw = photo.face;
  if (!raw || !box) return crop;
  const fx0 = Math.max(0, raw.x), fy0 = Math.max(0, raw.y);
  const fx1 = Math.min(1, raw.x + raw.w), fy1 = Math.min(1, raw.y + raw.h);
  const fw = fx1 - fx0, fh = fy1 - fy0;
  if (fw <= 0 || fh <= 0) return crop;

  const one = visibleWindow(photo, box, { ...crop, zoom: 1 });
  const want = { cx: crop.cx ?? 0.5, cy: crop.cy ?? 0.45, zoom: Math.max(1, crop.zoom || 1) };

  // hold it whole: the panel must see at least as much as the face box, which caps the zoom
  if (fw <= one.vw && fh <= one.vh) {
    const capZoom = Math.max(1, Math.min(one.vw / fw, one.vh / fh) * 0.998);
    const zoom = Math.min(want.zoom, capZoom);
    const win = visibleWindow(photo, box, { cx: want.cx, cy: want.cy, zoom });
    const loX = fx1 - win.vw / 2, hiX = fx0 + win.vw / 2;
    const loY = fy1 - win.vh / 2, hiY = fy0 + win.vh / 2;
    const cx = clamp(want.cx, Math.min(loX, hiX), Math.max(loX, hiX));
    const cy = clamp(want.cy, Math.min(loY, hiY), Math.max(loY, hiY));
    return {
      cx: clamp(cx, win.vw / 2, 1 - win.vw / 2),
      cy: clamp(cy, win.vh / 2, 1 - win.vh / 2),
      zoom,
    };
  }

  // keep it out: four ways past the face, and the one that keeps the most picture wins
  const ways = [
    { axis: 'x', room: 1 - fx1, from: fx1, to: 1 },
    { axis: 'x', room: fx0, from: 0, to: fx0 },
    { axis: 'y', room: 1 - fy1, from: fy1, to: 1 },
    { axis: 'y', room: fy0, from: 0, to: fy0 },
  ].filter((w) => w.room > 0.02);
  let best = null;
  for (const way of ways) {
    const span = way.axis === 'x' ? one.vw : one.vh;
    const zoom = Math.max(1, span / way.room);
    if (!best || zoom < best.zoom - 1e-6) best = { ...way, zoom };
  }
  if (!best) return want;
  const zoom = Math.max(want.zoom, best.zoom);
  const win = visibleWindow(photo, box, { cx: want.cx, cy: want.cy, zoom });
  let cx = want.cx, cy = want.cy;
  if (best.axis === 'x') {
    cx = clamp(want.cx, best.from + win.vw / 2, best.to - win.vw / 2);
  } else {
    cy = clamp(want.cy, best.from + win.vh / 2, best.to - win.vh / 2);
  }
  return {
    cx: clamp(cx, win.vw / 2, 1 - win.vw / 2),
    cy: clamp(cy, win.vh / 2, 1 - win.vh / 2),
    zoom,
  };
}

/** Grows or trims the panel list to the layout's cell count, keeping each panel's crop. */
export function syncPanels(state) {
  const cells = LAYOUTS[state.layout].cells.length;
  const ids = state.photos.map((p) => p.id);
  while (state.panels.length < cells) {
    const i = state.panels.length;
    const panel = {
      photo: null,
      cx: 0.5,
      cy: 0.45,
      zoom: 1,
      label: null,
      auto: true,
    };
    applyDefaultCrop(panel, state.photos.find((p) => p.id === ids[i % ids.length]), state, i);
    state.panels.push(panel);
  }
  if (state.panels.length > cells) state.panels.length = cells;
  if (state.selected >= cells) state.selected = cells - 1;
  return state;
}

/** Adds photos to the pool once each, then points any empty panel at them. */
export function addPhotos(state, photos) {
  for (const photo of photos) {
    if (!state.photos.some((p) => p.id === photo.id)) state.photos.push(photo);
  }
  const ids = state.photos.map((p) => p.id);
  state.panels.forEach((panel, i) => {
    if (!panel.photo) {
      const photo = state.photos.find((p) => p.id === ids[i % ids.length]);
      applyDefaultCrop(panel, photo, state, i);
    }
  });
  return state;
}

function applyDefaultCrop(panel, photo, state, slot) {
  if (!photo) return;
  panel.photo = photo.id;
  if (photo.label) panel.label = photo.label;
  panel.face = photo.face || null;
  panel.subject = photo.subj || null;
  const where = { layout: state.layout, size: state.size, slot };
  const frame = resolveFrame(photo, where) || { cx: 0.5, cy: 0.45, zoom: 1 };
  const box = panelBox(state.layout, state.size, slot);
  const crop = holdFace({ cx: frame.cx, cy: frame.cy, zoom: frame.zoom }, photo, box);
  panel.cx = crop.cx;
  panel.cy = crop.cy;
  panel.zoom = crop.zoom;
  panel.auto = true;
}

/**
 * Re-resolves every panel still on its preset after a layout or post-size switch, so a panel is never left with a
 * frame cut for a shape it no longer has. A panel the person has dragged or zoomed themselves is left alone.
 */
export function reframePanels(state) {
  state.panels.forEach((panel, i) => {
    if (!panel.auto || !panel.photo) return;
    const photo = state.photos.find((p) => p.id === panel.photo);
    if (photo) applyDefaultCrop(panel, photo, state, i);
  });
  return state;
}

export function assignPhoto(state, photoId, all) {
  const photo = state.photos.find((p) => p.id === photoId);
  if (!photo) return;
  if (all) {
    state.panels.forEach((panel, i) => applyDefaultCrop(panel, photo, state, i));
    return;
  }
  const panel = state.panels[state.selected];
  if (panel) applyDefaultCrop(panel, photo, state, state.selected);
}

export function resetPanel(state, index) {
  const panel = state.panels[index];
  if (!panel) return;
  const photo = state.photos.find((p) => p.id === panel.photo);
  if (photo) {
    applyDefaultCrop(panel, photo, state, index);
    return;
  }
  panel.cx = 0.5;
  panel.cy = 0.45;
  panel.zoom = 1;
  panel.auto = true;
}

export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

/** Loads the sample photos that ship with the app, so the poster is never blank on first paint. */
export async function loadSamplePhotos(wanted) {
  const list = wanted
    ? wanted.map((id) => SAMPLES.find((s) => s.id === id)).filter(Boolean)
    : SAMPLES;
  const loaded = await Promise.all(list.map(async (s) => {
    const img = await loadImage(s.url);
    return { ...s, img };
  }));
  return loaded;
}

/** User files, read locally with object URLs. No upload, no network. */
export async function photosFromFiles(files) {
  const out = [];
  let n = 0;
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    n += 1;
    const id = `local-${Date.now()}-${n}`;
    const url = URL.createObjectURL(file);
    const img = await loadImage(url);
    out.push({ id, name: file.name.replace(/\.[^.]+$/, '').slice(0, 24), url, img, local: true, w: img.naturalWidth, h: img.naturalHeight });
  }
  return out;
}

const HISTORY_FIELDS = ['layout', 'palette', 'size', 'title', 'caption', 'seed'];

/** Serializable slice of the state; the image objects stay in the pool and are looked up by id. */
export function snapshot(state) {
  const snap = { panels: state.panels.map((p) => ({ ...p })) };
  for (const key of HISTORY_FIELDS) snap[key] = state[key];
  return JSON.stringify(snap);
}

export function restore(state, json) {
  const snap = JSON.parse(json);
  for (const key of HISTORY_FIELDS) state[key] = snap[key];
  state.panels = snap.panels.map((p) => ({ ...p }));
  return state;
}

/** A small undo/redo stack: commit() after an edit, undo()/redo() to walk it. */
export function createHistory(state, onChange) {
  const stack = [snapshot(state)];
  let at = 0;
  const emit = () => onChange && onChange(canUndo(), canRedo());
  const canUndo = () => at > 0;
  const canRedo = () => at < stack.length - 1;
  return {
    commit() {
      const now = snapshot(state);
      if (stack[at] === now) return;
      stack.length = at + 1;
      stack.push(now);
      if (stack.length > 60) stack.shift();
      at = stack.length - 1;
      emit();
    },
    undo() {
      if (!canUndo()) return false;
      at -= 1;
      restore(state, stack[at]);
      emit();
      return true;
    },
    redo() {
      if (!canRedo()) return false;
      at += 1;
      restore(state, stack[at]);
      emit();
      return true;
    },
    canUndo,
    canRedo,
    emit,
    reset() {
      stack.length = 0;
      stack.push(snapshot(state));
      at = 0;
      emit();
    },
  };
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
