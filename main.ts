// Hand-in for Palm Coast Cover Lab.
//
// app/ is the deliverable: a static site with no build step and no network request. This program publishes it:
// each folder in the manifest is rebuilt in the output directory, then dossier.json is written from what landed
// there with the kit's own library, so the bytes here are the bytes the scorer rebuilds. Standard library only,
// and no clock or path leaks into the files, so two runs are byte-identical.
//
//   MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const OUT = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// what gets published, in the order it is copied; screenshots stay optional so an early build still hands in
const MANIFEST = [
  { name: 'app', required: true },
  { name: 'screenshots', required: false },
];

// the scorer's caps: the text budget shapes the dossier bytes, the rest refuse an entry the scorer would refuse
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
};

/** File count and total bytes under a directory, for the summary line. */
function measure(dir: string): { files: number; bytes: number } {
  let files = 0;
  let bytes = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      const inner = measure(full);
      files += inner.files;
      bytes += inner.bytes;
    } else {
      files += 1;
      bytes += statSync(full).size;
    }
  }
  return { files, bytes };
}

mkdirSync(OUT, { recursive: true });

for (const { name, required } of MANIFEST) {
  const from = join(ROOT, name);
  const to = join(OUT, name);
  if (!existsSync(from)) {
    if (required) throw new Error(`${name}/ is missing beside main.ts`);
    console.log(`${name}/ absent, skipped`);
    continue;
  }
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true });
  const { files, bytes } = measure(to);
  console.log(`${name}/ -> ${to} (${files} files, ${(bytes / 1024).toFixed(0)} KiB)`);
}

// the app has to open as a page; catching a missing index.html here beats a refused entry later
const index = join(OUT, 'app', 'index.html');
if (!existsSync(index)) throw new Error('app/index.html did not survive the copy');
if (statSync(index).size > 1024 * 1024) throw new Error('app/index.html is over the 1 MiB cap');

const dossier = buildDossier(OUT, CAPS);
writeFileSync(join(OUT, 'dossier.json'), dossier);
console.log(`dossier.json -> ${(Buffer.byteLength(dossier) / 1024).toFixed(1)} KiB (text cap ${CAPS.text_max_bytes})`);
