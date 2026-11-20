// The editor: builds the control rail, keeps the preview in sync with the edit state, handles pan/zoom on the poster,
// undo/redo, photo loading and the PNG exports. Nothing here talks to a network; photos are object URLs.

import {
  drawCover, panelRects, loadCoverFont, PALETTES, LAYOUTS, SIZES, PANEL_WORDS,
} from './render.js';
import {
  createState, syncPanels, reframePanels, addPhotos, assignPhoto, resetPanel, loadSamplePhotos,
  photosFromFiles, createHistory, snapshot, restore,
} from './state.js';

const PREVIEW_LONG = 1200;

export async function createStudio(state) {
  await loadCoverFont();
  syncPanels(state);

  const history = createHistory(state, paintHistoryButtons);
  const ui = {
    studio: document.getElementById('studio'),
    canvas: document.getElementById('preview'),
    status: document.getElementById('status'),
    meta: document.getElementById('meta'),
    title: document.getElementById('title'),
    caption: document.getElementById('caption'),
    titleCount: document.getElementById('title-count'),
    captionCount: document.getElementById('caption-count'),
    layouts: document.getElementById('layouts'),
    palettes: document.getElementById('palettes'),
    pool: document.getElementById('pool'),
    photoCount: document.getElementById('photo-count'),
    panelCount: document.getElementById('panel-count'),
    panelNo: document.getElementById('panel-no'),
    panelPhoto: document.getElementById('panel-photo'),
    zoom: document.getElementById('zoom'),
    zoomVal: document.getElementById('zoom-val'),
    sizes: document.getElementById('sizes'),
    drop: document.getElementById('drop'),
    file: document.getElementById('file'),
    undo: document.getElementById('undo'),
    redo: document.getElementById('redo'),
    exports: document.getElementById('exports'),
  };

  let dirty = false;
  let frame = 0;

  function setStatus(text, kind) {
    ui.status.textContent = text;
    ui.status.className = kind || '';
  }

  function schedule() {
    if (dirty) return;
    dirty = true;
    frame = requestAnimationFrame(() => {
      dirty = false;
      render();
    });
  }

  function render() {
    const size = SIZES[state.size] || SIZES.square;
    const scale = PREVIEW_LONG / Math.max(size.w, size.h);
    const cw = Math.round(size.w * scale);
    const ch = Math.round(size.h * scale);
    if (ui.canvas.width !== cw || ui.canvas.height !== ch) {
      ui.canvas.width = cw;
      ui.canvas.height = ch;
    }
    drawCover(ui.canvas, state, { selection: state.selected });
    fitPreview();
    const photo = state.photos.find((p) => p.id === (state.panels[state.selected] || {}).photo);
    ui.meta.textContent = `${state.photos.length} photos · ${state.panels.length} panels · ${PALETTES[state.palette].label} · ${size.tag}`;
    ui.panelNo.textContent = String(state.selected + 1).padStart(2, '0');
    ui.panelPhoto.textContent = photo ? photo.name : 'empty';
    ui.zoomVal.textContent = (state.panels[state.selected]?.zoom || 1).toFixed(2);
    ui.zoom.value = String(state.panels[state.selected]?.zoom || 1);
    ui.titleCount.textContent = `${ui.title.value.length}/26`;
    ui.captionCount.textContent = `${ui.caption.value.length}/44`;
    markChips();
    void frame;
  }

  function fitPreview() {
    const hold = ui.drop;
    const availW = Math.max(120, hold.clientWidth - 60);
    const availH = Math.max(120, hold.clientHeight - 52);
    const s = Math.min(availW / ui.canvas.width, availH / ui.canvas.height);
    ui.canvas.style.width = `${Math.round(ui.canvas.width * s)}px`;
    ui.canvas.style.height = `${Math.round(ui.canvas.height * s)}px`;
  }

  window.addEventListener('resize', fitPreview);

  function paintHistoryButtons(canUndo, canRedo) {
    ui.undo.disabled = !canUndo;
    ui.redo.disabled = !canRedo;
    ui.undo.style.opacity = canUndo ? '1' : '0.4';
    ui.redo.style.opacity = canRedo ? '1' : '0.4';
  }

  function markChips() {
    for (const el of ui.layouts.children) el.classList.toggle('on', el.dataset.layout === state.layout);
    for (const el of ui.palettes.children) el.classList.toggle('on', el.dataset.palette === state.palette);
    for (const el of ui.sizes.children) el.classList.toggle('on', el.dataset.size === state.size);
    for (const el of ui.exports.querySelectorAll('[data-size]')) {
      el.classList.toggle('cta', el.dataset.size === state.size);
    }
    for (const el of ui.pool.children) {
      const id = el.dataset.photo;
      el.classList.toggle('used', state.panels.some((p) => p.photo === id));
    }
  }

  // ---------------------------------------------------------------- rail

  for (const [key, layout] of Object.entries(LAYOUTS)) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.dataset.layout = key;
    chip.title = `${layout.label} — ${layout.cells.length} panels`;
    const mini = document.createElement('span');
    mini.className = 'mini';
    for (const [x, y, w, h] of layout.cells) {
      const cell = document.createElement('i');
      cell.style.left = `${x * 100}%`;
      cell.style.top = `${y * 100}%`;
      cell.style.width = `${w * 100}%`;
      cell.style.height = `${h * 100}%`;
      mini.append(cell);
    }
    const label = document.createElement('em');
    label.textContent = layout.label;
    chip.append(mini, label);
    chip.addEventListener('click', () => {
      setLayout(key);
    });
    ui.layouts.append(chip);
  }

  for (const [key, pal] of Object.entries(PALETTES)) {
    const sw = document.createElement('button');
    sw.type = 'button';
    sw.className = 'swatch';
    sw.dataset.palette = key;
    sw.style.setProperty('--a', pal.grade[0]);
    sw.style.setProperty('--b', pal.accent);
    sw.style.setProperty('--c', pal.accent2);
    const band = document.createElement('span');
    band.className = 'band';
    const name = document.createElement('span');
    name.textContent = pal.label;
    sw.append(band, name);
    sw.addEventListener('click', () => {
      state.palette = key;
      history.commit();
      setStatus(`Grade: ${pal.label}`, 'ok');
      schedule();
    });
    ui.palettes.append(sw);
  }

  for (const [key, size] of Object.entries(SIZES)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'size';
    b.dataset.size = key;
    b.textContent = size.tag;
    b.addEventListener('click', () => {
      state.size = key;
      reframePanels(state);
      setStatus(`Post size: ${size.tag}`);
      schedule();
    });
    ui.sizes.append(b);
  }

  function renderPool() {
    ui.pool.replaceChildren();
    for (const photo of state.photos) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'thumb';
      b.dataset.photo = photo.id;
      b.title = `${photo.name} — clicks fill the selected panel`;
      const img = document.createElement('img');
      img.src = photo.url;
      img.alt = photo.name;
      const label = document.createElement('b');
      label.textContent = photo.name;
      b.append(img, label);
      b.addEventListener('click', () => {
        assignPhoto(state, photo.id, false);
        history.commit();
        setStatus(`Panel ${state.selected + 1} filled with ${photo.name}`);
        schedule();
      });
      ui.pool.append(b);
    }
    ui.photoCount.textContent = `${state.photos.length} in pool`;
  }

  function setLayout(key) {
    if (!LAYOUTS[key]) return;
    state.layout = key;
    syncPanels(state);
    reframePanels(state);
    history.commit();
    setStatus(`${LAYOUTS[key].label}: ${LAYOUTS[key].cells.length} panels`, 'ok');
    schedule();
  }

  // ---------------------------------------------------------------- inputs

  ui.title.addEventListener('input', () => {
    state.title = ui.title.value;
    schedule();
  });
  ui.title.addEventListener('change', () => history.commit());
  ui.caption.addEventListener('input', () => {
    state.caption = ui.caption.value;
    schedule();
  });
  ui.caption.addEventListener('change', () => history.commit());

  ui.zoom.addEventListener('input', () => {
    const panel = state.panels[state.selected];
    if (!panel) return;
    panel.zoom = Number(ui.zoom.value);
    panel.auto = false;
    schedule();
  });
  ui.zoom.addEventListener('change', () => history.commit());

  ui.undo.addEventListener('click', () => { if (history.undo()) afterHistory('Undo'); });
  ui.redo.addEventListener('click', () => { if (history.redo()) afterHistory('Redo'); });

  function afterHistory(what) {
    ui.title.value = state.title;
    ui.caption.value = state.caption;
    syncPanels(state);
    setStatus(what);
    schedule();
  }

  document.getElementById('all-panels').addEventListener('click', () => {
    const panel = state.panels[state.selected];
    if (!panel || !panel.photo) return;
    assignPhoto(state, panel.photo, true);
    history.commit();
    const photo = state.photos.find((p) => p.id === panel.photo);
    setStatus(`${photo ? photo.name : 'Photo'} fills all ${state.panels.length} panels`, 'ok');
    schedule();
  });

  document.getElementById('reset-panel').addEventListener('click', () => {
    resetPanel(state, state.selected);
    history.commit();
    setStatus(`Panel ${state.selected + 1} crop reset`);
    schedule();
  });

  document.getElementById('add-photos').addEventListener('click', () => ui.file.click());
  ui.file.addEventListener('change', async (e) => {
    await ingest(e.target.files);
    ui.file.value = '';
  });

  async function ingest(files) {
    const list = Array.from(files || []);
    if (!list.length) return;
    setStatus(`Reading ${list.length} photo${list.length > 1 ? 's' : ''} on this machine…`);
    try {
      const photos = await photosFromFiles(list);
      if (!photos.length) {
        setStatus('No image files in that drop', 'err');
        return;
      }
      addPhotos(state, photos);
      renderPool();
      history.commit();
      setStatus(`${photos.length} photo${photos.length > 1 ? 's' : ''} added to the pool`, 'ok');
      schedule();
    } catch (err) {
      setStatus(`Could not read that image: ${err.message}`, 'err');
    }
  }

  // ---------------------------------------------------------------- poster gestures

  const canvas = ui.canvas;
  let drag = null;

  function canvasPoint(e) {
    const r = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (canvas.width / r.width),
      y: (e.clientY - r.top) * (canvas.height / r.height),
    };
  }

  function hitPanel(pt) {
    const geo = panelRects(state, canvas.width, canvas.height);
    for (let i = geo.panels.length - 1; i >= 0; i--) {
      const rect = geo.panels[i];
      let x = pt.x, y = pt.y;
      if (rect.rot) {
        const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
        const dx = x - cx, dy = y - cy;
        x = cx + dx * Math.cos(-rect.rot) - dy * Math.sin(-rect.rot);
        y = cy + dx * Math.sin(-rect.rot) + dy * Math.cos(-rect.rot);
      }
      if (x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h) return i;
    }
    return -1;
  }

  canvas.addEventListener('pointerdown', (e) => {
    const pt = canvasPoint(e);
    const index = hitPanel(pt);
    if (index < 0) return;
    state.selected = index;
    const rect = panelRects(state, canvas.width, canvas.height).panels[index];
    drag = { pointerId: e.pointerId, index, rect, lastX: pt.x, lastY: pt.y, moved: false };
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('dragging');
    schedule();
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const pt = canvasPoint(e);
    const panel = state.panels[drag.index];
    const photo = state.photos.find((p) => p.id === panel.photo);
    if (photo && photo.img) {
      const rect = drag.rect;
      const scale = Math.max(rect.w / photo.img.naturalWidth, rect.h / photo.img.naturalHeight) * (panel.zoom || 1);
      const dw = photo.img.naturalWidth * scale;
      const dh = photo.img.naturalHeight * scale;
      panel.cx = clamp(panel.cx - (pt.x - drag.lastX) / dw, rect.w / (2 * dw), 1 - rect.w / (2 * dw));
      panel.cy = clamp(panel.cy - (pt.y - drag.lastY) / dh, rect.h / (2 * dh), 1 - rect.h / (2 * dh));
      panel.auto = false;
      drag.moved = true;
    }
    drag.lastX = pt.x;
    drag.lastY = pt.y;
    schedule();
  });

  function endDrag() {
    if (!drag) return;
    const moved = drag.moved;
    drag = null;
    canvas.classList.remove('dragging');
    if (moved) history.commit();
  }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const index = hitPanel(canvasPoint(e)) >= 0 ? hitPanel(canvasPoint(e)) : state.selected;
    state.selected = index;
    const panel = state.panels[index];
    if (!panel) return;
    panel.zoom = clamp((panel.zoom || 1) * Math.exp(-e.deltaY * 0.0016), 1, 2.4);
    panel.auto = false;
    schedule();
    clearTimeout(canvas._zoomCommit);
    canvas._zoomCommit = setTimeout(() => history.commit(), 260);
  }, { passive: false });

  // ---------------------------------------------------------------- exports

  async function exportSize(key) {
    const size = SIZES[key] || SIZES.square;
    setStatus(`Rendering ${size.tag}…`);
    await new Promise((r) => setTimeout(r, 16));
    const canvasOut = document.createElement('canvas');
    canvasOut.width = size.w;
    canvasOut.height = size.h;
    drawCover(canvasOut, state, {});
    const blob = await new Promise((resolve, reject) => {
      canvasOut.toBlob((b) => (b ? resolve(b) : reject(new Error('the browser refused the PNG'))), 'image/png');
    });
    const name = `palm-coast-cover-${size.w}x${size.h}.png`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    state.size = key;
    schedule();
    setStatus(`Saved ${name} · ${Math.round(blob.size / 1024)} KB`, 'ok');
    return blob;
  }

  for (const btn of ui.exports.querySelectorAll('[data-size]')) {
    btn.addEventListener('click', () => exportSize(btn.dataset.size));
  }

  // ---------------------------------------------------------------- drag and drop

  const hold = ui.drop;
  let dragDepth = 0;
  hold.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragDepth += 1;
    hold.classList.add('over');
  });
  hold.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });
  hold.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) hold.classList.remove('over');
  });
  hold.addEventListener('drop', async (e) => {
    e.preventDefault();
    dragDepth = 0;
    hold.classList.remove('over');
    await ingest(e.dataTransfer.files);
  });

  // ---------------------------------------------------------------- keyboard

  const layoutKeys = Object.keys(LAYOUTS);
  const paletteKeys = Object.keys(PALETTES);

  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement && e.target.type === 'text') {
      if (e.key === 'Escape') e.target.blur();
      return;
    }
    const k = e.key.toLowerCase();
    if (k >= '1' && k <= '5') {
      setLayout(layoutKeys[Number(k) - 1]);
      return;
    }
    if (k >= '6' && k <= '9') {
      const pal = paletteKeys[Number(k) - 6];
      if (pal) {
        state.palette = pal;
        history.commit();
        setStatus(`Grade: ${PALETTES[pal].label}`, 'ok');
        schedule();
      }
      return;
    }
    if ((e.metaKey || e.ctrlKey) && k === 'z') {
      e.preventDefault();
      if (e.shiftKey ? history.redo() : history.undo()) afterHistory(e.shiftKey ? 'Redo' : 'Undo');
      return;
    }
    if ((e.metaKey || e.ctrlKey) && k === 'y') {
      e.preventDefault();
      if (history.redo()) afterHistory('Redo');
      return;
    }
    if (k === 'z') { if (history.undo()) afterHistory('Undo'); return; }
    if (k === 'y') { if (history.redo()) afterHistory('Redo'); return; }
    if (k === 'e') { exportSize(state.size); return; }
    if (k === 'r') { resetPanel(state, state.selected); history.commit(); schedule(); return; }
    if (k === 'a') {
      const panel = state.panels[state.selected];
      if (panel && panel.photo) {
        assignPhoto(state, panel.photo, true);
        history.commit();
        schedule();
      }
    }
    if (k === 'arrowleft' || k === 'arrowright' || k === 'arrowup' || k === 'arrowdown') {
      const panel = state.panels[state.selected];
      if (!panel) return;
      e.preventDefault();
      const step = e.shiftKey ? 0.05 : 0.012;
      if (k === 'arrowleft') panel.cx -= step;
      if (k === 'arrowright') panel.cx += step;
      if (k === 'arrowup') panel.cy -= step;
      if (k === 'arrowdown') panel.cy += step;
      panel.auto = false;
      schedule();
      clearTimeout(canvas._keyCommit);
      canvas._keyCommit = setTimeout(() => history.commit(), 300);
    }
  });

  // ---------------------------------------------------------------- boot

  ui.title.value = state.title;
  ui.caption.value = state.caption;
  renderPool();
  history.emit();
  render();
  setStatus(`Sample photos loaded · drag a panel to crop · export when it looks right`, 'ok');

  // exposed for the screenshot scenes and for the console
  const api = {
    state,
    render: schedule,
    redraw: render,
    exportSize,
    exportCanvas(w, h) {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      drawCover(c, state, {});
      return c;
    },
    setLayout,
    apply(scene) {
      Object.assign(state, scene);
      ui.title.value = state.title;
      ui.caption.value = state.caption;
      syncPanels(state);
      reframePanels(state);
      renderPool();
      history.reset();
      render();
    },
    addSamplePhotos: async (wanted) => {
      const photos = await loadSamplePhotos(wanted);
      addPhotos(state, photos);
      renderPool();
      syncPanels(state);
      history.reset();
      render();
    },
    setStatus,
    syncPanels: () => { syncPanels(state); render(); },
    snapshot: () => snapshot(state),
    restore: (json) => { restore(state, json); schedule(); },
    reload: () => { syncPanels(state); reframePanels(state); render(); },
    panelWords: PANEL_WORDS,
  };
  return api;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
