from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "outputs" / "pet_visuals" / "pixel_samples"


SCALE = 4
BASE_SIZE = 64


PALETTE = {
    "outline": (24, 24, 28, 255),
    "dark": (37, 88, 62, 255),
    "main": (74, 160, 96, 255),
    "light": (134, 213, 125, 255),
    "belly": (246, 211, 116, 255),
    "belly_shadow": (202, 143, 67, 255),
    "horn": (238, 224, 174, 255),
    "horn_shadow": (168, 134, 78, 255),
    "wing": (68, 127, 134, 255),
    "wing_light": (107, 194, 178, 255),
    "cheek": (229, 105, 102, 255),
    "eye": (18, 22, 24, 255),
    "eye_light": (255, 255, 255, 255),
    "claw": (229, 205, 144, 255),
}


def rect(draw, x, y, w, h, color):
    draw.rectangle((x, y, x + w - 1, y + h - 1), fill=color)


def poly(draw, points, color):
    draw.polygon(points, fill=color)


def ellipse(draw, box, color):
    draw.ellipse(box, fill=color)


def paste_outline(draw, fn, *args, grow=1):
    for dx in range(-grow, grow + 1):
        for dy in range(-grow, grow + 1):
            if abs(dx) + abs(dy) <= grow + 1:
                shifted = []
                for value in args:
                    if isinstance(value, tuple):
                        shifted.append(tuple(v + (dx if i % 2 == 0 else dy) for i, v in enumerate(value)))
                    elif isinstance(value, list):
                        shifted.append([(x + dx, y + dy) for x, y in value])
                    else:
                        shifted.append(value)
                fn(draw, *shifted, PALETTE["outline"])


def draw_mame_draco():
    img = Image.new("RGBA", (BASE_SIZE, BASE_SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Rear details: tail and wings.
    paste_outline(draw, poly, [(17, 40), (8, 36), (7, 30), (13, 29), (19, 35)])
    poly(draw, [(17, 40), (9, 35), (8, 31), (13, 30), (19, 36)], PALETTE["dark"])
    rect(draw, 8, 32, 4, 2, PALETTE["light"])

    paste_outline(draw, poly, [(19, 29), (8, 19), (9, 34)])
    poly(draw, [(19, 29), (9, 20), (10, 32)], PALETTE["wing"])
    rect(draw, 11, 24, 3, 8, PALETTE["wing_light"])

    paste_outline(draw, poly, [(45, 29), (56, 19), (55, 34)])
    poly(draw, [(45, 29), (55, 20), (54, 32)], PALETTE["wing"])
    rect(draw, 50, 24, 3, 8, PALETTE["wing_light"])

    # Horns.
    paste_outline(draw, poly, [(22, 17), (17, 8), (25, 13)])
    poly(draw, [(22, 17), (18, 9), (25, 13)], PALETTE["horn"])
    rect(draw, 20, 12, 2, 3, PALETTE["horn_shadow"])

    paste_outline(draw, poly, [(42, 17), (47, 8), (39, 13)])
    poly(draw, [(42, 17), (46, 9), (39, 13)], PALETTE["horn"])
    rect(draw, 43, 12, 2, 3, PALETTE["horn_shadow"])

    # Body.
    paste_outline(draw, ellipse, (20, 34, 45, 56), grow=2)
    ellipse(draw, (20, 34, 45, 56), PALETTE["main"])
    ellipse(draw, (26, 39, 39, 55), PALETTE["belly"])
    rect(draw, 28, 51, 9, 3, PALETTE["belly_shadow"])

    # Legs and claws.
    for x in (23, 38):
        paste_outline(draw, rect, x, 53, 6, 4)
        rect(draw, x, 52, 6, 5, PALETTE["dark"])
        rect(draw, x + 1, 56, 5, 2, PALETTE["claw"])

    # Head.
    paste_outline(draw, ellipse, (15, 13, 49, 42), grow=2)
    ellipse(draw, (15, 13, 49, 42), PALETTE["main"])
    rect(draw, 21, 16, 15, 4, PALETTE["light"])
    rect(draw, 37, 19, 5, 3, PALETTE["light"])
    rect(draw, 17, 30, 4, 4, PALETTE["dark"])
    rect(draw, 43, 30, 4, 4, PALETTE["dark"])

    # Snout and face.
    paste_outline(draw, ellipse, (25, 28, 39, 39))
    ellipse(draw, (25, 28, 39, 39), PALETTE["belly"])
    rect(draw, 21, 27, 4, 3, PALETTE["cheek"])
    rect(draw, 40, 27, 4, 3, PALETTE["cheek"])

    for eye_x in (25, 38):
        rect(draw, eye_x, 23, 5, 7, PALETTE["eye"])
        rect(draw, eye_x + 1, 24, 2, 2, PALETTE["eye_light"])
    rect(draw, 31, 32, 2, 2, PALETTE["outline"])
    rect(draw, 34, 32, 2, 2, PALETTE["outline"])
    rect(draw, 32, 36, 4, 1, PALETTE["outline"])

    # Forehead scales.
    for x, y in [(31, 14), (29, 18), (34, 18)]:
        rect(draw, x, y, 3, 3, PALETTE["dark"])
        rect(draw, x, y, 2, 1, PALETTE["light"])

    return img


def save_outputs():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    sprite = draw_mame_draco()

    native = OUT_DIR / "pet_sample_mame_draco_pixel_64_transparent.png"
    transparent = OUT_DIR / "pet_sample_mame_draco_pixel_transparent.png"
    white = OUT_DIR / "pet_sample_mame_draco_pixel_white.png"

    sprite.save(native)
    scaled = sprite.resize((BASE_SIZE * SCALE, BASE_SIZE * SCALE), Image.Resampling.NEAREST)
    scaled.save(transparent)

    bg = Image.new("RGBA", scaled.size, (255, 255, 255, 255))
    bg.alpha_composite(scaled)
    bg.convert("RGB").save(white)

    print(native)
    print(transparent)
    print(white)


if __name__ == "__main__":
    save_outputs()
