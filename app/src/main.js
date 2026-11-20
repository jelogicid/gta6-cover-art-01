// Entry point for the page. A `?shot=` query opens a fixed screenshot scene instead of the normal studio; otherwise
// the studio boots with the sample photos already in the pool, so the poster is never blank.

import { createState, loadSamplePhotos, addPhotos, syncPanels } from './state.js';
import { createStudio } from './studio.js';
import { runCoverShot, runEditorShot } from './shots.js';

const query = new URLSearchParams(location.search);
const shot = query.get('shot');

async function boot() {
  if (shot === 'cover') {
    await runCoverShot(query);
    return;
  }
  if (shot === 'editor') {
    await runEditorShot(query);
    return;
  }

  const state = createState();
  try {
    const samples = await loadSamplePhotos();
    addPhotos(state, samples);
  } catch (err) {
    console.error('sample photos did not load', err);
  }
  syncPanels(state);
  const studio = await createStudio(state);
  window.__studio = studio;
}

boot().catch((err) => {
  const status = document.getElementById('status');
  if (status) {
    status.textContent = `Studio failed to start: ${err.message}`;
    status.className = 'err';
  }
  console.error(err);
});
