from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "outputs" / "pet_visuals" / "pixel_samples"
BASE_SIZE = 64
SCALE = 4


C = {
    "outline": (22, 22, 27, 255),
    "deep": (57, 49, 57, 255),
    "hide_dark": (108, 74, 56, 255),
    "hide": (183, 116, 67, 255),
    "hide_light": (231, 164, 85, 255),
    "cream": (244, 220, 151, 255),
    "cream_dark": (190, 139, 76, 255),
    "shell_dark": (42, 91, 102, 255),
    "shell": (58, 137, 135, 255),
    "shell_light": (103, 204, 177, 255),
    "crystal": (116, 230, 219, 255),
    "crystal_light": (233, 255, 238, 255),
    "amber": (255, 202, 78, 255),
    "amber_dark": (175, 102, 43, 255),
    "eye": (14, 18, 23, 255),
    "eye_glint": (255, 255, 255, 255),
    "cheek": (222, 93, 83, 255),
    "claw": (233, 213, 153, 255),
}


def rect(draw, box, fill, outline=False, width=1):
    draw.rectangle(box, fill=fill, outline=C["outline"] if outline else None, width=width)


def ellipse(draw, box, fill, outline=True, width=2):
    draw.ellipse(box, fill=fill, outline=C["outline"] if outline else None, width=width)


def poly(draw, points, fill, outline=True, width=2):
    draw.polygon(points, fill=fill)
    if outline:
        draw.line(points + [points[0]], fill=C["outline"], width=width, joint="curve")


def line(draw, points, fill=None, width=1):
    draw.line(points, fill=fill or C["outline"], width=width)


def draw_radical_pet():
    img = Image.new("RGBA", (BASE_SIZE, BASE_SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Back tail with glowing mineral bud.
    poly(draw, [(47, 34), (55, 29), (58, 22), (61, 25), (59, 33), (52, 39)], C["hide_dark"], width=2)
    rect(draw, (53, 30, 56, 33), C["hide_light"])
    poly(draw, [(57, 17), (62, 22), (59, 29), (53, 25), (54, 20)], C["crystal"], width=2)
    rect(draw, (56, 20, 59, 22), C["crystal_light"])
    rect(draw, (58, 25, 60, 27), C["shell_light"])

    # Body shell: the main silhouette is now a small armored quadruped.
    poly(draw, [(23, 29), (32, 20), (47, 22), (56, 34), (51, 47), (31, 50), (21, 42)], C["shell_dark"], width=2)
    poly(draw, [(28, 31), (35, 24), (46, 26), (52, 35), (48, 43), (33, 45), (25, 39)], C["shell"], width=1)
    rect(draw, (34, 27, 40, 29), C["shell_light"])
    rect(draw, (43, 31, 48, 33), C["shell_light"])
    rect(draw, (31, 36, 35, 38), C["amber"])
    rect(draw, (43, 39, 47, 41), C["amber"])

    # Shell spikes.
    poly(draw, [(31, 23), (34, 15), (38, 24)], C["cream"], width=2)
    poly(draw, [(42, 24), (47, 16), (50, 27)], C["cream"], width=2)

    # Legs placed under shell with clear feet.
    for x, y, w in [(23, 43, 7), (34, 46, 7), (45, 43, 7)]:
        ellipse(draw, (x, y, x + w, y + 10), C["hide_dark"], width=2)
        rect(draw, (x + 1, y + 8, x + w, y + 11), C["claw"])
    ellipse(draw, (16, 40, 24, 50), C["hide_dark"], width=2)
    rect(draw, (17, 48, 24, 51), C["claw"])

    # Neck bridge.
    poly(draw, [(18, 31), (27, 30), (29, 39), (19, 41)], C["hide"], width=2)
    rect(draw, (22, 33, 26, 36), C["hide_light"])

    # Large head, side/front hybrid.
    poly(
        draw,
        [
            (12, 19),
            (20, 11),
            (35, 12),
            (43, 20),
            (43, 31),
            (36, 40),
            (21, 41),
            (11, 34),
            (8, 25),
        ],
        C["hide"],
        width=2,
    )
    rect(draw, (20, 15, 31, 17), C["hide_light"])
    rect(draw, (33, 18, 38, 20), C["hide_light"])
    rect(draw, (11, 28, 15, 34), C["hide_dark"])

    # Horns and cheek fins.
    poly(draw, [(18, 14), (14, 5), (23, 11)], C["cream"], width=2)
    line(draw, [(16, 8), (19, 13)], C["cream_dark"], width=1)
    poly(draw, [(34, 14), (40, 6), (40, 16)], C["cream"], width=2)
    line(draw, [(38, 9), (36, 14)], C["cream_dark"], width=1)
    poly(draw, [(9, 27), (2, 23), (5, 34), (11, 33)], C["shell"], width=2)
    rect(draw, (5, 27, 8, 30), C["shell_light"])

    # Snout.
    poly(draw, [(11, 31), (20, 27), (30, 31), (32, 37), (25, 42), (14, 39)], C["cream"], width=2)
    rect(draw, (16, 33, 19, 35), C["amber_dark"])
    rect(draw, (25, 33, 28, 35), C["amber_dark"])
    rect(draw, (20, 38, 26, 39), C["outline"])
    rect(draw, (13, 35, 16, 37), C["cheek"])

    # Eyes: readable from game size.
    rect(draw, (20, 23, 26, 30), C["eye"])
    rect(draw, (21, 24, 23, 25), C["eye_glint"])
    rect(draw, (24, 29, 26, 30), (48, 73, 61, 255))
    rect(draw, (34, 23, 39, 29), C["eye"])
    rect(draw, (35, 24, 37, 25), C["eye_glint"])

    # Forehead plates and small scars/marks.
    rect(draw, (27, 13, 30, 15), C["shell_dark"])
    rect(draw, (31, 16, 34, 18), C["shell"])
    rect(draw, (24, 18, 26, 20), C["amber"])
    rect(draw, (37, 30, 39, 32), C["amber"])

    return img


def make_white(image):
    bg = Image.new("RGBA", image.size, (255, 255, 255, 255))
    bg.alpha_composite(image)
    return bg.convert("RGB")


def save_outputs():
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    sprite = draw_radical_pet()
    scaled = sprite.resize((BASE_SIZE * SCALE, BASE_SIZE * SCALE), Image.Resampling.NEAREST)

    native = OUT_DIR / "pet_sample_cavern_lantern_whelp_64_transparent.png"
    transparent = OUT_DIR / "pet_sample_cavern_lantern_whelp_transparent.png"
    white = OUT_DIR / "pet_sample_cavern_lantern_whelp_white.png"
    comparison = OUT_DIR / "pet_sample_radical_compare.png"

    sprite.save(native)
    scaled.save(transparent)
    make_white(scaled).save(white)

    old_path = OUT_DIR / "pet_sample_mame_draco_pixel_refined_transparent.png"
    if old_path.exists():
        old = Image.open(old_path).convert("RGBA")
        canvas = Image.new("RGBA", (old.width * 2 + 16, old.height), (255, 255, 255, 255))
        canvas.alpha_composite(old, (0, 0))
        canvas.alpha_composite(scaled, (old.width + 16, 0))
        canvas.convert("RGB").save(comparison)

    print(native)
    print(transparent)
    print(white)
    if comparison.exists():
        print(comparison)


if __name__ == "__main__":
    save_outputs()
