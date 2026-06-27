from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "outputs" / "base_inner_review"
CANVAS_SIZE = (1034, 1520)
LOW_SIZE = (80, 128)
SCALE = 10
OFFSET = (117, 90)


def open_rgba(name):
    return Image.open(ROOT / name).convert("RGBA")


def clean_alpha(img):
    """Remove isolated transparent-edge dust on the low-res canvas."""
    out = img.copy()
    px = out.load()
    w, h = out.size
    to_clear = []
    for y in range(h):
        for x in range(w):
            if px[x, y][3] == 0:
                continue
            neighbors = 0
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if 0 <= nx < w and 0 <= ny < h and px[nx, ny][3] > 0:
                    neighbors += 1
            if neighbors == 0:
                to_clear.append((x, y))
    for x, y in to_clear:
        px[x, y] = (0, 0, 0, 0)
    return out


def extract_low_head():
    src = open_rgba("typeC_outfit12_grand_sage_sprite_transparent.png")
    head = Image.new("RGBA", LOW_SIZE, (0, 0, 0, 0))
    sp = src.load()
    hp = head.load()
    for y in range(src.height):
        for x in range(src.width):
            r, g, b, a = sp[x, y]
            if a == 0:
                continue
            # Keep hair, glasses, face, ears, and earrings. Remove staff and robe/body pixels.
            if x < 18:
                continue
            if y > 58:
                teal_hair = r < 165 and g > 80 and b > 85 and abs(g - b) < 95
                skin_or_blush = r > 150 and 65 < g < 190 and 40 < b < 165 and r > b + 25
                gold = r > 130 and g > 80 and b < 95 and (x <= 24 or x >= 56)
                side_hair_or_ear = y <= 66 and (x <= 31 or x >= 49) and (teal_hair or skin_or_blush or gold)
                chin_edge = y <= 61 and 32 <= x <= 48 and (skin_or_blush or r < 45)
                if not side_hair_or_ear and not chin_edge:
                    continue
            hp[x, y] = (r, g, b, a)
    return clean_alpha(head)


def draw_body():
    img = Image.new("RGBA", LOW_SIZE, (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    line = (23, 22, 22, 255)
    line_soft = (48, 48, 50, 255)
    skin = (238, 142, 103, 255)
    skin_hi = (255, 180, 136, 255)
    shirt = (239, 235, 219, 255)
    shirt_hi = (255, 252, 238, 255)
    shirt_shadow = (197, 194, 181, 255)
    shorts = (48, 59, 82, 255)
    shorts_hi = (72, 85, 112, 255)
    leggings = (55, 59, 68, 255)
    boots = (100, 61, 34, 255)
    boots_hi = (158, 94, 45, 255)

    def rect(box, fill, outline=None):
        d.rectangle(box, fill=fill)
        if outline:
            d.rectangle(box, outline=outline)

    def poly(points, fill, outline=None):
        d.polygon(points, fill=fill)
        if outline:
            d.line(points + [points[0]], fill=outline, width=1)

    def ellipse(box, fill, outline=None):
        d.ellipse(box, fill=fill)
        if outline:
            d.ellipse(box, outline=outline)

    # Neck tucked slightly under the head.
    rect((37, 52, 43, 59), skin, line)
    rect((39, 52, 42, 55), skin_hi)

    # Sleeves and hands.
    poly([(25, 58), (34, 57), (33, 84), (29, 91), (22, 88), (21, 70)], shirt, line)
    poly([(46, 57), (55, 58), (59, 70), (58, 88), (51, 91), (47, 84)], shirt, line)
    rect((25, 76, 31, 86), shirt_shadow)
    rect((50, 76, 56, 86), shirt_shadow)
    ellipse((20, 84, 31, 95), skin, line)
    ellipse((49, 84, 60, 95), skin, line)
    rect((23, 86, 28, 90), skin_hi)
    rect((52, 86, 57, 90), skin_hi)

    # Torso.
    poly([(31, 55), (49, 55), (55, 82), (52, 96), (28, 96), (25, 82)], shirt, line)
    rect((35, 58, 45, 85), shirt_hi)
    poly([(34, 55), (40, 62), (46, 55)], shirt_shadow, line)
    rect((39, 63, 41, 83), line_soft)
    rect((36, 72, 44, 74), line_soft)
    rect((35, 84, 45, 86), line_soft)

    # Shorts.
    rect((28, 92, 52, 103), shorts, line)
    rect((31, 94, 38, 101), shorts_hi)
    rect((42, 94, 49, 101), (35, 43, 62, 255))
    rect((39, 93, 41, 106), (219, 219, 209, 255))

    # Legs and boots.
    rect((30, 103, 38, 116), leggings, line)
    rect((43, 103, 51, 116), leggings, line)
    rect((31, 104, 37, 108), (235, 234, 224, 255))
    rect((44, 104, 50, 108), (235, 234, 224, 255))
    rect((26, 115, 39, 124), boots, line)
    rect((42, 115, 55, 124), boots, line)
    rect((29, 117, 37, 119), boots_hi)
    rect((45, 117, 53, 119), boots_hi)
    rect((25, 123, 39, 126), line)
    rect((42, 123, 56, 126), line)

    return clean_alpha(img)


def composite_low():
    head = extract_low_head()
    body = draw_body()
    full = body.copy()
    full.alpha_composite(head)
    return head, body, clean_alpha(full)


def upscale_to_canvas(img):
    scaled = img.resize((LOW_SIZE[0] * SCALE, LOW_SIZE[1] * SCALE), Image.Resampling.NEAREST)
    canvas = Image.new("RGBA", CANVAS_SIZE, (0, 0, 0, 0))
    canvas.alpha_composite(scaled, OFFSET)
    return canvas


def save_pair(sprite, stem):
    sprite.save(ROOT / f"{stem}_transparent.png")
    white = Image.new("RGBA", sprite.size, (255, 255, 255, 255))
    white.alpha_composite(sprite)
    white.convert("RGB").save(ROOT / f"{stem}_white.png")


def make_review(low_head, low_body, low_full, high_head, high_body, high_full):
    OUT.mkdir(parents=True, exist_ok=True)
    cells = [
        ("low head", low_head.resize((LOW_SIZE[0] * 3, LOW_SIZE[1] * 3), Image.Resampling.NEAREST)),
        ("low body", low_body.resize((LOW_SIZE[0] * 3, LOW_SIZE[1] * 3), Image.Resampling.NEAREST)),
        ("low full", low_full.resize((LOW_SIZE[0] * 3, LOW_SIZE[1] * 3), Image.Resampling.NEAREST)),
        ("final", high_full),
    ]
    cell = (260, 390)
    sheet = Image.new("RGBA", (cell[0] * len(cells), cell[1]), (244, 244, 244, 255))
    d = ImageDraw.Draw(sheet)
    for i, (label, img) in enumerate(cells):
        white = Image.new("RGBA", img.size, (255, 255, 255, 255))
        white.alpha_composite(img)
        thumb = white.copy()
        thumb.thumbnail((230, 330), Image.Resampling.NEAREST)
        x = i * cell[0]
        sheet.alpha_composite(thumb, (x + (cell[0] - thumb.width) // 2, 44 + (330 - thumb.height) // 2))
        d.text((x + 8, 10), label, fill=(20, 20, 20, 255))
    sheet.convert("RGB").save(OUT / "typeC_uniform_pixel_review.jpg")

    low_head.save(OUT / "typeC_uniform_low_head.png")
    low_body.save(OUT / "typeC_uniform_low_body.png")
    low_full.save(OUT / "typeC_uniform_low_full.png")
    high_head.save(OUT / "typeC_uniform_head_lock.png")
    high_body.save(OUT / "typeC_uniform_body_base.png")
    high_full.save(OUT / "typeC_uniform_final_transparent.png")


def main():
    low_head, low_body, low_full = composite_low()
    high_head = upscale_to_canvas(low_head)
    high_body = upscale_to_canvas(low_body)
    high_full = upscale_to_canvas(low_full)

    high_head.save(ROOT / "typeC_head_lock.png")
    high_body.save(ROOT / "typeC_body_base.png")
    save_pair(high_full, "typeC_base_inner")
    make_review(low_head, low_body, low_full, high_head, high_body, high_full)
    print(OUT / "typeC_uniform_pixel_review.jpg")


if __name__ == "__main__":
    main()
