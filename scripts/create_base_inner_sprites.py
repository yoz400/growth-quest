from pathlib import Path

from PIL import Image, ImageChops, ImageFilter


ROOT = Path(__file__).resolve().parents[1]


def open_rgba(name):
    return Image.open(ROOT / name).convert("RGBA")


def alpha_mask(img):
    return img.getchannel("A")


def grow(mask, radius):
    return mask.filter(ImageFilter.MaxFilter(radius * 2 + 1))


def fit_canvas(img, size, offset=None):
    if offset is None:
        offset = ((size[0] - img.width) // 2, (size[1] - img.height) // 2)
    out = Image.new("RGBA", size, (0, 0, 0, 0))
    out.alpha_composite(img, offset)
    return out


def is_skin(r, g, b):
    return r > 150 and 75 < g < 185 and 45 < b < 150 and r > b + 35


def is_dark(r, g, b):
    return r < 58 and g < 52 and b < 52


def tint_pixel(pixel, target, strength=0.9):
    r, g, b, a = pixel
    if a == 0:
        return pixel
    if r < 30 and g < 30 and b < 30:
        return pixel

    lum = 0.299 * r + 0.587 * g + 0.114 * b
    factor = max(0.45, min(1.25, lum / 175))
    nr = int(target[0] * factor)
    ng = int(target[1] * factor)
    nb = int(target[2] * factor)
    nr = max(0, min(255, nr))
    ng = max(0, min(255, ng))
    nb = max(0, min(255, nb))
    return (
        int(r * (1 - strength) + nr * strength),
        int(g * (1 - strength) + ng * strength),
        int(b * (1 - strength) + nb * strength),
        a,
    )


def remove_tiny_parts(img, min_area=120):
    alpha = img.getchannel("A")
    seen = set()
    keep = Image.new("L", img.size, 0)
    ap = alpha.load()
    kp = keep.load()

    for sy in range(img.height):
        for sx in range(img.width):
            if ap[sx, sy] == 0 or (sx, sy) in seen:
                continue
            stack = [(sx, sy)]
            seen.add((sx, sy))
            comp = []
            while stack:
                x, y = stack.pop()
                comp.append((x, y))
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < img.width and 0 <= ny < img.height and (nx, ny) not in seen and ap[nx, ny] > 0:
                        seen.add((nx, ny))
                        stack.append((nx, ny))
            if len(comp) >= min_area:
                for x, y in comp:
                    kp[x, y] = ap[x, y]

    out = img.copy()
    out.putalpha(keep)
    return out


def cut_with_mask(img, mask):
    out = Image.new("RGBA", img.size, (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out


def mask_rect(size, box):
    m = Image.new("L", size, 0)
    px = m.load()
    x1, y1, x2, y2 = box
    for y in range(max(0, y1), min(size[1], y2)):
        for x in range(max(0, x1), min(size[0], x2)):
            px[x, y] = 255
    return m


def type_a_head(src):
    region = mask_rect(src.size, (170, 80, 780, 660))
    mask = ImageChops.multiply(alpha_mask(src), region)
    return cut_with_mask(src, mask)


def type_b_head(src):
    alpha = alpha_mask(src)
    upper = mask_rect(src.size, (245, 70, 930, 645))
    head = ImageChops.multiply(alpha, upper)

    seed = Image.new("L", src.size, 0)
    sp = seed.load()
    px = src.load()
    for y in range(src.height):
        for x in range(src.width):
            r, g, b, a = px[x, y]
            if a == 0 or x < 245:
                continue
            pink_hair = r > 135 and 50 < g < 185 and 70 < b < 190 and r > g + 15 and b > g - 55
            ribbon = y < 470 and r < 125 and g > 55 and b < 120
            gold = y < 470 and r > 135 and g > 80 and b < 105
            if pink_hair or ribbon or gold:
                sp[x, y] = 255

    hair = ImageChops.multiply(alpha, grow(seed, 4))
    mask = ImageChops.lighter(head, hair)
    return remove_tiny_parts(cut_with_mask(src, mask), 160)


def type_c_head(src):
    alpha = alpha_mask(src)
    mask = ImageChops.multiply(alpha, mask_rect(src.size, (150, 70, 880, 710)))
    mp = mask.load()
    for y in range(src.height):
        for x in range(src.width):
            if y > 660 and x > 590:
                mp[x, y] = 0
    return remove_tiny_parts(cut_with_mask(src, mask), 160)


def erase_by_mask(img, mask):
    out = img.copy()
    op = out.load()
    mp = mask.load()
    for y in range(out.height):
        for x in range(out.width):
            if mp[x, y] > 0:
                op[x, y] = (0, 0, 0, 0)
    return out


def recolor_body(img, kind):
    out = img.copy()
    px = out.load()

    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue

            if kind == "A":
                if y < 560:
                    px[x, y] = (0, 0, 0, 0)
                    continue
                if 850 <= y <= 1185 and 295 <= x <= 720:
                    px[x, y] = tint_pixel(px[x, y], (37, 40, 48), 0.94)
                    continue
                if y > 1100 and 265 <= x <= 750:
                    px[x, y] = tint_pixel(px[x, y], (118, 70, 34), 0.65)
                    continue
                if is_skin(r, g, b):
                    continue
                if 535 <= y <= 955 and 210 <= x <= 805:
                    px[x, y] = tint_pixel(px[x, y], (244, 240, 224), 0.9)

            elif kind == "B":
                if y < 570:
                    px[x, y] = (0, 0, 0, 0)
                    continue
                hand_area = (285 <= x <= 395 and 900 <= y <= 1110) or (650 <= x <= 770 and 900 <= y <= 1110)
                if 560 <= y <= 1125 and 245 <= x <= 805:
                    if is_skin(r, g, b) and hand_area:
                        continue
                    px[x, y] = tint_pixel(px[x, y], (247, 243, 228), 0.96)
                    continue
                if 1035 <= y <= 1285 and 350 <= x <= 685:
                    px[x, y] = tint_pixel(px[x, y], (88, 90, 104), 0.9)
                    continue
                if y > 1210 and 340 <= x <= 695:
                    px[x, y] = tint_pixel(px[x, y], (92, 70, 55), 0.7)
                    continue
                if is_skin(r, g, b):
                    continue

            else:
                if y < 625:
                    px[x, y] = (0, 0, 0, 0)
                    continue
                if is_skin(r, g, b):
                    continue
                if 620 <= y <= 980 and 150 <= x <= 850:
                    px[x, y] = tint_pixel(px[x, y], (246, 242, 226), 0.96)
                if 900 <= y <= 1175 and 255 <= x <= 785:
                    px[x, y] = tint_pixel(px[x, y], (57, 67, 90), 0.92)
                if y > 1090 and 260 <= x <= 780:
                    px[x, y] = tint_pixel(px[x, y], (108, 66, 36), 0.75)

    return remove_tiny_parts(out, 140)


def save_pair(sprite, stem):
    sprite.save(ROOT / f"{stem}_transparent.png")
    white = Image.new("RGBA", sprite.size, (255, 255, 255, 255))
    white.alpha_composite(sprite)
    white.convert("RGB").save(ROOT / f"{stem}_white.png")


def make_a():
    src = open_rgba("adventurer-a-cape-extended-transparent.png")
    base = fit_canvas(open_rgba("adventurer-a-villager-transparent.png"), src.size, (-2, 2))
    head = type_a_head(src)
    body = erase_by_mask(recolor_body(base, "A"), alpha_mask(head))
    full = body.copy()
    full.alpha_composite(head)
    return full, head, body


def make_b():
    src = open_rgba("adventurer-b-crop-fixed-transparent.png")
    base = open_rgba("adventurer-b-villager-transparent.png")
    head = type_b_head(src)
    body = erase_by_mask(recolor_body(base, "B"), alpha_mask(head))
    full = body.copy()
    full.alpha_composite(head)
    return full, head, body


def make_c():
    src = open_rgba("adventurer-c-crop-fixed-transparent.png")
    head = type_c_head(src)
    a_src = open_rgba("adventurer-a-cape-extended-transparent.png")
    a_base = fit_canvas(open_rgba("adventurer-a-villager-transparent.png"), a_src.size, (-2, 2))
    a_body = recolor_body(a_base, "A")
    ap = a_body.load()
    for y in range(a_body.height):
        for x in range(a_body.width):
            if y < 560:
                ap[x, y] = (0, 0, 0, 0)
    crop = a_body.crop(a_body.getbbox())
    resized = crop.resize((int(crop.width * 0.78), int(crop.height * 0.78)), Image.Resampling.NEAREST)
    body = Image.new("RGBA", src.size, (0, 0, 0, 0))
    body.alpha_composite(resized, ((src.width - resized.width) // 2, 630))
    body = erase_by_mask(body, alpha_mask(head))
    full = body.copy()
    full.alpha_composite(head)
    return full, head, body


def contact(sprites):
    thumbs = []
    for sprite in sprites:
        thumb = Image.new("RGBA", (330, 470), (255, 255, 255, 255))
        copy = sprite.copy()
        copy.thumbnail((285, 425), Image.Resampling.NEAREST)
        thumb.alpha_composite(copy, ((330 - copy.width) // 2, (470 - copy.height) // 2))
        thumbs.append(thumb)
    sheet = Image.new("RGBA", (990, 470), (255, 255, 255, 255))
    for i, thumb in enumerate(thumbs):
        sheet.alpha_composite(thumb, (i * 330, 0))
    sheet.convert("RGB").save(ROOT / "base_inner_contact.png")


def main():
    raise SystemExit(
        "create_base_inner_sprites.py is disabled because the automatic layer split is not reliable. "
        "See docs/base-inner-root-cause.md before rebuilding base inner sprites."
    )
    makers = {"typeA": make_a, "typeB": make_b, "typeC": make_c}
    sprites = []
    for key, maker in makers.items():
        full, head, body = maker()
        save_pair(full, f"{key}_base_inner")
        head.save(ROOT / f"{key}_head_lock.png")
        body.save(ROOT / f"{key}_body_base.png")
        sprites.append(full)
    contact(sprites)


if __name__ == "__main__":
    main()
