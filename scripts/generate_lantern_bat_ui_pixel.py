from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "outputs" / "pet_visuals" / "pixel_samples"
BASE_SIZE = 64
SCALE = 4


C = {
    "outline": (19, 18, 25, 255),
    "body_dark": (47, 42, 79, 255),
    "body": (80, 72, 126, 255),
    "body_light": (118, 105, 166, 255),
    "wing_dark": (39, 43, 83, 255),
    "wing": (62, 76, 132, 255),
    "wing_light": (92, 121, 177, 255),
    "ear_inner": (178, 139, 172, 255),
    "lantern": (255, 199, 77, 255),
    "lantern_light": (255, 244, 171, 255),
    "glow": (255, 221, 111, 190),
    "eye": (13, 16, 22, 255),
    "eye_glint": (255, 255, 238, 255),
    "mouth": (226, 136, 111, 255),
}


def rect(draw, box, fill):
    x0, y0, x1, y1 = box
    draw.rectangle((min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1)), fill=fill)


def ellipse(draw, box, fill, outline=None, width=1):
    draw.ellipse(box, fill=fill, outline=outline, width=width)


def polygon(draw, points, fill, outline=None, width=2):
    draw.polygon(points, fill=fill)
    if outline:
        draw.line(points + [points[0]], fill=outline, width=width, joint="curve")


def line(draw, points, fill, width=1):
    draw.line(points, fill=fill, width=width)


def draw_lantern_bat():
    img = Image.new("RGBA", (BASE_SIZE, BASE_SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Soft glow behind the hanging lantern.
    ellipse(draw, (25, 38, 40, 55), C["glow"])
    ellipse(draw, (22, 35, 43, 58), (255, 212, 100, 70))

    # Wings first, behind the body.
    polygon(draw, [(27, 28), (12, 19), (7, 33), (14, 31), (11, 45), (25, 39)], C["outline"])
    polygon(draw, [(26, 29), (13, 22), (9, 32), (16, 30), (13, 42), (25, 37)], C["wing"])
    rect(draw, (14, 28, 18, 30), C["wing_light"])
    rect(draw, (15, 34, 19, 36), C["wing_dark"])

    polygon(draw, [(37, 28), (52, 19), (57, 33), (50, 31), (53, 45), (39, 39)], C["outline"])
    polygon(draw, [(38, 29), (51, 22), (55, 32), (48, 30), (51, 42), (39, 37)], C["wing"])
    rect(draw, (46, 28, 50, 30), C["wing_light"])
    rect(draw, (45, 34, 49, 36), C["wing_dark"])

    # Ears.
    polygon(draw, [(23, 24), (18, 12), (28, 18)], C["outline"])
    polygon(draw, [(24, 23), (19, 14), (27, 18)], C["body"])
    rect(draw, (21, 17, 23, 20), C["ear_inner"])
    polygon(draw, [(41, 24), (46, 12), (36, 18)], C["outline"])
    polygon(draw, [(40, 23), (45, 14), (37, 18)], C["body"])
    rect(draw, (41, 17, 43, 20), C["ear_inner"])

    # Round body and head.
    ellipse(draw, (20, 21, 44, 47), C["outline"])
    ellipse(draw, (22, 23, 42, 45), C["body"])
    rect(draw, (25, 25, 33, 27), C["body_light"])
    rect(draw, (36, 30, 39, 34), C["body_light"])
    rect(draw, (23, 36, 26, 41), C["body_dark"])
    rect(draw, (39, 36, 42, 41), C["body_dark"])

    # Tiny feet gripping the lantern cord.
    rect(draw, (27, 45, 29, 48), C["outline"])
    rect(draw, (35, 45, 37, 48), C["outline"])
    rect(draw, (28, 45, 28, 47), C["body_light"])
    rect(draw, (36, 45, 36, 47), C["body_light"])

    # Lantern cord and lantern.
    line(draw, [(32, 45), (32, 49)], C["outline"], width=2)
    rect(draw, (26, 49, 38, 57), C["outline"])
    rect(draw, (28, 50, 36, 55), C["lantern"])
    rect(draw, (30, 51, 35, 53), C["lantern_light"])
    rect(draw, (28, 54, 36, 55), C["lantern_light"])
    rect(draw, (27, 56, 37, 57), C["outline"])
    rect(draw, (30, 56, 35, 56), C["lantern_light"])

    # Face.
    ellipse(draw, (25, 31, 30, 36), C["eye"])
    rect(draw, (26, 32, 27, 33), C["eye_glint"])
    ellipse(draw, (35, 31, 40, 36), C["eye"])
    rect(draw, (36, 32, 37, 33), C["eye_glint"])
    rect(draw, (31, 38, 33, 39), C["mouth"])
    rect(draw, (33, 38, 34, 38), C["mouth"])

    # A few night-spark pixels from the lantern, kept subtle.
    rect(draw, (20, 51, 21, 52), C["lantern_light"])
    rect(draw, (43, 50, 44, 51), C["lantern"])
    rect(draw, (47, 44, 48, 45), C["lantern_light"])

    return img


def make_white(image):
    bg = Image.new("RGBA", image.size, (255, 255, 255, 255))
    bg.alpha_composite(image)
    return bg.convert("RGB")


def save_outputs():
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    sprite = draw_lantern_bat()
    scaled = sprite.resize((BASE_SIZE * SCALE, BASE_SIZE * SCALE), Image.Resampling.NEAREST)

    native_transparent = OUT_DIR / "pet_003_lantern_bat_ui_64_transparent.png"
    native_white = OUT_DIR / "pet_003_lantern_bat_ui_64_white.png"
    preview_transparent = OUT_DIR / "pet_003_lantern_bat_ui_256_transparent.png"
    preview_white = OUT_DIR / "pet_003_lantern_bat_ui_256_white.png"

    sprite.save(native_transparent)
    make_white(sprite).save(native_white)
    scaled.save(preview_transparent)
    make_white(scaled).save(preview_white)

    print(native_transparent)
    print(native_white)
    print(preview_transparent)
    print(preview_white)


if __name__ == "__main__":
    save_outputs()
