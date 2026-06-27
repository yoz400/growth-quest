from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(
    "/Users/hapiyopi/.codex/generated_images/"
    "019ebbf0-63ec-7a60-834f-2e4aa808da05/"
    "ig_0e1a167aa738bb97016a367698b5c48191b1ef0173f971ff55.png"
)
ASSET_ROOT = ROOT / "assets" / "otomon" / "mame_drako"

PATHS = {
    "original": ASSET_ROOT / "source" / "mame_drako_original.png",
    1024: ASSET_ROOT / "1024" / "mame_drako_1024.png",
    256: ASSET_ROOT / "256" / "mame_drako_256.png",
    64: ASSET_ROOT / "64" / "mame_drako_64.png",
}


def connected_white_background(rgb):
    arr = np.asarray(rgb.convert("RGB"))
    h, w, _ = arr.shape
    near_white = (
        (arr[:, :, 0] >= 244)
        & (arr[:, :, 1] >= 244)
        & (arr[:, :, 2] >= 244)
        & (np.abs(arr[:, :, 0].astype(int) - arr[:, :, 1].astype(int)) < 12)
        & (np.abs(arr[:, :, 0].astype(int) - arr[:, :, 2].astype(int)) < 12)
    )

    visited = np.zeros((h, w), dtype=bool)
    q = deque()

    for x in range(w):
        if near_white[0, x]:
            q.append((0, x))
            visited[0, x] = True
        if near_white[h - 1, x]:
            q.append((h - 1, x))
            visited[h - 1, x] = True
    for y in range(h):
        if near_white[y, 0] and not visited[y, 0]:
            q.append((y, 0))
            visited[y, 0] = True
        if near_white[y, w - 1] and not visited[y, w - 1]:
            q.append((y, w - 1))
            visited[y, w - 1] = True

    while q:
        y, x = q.popleft()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < h and 0 <= nx < w and near_white[ny, nx] and not visited[ny, nx]:
                visited[ny, nx] = True
                q.append((ny, nx))

    return visited


def remove_white_background(image):
    rgba = image.convert("RGBA")
    bg = connected_white_background(rgba)
    arr = np.array(rgba)
    arr[bg, 3] = 0

    fringe = (
        (arr[:, :, 3] > 0)
        & (arr[:, :, 0] >= 250)
        & (arr[:, :, 1] >= 250)
        & (arr[:, :, 2] >= 250)
    )
    arr[fringe, 3] = np.minimum(arr[fringe, 3], 80)
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

    transparent = remove_white_background(original.convert("RGBA"))
    transparent.save(PATHS[1024])

    subject = crop_subject(transparent)
    for size in (256, 64):
        fit_to_square(subject, size).save(PATHS[size])

    for label, path in PATHS.items():
        print(f"{label}: {path}")


if __name__ == "__main__":
    main()
