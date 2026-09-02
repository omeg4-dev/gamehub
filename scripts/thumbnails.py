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


def face(pen, x, y, r, ring, holding=False):
    """One of the pods from Hot Potato, drawn the same way the game draws
    them: a white disc, a ring in that player's colour, and a face that
    knows whether it is the one holding the bomb."""
    pen.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255),
                outline=ring, width=int(r * .13))
    ink = (61, 88, 102)
    for side in (-1, 1):
        ex = x + side * r * .30
        pen.ellipse([ex - r * .085, y - r * .30, ex + r * .085, y - r * .06],
                    fill=ink)
    if holding:
        pen.ellipse([x - r * .17, y + r * .10, x + r * .17, y + r * .44], fill=ink)
    else:
        pen.arc([x - r * .26, y - r * .10, x + r * .26, y + r * .34],
                start=20, end=160, fill=ink, width=int(r * .09))


def hot_potato():
    image, _ = new((255, 236, 214), (255, 255, 255))
    image = image.convert("RGBA")
    pen = ImageDraw.Draw(image)
    face(pen, 132 * S, 190 * S, 74 * S, (62, 199, 255), holding=True)
    face(pen, 380 * S, 190 * S, 74 * S, (255, 111, 94))
    # The bomb, mid-throw, with the arc it is travelling on.
    for i in range(22):
        t = i / 21
        bx = (132 + (380 - 132) * t) * S
        by = (190 - 150 * (t * (1 - t) * 4)) * S
        if i % 2:
            pen.ellipse([bx - 3 * S, by - 3 * S, bx + 3 * S, by + 3 * S],
                        fill=(150, 175, 190, 130))
    bx, by, br = 256 * S, 108 * S, 34 * S
    pen.ellipse([bx - br, by - br, bx + br, by + br], fill=(58, 70, 80))
    pen.line([(bx, by - br), (bx + br * .7, by - br * 1.5),
              (bx + br * .35, by - br * 1.95)], fill=(201, 139, 90),
             width=int(br * .18), joint="curve")
    pen.ellipse([bx + br * .35 - br * .28, by - br * 2.05 - br * .28,
                 bx + br * .35 + br * .28, by - br * 2.05 + br * .28],
                fill=(255, 209, 102))
    pen.ellipse([bx - br * .5, by - br * .6, bx - br * .18, by - br * .3],
                fill=(255, 255, 255, 90))
    save(image.convert("RGB"), "hot-potato")


# --- Road Hop ----------------------------------------------------------
# The same projection the game uses, so the card and the game agree about
# what the world looks like: a cube is a top face and the two sides that
# face the camera, each a shade darker.
def road_hop():
    image, _ = new((150, 205, 235), (196, 229, 247))
    image = image.convert("RGBA")
    pen = ImageDraw.Draw(image)
    tile = 78 * S
    view = dict(w=tile, d=tile * .58, s=tile * .21, h=tile * .66,
                ox=W * S / 2 - tile * .21 * 2.4, oy=H * S * .92)

    def proj(col, row, z):
        return (view["ox"] + (col - 2.5) * view["w"] + row * view["s"],
                view["oy"] - row * view["d"] - z * view["h"])

    def shade(colour, amount):
        return tuple(min(255, round(c * amount)) for c in colour)

    def box(col, row, w, d, z0, z1, colour):
        a, b = proj(col, row, z1), proj(col + w, row, z1)
        c, e = proj(col + w, row + d, z1), proj(col, row + d, z1)
        a0, b0 = proj(col, row, z0), proj(col + w, row, z0)
        c0 = proj(col + w, row + d, z0)
        pen.polygon([a, b, c, e], fill=shade(colour, 1.0))
        pen.polygon([a, b, b0, a0], fill=shade(colour, .78))
        pen.polygon([b, c, c0, b0], fill=shade(colour, .62))

    # Far to near, so the nearer rows simply paint over the ones behind.
    for row, kind in [(3, "grass"), (2, "road"), (1, "road"), (0, "grass"),
                      (-1, "grass")]:
        if kind == "grass":
            box(-4, row, 14, 1, 0, .3, (126, 200, 80) if row % 2 else (118, 192, 71))
        else:
            box(-4, row, 14, 1, 0, .18, (76, 82, 92))
            if row == 2:
                for c in range(-4, 10, 2):
                    pen.polygon([proj(c + .3, row + .96, .19),
                                 proj(c + 1.3, row + .96, .19),
                                 proj(c + 1.3, row + .99, .19),
                                 proj(c + .3, row + .99, .19)],
                                fill=(238, 232, 200))
        if row == 3:
            box(0.1, row + .32, .36, .36, .3, .8, (122, 82, 48))
            box(-.15, row + .06, .88, .88, .8, 1.42, (53, 160, 87))
            box(4.2, row + .32, .36, .36, .3, .8, (122, 82, 48))
            box(3.95, row + .06, .88, .88, .8, 1.42, (47, 139, 76))
        if row == 2:
            box(2.6, row + .14, 1.9, .72, .18, .62, (226, 87, 76))
            box(3.0, row + .2, 1.05, .6, .62, .92, (199, 76, 67))
        if row == 1:
            box(-.6, row + .14, 1.9, .72, .18, .62, (95, 179, 232))
            box(-.2, row + .2, 1.05, .6, .62, .92, (83, 157, 204))
        if row == 0:
            # The chicken, on the near verge, mid-hop.
            z = .34
            box(2.11, .2, .78, .62, z + .04, z + .58, (247, 247, 244))
            box(2.20, .66, .60, .34, z + .56, z + 1.04, (255, 255, 255))
            box(2.35, .98, .30, .18, z + .72, z + .88, (244, 166, 60))
            box(2.31, .72, .38, .22, z + 1.04, z + 1.2, (226, 87, 76))
            for eye in (2.24, 2.63):
                pen.polygon([proj(eye, .99, z + .96), proj(eye + .13, .99, z + .96),
                             proj(eye + .13, .99, z + .84), proj(eye, .99, z + .84)],
                            fill=(43, 43, 43))
    save(image.convert("RGB"), "road-hop")


if __name__ == "__main__":
    snake()
    colour_sort()
    balloon_rush()
    hot_potato()
    road_hop()
    sys.exit(0)
