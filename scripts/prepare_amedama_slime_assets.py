from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(
    "/Users/hapiyopi/.codex/generated_images/"
    "019ebbf0-63ec-7a60-834f-2e4aa808da05/"
    "ig_0cfe550a0200dab9016a36974446a081918f10ae3a7ed88999.png"
)
ASSET_ROOT = ROOT / "assets" / "otomon" / "amedama_slime"

PATHS = {
    "original": ASSET_ROOT / "source" / "amedama_slime_original.png",
    1024: ASSET_ROOT / "1024" / "amedama_slime_1024.png",
    256: ASSET_ROOT / "256" / "amedama_slime_256.png",
    64: ASSET_ROOT / "64" / "amedama_slime_64.png",
}


def connected_light_background(rgb):
    arr = np.asarray(rgb.convert("RGB"))
    h, w, _ = arr.shape
    channel_max = arr.max(axis=2)
    channel_min = arr.min(axis=2)
    light_neutral = (channel_min >= 214) & ((channel_max - channel_min) <= 38)

    visited = np.zeros((h, w), dtype=bool)
    q = deque()

    for x in range(w):
        if light_neutral[0, x]:
            q.append((0, x))
            visited[0, x] = True
        if light_neutral[h - 1, x]:
            q.append((h - 1, x))
            visited[h - 1, x] = True
    for y in range(h):
        if light_neutral[y, 0] and not visited[y, 0]:
            q.append((y, 0))
            visited[y, 0] = True
        if light_neutral[y, w - 1] and not visited[y, w - 1]:
            q.append((y, w - 1))
            visited[y, w - 1] = True

    while q:
        y, x = q.popleft()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < h and 0 <= nx < w and light_neutral[ny, nx] and not visited[ny, nx]:
                visited[ny, nx] = True
                q.append((ny, nx))

    return visited


def remove_light_background(image):
    rgba = image.convert("RGBA")
    bg = connected_light_background(rgba)
    arr = np.array(rgba)
    arr[bg, 3] = 0

    pale_fringe = (
        (arr[:, :, 3] > 0)
        & (arr[:, :, 0] >= 240)
        & (arr[:, :, 1] >= 240)
        & (arr[:, :, 2] >= 240)
    )
    arr[pale_fringe, 3] = np.minimum(arr[pale_fringe, 3], 70)
    return Image.fromarray(arr, "RGBA")


def crop_subject(image):
    bbox = image.getchannel("A").point(lambda p: 255 if p > 8 else 0).getbbox()
    if not bbox:
        return image
    left, top, right, bottom = bbox
    width = right - left
    height = bottom - top
    pad = max(24, int(max(width, height) * 0.05))
    return image.crop(
        (
            max(0, left - pad),
            max(0, top - pad),
            min(image.width, right + pad),
            min(image.height, bottom + pad),
        )
    )


def fit_to_square(subject, size):
    max_ratio = 0.9 if size == 64 else 0.88
    max_side = int(size * max_ratio)
    scale = min(max_side / subject.width, max_side / subject.height)
    new_size = (
        max(1, int(round(subject.width * scale))),
        max(1, int(round(subject.height * scale))),
    )
    resized = subject.resize(new_size, Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.alpha_composite(resized, ((size - resized.width) // 2, (size - resized.height) // 2))
    return canvas


def main():
    if not SOURCE.exists():
        raise FileNotFoundError(f"Generated source image not found: {SOURCE}")

    for path in PATHS.values():
        path.parent.mkdir(parents=True, exist_ok=True)

    original = Image.open(SOURCE).convert("RGB")
    if original.size != (1024, 1024):
        original = original.resize((1024, 1024), Image.Resampling.LANCZOS)
    original.save(PATHS["original"])

    transparent = remove_light_background(original.convert("RGBA"))
    transparent.save(PATHS[1024])

    subject = crop_subject(transparent)
    for size in (256, 64):
        fit_to_square(subject, size).save(PATHS[size])

    for label, path in PATHS.items():
        print(f"{label}: {path}")


if __name__ == "__main__":
    main()
