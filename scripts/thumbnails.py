"""Draw the channel art for the games that ship in the box.

Drawn rather than downloaded, and drawn at four times the size and shrunk,
which is the cheapest antialiasing there is.

    python scripts/thumbnails.py
"""
import pathlib
import sys

from PIL import Image, ImageDraw

ROOT = pathlib.Path(__file__).resolve().parent.parent
W, H, S = 512, 320, 4


def sky(draw, top, bottom):
    """The pale wash every channel sits on, so they look like a set."""
    for y in range(H * S):
        t = y / (H * S)
        draw.line([(0, y), (W * S, y)],
                  fill=tuple(round(a + (b - a) * t) for a, b in
                             zip(top, bottom)))


def new(top=(226, 243, 253), bottom=(255, 255, 255)):
    image = Image.new("RGB", (W * S, H * S), "white")
    draw = ImageDraw.Draw(image)
    sky(draw, top, bottom)
    return image, draw


def save(image, slug):
    out = ROOT / "games" / slug / "thumbnail.png"
    image.resize((W, H), Image.LANCZOS).save(out)
    print(out)


def snake():
    image, draw = new((222, 244, 228), (255, 255, 255))
    body = [(0, 1), (1, 1), (2, 1), (2, 0), (3, 0), (4, 0), (5, 0)]
    cell = 54 * S
    span = 6.9 * cell                      # the body plus the apple beside it
    left = (W * S - span) / 2
    top = (H * S - 2 * cell) / 2
    for i, (cx, cy) in enumerate(body):
        x, y = left + cx * cell, top + cy * cell
        pad = 3 * S if i == len(body) - 1 else 5 * S
        shade = int(60 * i / len(body))
        draw.rounded_rectangle([x + pad, y + pad, x + cell - pad, y + cell - pad],
                               radius=16 * S,
                               fill=(58 + shade, 170 + shade // 3, 118 + shade // 2),
                               outline=(255, 255, 255), width=3 * S)
    # The head is the last segment; give it eyes so it faces somewhere.
    hx, hy = left + body[-1][0] * cell, top + body[-1][1] * cell
    for dx in (0.36, 0.68):
        draw.ellipse([hx + cell * dx - 6 * S, hy + cell * .32 - 6 * S,
                      hx + cell * dx + 6 * S, hy + cell * .32 + 6 * S],
                     fill=(255, 255, 255))
    ax, ay = left + 6.7 * cell, top + cell * .5
    draw.ellipse([ax - 23 * S, ay - 23 * S, ax + 23 * S, ay + 23 * S],
                 fill=(255, 95, 87))
    draw.ellipse([ax + 3 * S, ay - 34 * S, ax + 30 * S, ay - 21 * S],
                 fill=(94, 194, 106))
    save(image, "snake")


def tube(image, x, y, width, height, colours):
    """A tube is drawn twice: once as liquid on its own layer, then that
    layer pasted through a rounded mask. Filling rectangles straight into
    the picture spills the colour past the rounded bottom."""
    radius = int(width * .42)
    liquid = Image.new("RGB", (int(width), int(height)), "white")
    paint = ImageDraw.Draw(liquid)
    unit = height / 4
    for n, colour in enumerate(reversed(colours)):
        if colour is not None:
            paint.rectangle([0, (3 - n) * unit, width, (4 - n) * unit],
                            fill=colour)
    mask = Image.new("L", (int(width), int(height)), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, width - 1, height - 1], radius=radius, fill=255)
    image.paste(liquid, (int(x), int(y)), mask)

    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle([x, y, x + width, y + height], radius=radius,
                           outline=(168, 190, 206), width=5 * S)
    draw.rounded_rectangle([x + width * .17, y + height * .07,
                            x + width * .28, y + height * .34],
                           radius=6 * S, fill=(255, 255, 255))


def colour_sort():
    image, _ = new((233, 240, 252), (255, 255, 255))
    tubes = [
        [(255, 95, 87), (77, 150, 255), (255, 201, 60), (94, 194, 106)],
        [(94, 194, 106), (255, 201, 60), (255, 95, 87), (77, 150, 255)],
        [(77, 150, 255), (94, 194, 106), (94, 194, 106), None],
        [None, None, None, None],
    ]
    width, height, gap = 66 * S, 208 * S, 34 * S
    left = (W * S - (len(tubes) * width + (len(tubes) - 1) * gap)) / 2
    top = (H * S - height) / 2
    for i, colours in enumerate(tubes):
        tube(image, left + i * (width + gap), top, width, height, colours)
    save(image, "colour-sort")


def balloon(image, x, y, r, colour, label=None, string=True):
    """One balloon, lit from the top left like everything else in the menu."""
    layer = Image.new("RGBA", image.size, (0, 0, 0, 0))
    pen = ImageDraw.Draw(layer)
    if string:
        pen.line([(x, y + r * 1.24), (x + r * .35, y + r * 1.9),
                  (x, y + r * 2.5)], fill=(140, 165, 180, 190), width=int(2 * S),
                 joint="curve")
    pen.ellipse([x - r, y - r * 1.18, x + r, y + r * 1.18], fill=colour)
    pen.polygon([(x - r * .16, y + r * 1.12), (x + r * .16, y + r * 1.12),
                 (x, y + r * 1.36)], fill=colour)
    # The highlight: a soft white ellipse up and to the left, the same place
    # the plates in the menu are lit from.
    pen.ellipse([x - r * .62, y - r * .92, x - r * .12, y - r * .28],
                fill=(255, 255, 255, 150))
    if label:
        box = pen.textbbox((0, 0), label, font_size=int(r * 1.0))
        pen.text((x - (box[2] - box[0]) / 2, y - (box[3] - box[1]) / 2 - r * .2),
                 label, fill=(255, 255, 255, 235), font_size=int(r * 1.0))
    image.alpha_composite(layer)


def balloon_rush():
    image, _ = new((205, 236, 253), (255, 255, 255))
    image = image.convert("RGBA")
    balloon(image, 118 * S, 168 * S, 46 * S, (255, 107, 107))
    balloon(image, 386 * S, 150 * S, 44 * S, (77, 150, 255))
    balloon(image, 256 * S, 128 * S, 52 * S, (255, 196, 46), "5")
    balloon(image, 448 * S, 246 * S, 30 * S, (66, 80, 92))
    save(image.convert("RGB"), "balloon-rush")


if __name__ == "__main__":
    snake()
    colour_sort()
    balloon_rush()
    sys.exit(0)
