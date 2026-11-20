// Palm Coast Cover Lab — the hand-in program.
//
// The app itself is the static site in app/: plain HTML, one stylesheet, five ES modules, a vendored OFL font
// and five sample images. It runs from any static file server with no build step and no network request. This
// program publishes that folder: it copies app/ and screenshots/ beside a fresh dossier.json into the grade's
// output directory, which MAKEFUN_OUTPUT_DIR stands in for outside the grader.
//
//   MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Standard library only, and the same bytes on every run: the copies are rebuilt from scratch each time and the
// dossier is written from the files as they land, with no clock, path or random value in it.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const repo = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's caps, passed to the same library it grades with so the dossier it writes here is the one the
// grader rebuilds: the text budget shapes the bytes; the rest refuse an entry the scorer would refuse.
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
};

/** Copies one folder into the output, replacing whatever was there, so repeated runs leave no stale files. */
function publish(name: string, required: boolean): void {
  const from = join(repo, name);
  const to = join(out, name);
  if (!existsSync(from)) {
    if (required) throw new Error(`missing ${name}/ beside main.ts`);
    return;
  }
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true });
  console.log(`${name}/ -> ${to}`);
}

mkdirSync(out, { recursive: true });
publish('app', true);
publish('screenshots', false);

const dossier = buildDossier(out, CAPS);
writeFileSync(join(out, 'dossier.json'), dossier);
console.log(`dossier.json -> ${(Buffer.byteLength(dossier) / 1024).toFixed(1)} KiB`);
