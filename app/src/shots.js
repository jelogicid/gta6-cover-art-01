// Fixed scenes for the screenshots. `?shot=cover` paints one poster at a post size and hands back its PNG data URL;
// `?shot=editor` opens the whole studio with photos loaded. `window.__shotReady` is set once the frame is painted.

import { drawCover, loadCoverFont, SIZES } from './render.js';
import { createState, loadSamplePhotos, addPhotos, syncPanels } from './state.js';
import { createStudio } from './studio.js';

const DEFAULT_PHOTOS = ['gold-hour', 'palm-line', 'the-car', 'pier', 'low-tide', 'the-rod'];

function pickPhotos(value) {
  const wanted = (value || '').split(',').map((s) => s.trim()).filter(Boolean);
  return wanted.length ? wanted : DEFAULT_PHOTOS;
}

function sceneState(q) {
  const state = createState();
  state.layout = q.get('layout') || 'hero';
  state.palette = q.get('palette') || 'vice';
  state.size = q.get('size') || 'wide';
  state.title = q.get('title') || 'Sunset Heist';
  state.caption = q.get('caption') || 'Palm Coast Never Sleeps';
  if (q.get('seed')) state.seed = Number(q.get('seed')) || 7;
  return state;
}

function framePanels(state, q) {
  const cy = q.get('crop') ? Number(q.get('crop')) : null;
  if (cy == null) return;
  state.panels.forEach((panel) => {
    panel.cy = cy;
  });
}

/** Renders one poster alone on the page at its export size and records its PNG for the screenshot script. */
export async function runCoverShot(q) {
  document.body.classList.add('shot');
  await loadCoverFont();

  const state = sceneState(q);
  const posts = await loadSamplePhotos(pickPhotos(q.get('photos')));
  addPhotos(state, posts);
  syncPanels(state);
  framePanels(state, q);

  const size = SIZES[state.size] || SIZES.wide;
  const hold = document.createElement('div');
  hold.className = 'shot-hold';
  const canvas = document.createElement('canvas');
  canvas.width = size.w;
  canvas.height = size.h;
  canvas.id = 'shot-canvas';
  hold.append(canvas);
  document.body.append(hold);

  drawCover(canvas, state, {});
  window.__shotPNG = canvas.toDataURL('image/png');
  window.__shotSize = { w: size.w, h: size.h, tag: size.tag };
  window.__studioState = state;

  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  window.__shotReady = true;
}

/** Opens the studio itself, photos loaded, at a scene the screenshot script can frame. */
export async function runEditorShot(q) {
  await loadCoverFont();
  const state = sceneState(q);
  state.size = q.get('size') || 'square';
  const posts = await loadSamplePhotos(pickPhotos(q.get('photos')));
  addPhotos(state, posts);
  syncPanels(state);
  framePanels(state, q);

  const studio = await createStudio(state);
  if (q.get('select')) {
    state.selected = Math.min(state.panels.length - 1, Math.max(0, Number(q.get('select')) - 1));
  }
  studio.reload();
  studio.setStatus(`${state.photos.length} sample photos · drag to crop · paste your caption · export PNG`, 'ok');

  if (q.get('scroll')) {
    document.querySelector('.scroll').scrollTop = Number(q.get('scroll'));
  }
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  window.__shotReady = true;
  return studio;
}
