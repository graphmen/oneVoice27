"""Crop verse graphics just above / below the QR code."""

from pathlib import Path

import numpy as np
from PIL import Image

SRC = Path("public/verses")
CORNER = 210
MAX_W = 640
BOTTOM_CROP = 318
TOP_CROP = 333


def qr_score(gray: np.ndarray) -> float:
    bw = gray > np.median(gray)
    ht = float(np.abs(np.diff(bw.astype(np.int16), axis=1)).mean())
    vt = float(np.abs(np.diff(bw.astype(np.int16), axis=0)).mean())
    return min(ht, vt)


def process(path: Path) -> str:
    im = Image.open(path).convert("RGB")
    gray = np.asarray(im.convert("L"))
    h, w = gray.shape
    tr = gray[12 : 12 + CORNER, w - CORNER - 8 : w - 8]
    br = gray[h - CORNER - 12 : h - 12, w - CORNER - 8 : w - 8]
    top_score = qr_score(tr)
    bot_score = qr_score(br)

    top, bottom = 0, h
    if bot_score >= 0.03 and bot_score >= top_score:
        bottom = h - BOTTOM_CROP
        note = "bottom QR"
    elif top_score >= 0.03:
        top = TOP_CROP
        note = "top QR"
    else:
        bottom = h - BOTTOM_CROP
        note = "fallback"

    cropped = im.crop((0, top, w, bottom))
    if cropped.width > MAX_W:
        ratio = MAX_W / cropped.width
        cropped = cropped.resize((MAX_W, round(cropped.height * ratio)), Image.Resampling.LANCZOS)
    cropped.save(path, format="JPEG", quality=86, optimize=True)
    return f"{path.name} -> {cropped.size[0]}x{cropped.size[1]} ({note} top={top_score:.3f} bot={bot_score:.3f})"


def main() -> None:
    for path in sorted(SRC.glob("verse-*.jpg")):
        print(process(path))


if __name__ == "__main__":
    main()
