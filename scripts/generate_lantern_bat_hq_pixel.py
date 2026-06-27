from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "outputs" / "pet_visuals" / "lantern_bat_hq"
BASE_SIZE = 128


C = {
    "outline": (22, 17, 29, 255),
    "outline_soft": (51, 40, 74, 255),
    "body_deep": (44, 36, 79, 255),
    "body_dark": (70, 56, 122, 255),
    "body": (105, 82, 169, 255),
    "body_light": (155, 128, 219, 255),
    "wing_deep": (28, 43, 89, 255),
    "wing_dark": (46, 70, 134, 255),
    "wing": (78, 112, 187, 255),
    "wing_light": (117, 173, 231, 255),
    "ear_inner": (217, 157, 212, 255),
    "fur": (244, 220, 165, 255),
    "glow": (255, 205, 80, 255),
    "glow_light": (255, 249, 176, 255),
    "glow_soft": (255, 213, 91, 150),
    "eye": (17, 18, 25, 255),
    "eye_glint": (255, 255, 247, 255),
    "blush": (224, 115, 142, 255),
    "mouth": (103, 48, 67, 255),
}


def rect(draw, box, fill):
    x0, y0, x1, y1 = box
    draw.rectangle((min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1)), fill=fill)


def ellipse(draw, box, fill, outline=None, width=1):
    draw.ellipse(box, fill=fill, outline=outline, width=width)


def polygon(draw, points, fill, outline=None, width=3):
    draw.polygon(points, fill=fill)
    if outline:
        draw.line(points + [points[0]], fill=outline, width=width, joint="curve")


def line(draw, points, fill, width=1):
    draw.line(points, fill=fill, width=width)


def draw_lantern_bat_hq():
    img = Image.new("RGBA", (BASE_SIZE, BASE_SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Chest glow integrated into the creature, not a held item.
    ellipse(draw, (46, 62, 82, 104), C["glow_soft"])
    ellipse(draw, (38, 54, 90, 112), (255, 205, 88, 60))

    # Wing silhouettes with clear front-facing symmetry.
    left_outer = [(54, 51), (31, 31), (16, 42), (10, 68), (24, 62), (18, 91), (43, 78), (54, 85)]
    right_outer = [(74, 51), (97, 31), (112, 42), (118, 68), (104, 62), (110, 91), (85, 78), (74, 85)]
    polygon(draw, left_outer, C["outline"], outline=None)
    polygon(draw, right_outer, C["outline"], outline=None)
    polygon(draw, [(52, 53), (32, 36), (19, 45), (14, 64), (29, 58), (23, 83), (43, 72), (53, 79)], C["wing_dark"])
    polygon(draw, [(76, 53), (96, 36), (109, 45), (114, 64), (99, 58), (105, 83), (85, 72), (75, 79)], C["wing_dark"])
    polygon(draw, [(31, 40), (21, 48), (17, 61), (30, 55), (26, 75), (41, 66), (51, 73), (49, 58)], C["wing"])
    polygon(draw, [(97, 40), (107, 48), (111, 61), (98, 55), (102, 75), (87, 66), (77, 73), (79, 58)], C["wing"])
    rect(draw, (29, 47, 39, 51), C["wing_light"])
    rect(draw, (89, 47, 99, 51), C["wing_light"])
    rect(draw, (27, 62, 37, 66), C["wing_deep"])
    rect(draw, (91, 62, 101, 66), C["wing_deep"])
    line(draw, [(36, 38), (49, 58), (45, 77)], C["outline_soft"], width=2)
    line(draw, [(92, 38), (79, 58), (83, 77)], C["outline_soft"], width=2)

    # Ears.
    polygon(draw, [(48, 42), (35, 16), (59, 29)], C["outline"])
    polygon(draw, [(50, 41), (38, 21), (57, 31)], C["body"])
    polygon(draw, [(47, 34), (40, 23), (53, 30)], C["ear_inner"], outline=None)
    rect(draw, (42, 24, 46, 27), C["body_light"])
    polygon(draw, [(80, 42), (93, 16), (69, 29)], C["outline"])
    polygon(draw, [(78, 41), (90, 21), (71, 31)], C["body"])
    polygon(draw, [(81, 34), (88, 23), (75, 30)], C["ear_inner"], outline=None)
    rect(draw, (82, 24, 86, 27), C["body_light"])

    # Body and head as one cute small creature.
    ellipse(draw, (40, 34, 88, 97), C["outline"])
    ellipse(draw, (43, 37, 85, 94), C["body"])
    rect(draw, (51, 40, 67, 45), C["body_light"])
    rect(draw, (70, 49, 77, 55), C["body_light"])
    rect(draw, (45, 67, 50, 77), C["body_dark"])
    rect(draw, (79, 67, 84, 77), C["body_dark"])

    # Built-in glowing belly pattern, integrated into the body instead of a separate item.
    ellipse(draw, (50, 72, 78, 99), C["fur"])
    rect(draw, (55, 76, 73, 80), (255, 238, 188, 255))
    ellipse(draw, (56, 80, 72, 96), C["glow"])
    rect(draw, (60, 84, 69, 90), C["glow_light"])
    rect(draw, (61, 91, 68, 95), C["glow"])
    rect(draw, (53, 96, 75, 98), C["body_deep"])
    rect(draw, (58, 96, 70, 96), C["glow_light"])

    # Face.
    ellipse(draw, (50, 55, 61, 68), C["eye"])
    rect(draw, (53, 57, 56, 60), C["eye_glint"])
    ellipse(draw, (67, 55, 78, 68), C["eye"])
    rect(draw, (70, 57, 73, 60), C["eye_glint"])
    rect(draw, (49, 70, 54, 73), C["blush"])
    rect(draw, (75, 70, 80, 73), C["blush"])
    rect(draw, (61, 72, 63, 74), C["mouth"])
    rect(draw, (65, 72, 67, 74), C["mouth"])
    rect(draw, (63, 75, 65, 76), C["mouth"])

    # Small feet, not items.
    ellipse(draw, (47, 94, 57, 104), C["outline"])
    ellipse(draw, (49, 95, 56, 102), C["body_dark"])
    rect(draw, (50, 99, 56, 102), C["body_light"])
    ellipse(draw, (71, 94, 81, 104), C["outline"])
    ellipse(draw, (72, 95, 79, 102), C["body_dark"])
    rect(draw, (72, 99, 78, 102), C["body_light"])

    # Tiny firefly-like glow pixels, part of the aura rather than separate items.
    rect(draw, (37, 95, 39, 97), C["glow_light"])
    rect(draw, (88, 94, 90, 96), C["glow"])
    rect(draw, (92, 82, 93, 83), C["glow_light"])
    rect(draw, (34, 82, 35, 83), C["glow"])

    return img


def make_white(image):
    bg = Image.new("RGBA", image.size, (255, 255, 255, 255))
    bg.alpha_composite(image)
    return bg.convert("RGB")


def save_outputs():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    sprite = draw_lantern_bat_hq()

    outputs = {
        "1024_transparent": OUT_DIR / "pet_003_lantern_bat_hq_1024_transparent.png",
        "1024_white": OUT_DIR / "pet_003_lantern_bat_hq_1024_white.png",
        "256_transparent": OUT_DIR / "pet_003_lantern_bat_hq_256_transparent.png",
        "256_white": OUT_DIR / "pet_003_lantern_bat_hq_256_white.png",
        "64_transparent": OUT_DIR / "pet_003_lantern_bat_hq_64_transparent.png",
        "64_white": OUT_DIR / "pet_003_lantern_bat_hq_64_white.png",
        "source_128": OUT_DIR / "pet_003_lantern_bat_hq_source_128.png",
    }

    sprite.save(outputs["source_128"])

    for size in (1024, 256, 64):
        scaled = sprite.resize((size, size), Image.Resampling.NEAREST)
        scaled.save(outputs[f"{size}_transparent"])
        make_white(scaled).save(outputs[f"{size}_white"])

    for path in outputs.values():
        print(path)


if __name__ == "__main__":
    save_outputs()
