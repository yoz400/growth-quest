from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "outputs" / "pet_visuals" / "lantern_bat_storybook"
BASE_SIZE = 256


C = {
    "outline": (45, 33, 48, 255),
    "line_warm": (92, 67, 80, 255),
    "body_deep": (74, 53, 104, 255),
    "body_dark": (103, 73, 146, 255),
    "body": (141, 103, 190, 255),
    "body_light": (189, 151, 231, 255),
    "wing_deep": (55, 76, 132, 255),
    "wing_dark": (76, 105, 169, 255),
    "wing": (112, 154, 215, 255),
    "wing_light": (175, 217, 249, 255),
    "ear_inner": (236, 169, 220, 255),
    "cream": (255, 231, 171, 255),
    "cream_light": (255, 248, 205, 255),
    "glow": (255, 203, 75, 255),
    "glow_light": (255, 250, 177, 255),
    "eye": (31, 27, 35, 255),
    "eye_glint": (255, 255, 246, 255),
    "blush": (229, 126, 152, 255),
    "mouth": (125, 64, 83, 255),
}


def rect(draw, box, fill):
    x0, y0, x1, y1 = box
    draw.rectangle((min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1)), fill=fill)


def ellipse(draw, box, fill, outline=None, width=1):
    draw.ellipse(box, fill=fill, outline=outline, width=width)


def polygon(draw, points, fill, outline=None, width=4):
    draw.polygon(points, fill=fill)
    if outline:
        draw.line(points + [points[0]], fill=outline, width=width, joint="curve")


def line(draw, points, fill, width=2):
    draw.line(points, fill=fill, width=width)


def rounded_rect(draw, box, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def layer_glow(size, ellipses):
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    for box, color in ellipses:
        draw.ellipse(box, fill=color)
    return layer.filter(ImageFilter.GaussianBlur(5))


def draw_storybook_bat():
    img = Image.new("RGBA", (BASE_SIZE, BASE_SIZE), (0, 0, 0, 0))

    # Soft watercolor-like aura, but no background card and no text.
    img.alpha_composite(layer_glow(BASE_SIZE, [
        ((48, 54, 208, 210), (255, 213, 105, 44)),
        ((30, 74, 120, 190), (117, 171, 235, 34)),
        ((136, 70, 230, 190), (180, 136, 232, 30)),
        ((76, 126, 178, 224), (255, 225, 129, 45)),
    ]))
    draw = ImageDraw.Draw(img)

    # Small rounded bat wings. The silhouette stays soft, but avoids looking like a held item.
    polygon(draw, [(111, 105), (87, 76), (56, 65), (35, 82), (27, 115), (45, 134), (39, 163), (67, 149), (88, 161), (101, 139), (112, 154)], C["outline"])
    polygon(draw, [(145, 105), (169, 76), (200, 65), (221, 82), (229, 115), (211, 134), (217, 163), (189, 149), (168, 161), (155, 139), (144, 154)], C["outline"])
    polygon(draw, [(106, 107), (85, 83), (60, 75), (43, 89), (36, 114), (54, 126), (49, 149), (70, 137), (88, 150), (98, 130), (106, 144)], C["wing_dark"])
    polygon(draw, [(150, 107), (171, 83), (196, 75), (213, 89), (220, 114), (202, 126), (207, 149), (186, 137), (168, 150), (158, 130), (150, 144)], C["wing_dark"])
    polygon(draw, [(78, 82), (53, 90), (45, 113), (62, 119), (57, 139), (75, 128), (91, 140), (98, 118)], C["wing"])
    polygon(draw, [(178, 82), (203, 90), (211, 113), (194, 119), (199, 139), (181, 128), (165, 140), (158, 118)], C["wing"])
    rect(draw, (56, 92, 80, 98), C["wing_light"])
    rect(draw, (176, 92, 200, 98), C["wing_light"])
    rect(draw, (55, 128, 78, 135), C["wing_deep"])
    rect(draw, (178, 128, 201, 135), C["wing_deep"])
    line(draw, [(78, 80), (99, 113), (92, 151)], C["line_warm"], width=3)
    line(draw, [(178, 80), (157, 113), (164, 151)], C["line_warm"], width=3)

    # Ears.
    polygon(draw, [(96, 83), (75, 41), (119, 61)], C["outline"])
    polygon(draw, [(99, 79), (82, 50), (114, 64)], C["body"])
    polygon(draw, [(94, 67), (85, 52), (107, 62)], C["ear_inner"])
    rect(draw, (85, 51, 92, 56), C["body_light"])
    polygon(draw, [(160, 83), (181, 41), (137, 61)], C["outline"])
    polygon(draw, [(157, 79), (174, 50), (142, 64)], C["body"])
    polygon(draw, [(162, 67), (171, 52), (149, 62)], C["ear_inner"])
    rect(draw, (165, 51, 172, 56), C["body_light"])

    # Main rounded body. Kept centered with generous margins.
    ellipse(draw, (76, 70, 180, 190), C["outline"])
    ellipse(draw, (83, 77, 173, 184), C["body"])
    rect(draw, (100, 84, 138, 92), C["body_light"])
    rect(draw, (145, 101, 159, 112), C["body_light"])
    rect(draw, (86, 139, 94, 160), C["body_dark"])
    rect(draw, (162, 139, 170, 160), C["body_dark"])

    # Built-in glow patch, like a living lantern organ.
    ellipse(draw, (96, 138, 160, 210), C["outline"])
    ellipse(draw, (102, 143, 154, 202), C["cream"])
    rect(draw, (110, 151, 147, 159), C["cream_light"])
    ellipse(draw, (110, 158, 146, 194), C["glow"])
    rect(draw, (119, 167, 139, 181), C["glow_light"])
    rect(draw, (122, 183, 136, 191), C["glow"])
    rect(draw, (105, 194, 151, 201), C["outline"])
    rect(draw, (116, 194, 141, 196), C["glow_light"])

    # Face: large soft eyes similar to the guide fairy family.
    ellipse(draw, (99, 107, 122, 134), C["eye"])
    rect(draw, (105, 112, 112, 119), C["eye_glint"])
    rect(draw, (114, 125, 119, 130), (79, 67, 92, 255))
    ellipse(draw, (134, 107, 157, 134), C["eye"])
    rect(draw, (140, 112, 147, 119), C["eye_glint"])
    rect(draw, (136, 125, 141, 130), (79, 67, 92, 255))
    rect(draw, (96, 139, 107, 145), C["blush"])
    rect(draw, (150, 139, 161, 145), C["blush"])
    rect(draw, (122, 143, 126, 147), C["mouth"])
    rect(draw, (130, 143, 134, 147), C["mouth"])
    rect(draw, (126, 148, 130, 150), C["mouth"])

    # Tiny feet attached to the body.
    ellipse(draw, (96, 197, 117, 217), C["outline"])
    ellipse(draw, (100, 199, 114, 213), C["body_dark"])
    rect(draw, (101, 207, 114, 213), C["body_light"])
    ellipse(draw, (139, 197, 160, 217), C["outline"])
    ellipse(draw, (142, 199, 156, 213), C["body_dark"])
    rect(draw, (142, 207, 155, 213), C["body_light"])

    # Sparse integrated glow specks. They are aura, not items.
    rect(draw, (73, 185, 77, 188), C["glow_light"])
    rect(draw, (181, 184, 185, 187), C["glow"])
    rect(draw, (190, 162, 192, 164), C["glow_light"])
    rect(draw, (65, 161, 67, 163), C["glow"])

    return img


def make_white(image):
    bg = Image.new("RGBA", image.size, (255, 255, 255, 255))
    bg.alpha_composite(image)
    return bg.convert("RGB")


def save_outputs():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    sprite = draw_storybook_bat()

    outputs = {
        "1024_transparent": OUT_DIR / "pet_003_lantern_bat_storybook_1024_transparent.png",
        "1024_white": OUT_DIR / "pet_003_lantern_bat_storybook_1024_white.png",
        "256_transparent": OUT_DIR / "pet_003_lantern_bat_storybook_256_transparent.png",
        "256_white": OUT_DIR / "pet_003_lantern_bat_storybook_256_white.png",
        "64_transparent": OUT_DIR / "pet_003_lantern_bat_storybook_64_transparent.png",
        "64_white": OUT_DIR / "pet_003_lantern_bat_storybook_64_white.png",
        "source_256": OUT_DIR / "pet_003_lantern_bat_storybook_source_256.png",
    }

    sprite.save(outputs["source_256"])

    for size in (1024, 256, 64):
        if size == BASE_SIZE:
            scaled = sprite
        elif size > BASE_SIZE:
            scaled = sprite.resize((size, size), Image.Resampling.NEAREST)
        else:
            scaled = sprite.resize((size, size), Image.Resampling.NEAREST)
        scaled.save(outputs[f"{size}_transparent"])
        make_white(scaled).save(outputs[f"{size}_white"])

    for path in outputs.values():
        print(path)


if __name__ == "__main__":
    save_outputs()
