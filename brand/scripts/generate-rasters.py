#!/usr/bin/env python3
"""
Regenerate every raster brand asset from the logo geometry.

The PNGs and the .ico in brand/favicon/ are build artefacts, not hand-drawn
files. They are derived from the same three circles that define
brand/logo/stablepay-logo.svg, so the vector and the rasters cannot drift.

    pip install Pillow
    python3 brand/scripts/generate-rasters.py

Why draw the circles here instead of rasterising the SVG? Because doing so
removes the dependency on a system SVG renderer (cairosvg, rsvg, Inkscape),
each of which is a separate install and some of which quietly disagree about
antialiasing and about how `opacity` composites. The mark is three circles;
reproducing it exactly is a dozen lines, and the output is deterministic on
any machine with Pillow.

If the logo geometry ever changes, change CIRCLES here and the viewBox in the
SVGs together.
"""

import os
import sys

try:
    from PIL import Image, ImageDraw
except ImportError:
    sys.exit("Pillow is required:  pip install Pillow")

HERE = os.path.dirname(os.path.abspath(__file__))
BRAND = os.path.dirname(HERE)
FAV = os.path.join(BRAND, "favicon")

# Geometry of brand/logo/stablepay-logo.svg (viewBox 0 0 582 549).
VB_W, VB_H = 582.0, 549.0

# Painted in SVG source order: three opaque white discs, then the three
# translucent brand hues. The order determines the overlap colours.
CIRCLES = [
    (290.5, 170.5, 170.5, (255, 255, 255), 1.0),
    (411.5, 378.5, 170.5, (255, 255, 255), 1.0),
    (170.5, 378.5, 170.5, (255, 255, 255), 1.0),
    (290.5, 170.5, 170.5, (0x23, 0x5E, 0xFE), 0.7),   # Signal Blue
    (170.5, 378.5, 170.5, (0xFF, 0xC8, 0x22), 0.8),   # Beacon Yellow
    (411.5, 378.5, 170.5, (0xFD, 0x67, 0x24), 0.8),   # Ember Orange
]


def render(size, pad_ratio=0.06, supersample=8):
    """Square RGBA render of the mark, centred, with proportional padding.

    Drawn at `supersample`x and downsampled with Lanczos: Pillow's ellipse has
    no antialiasing of its own, and hard edges at 16px look broken.
    """
    S = size * supersample
    canvas = Image.new("RGBA", (S, S), (0, 0, 0, 0))

    pad = S * pad_ratio
    avail = S - 2 * pad
    scale = avail / max(VB_W, VB_H)
    off_x = pad + (avail - VB_W * scale) / 2
    off_y = pad + (avail - VB_H * scale) / 2

    for cx, cy, r, rgb, alpha in CIRCLES:
        # Each disc goes on its own layer so alpha_composite reproduces SVG's
        # `opacity` semantics. Drawing translucent fills straight onto the
        # canvas would blend against transparent pixels instead.
        layer = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)
        X, Y, R = off_x + cx * scale, off_y + cy * scale, r * scale
        d.ellipse([X - R, Y - R, X + R, Y + R], fill=rgb + (round(alpha * 255),))
        canvas = Image.alpha_composite(canvas, layer)

    return canvas.resize((size, size), Image.LANCZOS)


def flatten(img, bg=(255, 255, 255, 255)):
    """Composite onto an opaque plate. Required where the platform supplies
    its own background if we don't (iOS) or crops to a mask (Android)."""
    base = Image.new("RGBA", img.size, bg)
    return Image.alpha_composite(base, img).convert("RGB")


def main():
    os.makedirs(FAV, exist_ok=True)
    written = []

    def save(img, name):
        img.save(os.path.join(FAV, name))
        written.append(name)

    # Browser tab icons. Tight padding: at 16px every pixel of margin is a
    # pixel the mark does not get.
    save(render(16, pad_ratio=0.02), "favicon-16x16.png")
    save(render(32, pad_ratio=0.02), "favicon-32x32.png")

    # iOS composites the touch icon onto an opaque tile regardless, so supply
    # a white one explicitly rather than letting it pick.
    save(flatten(render(180, pad_ratio=0.12)), "apple-touch-icon.png")

    # PWA install icons.
    save(render(192, pad_ratio=0.06), "android-chrome-192x192.png")
    save(render(512, pad_ratio=0.06), "android-chrome-512x512.png")

    # Android crops maskable icons to the inner 80%, so pad harder and fill
    # the plate; otherwise the outer discs get clipped by the OS mask.
    save(flatten(render(512, pad_ratio=0.20)), "maskable-icon-512x512.png")

    # Multi-resolution .ico for legacy browsers and pinned tabs.
    render(256, pad_ratio=0.02).save(
        os.path.join(FAV, "favicon.ico"),
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64)],
    )
    written.append("favicon.ico")

    # 1200x630 social preview, mark on white at the optical left.
    og = Image.new("RGB", (1200, 630), (255, 255, 255))
    mark = render(360, pad_ratio=0.0)
    og.paste(mark, (110, 135), mark)
    save(og, "og-image.png")

    for name in written:
        size = os.path.getsize(os.path.join(FAV, name))
        print(f"  {name:32s} {size:>8,} bytes")
    print(f"\n{len(written)} files written to {FAV}")


if __name__ == "__main__":
    main()
