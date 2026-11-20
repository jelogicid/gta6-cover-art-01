#!/usr/bin/env python3
"""Build support, never shipped: preview a candidate crop of a sample photo at a panel's aspect, exactly the way
photoTransform crops it, so frames can be picked by eye before any poster is rendered.

  python3 screws/crop-preview.py <photo> <aspect> <cx> <cy> <zoom> [out.png]
"""
import sys
from PIL import Image

SRC = {
    'gold-hour': 'app/samples/gold-hour.jpg',
    'palm-line': 'app/samples/palm-line.jpg',
    'the-car': 'app/samples/the-car.jpg',
    'pier': 'app/samples/pier.jpg',
    'low-tide': 'app/samples/low-tide.jpg',
    'the-rod': 'app/samples/the-rod.jpg',
}


def crop(photo, aspect, cx, cy, zoom, out_w=900):
    img = Image.open(SRC[photo]).convert('RGB')
    iw, ih = img.size
    out_h = int(round(out_w / aspect))
    base = max(out_w / iw, out_h / ih)
    scale = base * max(1.0, zoom)
    dw, dh = iw * scale, ih * scale
    vw = min(1.0, out_w / dw)
    vh = min(1.0, out_h / dh)
    fx = min(1 - vw / 2, max(vw / 2, cx))
    fy = min(1 - vh / 2, max(vh / 2, cy))
    x = out_w / 2 - fx * dw
    y = out_h / 2 - fy * dh
    canvas = Image.new('RGB', (out_w, out_h), (16, 8, 24))
    canvas.paste(img.resize((int(round(dw)), int(round(dh))), Image.LANCZOS), (int(round(x)), int(round(y))))
    return canvas, dict(window=(round(fx - vw / 2, 3), round(fx + vw / 2, 3), round(fy - vh / 2, 3), round(fy + vh / 2, 3)),
                        shows=round(vw * vh, 3), size=(out_w, out_h))


if __name__ == '__main__':
    photo, aspect, cx, cy, zoom = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), float(sys.argv[4]), float(sys.argv[5])
    out = sys.argv[6] if len(sys.argv) > 6 else None
    im, info = crop(photo, aspect, cx, cy, zoom)
    print(photo, info)
    if out:
        im.save(out)
        print('->', out)
