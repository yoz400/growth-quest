from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "outputs" / "pet_visuals" / "pixel_samples"
BASE_SIZE = 64
SCALE = 4


C = {
    "outline": (26, 23, 24, 255),
    "wool_dark": (221, 156, 135, 255),
    "wool_mid": (255, 203, 167, 255),
    "wool": (255, 226, 181, 255),
    "wool_light": (255, 247, 217, 255),
    "cotton_pink": (255, 190, 205, 255),
    "cotton_light": (255, 232, 226, 255),
    "sun": (255, 191, 59, 255),
    "sun_light": (255, 244, 156, 255),
    "blush": (239, 126, 103, 255),
    "eye": (18, 18, 22, 255),
    "mouth": (77, 45, 41, 255),
    "foot": (223, 158, 126, 255),
}


def rect(draw, box, fill):
    x0, y0, x1, y1 = box
    draw.rectangle((min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1)), fill=fill)


def ellipse(draw, box, fill, outline=None, width=1):
    draw.ellipse(box, fill=fill, outline=outline, width=width)


def polygon(draw, points, fill, outline=None):
    draw.polygon(points, fill=fill)
    if outline:
        draw.line(points + [points[0]], fill=outline, width=2, joint="curve")


def draw_sun_crest(draw):
    # Small warm sun puff, rounded so it does not feel like a hard crown.
    ellipse(draw, (29, 10, 37, 18), C["outline"])
    ellipse(draw, (30, 11, 36, 17), C["sun"])
    rect(draw, (32, 12, 34, 13), C["sun_light"])
    rect(draw, (26, 15, 28, 16), C["sun"])
    rect(draw, (38, 15, 40, 16), C["sun"])


def draw_moko():
    img = Image.new("RGBA", (BASE_SIZE, BASE_SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Cotton-candy outline as a union of rounded puffs.
    outline_lobes = [
        (18, 18, 33, 34),
        (29, 17, 45, 34),
        (9, 34, 26, 51),
        (14, 25, 33, 45),
        (27, 20, 45, 40),
        (36, 28, 55, 48),
        (17, 40, 35, 58),
        (30, 39, 49, 58),
        (21, 30, 45, 54),
        (7, 40, 22, 53),
        (44, 39, 58, 53),
    ]
    for box in outline_lobes:
        ellipse(draw, box, C["outline"])

    # Fill over the outline lobes to remove internal black seams.
    fill_lobes = [
        ((20, 20, 32, 33), C["wool_light"]),
        ((31, 19, 44, 33), C["cotton_light"]),
        ((11, 36, 25, 50), C["cotton_pink"]),
        ((16, 27, 32, 44), C["wool"]),
        ((29, 22, 44, 39), C["wool_light"]),
        ((38, 30, 53, 47), C["cotton_light"]),
        ((19, 42, 34, 56), C["wool_mid"]),
        ((31, 41, 47, 56), C["cotton_pink"]),
        ((23, 32, 43, 52), C["wool"]),
        ((9, 42, 21, 52), C["cotton_light"]),
        ((45, 41, 56, 52), C["cotton_pink"]),
    ]
    for box, color in fill_lobes:
        ellipse(draw, box, color)

    # Soft candy-floss shadows and highlights, simple enough for 64px.
    rect(draw, (16, 44, 49, 48), C["wool_mid"])
    rect(draw, (24, 51, 42, 52), C["wool_mid"])
    ellipse(draw, (18, 27, 34, 38), C["wool_light"])
    rect(draw, (24, 25, 39, 27), C["wool_light"])
    rect(draw, (38, 32, 45, 34), C["wool_light"])
    rect(draw, (14, 40, 18, 43), C["cotton_light"])
    rect(draw, (49, 39, 52, 42), C["wool_mid"])
    rect(draw, (24, 20, 29, 22), C["wool_light"])
    rect(draw, (34, 21, 40, 23), C["cotton_light"])
    rect(draw, (12, 46, 16, 48), C["wool"])
    rect(draw, (50, 45, 54, 47), C["cotton_light"])

    # Face: same friendly eye language as the slime, but warmer.
    ellipse(draw, (22, 34, 28, 40), C["eye"])
    rect(draw, (23, 35, 24, 36), C["wool_light"])
    ellipse(draw, (37, 34, 43, 40), C["eye"])
    rect(draw, (38, 35, 39, 36), C["wool_light"])
    rect(draw, (20, 41, 23, 43), C["blush"])
    rect(draw, (42, 41, 45, 43), C["blush"])
    rect(draw, (30, 42, 31, 43), C["mouth"])
    rect(draw, (34, 42, 35, 43), C["mouth"])
    rect(draw, (31, 44, 34, 44), C["mouth"])

    # Keep the lower fluff soft now that the sunlight core is removed.
    rect(draw, (28, 46, 37, 48), C["wool_mid"])
    rect(draw, (30, 49, 35, 50), C["cotton_pink"])

    # Soften the side puffs without adding heavy black side shadows.
    rect(draw, (11, 40, 15, 46), C["cotton_light"])
    rect(draw, (51, 40, 54, 46), C["cotton_pink"])
    rect(draw, (16, 50, 19, 52), C["wool_mid"])
    rect(draw, (47, 50, 49, 52), C["cotton_pink"])
    rect(draw, (8, 40, 10, 47), C["cotton_light"])
    rect(draw, (55, 40, 56, 47), C["cotton_pink"])

    # Restore only the outer black rim, not the old side-shadow blocks.
    rect(draw, (7, 42, 8, 47), C["outline"])
    rect(draw, (9, 39, 11, 40), C["outline"])
    rect(draw, (9, 48, 12, 49), C["outline"])
    rect(draw, (57, 42, 58, 47), C["outline"])
    rect(draw, (54, 39, 56, 40), C["outline"])
    rect(draw, (53, 48, 56, 49), C["outline"])

    rect(draw, (26, 56, 31, 57), C["outline"])
    rect(draw, (36, 56, 41, 57), C["outline"])
    rect(draw, (21, 53, 29, 55), C["wool_mid"])
    rect(draw, (37, 53, 45, 55), C["cotton_pink"])
    rect(draw, (28, 56, 30, 56), C["wool_mid"])
    rect(draw, (38, 56, 40, 56), C["cotton_pink"])

    return img


def make_white(image):
    bg = Image.new("RGBA", image.size, (255, 255, 255, 255))
    bg.alpha_composite(image)
    return bg.convert("RGB")


def save_outputs():
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    sprite = draw_moko()
    scaled = sprite.resize((BASE_SIZE * SCALE, BASE_SIZE * SCALE), Image.Resampling.NEAREST)

    native_transparent = OUT_DIR / "pet_002_hidamari_moko_ui_64_transparent.png"
    native_white = OUT_DIR / "pet_002_hidamari_moko_ui_64_white.png"
    preview_transparent = OUT_DIR / "pet_002_hidamari_moko_ui_256_transparent.png"
    preview_white = OUT_DIR / "pet_002_hidamari_moko_ui_256_white.png"

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
