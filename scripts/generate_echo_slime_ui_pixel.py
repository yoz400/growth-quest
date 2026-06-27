from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "outputs" / "pet_visuals" / "pixel_samples"
BASE_SIZE = 64
SCALE = 4


C = {
    "outline": (20, 24, 27, 255),
    "mint_dark": (42, 132, 117, 255),
    "mint_mid": (75, 195, 164, 235),
    "mint": (112, 229, 190, 215),
    "mint_light": (185, 255, 222, 225),
    "foam": (233, 255, 239, 235),
    "ripple": (50, 157, 146, 190),
    "core": (255, 224, 88, 255),
    "core_light": (255, 255, 210, 255),
    "eye": (12, 18, 22, 255),
    "mouth": (42, 44, 51, 255),
    "note": (65, 185, 155, 255),
}


def rect(draw, box, fill):
    x0, y0, x1, y1 = box
    draw.rectangle((min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1)), fill=fill)


def ellipse(draw, box, fill, outline=None, width=1):
    draw.ellipse(box, fill=fill, outline=outline, width=width)


def arc(draw, box, start, end, fill, width=1):
    draw.arc(box, start, end, fill=fill, width=width)


def draw_note(draw):
    # Optional tiny note, kept outside the body and away from the silhouette.
    rect(draw, (52, 20, 53, 27), C["outline"])
    rect(draw, (53, 20, 56, 21), C["outline"])
    rect(draw, (49, 26, 53, 30), C["outline"])
    rect(draw, (52, 21, 52, 26), C["note"])
    rect(draw, (53, 21, 55, 21), C["note"])
    rect(draw, (50, 27, 52, 29), C["note"])


def draw_sound_horn(draw, x, y):
    # Short, thick, antenna-like echo horns.
    rect(draw, (x - 2, y + 4, x + 2, y + 9), C["outline"])
    rect(draw, (x - 5, y, x + 5, y + 4), C["outline"])
    rect(draw, (x - 3, y + 1, x + 3, y + 3), C["mint_light"])
    rect(draw, (x - 1, y + 4, x + 1, y + 8), C["mint_mid"])


def draw_echo_slime():
    img = Image.new("RGBA", (BASE_SIZE, BASE_SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    draw_sound_horn(draw, 24, 13)
    draw_sound_horn(draw, 40, 13)

    # Body: soft, low mochi-like dome with clear margins.
    ellipse(draw, (9, 22, 55, 57), C["outline"])
    rect(draw, (13, 43, 51, 56), C["outline"])
    ellipse(draw, (12, 25, 52, 53), C["mint"])
    rect(draw, (16, 42, 48, 53), C["mint"])
    ellipse(draw, (17, 45, 47, 58), C["mint_mid"])

    # Weight and simple readable volume: flat, squishy base.
    rect(draw, (14, 39, 16, 48), C["mint_mid"])
    rect(draw, (48, 39, 50, 48), C["mint_mid"])
    rect(draw, (20, 50, 44, 53), C["mint_dark"])
    rect(draw, (24, 55, 40, 56), C["outline"])

    # Highlights, limited and chunky.
    rect(draw, (22, 27, 35, 29), C["foam"])
    rect(draw, (19, 31, 23, 33), C["mint_light"])
    rect(draw, (38, 29, 42, 31), C["mint_light"])

    # One subtle internal ripple.
    arc(draw, (22, 36, 43, 48), 200, 340, C["ripple"], width=2)
    rect(draw, (27, 42, 29, 43), C["ripple"])
    rect(draw, (35, 42, 37, 43), C["ripple"])

    # Small glowing echo core, separated from the face.
    ellipse(draw, (29, 46, 36, 53), C["outline"])
    ellipse(draw, (30, 47, 35, 52), C["core"])
    rect(draw, (32, 48, 34, 50), C["core_light"])

    # Simple face: rounded black eyes with tiny highlights, matching the earlier cute version.
    ellipse(draw, (22, 33, 28, 39), C["eye"])
    rect(draw, (23, 34, 24, 35), C["foam"])
    ellipse(draw, (37, 33, 43, 39), C["eye"])
    rect(draw, (38, 34, 39, 35), C["foam"])
    rect(draw, (31, 41, 32, 42), C["mouth"])
    rect(draw, (34, 41, 35, 42), C["mouth"])
    rect(draw, (32, 43, 34, 43), C["mouth"])

    # Restore a few hard outline pixels after translucent body layers.
    rect(draw, (9, 36, 11, 48), C["outline"])
    rect(draw, (53, 36, 55, 48), C["outline"])
    rect(draw, (13, 50, 15, 55), C["outline"])
    rect(draw, (49, 50, 51, 55), C["outline"])

    return img


def make_white(image):
    bg = Image.new("RGBA", image.size, (255, 255, 255, 255))
    bg.alpha_composite(image)
    return bg.convert("RGB")


def save_outputs():
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    sprite = draw_echo_slime()
    scaled = sprite.resize((BASE_SIZE * SCALE, BASE_SIZE * SCALE), Image.Resampling.NEAREST)

    native_transparent = OUT_DIR / "pet_001_echo_slime_ui_64_transparent.png"
    native_white = OUT_DIR / "pet_001_echo_slime_ui_64_white.png"
    preview_transparent = OUT_DIR / "pet_001_echo_slime_ui_256_transparent.png"
    preview_white = OUT_DIR / "pet_001_echo_slime_ui_256_white.png"

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
