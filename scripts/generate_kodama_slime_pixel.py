from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "outputs" / "pet_visuals" / "pixel_samples"
BASE_SIZE = 64
SCALE = 4


C = {
    "outline": (20, 24, 26, 255),
    "mint_dark": (45, 139, 121, 255),
    "mint": (106, 224, 186, 218),
    "mint_mid": (78, 194, 163, 245),
    "mint_light": (178, 255, 219, 220),
    "foam": (224, 255, 235, 235),
    "ripple": (38, 154, 143, 190),
    "ripple_light": (190, 255, 229, 220),
    "core": (255, 231, 99, 255),
    "core_light": (255, 255, 220, 255),
    "eye": (12, 18, 22, 255),
    "eye_glint": (255, 255, 255, 255),
    "mouth": (75, 55, 64, 255),
    "note": (65, 183, 157, 255),
    "note_light": (194, 255, 226, 255),
}


def rect(draw, box, fill):
    x0, y0, x1, y1 = box
    draw.rectangle((min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1)), fill=fill)


def ellipse(draw, box, fill, outline=None, width=1):
    draw.ellipse(box, fill=fill, outline=outline, width=width)


def line(draw, points, fill, width=1):
    draw.line(points, fill=fill, width=width)


def arc(draw, box, start, end, fill, width=1):
    draw.arc(box, start=start, end=end, fill=fill, width=width)


def draw_music_note(draw, x, y, flip=False):
    color = C["note"]
    light = C["note_light"]
    dx = -1 if flip else 1
    rect(draw, (x, y + 7, x + 3, y + 10), C["outline"])
    rect(draw, (x + 1, y + 8, x + 3, y + 10), color)
    rect(draw, (x + 3 * dx, y, x + 4 * dx, y + 8), C["outline"])
    rect(draw, (x + 3 * dx, y + 1, x + 3 * dx, y + 7), color)
    rect(draw, (x + 3 * dx, y, x + 8 * dx, y + 1), C["outline"])
    rect(draw, (x + 3 * dx, y + 1, x + 7 * dx, y + 1), light)


def draw_tuning_fork_horn(draw, x, y, flip=False):
    side = -1 if flip else 1
    # Black chunky outline first.
    rect(draw, (x - 1, y + 5, x + 1, y + 13), C["outline"])
    rect(draw, (x - 4 * side, y, x - 3 * side, y + 6), C["outline"])
    rect(draw, (x + 3 * side, y, x + 4 * side, y + 6), C["outline"])
    rect(draw, (x - 4 * side, y + 5, x + 4 * side, y + 7), C["outline"])
    # Soft mint inside.
    rect(draw, (x, y + 6, x, y + 12), C["mint_mid"])
    rect(draw, (x - 3 * side, y + 1, x - 3 * side, y + 6), C["mint_light"])
    rect(draw, (x + 3 * side, y + 1, x + 3 * side, y + 6), C["mint_light"])
    rect(draw, (x - 3 * side, y + 6, x + 3 * side, y + 6), C["mint_mid"])


def draw_kodama_slime():
    img = Image.new("RGBA", (BASE_SIZE, BASE_SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Tiny bouncing sound effects.
    draw_music_note(draw, 7, 20, flip=False)
    draw_music_note(draw, 55, 16, flip=True)
    rect(draw, (50, 45, 51, 46), C["note_light"])
    rect(draw, (12, 47, 13, 48), C["note"])

    # Tuning-fork-like soft horns.
    draw_tuning_fork_horn(draw, 22, 7, flip=True)
    draw_tuning_fork_horn(draw, 42, 7, flip=False)

    # Outer slime silhouette: thick black outline, squat and bouncy.
    ellipse(draw, (13, 15, 51, 54), C["outline"], outline=None)
    rect(draw, (18, 48, 46, 55), C["outline"])
    ellipse(draw, (17, 18, 47, 51), C["mint"], outline=None)
    rect(draw, (20, 44, 44, 52), C["mint"])
    ellipse(draw, (19, 46, 45, 56), C["mint"], outline=None)

    # Bottom and side weight so it does not feel like a plain circle.
    arc(draw, (18, 27, 46, 58), 12, 166, C["mint_dark"], width=2)
    rect(draw, (20, 50, 43, 53), C["mint_mid"])
    rect(draw, (23, 53, 40, 55), C["mint_dark"])
    rect(draw, (15, 34, 17, 42), C["mint_mid"])
    rect(draw, (47, 35, 49, 42), C["mint_mid"])

    # Highlights: make the semi-transparent slime feel glossy.
    rect(draw, (23, 20, 34, 22), C["foam"])
    rect(draw, (20, 24, 24, 26), C["mint_light"])
    rect(draw, (37, 22, 40, 24), C["mint_light"])
    rect(draw, (27, 18, 29, 19), (255, 255, 245, 230))

    # Internal sound-wave ripples.
    arc(draw, (22, 27, 43, 45), 205, 340, C["ripple"], width=2)
    arc(draw, (25, 29, 40, 43), 205, 340, C["ripple_light"], width=1)
    line(draw, [(23, 41), (27, 39), (31, 41), (35, 39), (40, 41)], C["ripple"], width=2)
    line(draw, [(25, 43), (31, 45), (38, 43)], C["ripple_light"], width=1)

    # Cute face.
    ellipse(draw, (22, 28, 27, 34), C["eye"], outline=None)
    rect(draw, (23, 29, 24, 30), C["eye_glint"])
    ellipse(draw, (38, 28, 43, 34), C["eye"], outline=None)
    rect(draw, (39, 29, 40, 30), C["eye_glint"])

    # Clear omega mouth: two tiny rounded lobes plus a center dip.
    omega_pixels = [
        ".XX...XX.",
        "X..X.X..X",
        "X..X.X..X",
        ".X.....X.",
        "..X...X..",
        "...XXX...",
    ]
    ox, oy = 28, 35
    for row, pattern in enumerate(omega_pixels):
        for col, value in enumerate(pattern):
            if value == "X":
                rect(draw, (ox + col, oy + row, ox + col, oy + row), C["outline"])

    # Glowing core lower in the body, separate from the face.
    ellipse(draw, (29, 43, 36, 50), C["core"], outline=C["outline"], width=1)
    rect(draw, (31, 45, 34, 47), C["core_light"])
    rect(draw, (33, 48, 35, 50), C["core"])
    rect(draw, (27, 46, 28, 47), C["ripple_light"])
    rect(draw, (37, 46, 38, 47), C["ripple_light"])

    # Rebuild small outline pixels where fill softened the silhouette.
    rect(draw, (18, 49, 19, 53), C["outline"])
    rect(draw, (44, 49, 45, 53), C["outline"])
    rect(draw, (21, 55, 42, 56), C["outline"])
    rect(draw, (13, 34, 14, 43), C["outline"])
    rect(draw, (50, 34, 51, 43), C["outline"])

    return img


def make_white(image):
    bg = Image.new("RGBA", image.size, (255, 255, 255, 255))
    bg.alpha_composite(image)
    return bg.convert("RGB")


def save_outputs():
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    sprite = draw_kodama_slime()
    scaled = sprite.resize((BASE_SIZE * SCALE, BASE_SIZE * SCALE), Image.Resampling.NEAREST)

    native_transparent = OUT_DIR / "pet_001_kodama_slime_pixel_64_transparent.png"
    native_white = OUT_DIR / "pet_001_kodama_slime_pixel_64_white.png"
    preview_transparent = OUT_DIR / "pet_001_kodama_slime_pixel_256_transparent.png"
    preview_white = OUT_DIR / "pet_001_kodama_slime_pixel_256_white.png"

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
