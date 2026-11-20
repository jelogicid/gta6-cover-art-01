#!/usr/bin/env python3
"""Build support, never shipped: prove which layer the hero cut-out sits on.

The question is not opinion, it is occlusion. Inside the bust's silhouette, where the wordmark's cream letterforms
would otherwise be, we should find photograph rather than cream type if the bust is in front, and cream type if it
is behind. This renders both facts for comparison:

  inside   share of the silhouette's interior that is cream letterform (luminance > 170 AND low saturation, the
           cream fill) — near zero means the bust covers the letters
  band     the same share over the rest of the wordmark band, as the baseline
  shadow   mean luminance just outside the silhouette on the side the light comes from versus the far side

  python3 screws/layer-check.py <cover.png> "<shot query>"
"""
import json
import math
import subprocess
import sys
from PIL import Image


def luminance(p):
    return 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]


def is_cream(p):
    """The wordmark's fill: bright, and nearly neutral (the photos are duotoned, so they are coloured)."""
    r, g, b = p
    return luminance(p) > 170 and (max(p) - min(p)) < 46


def main():
    path, query = sys.argv[1], sys.argv[2]
    im = Image.open(path).convert('RGB')
    px = im.load()
    box = json.loads(subprocess.run(['node', 'screws/bust-box.mjs', query],
                                    capture_output=True, text=True, check=True).stdout)
    cx, cy, rx, ry = box['cx'], box['cy'], box['rx'], box['ry']
    w, h = im.size

    # the wordmark band: rows above the hero panel that carry the type
    band_top, band_bottom = int(box['rect']['y'] - (box['rect']['y'] - 0) * 0.98), int(box['rect']['y'])
    band_top = max(0, int(h * 0.04))

    inside_total = inside_cream = 0
    band_total = band_cream = 0
    for y in range(band_top, band_bottom, 2):
        for x in range(0, w, 2):
            cream = is_cream(px[x, y])
            u = (x - cx) / rx
            v = (y - cy) / ry
            in_bust = u * u + v * v <= 0.93 * 0.93
            if in_bust:
                inside_total += 1
                inside_cream += 1 if cream else 0
            else:
                band_total += 1
                band_cream += 1 if cream else 0

    in_share = 100 * inside_cream / max(1, inside_total)
    band_share = 100 * band_cream / max(1, band_total)
    print(f'{path}  band rows {band_top}–{band_bottom}  bust {cx:.0f},{cy:.0f} r {rx:.0f},{ry:.0f}')
    print(f'cream type inside the silhouette: {in_share:.1f}%   over the rest of the band: {band_share:.1f}%')
    if band_share > 3:
        covered = 100 * (1 - in_share / band_share)
        print(f'-> the bust covers {covered:.0f}% of the type it overlaps: '
              f'{"IN FRONT of the wordmark" if covered > 60 else "BEHIND the wordmark"}')

    # the light: rim brightness on the top-left arc against the band behind it, shadow just outside the far edge
    def at(deg, f):
        a = math.radians(deg)
        return px[int(cx + math.cos(a) * rx * f), int(cy + math.sin(a) * ry * f)]

    rim = max(luminance(at(d, 0.975)) for d in range(175, 300, 2))
    behind = sum(luminance(at(d, 1.09)) for d in range(175, 300, 2)) / len(range(175, 300, 2))
    print(f'rim peak {rim:.0f} vs band behind it {behind:.0f}  -> {rim - behind:+.0f}')

    near = sum(luminance(at(d, 1.035)) for d in range(-40, -2, 2)) / len(range(-40, -2, 2))
    far = sum(luminance(at(d, 1.24)) for d in range(-40, -2, 2)) / len(range(-40, -2, 2))
    print(f'shadow just outside {near:.0f} vs band past it {far:.0f}  -> {near - far:+.0f}')


if __name__ == '__main__':
    main()
