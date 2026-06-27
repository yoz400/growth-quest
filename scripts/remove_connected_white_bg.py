from collections import deque
from pathlib import Path

from PIL import Image


FILES = [
    ("adventurer-a-cape-extended.png", "adventurer-a-cape-extended-transparent.png"),
    ("adventurer-b-crop-fixed.png", "adventurer-b-crop-fixed-transparent.png"),
    ("adventurer-c-crop-fixed.png", "adventurer-c-crop-fixed-transparent.png"),
]

THRESHOLD = 200


def is_background(pixel):
    r, g, b, a = pixel
    return a > 0 and r >= THRESHOLD and g >= THRESHOLD and b >= THRESHOLD


def remove_connected_white_background(source, destination):
    image = Image.open(source).convert("RGBA")
    width, height = image.size
    pixels = image.load()
    queue = deque()
    seen = set()

    for x in range(width):
        for y in (0, height - 1):
            if is_background(pixels[x, y]):
                queue.append((x, y))
                seen.add((x, y))

    for y in range(height):
        for x in (0, width - 1):
            if (x, y) not in seen and is_background(pixels[x, y]):
                queue.append((x, y))
                seen.add((x, y))

    while queue:
        x, y = queue.popleft()
        r, g, b, _ = pixels[x, y]
        pixels[x, y] = (r, g, b, 0)

        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < width and 0 <= ny < height and (nx, ny) not in seen:
                if is_background(pixels[nx, ny]):
                    seen.add((nx, ny))
                    queue.append((nx, ny))

    image.save(destination)
    return image.size, len(seen)


def main():
    root = Path(__file__).resolve().parents[1]
    for source_name, destination_name in FILES:
        size, transparent_pixels = remove_connected_white_background(
            root / source_name,
            root / destination_name,
        )
        print(f"{destination_name}: {size[0]}x{size[1]}, transparent={transparent_pixels}")


if __name__ == "__main__":
    main()
