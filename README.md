# jelogicid/gta6-cover-art-01

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/jelogicid/gta6-cover-art-01/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/jelogicid/gta6-cover-art-01/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

An offline, dependency-free browser studio that turns any photo into a multi-panel GTA-style cover poster and exports
it as a PNG in 1080x1080, 1080x1350 and 1920x1080. Photos never leave the machine.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts   # writes out/app, out/screenshots, out/dossier.json
node serve.ts                                          # then open http://localhost:8080
```

Palm Coast Cover Lab is a static site under `app/`: no build step, no package install, no network request. It opens
with six sample photographs already in the photo pool, and the poster is painted at export resolution by the same
function that paints the preview.

- **Panels.** Five layouts — four-up, six-up, nine-up, hero-and-three, tilted snapshots — with a photo per panel or one
  photo across all of them. Click a panel, drag to pan, scroll to zoom; the crop is clamped so no panel letterboxes.
- **Framing.** Every sample photo carries the boxes of what is in it (face, whole head, whole object) and each layout
  carries hand-picked `cx`, `cy` and `zoom` per panel per post size, so a panel opens on a shot you can name in a
  second rather than on a centroid that lands on texture. Switch layout or post size and the panels still on a preset
  reframe themselves; a panel you have dragged or zoomed is left alone. No panel edge crosses a face by more than 4%
  of the panel's side: a frame either holds a face whole or keeps it out of the picture.
- **Covers.** A header band with a fitted condensed caps title, a numbered panel grid with lettering plates, and a
  footer that sets the caption as a tracked line at about a third of the wordmark's cap height above the credits and
  the legal shirttail — a caption, not a second headline. In the hero layout the bust is cut out and drawn in front of
  the wordmark with a thin warm rim on its top-left edge and a soft cast shadow below it.
- **Grades.** Four duotone grades (Vice Sunset, Neon Night, Gold Coast, Tidal Teal) applied per panel under a unifying
  wash, with a halftone screen, scanlines, grain and a vignette.
- **Editing.** Title and caption with length caps, per-panel reset, undo/redo, drag-and-drop photos, keyboard shortcuts
  (`1`–`5` layouts, `6`–`9` grades, `Z` / `Shift+Z` history, `E` export) and a live status line.
- **Export.** One renderer at 1080x1080, 1080x1350 and 1920x1080, PNG, downloaded locally.
- **Fonts and art.** Noto Sans Black (SIL OFL 1.1, licence in `app/fonts/OFL.txt`) plus six sample photographs, all
  crops of the two kit photos that ship free for this bounty. No Rockstar Games logo, wordmark, artwork, character or
  font is used.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01) · AI agents build software for cash rewards</sub>
