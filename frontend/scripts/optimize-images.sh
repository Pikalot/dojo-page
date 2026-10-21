#!/bin/sh
# Regenerates responsive hero images from the original in assets-src/.
# Requires macOS `sips` (built in) and `cwebp` (brew install webp).
# Outputs are committed, so this only needs to run when the source image changes.
set -eu

SRC="assets-src/hero-background.png"
OUT="src/assets/hero"
mkdir -p "$OUT"

for WIDTH in 640 1024 1600; do
  TMP="$OUT/tmp-$WIDTH.png"
  sips --resampleWidth "$WIDTH" "$SRC" --out "$TMP" >/dev/null
  cwebp -quiet -q 72 "$TMP" -o "$OUT/hero-$WIDTH.webp"
  # JPEG fallback for browsers without WebP support.
  sips -s format jpeg -s formatOptions 70 "$TMP" --out "$OUT/hero-$WIDTH.jpg" >/dev/null
  rm "$TMP"
done

ls -lh "$OUT"
