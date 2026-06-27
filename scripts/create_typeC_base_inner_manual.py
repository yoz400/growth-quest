from pathlib import Path

from PIL import Image, ImageChops, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "outputs" / "base_inner_review"


def open_rgba(name):
    return Image.open(ROOT / name).convert("RGBA")


def alpha(img):
    return img.getchannel("A")


def rect_mask(size, box):
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rectangle(box, fill=255)
    return mask


def cut_with_mask(img, mask):
    out = Image.new("RGBA", img.size, (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out


def extract_c_head(src):
    # Keep the full original head, including hair highlights, glasses, ears, and ahoge.
    mask = ImageChops.multiply(alpha(src), rect_mask(src.size, (145, 65, 890, 705)))
    px = mask.load()
    for y in range(src.height):
        for x in range(src.width):
            # The right-side book/hand area starts below the face; do not keep it in head_lock.
            if y > 660 and x > 590:
                px[x, y] = 0
    return cut_with_mask(src, mask), mask


def p(draw, points, fill, outline=None):
    draw.polygon(points, fill=fill)
    if outline:
        draw.line(points + [points[0]], fill=outline, width=1)


def r(draw, box, fill, outline=None):
    draw.rectangle(box, fill=fill)
    if outline:
        draw.rectangle(box, outline=outline, width=1)


def e(draw, box, fill, outline=None):
    draw.ellipse(box, fill=fill)
    if outline:
        draw.ellipse(box, outline=outline, width=1)


def make_lowres_body():
    # 80x128 follows the existing C mini sprite proportions.
    img = Image.new("RGBA", (80, 128), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    line = (22, 22, 24, 255)
    shade = (194, 190, 178, 255)
    shirt = (239, 235, 218, 255)
    shirt_hi = (255, 251, 238, 255)
    shorts = (48, 58, 78, 255)
    shorts_hi = (70, 82, 108, 255)
    boot = (102, 62, 35, 255)
    boot_hi = (154, 93, 45, 255)
    skin = (239, 141, 104, 255)
    skin_hi = (255, 180, 135, 255)

    # Neck
    r(d, (36, 44, 44, 52), skin, line)
    r(d, (38, 44, 42, 48), skin_hi)

    # Arms behind torso: simple sleeves with visible hands.
    p(d, [(22, 52), (33, 55), (31, 83), (22, 88), (17, 77), (18, 59)], shirt, line)
    p(d, [(48, 55), (59, 52), (63, 59), (62, 77), (57, 88), (49, 83)], shirt, line)
    r(d, (20, 72, 28, 83), shade)
    r(d, (52, 72, 60, 83), shade)
    e(d, (17, 82, 29, 94), skin, line)
    e(d, (51, 82, 63, 94), skin, line)
    r(d, (20, 85, 25, 89), skin_hi)
    r(d, (54, 85, 59, 89), skin_hi)

    # Shirt body: slightly narrow shoulders, chibi torso.
    p(d, [(29, 50), (51, 50), (56, 78), (53, 94), (27, 94), (24, 78)], shirt, line)
    r(d, (34, 53, 47, 82), shirt_hi)
    p(d, [(34, 50), (40, 57), (46, 50)], (210, 204, 191, 255), line)
    r(d, (39, 58, 41, 80), (80, 86, 96, 255))
    r(d, (36, 67, 44, 69), (80, 86, 96, 255))
    r(d, (35, 79, 45, 81), (80, 86, 96, 255))

    # Shorts and waist.
    r(d, (27, 88, 53, 100), shorts, line)
    r(d, (30, 90, 38, 98), shorts_hi)
    r(d, (42, 90, 50, 98), (36, 44, 62, 255))
    r(d, (39, 91, 41, 101), (220, 220, 210, 255))

    # Legs.
    r(d, (29, 99, 38, 114), (58, 62, 70, 255), line)
    r(d, (43, 99, 52, 114), (58, 62, 70, 255), line)
    r(d, (30, 100, 37, 105), (237, 236, 226, 255))
    r(d, (44, 100, 51, 105), (237, 236, 226, 255))

    # Boots.
    r(d, (25, 113, 39, 124), boot, line)
    r(d, (42, 113, 56, 124), boot, line)
    r(d, (28, 115, 37, 118), boot_hi)
    r(d, (45, 115, 54, 118), boot_hi)
    r(d, (24, 122, 39, 126), line)
    r(d, (42, 122, 57, 126), line)

    return img


def clear_overlap(img, mask):
    out = img.copy()
    op = out.load()
    mp = mask.load()
    for y in range(out.height):
        for x in range(out.width):
            if mp[x, y] > 0:
                op[x, y] = (0, 0, 0, 0)
    return out


def compose_candidate(scale, yoff):
    src = open_rgba("adventurer-c-crop-fixed-transparent.png")
    head, head_mask = extract_c_head(src)
    low_body = make_lowres_body()
    body_scaled = low_body.resize((low_body.width * scale, low_body.height * scale), Image.Resampling.NEAREST)
    body = Image.new("RGBA", src.size, (0, 0, 0, 0))
    xoff = (src.width - body_scaled.width) // 2
    body.alpha_composite(body_scaled, (xoff, yoff))
    body = clear_overlap(body, head_mask)
    full = body.copy()
    full.alpha_composite(head)
    return src, head, head_mask, body, full


def save_pair(sprite, stem):
    sprite.save(ROOT / f"{stem}_transparent.png")
    white = Image.new("RGBA", sprite.size, (255, 255, 255, 255))
    white.alpha_composite(sprite)
    white.convert("RGB").save(ROOT / f"{stem}_white.png")


def make_contact(candidates):
    cell = (230, 330)
    sheet = Image.new("RGBA", (cell[0] * len(candidates), cell[1]), (244, 244, 244, 255))
    draw = ImageDraw.Draw(sheet)
    for i, (label, img) in enumerate(candidates):
        canvas = Image.new("RGBA", cell, (255, 255, 255, 255))
        thumb = img.copy()
        thumb.thumbnail((205, 280), Image.Resampling.NEAREST)
        canvas.alpha_composite(thumb, ((cell[0] - thumb.width) // 2, 38 + (280 - thumb.height) // 2))
        x = i * cell[0]
        sheet.alpha_composite(canvas, (x, 0))
        draw.text((x + 6, 8), label, fill=(20, 20, 20, 255))
    return sheet


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    labels = []
    built = {}
    for scale in (7, 8, 9):
        for yoff in (250, 290, 330):
            src, head, head_mask, body, full = compose_candidate(scale, yoff)
            key = f"s{scale}_y{yoff}"
            full.save(OUT / f"typeC_manual_candidate_{key}.png")
            labels.append((key, full))
            built[key] = (src, head, head_mask, body, full)

    contact = make_contact(labels)
    contact.convert("RGB").save(OUT / "typeC_manual_candidates.jpg")

    # Chosen candidate: compact body with the least visible neck gap.
    src, head, head_mask, body, full = built["s7_y250"]
    head.save(ROOT / "typeC_head_lock.png")
    body.save(ROOT / "typeC_body_base.png")
    save_pair(full, "typeC_base_inner")
    full.save(OUT / "typeC_base_inner_manual_chosen_transparent.png")
    body.save(OUT / "typeC_body_base_manual_chosen.png")
    head.save(OUT / "typeC_head_lock_manual_chosen.png")

    white = Image.new("RGBA", full.size, (255, 255, 255, 255))
    white.alpha_composite(full)
    white.convert("RGB").save(OUT / "typeC_base_inner_manual_chosen_white.png")
    print(OUT / "typeC_manual_candidates.jpg")


if __name__ == "__main__":
    main()
