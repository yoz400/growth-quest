from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "outputs" / "pet_visuals" / "pixel_samples"
BASE_SIZE = 64
SCALE = 4


C = {
    "outline": (24, 24, 28, 255),
    "deep": (34, 82, 60, 255),
    "shade": (46, 116, 72, 255),
    "main": (74, 164, 96, 255),
    "light": (133, 218, 125, 255),
    "belly": (244, 210, 117, 255),
    "belly_dark": (202, 141, 66, 255),
    "horn": (241, 226, 174, 255),
    "horn_dark": (160, 126, 72, 255),
    "wing": (58, 117, 128, 255),
    "wing_light": (99, 190, 174, 255),
    "eye": (14, 18, 22, 255),
    "eye_glint": (255, 255, 255, 255),
    "cheek": (228, 107, 104, 255),
    "claw": (231, 206, 146, 255),
    "mouth": (102, 43, 43, 255),
}


def ellipse(draw, box, fill, outline=True, width=2):
    draw.ellipse(box, fill=fill, outline=C["outline"] if outline else None, width=width)


def rect(draw, box, fill, outline=False, width=1):
    draw.rectangle(box, fill=fill, outline=C["outline"] if outline else None, width=width)


def poly(draw, points, fill, outline=True, width=2):
    draw.polygon(points, fill=fill)
    if outline:
        draw.line(points + [points[0]], fill=C["outline"], width=width, joint="curve")


def line(draw, points, fill=None, width=1):
    draw.line(points, fill=fill or C["outline"], width=width)


def draw_refined_draco():
    img = Image.new("RGBA", (BASE_SIZE, BASE_SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Tail behind the body.
    poly(draw, [(20, 43), (11, 42), (8, 37), (11, 33), (18, 36), (23, 41)], C["shade"], width=2)
    rect(draw, (10, 36, 13, 38), C["light"])

    # Wings sit behind the head and body, with clear readable silhouettes.
    poly(draw, [(19, 31), (8, 21), (7, 39), (13, 36), (18, 42)], C["wing"], width=2)
    line(draw, [(12, 26), (13, 36)], C["outline"], width=1)
    line(draw, [(9, 32), (17, 35)], C["wing_light"], width=2)
    rect(draw, (11, 23, 13, 26), C["wing_light"])

    poly(draw, [(45, 31), (56, 21), (57, 39), (51, 36), (46, 42)], C["wing"], width=2)
    line(draw, [(52, 26), (51, 36)], C["outline"], width=1)
    line(draw, [(55, 32), (47, 35)], C["wing_light"], width=2)
    rect(draw, (51, 23, 53, 26), C["wing_light"])

    # Small horns, kept high enough to preserve a cute round head.
    poly(draw, [(23, 17), (18, 8), (27, 13)], C["horn"], width=2)
    line(draw, [(20, 11), (23, 16)], C["horn_dark"], width=1)
    poly(draw, [(41, 17), (46, 8), (37, 13)], C["horn"], width=2)
    line(draw, [(44, 11), (41, 16)], C["horn_dark"], width=1)

    # Body first, then head overlaps it for chibi proportions.
    ellipse(draw, (21, 33, 43, 57), C["main"], width=2)
    rect(draw, (22, 43, 25, 51), C["shade"])
    ellipse(draw, (26, 40, 38, 57), C["belly"], outline=False)
    rect(draw, (27, 52, 37, 55), C["belly_dark"])
    rect(draw, (29, 43, 35, 45), (255, 230, 141, 255))

    # Arms and feet make the pose feel less like a blob.
    ellipse(draw, (17, 38, 25, 48), C["main"], width=2)
    rect(draw, (19, 45, 23, 48), C["belly"])
    ellipse(draw, (39, 38, 47, 48), C["main"], width=2)
    rect(draw, (41, 45, 45, 48), C["belly"])

    ellipse(draw, (22, 53, 30, 60), C["deep"], width=2)
    rect(draw, (23, 58, 29, 60), C["claw"])
    ellipse(draw, (34, 53, 42, 60), C["deep"], width=2)
    rect(draw, (35, 58, 41, 60), C["claw"])

    # Main head: big, centered, and kept round.
    ellipse(draw, (14, 13, 50, 43), C["main"], width=2)
    rect(draw, (17, 30, 21, 36), C["shade"])
    rect(draw, (43, 30, 47, 36), C["shade"])
    rect(draw, (22, 17, 35, 20), C["light"])
    rect(draw, (37, 20, 43, 22), C["light"])
    rect(draw, (24, 21, 27, 22), (166, 235, 147, 255))

    # Forehead scales with a clean three-dot rhythm.
    for box in [(31, 14, 33, 16), (27, 18, 29, 20), (35, 18, 37, 20)]:
        rect(draw, box, C["deep"])
        rect(draw, (box[0], box[1], box[0] + 1, box[1]), C["light"])

    # Snout and face.
    ellipse(draw, (24, 28, 40, 40), C["belly"], width=2)
    rect(draw, (27, 30, 37, 37), C["belly"])
    rect(draw, (30, 33, 32, 35), C["outline"])
    rect(draw, (35, 33, 37, 35), C["outline"])
    rect(draw, (32, 37, 36, 38), C["mouth"])

    rect(draw, (21, 27, 24, 30), C["cheek"])
    rect(draw, (40, 27, 43, 30), C["cheek"])

    # Larger but still pixel-simple eyes.
    rect(draw, (24, 23, 29, 30), C["eye"])
    rect(draw, (25, 24, 27, 25), C["eye_glint"])
    rect(draw, (26, 29, 29, 30), (32, 73, 64, 255))

    rect(draw, (36, 23, 41, 30), C["eye"])
    rect(draw, (37, 24, 39, 25), C["eye_glint"])
    rect(draw, (36, 29, 39, 30), (32, 73, 64, 255))

    return img


def make_white(image):
    bg = Image.new("RGBA", image.size, (255, 255, 255, 255))
    bg.alpha_composite(image)
    return bg.convert("RGB")


def save_outputs():
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    sprite = draw_refined_draco()
    scaled = sprite.resize((BASE_SIZE * SCALE, BASE_SIZE * SCALE), Image.Resampling.NEAREST)

    native = OUT_DIR / "pet_sample_mame_draco_pixel_refined_64_transparent.png"
    transparent = OUT_DIR / "pet_sample_mame_draco_pixel_refined_transparent.png"
    white = OUT_DIR / "pet_sample_mame_draco_pixel_refined_white.png"
    comparison = OUT_DIR / "pet_sample_mame_draco_pixel_compare.png"

    sprite.save(native)
    scaled.save(transparent)
    make_white(scaled).save(white)

    old_path = OUT_DIR / "pet_sample_mame_draco_pixel_transparent.png"
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
