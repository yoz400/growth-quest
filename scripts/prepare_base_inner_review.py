from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageOps


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


def shape_mask(size, shapes):
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    for kind, data in shapes:
        if kind == "rect":
            draw.rectangle(data, fill=255)
        elif kind == "ellipse":
            draw.ellipse(data, fill=255)
        elif kind == "polygon":
            draw.polygon(data, fill=255)
    return mask


def mask_image(src, mask):
    out = Image.new("RGBA", src.size, (0, 0, 0, 0))
    out.paste(src, (0, 0), ImageChops.multiply(alpha(src), mask))
    return out


def put_on_white(img):
    white = Image.new("RGBA", img.size, (255, 255, 255, 255))
    white.alpha_composite(img)
    return white


def fit_canvas(img, size, offset=(0, 0)):
    out = Image.new("RGBA", size, (0, 0, 0, 0))
    out.alpha_composite(img, offset)
    return out


def is_skin(r, g, b):
    return r > 150 and 70 < g < 190 and 45 < b < 155 and r > b + 32


def keep_line(r, g, b):
    return r < 35 and g < 35 and b < 35


def shade(pixel, target, strength):
    r, g, b, a = pixel
    if a == 0 or keep_line(r, g, b):
        return pixel
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    factor = max(0.55, min(1.18, lum / 175))
    tr, tg, tb = target
    nr = max(0, min(255, int(tr * factor)))
    ng = max(0, min(255, int(tg * factor)))
    nb = max(0, min(255, int(tb * factor)))
    return (
        int(r * (1 - strength) + nr * strength),
        int(g * (1 - strength) + ng * strength),
        int(b * (1 - strength) + nb * strength),
        a,
    )


def recolor_a_body(body):
    out = body.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if y >= 1100:
                px[x, y] = shade(px[x, y], (115, 68, 35), 0.55)
            elif y >= 855:
                px[x, y] = shade(px[x, y], (40, 43, 50), 0.9)
            elif not is_skin(r, g, b):
                px[x, y] = shade(px[x, y], (246, 242, 226), 0.9)
    return out


def recolor_b_body(body):
    out = body.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            hand_zone = (280 <= x <= 395 and 900 <= y <= 1110) or (645 <= x <= 770 and 900 <= y <= 1110)
            if is_skin(r, g, b) and hand_zone:
                continue
            if y >= 1210:
                px[x, y] = shade(px[x, y], (94, 71, 56), 0.65)
            elif y >= 1060:
                px[x, y] = shade(px[x, y], (88, 90, 104), 0.9)
            else:
                px[x, y] = shade(px[x, y], (247, 243, 229), 0.95)
    return out


def recolor_c_piece(piece, x_offset, y_offset):
    out = piece.copy()
    px = out.load()
    for y in range(out.height):
        gy = y + y_offset
        for x in range(out.width):
            gx = x + x_offset
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if is_skin(r, g, b):
                continue
            if gy >= 1160:
                px[x, y] = shade(px[x, y], (112, 70, 38), 0.75)
            elif gy >= 935:
                px[x, y] = shade(px[x, y], (57, 66, 90), 0.92)
            elif 150 <= gx <= 850:
                px[x, y] = shade(px[x, y], (245, 241, 226), 0.95)
    return out


def save_gray(mask, path):
    rgba = Image.new("RGBA", mask.size, (0, 0, 0, 0))
    rgba.putalpha(mask)
    Image.new("RGBA", mask.size, (255, 255, 255, 255)).save(path.with_name(path.stem + "_white_debug.png"))
    mask.save(path)


def save_sprite(sprite, path):
    sprite.save(path)
    put_on_white(sprite).convert("RGB").save(path.with_name(path.stem.replace("_transparent", "_white") + ".png"))


def build_a():
    src = open_rgba("adventurer-a-cape-extended-transparent.png")
    body_src = fit_canvas(open_rgba("adventurer-a-villager-transparent.png"), src.size, (-2, 2))
    head_mask = ImageChops.multiply(alpha(src), rect_mask(src.size, (185, 80, 790, 655)))
    body_mask = ImageChops.multiply(alpha(body_src), shape_mask(src.size, [
        ("polygon", [(225, 560), (760, 560), (735, 1325), (255, 1325)]),
    ]))
    head = mask_image(src, head_mask)
    body = mask_image(body_src, body_mask)
    body = recolor_a_body(body)
    body = clear_overlap(body, head_mask)
    full = body.copy()
    full.alpha_composite(head)
    return src, head_mask, body_mask, head, body, full


def build_b():
    src = open_rgba("adventurer-b-crop-fixed-transparent.png")
    body_src = open_rgba("adventurer-b-villager-transparent.png")
    head_shape = shape_mask(src.size, [
        ("rect", (245, 75, 875, 645)),
        ("polygon", [(640, 120), (1000, 205), (1025, 1025), (880, 1245), (700, 620)]),
        ("ellipse", (545, 95, 870, 430)),
    ])
    head_mask = ImageChops.multiply(alpha(src), head_shape)
    body_shape = shape_mask(src.size, [
        ("polygon", [(275, 570), (790, 570), (805, 1375), (310, 1375)]),
    ])
    body_mask = ImageChops.multiply(alpha(body_src), body_shape)
    head = mask_image(src, head_mask)
    body = mask_image(body_src, body_mask)
    body = recolor_b_body(body)
    body = clear_overlap(body, head_mask)
    full = body.copy()
    full.alpha_composite(head)
    return src, head_mask, body_mask, head, body, full


def build_c():
    src = open_rgba("adventurer-c-crop-fixed-transparent.png")
    head_mask = ImageChops.multiply(alpha(src), rect_mask(src.size, (150, 70, 880, 700)))
    head = mask_image(src, head_mask)

    body = Image.new("RGBA", src.size, (0, 0, 0, 0))

    # Keep type C's own torso, left sleeve, legs, and boots where they are not covered by the book.
    torso_box = (295, 640, 620, 1045)
    left_arm_box = (145, 700, 365, 1070)
    legs_box = (300, 935, 675, 1415)
    for box in (torso_box, left_arm_box, legs_box):
        piece = src.crop(box)
        piece = recolor_c_piece(piece, box[0], box[1])
        body.alpha_composite(piece, box[:2])

    # Rebuild the right sleeve from the left sleeve, instead of keeping the book area.
    arm = src.crop(left_arm_box)
    arm = ImageOps.mirror(arm)
    arm = recolor_c_piece(arm, 665, left_arm_box[1])
    body.alpha_composite(arm, (665, left_arm_box[1]))

    body = clear_overlap(body, head_mask)
    full = body.copy()
    full.alpha_composite(head)
    body_mask = alpha(body)
    return src, head_mask, body_mask, head, body, full


def clear_overlap(img, mask):
    out = img.copy()
    px = out.load()
    mp = mask.load()
    for y in range(out.height):
        for x in range(out.width):
            if mp[x, y] > 0:
                px[x, y] = (0, 0, 0, 0)
    return out


def mask_overlay(src, mask, color):
    base = put_on_white(src).convert("RGBA")
    overlay = Image.new("RGBA", src.size, color)
    alpha_mask = mask.filter(ImageFilter.GaussianBlur(0.5))
    overlay.putalpha(alpha_mask.point(lambda v: int(v * 0.45)))
    base.alpha_composite(overlay)
    return base


def make_review_row(label, src, head_mask, body_mask, head, body, full):
    cell = (230, 330)
    row = Image.new("RGBA", (cell[0] * 6, cell[1]), (244, 244, 244, 255))
    draw = ImageDraw.Draw(row)
    entries = [
        ("source", put_on_white(src)),
        ("head mask", mask_overlay(src, head_mask, (40, 120, 255, 255))),
        ("body mask", mask_overlay(src, body_mask, (255, 80, 40, 255))),
        ("head", put_on_white(head)),
        ("body", put_on_white(body)),
        ("preview", put_on_white(full)),
    ]
    for i, (title, img) in enumerate(entries):
        canvas = Image.new("RGBA", cell, (255, 255, 255, 255))
        im = img.copy()
        im.thumbnail((200, 275), Image.Resampling.NEAREST)
        canvas.alpha_composite(im, ((cell[0] - im.width) // 2, 45 + (275 - im.height) // 2))
        x = i * cell[0]
        row.alpha_composite(canvas, (x, 0))
        draw.text((x + 6, 6), f"{label} {title}", fill=(20, 20, 20, 255))
    return row


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    builders = {"typeA": build_a, "typeB": build_b, "typeC": build_c}
    rows = []
    for key, builder in builders.items():
        src, head_mask, body_mask, head, body, full = builder()
        head_mask.save(OUT / f"{key}_head_mask.png")
        body_mask.save(OUT / f"{key}_body_edit_mask.png")
        head.save(OUT / f"{key}_head_lock_review.png")
        body.save(OUT / f"{key}_body_base_review.png")
        save_sprite(full, OUT / f"{key}_base_inner_review_transparent.png")
        rows.append(make_review_row(key, src, head_mask, body_mask, head, body, full))
    sheet = Image.new("RGBA", (rows[0].width, rows[0].height * len(rows)), (244, 244, 244, 255))
    for i, row in enumerate(rows):
        sheet.alpha_composite(row, (0, i * row.height))
    sheet.convert("RGB").save(OUT / "base_inner_mask_review.jpg")
    print(OUT)


if __name__ == "__main__":
    main()
