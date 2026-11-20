# screws/

Build support for the hand-in. Nothing here ships: `main.ts` copies only `app/` and `screenshots/` into `/output`.

The checks below are the ones that decided the crop and framing work, kept so the next person can re-run them
rather than re-derive them. Every one of them reads the app's own numbers — no thresholds were fitted to the
screenshots by hand.

| script | what it proves | run |
| --- | --- | --- |
| `render-shots.mjs` | re-renders `screenshots/` from the app in headless Chromium, checks the export buttons hand back PNGs of the stated size, and records every request so a network call cannot slip in | `node screws/render-shots.mjs` |
| `frame-check.mjs` | every panel of every cover holds a whole face, whole head or whole object, is not a sliver of texture, and no panel edge cuts a face by more than 4% of the panel's side | `node screws/frame-check.mjs` |
| `text-check.mjs` | the footer tagline's CAP height sits at 25–40% of the wordmark's cap height, on one line, and the wordmark still fits one line | `node screws/text-check.mjs` |
| `layer-check.py` | the hero cut-out really is in front of the wordmark: how much of the type its silhouette covers, plus the rim's brightness and the cast shadow's darkening | `python3 screws/layer-check.py <cover.png> "<shot query>"` |
| `crop-preview.py` | previews a candidate `cx/cy/zoom` at a panel's aspect, the way `photoTransform` will crop it, so a frame can be picked by eye before rendering a poster | `python3 screws/crop-preview.py the-car 3.74 0.5 0.55 1.0 out.png` |
| `panel-peek.mjs` | writes each panel of a cover out as its own image at full export size, for judging a panel rather than the sheet | `node screws/panel-peek.mjs "<shot query>"` |
| `bust-box.mjs` | prints the `cx/cy/rx/ry` the renderer used for the hero cut-out, which `layer-check.py` measures against | `node screws/bust-box.mjs "<shot query>"` |
| `interaction-test.mjs`, `smoke.mjs` | the editor's interactions and a boot smoke test | `node screws/interaction-test.mjs` |

`screws/` is not part of the entry's line count, so keep this to probes that earn their place: anything one-shot
belongs in a scratch directory, not here.
