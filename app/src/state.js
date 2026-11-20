// The edit state and its undo history: which photos are in the pool, which photo fills each panel and how it is
// cropped, the title, the caption, the layout, the palette and the post size. Everything the renderer needs, nothing
// it does not, so a snapshot is a small JSON string.

import { LAYOUTS } from './render.js';

export const SAMPLES = [
  { id: 'gold-hour', name: 'Gold Hour', url: 'samples/gold-hour.jpg', label: 'GOLD HOUR', crop: { cx: 0.5, cy: 0.58, zoom: 1 }, face: { fx: 0.47, fy: 0.34 } },
  { id: 'palm-line', name: 'Palm Line', url: 'samples/palm-line.jpg', label: 'PALM LINE', crop: { cx: 0.44, cy: 0.3, zoom: 1.04 }, face: { fx: 0.36, fy: 0.3 } },
  { id: 'the-car', name: 'The Car', url: 'samples/the-car.jpg', label: 'THE CAR', crop: { cx: 0.5, cy: 0.52, zoom: 1.04 } },
  { id: 'pier', name: 'The Pier', url: 'samples/pier.jpg', label: 'THE PIER', crop: { cx: 0.45, cy: 0.7, zoom: 1.12 }, face: { fx: 0.4, fy: 0.3 } },
  { id: 'low-tide', name: 'Low Tide', url: 'samples/low-tide.jpg', label: 'LOW TIDE', crop: { cx: 0.5, cy: 0.5, zoom: 1.04 } },
  { id: 'the-rod', name: 'The Rod', url: 'samples/the-rod.jpg', label: 'THE ROD', crop: { cx: 0.44, cy: 0.34, zoom: 1.06 }, face: { fx: 0.4, fy: 0.3 } },
];

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
    };
    applyDefaultCrop(panel, state.photos.find((p) => p.id === ids[i % ids.length]));
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
      applyDefaultCrop(panel, photo);
    }
  });
  return state;
}

function applyDefaultCrop(panel, photo) {
  if (!photo) return;
  panel.photo = photo.id;
  if (photo.crop) {
    panel.cx = photo.crop.cx;
    panel.cy = photo.crop.cy;
    panel.zoom = photo.crop.zoom;
  }
  if (photo.label) panel.label = photo.label;
  panel.face = photo.face || null;
}

export function assignPhoto(state, photoId, all) {
  const photo = state.photos.find((p) => p.id === photoId);
  if (!photo) return;
  if (all) {
    for (const panel of state.panels) applyDefaultCrop(panel, photo);
    return;
  }
  const panel = state.panels[state.selected];
  if (panel) applyDefaultCrop(panel, photo);
}

export function resetPanel(state, index) {
  const panel = state.panels[index];
  if (!panel) return;
  panel.cx = 0.5;
  panel.cy = 0.45;
  panel.zoom = 1;
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
    out.push({ id, name: file.name.replace(/\.[^.]+$/, '').slice(0, 24), url, img, local: true });
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
