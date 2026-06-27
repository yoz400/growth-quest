from pathlib import Path
import shutil

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "outputs" / "pet_visuals" / "image２.png"
ASSET_ROOT = ROOT / "assets" / "otomon" / "tomoshibi_bat"

PATHS = {
    "original": ASSET_ROOT / "source" / "tomoshibi_bat_original.png",
    1024: ASSET_ROOT / "1024" / "tomoshibi_bat_1024.png",
    256: ASSET_ROOT / "256" / "tomoshibi_bat_256.png",
    64: ASSET_ROOT / "64" / "tomoshibi_bat_64.png",
}


def alpha_bbox(image, threshold=8):
    alpha = image.getchannel("A")
    mask = alpha.point(lambda p: 255 if p >= threshold else 0)
    return mask.getbbox()


def clean_alpha(image, threshold=8):
    rgba = image.convert("RGBA")
    r, g, b, a = rgba.split()
    a = a.point(lambda p: 0 if p < threshold else p)
    return Image.merge("RGBA", (r, g, b, a))


def crop_subject(image):
    cleaned = clean_alpha(image)
    bbox = alpha_bbox(cleaned)
    if not bbox:
        return cleaned

    left, top, right, bottom = bbox
    width = right - left
    height = bottom - top
    pad = max(24, int(max(width, height) * 0.04))

    left = max(0, left - pad)
    top = max(0, top - pad)
    right = min(cleaned.width, right + pad)
    bottom = min(cleaned.height, bottom + pad)
    return cleaned.crop((left, top, right, bottom))


def fit_to_square(subject, size):
    # 64px is tiny, so give it a little more margin to keep the silhouette readable.
    max_ratio = 0.86 if size == 64 else 0.88
    max_side = int(size * max_ratio)
    scale = min(max_side / subject.width, max_side / subject.height)
    new_size = (
        max(1, int(round(subject.width * scale))),
        max(1, int(round(subject.height * scale))),
    )

    resized = subject.resize(new_size, Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    x = (size - resized.width) // 2
    y = (size - resized.height) // 2
    canvas.alpha_composite(resized, (x, y))
    return canvas


def main():
    if not SOURCE.exists():
        raise FileNotFoundError(f"Source image not found: {SOURCE}")

    for path in PATHS.values():
        path.parent.mkdir(parents=True, exist_ok=True)

    shutil.copy2(SOURCE, PATHS["original"])

    original = Image.open(SOURCE).convert("RGBA")
    subject = crop_subject(original)
    for size in (1024, 256, 64):
        fit_to_square(subject, size).save(PATHS[size])

    for label, path in PATHS.items():
        print(f"{label}: {path}")


if __name__ == "__main__":
    main()
