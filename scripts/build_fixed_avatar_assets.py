from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "assets" / "avatar"

AVATARS = {
    "a": "adventurer-a-cape-extended-transparent.png",
    "b": "adventurer-b-crop-fixed-transparent.png",
    "c": "adventurer-c-crop-fixed-transparent.png",
}

BODY_PADDING = 24

# Face crops are normalized coordinates within each transparent-trimmed body image.
FACE_CROPS = {
    "a": (0.27, 0.02, 0.74, 0.43),
    "b": (0.28, 0.07, 0.72, 0.51),
    "c": (0.18, 0.05, 0.82, 0.50),
}

B_HAIR_AIR_HOLES = [
    (900, 350, 930, 430),
    (930, 540, 1005, 650),
    (930, 710, 1015, 850),
]


def expand_box(box, padding, width, height):
    left, top, right, bottom = box
    return (
        max(0, left - padding),
        max(0, top - padding),
        min(width, right + padding),
        min(height, bottom + padding),
    )


def trim_transparent(image):
    box = image.getbbox()
    if not box:
        return image
    return image.crop(expand_box(box, BODY_PADDING, *image.size))


def crop_face_square(image, normalized_box):
    width, height = image.size
    left, top, right, bottom = normalized_box
    box = (
        round(left * width),
        round(top * height),
        round(right * width),
        round(bottom * height),
    )
    crop = image.crop(box)

    size = max(crop.size)
    square = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    square.alpha_composite(
        crop,
        ((size - crop.width) // 2, (size - crop.height) // 2),
    )
    return square.resize((256, 256), Image.Resampling.LANCZOS)


def remove_b_hair_gap_whites(image):
    pixels = image.load()
    width, height = image.size
    seen = set()

    for left, top, right, bottom in B_HAIR_AIR_HOLES:
        for y in range(max(0, top), min(height, bottom)):
            for x in range(max(0, left), min(width, right)):
                r, g, b, a = pixels[x, y]
                # These rectangles cover only the enclosed air gaps in B's ponytail.
                # Remove bright/neutral remnants while preserving the pink hair outline.
                if a > 0 and r > 150 and g > 145 and b > 145 and max(r, g, b) - min(r, g, b) < 75:
                    pixels[x, y] = (r, g, b, 0)

    for y in range(height):
        for x in range(width):
            if (x, y) in seen:
                continue

            r, g, b, a = pixels[x, y]
            if not (a > 0 and r > 240 and g > 240 and b > 240):
                continue

            stack = [(x, y)]
            seen.add((x, y))
            points = []

            while stack:
                cx, cy = stack.pop()
                points.append((cx, cy))

                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if 0 <= nx < width and 0 <= ny < height and (nx, ny) not in seen:
                        rr, gg, bb, aa = pixels[nx, ny]
                        if aa > 0 and rr > 240 and gg > 240 and bb > 240:
                            seen.add((nx, ny))
                            stack.append((nx, ny))

            xs = [point[0] for point in points]
            ys = [point[1] for point in points]
            box = (min(xs), min(ys), max(xs) + 1, max(ys) + 1)

            # B's right-side ponytail has two enclosed white background gaps.
            # Restrict this to that hair area so white clothing/highlights stay intact.
            in_ponytail_hole_area = box[0] >= 850 and box[1] >= 300 and box[3] <= 700
            if in_ponytail_hole_area and len(points) > 100:
                for px, py in points:
                    rr, gg, bb, _ = pixels[px, py]
                    pixels[px, py] = (rr, gg, bb, 0)

    return image


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    for key, source_name in AVATARS.items():
        source = Image.open(ROOT / source_name).convert("RGBA")
        body = trim_transparent(source)
        if key == "b":
            body = remove_b_hair_gap_whites(body)
        body_path = OUT_DIR / f"adventurer-{key}-fixed.png"
        body.save(body_path)
        if key == "b":
            (OUT_DIR / "adventurer-b-fixed-v2.png").write_bytes(body_path.read_bytes())

        icon = crop_face_square(body, FACE_CROPS[key])
        icon_path = OUT_DIR / f"adventurer-{key}-face.png"
        icon.save(icon_path)
        if key == "b":
            (OUT_DIR / "adventurer-b-face-v2.png").write_bytes(icon_path.read_bytes())

        print(f"{body_path.relative_to(ROOT)} {body.size}")
        print(f"{icon_path.relative_to(ROOT)} {icon.size}")


if __name__ == "__main__":
    main()
