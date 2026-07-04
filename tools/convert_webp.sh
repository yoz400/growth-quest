#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

QUALITY="${WEBP_QUALITY:-85}"
PYTHON_BIN="${PYTHON_BIN:-/Users/hapiyopi/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3}"

if command -v cwebp >/dev/null 2>&1; then
  CONVERTER="cwebp"
else
  CONVERTER="pillow"
fi

echo "WebP conversion"
echo "quality: ${QUALITY}"
echo "converter: ${CONVERTER}"
echo

PNG_FILES=()
while IFS= read -r -d '' file; do
  PNG_FILES+=("$file")
done < <(find assets -name '*.png' -not -path 'assets/icons/*' -print0 | sort -z)

if [ "${#PNG_FILES[@]}" -eq 0 ]; then
  echo "No PNG files found."
  exit 0
fi

BEFORE_BYTES=0
for file in "${PNG_FILES[@]}"; do
  size=$(wc -c < "$file" | tr -d ' ')
  BEFORE_BYTES=$((BEFORE_BYTES + size))
done

if [ "$CONVERTER" = "cwebp" ]; then
  for file in "${PNG_FILES[@]}"; do
    out="${file%.png}.webp"
    cwebp -quiet -q "$QUALITY" "$file" -o "$out"
  done
else
  "$PYTHON_BIN" - "$QUALITY" "${PNG_FILES[@]}" <<'PY'
import sys
from pathlib import Path
from PIL import Image

quality = int(sys.argv[1])
for src in map(Path, sys.argv[2:]):
    dst = src.with_suffix(".webp")
    with Image.open(src) as im:
        if im.mode not in ("RGB", "RGBA"):
            im = im.convert("RGBA" if "A" in im.getbands() else "RGB")
        im.save(dst, "WEBP", quality=quality, method=4)
PY
fi

AFTER_BYTES=0
for file in "${PNG_FILES[@]}"; do
  webp="${file%.png}.webp"
  size=$(wc -c < "$webp" | tr -d ' ')
  AFTER_BYTES=$((AFTER_BYTES + size))
done

"$PYTHON_BIN" - "$BEFORE_BYTES" "$AFTER_BYTES" "${#PNG_FILES[@]}" <<'PY'
import sys

before = int(sys.argv[1])
after = int(sys.argv[2])
count = int(sys.argv[3])
saved = before - after
ratio = (saved / before * 100) if before else 0

def human(n):
    units = ["B", "KB", "MB", "GB"]
    value = float(n)
    for unit in units:
        if value < 1024 or unit == units[-1]:
            return f"{value:.1f}{unit}"
        value /= 1024

print(f"files: {count}")
print(f"png total:  {human(before)}")
print(f"webp total: {human(after)}")
print(f"saved:      {human(saved)} ({ratio:.1f}%)")
PY
