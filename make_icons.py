"""Generate icon-192.png and icon-512.png for Bella's Kitchen PWA.

Tomato-red background, cream "BK" monogram, charcoal border.
Designed to render well as a maskable icon (safe-zone inside ~80% radius).
"""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import sys

TOMATO   = (230, 57, 70, 255)   # #e63946
CREAM    = (253, 246, 227, 255) # #fdf6e3
CHARCOAL = (61, 40, 23, 255)    # #3d2817

ROOT = Path(__file__).parent

def find_bungee():
    # Try a few likely locations / fallbacks
    candidates = [
        ROOT / "Bungee-Regular.ttf",
        Path("C:/Windows/Fonts/Bungee-Regular.ttf"),
        Path("C:/Windows/Fonts/Impact.ttf"),
        Path("C:/Windows/Fonts/arialbd.ttf"),
    ]
    for c in candidates:
        if c.exists():
            return str(c)
    return None

def make_icon(size: int, out: Path):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # Maskable safe zone: keep visual content inside ~80% of canvas.
    # Background fills the full square (so any mask shape still has color).
    d.rectangle([0, 0, size, size], fill=TOMATO)

    # Charcoal border — sits inside the safe zone so it survives circle masks.
    border_inset = int(size * 0.10)
    border_w     = max(2, int(size * 0.025))
    d.rounded_rectangle(
        [border_inset, border_inset, size - border_inset, size - border_inset],
        radius=int(size * 0.12),
        outline=CHARCOAL,
        width=border_w,
    )

    # Monogram "BK"
    text = "BK"
    font_path = find_bungee()
    # Bungee is wide; tune size for the chosen font.
    font_size = int(size * (0.46 if font_path and "Bungee" in font_path else 0.52))
    if font_path:
        font = ImageFont.truetype(font_path, font_size)
    else:
        font = ImageFont.load_default()

    # Measure with textbbox for accuracy across PIL versions.
    bbox = d.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    # Account for bbox origin offset.
    tx = (size - tw) / 2 - bbox[0]
    ty = (size - th) / 2 - bbox[1]

    # Drop shadow in charcoal for a stamped look.
    shadow_off = max(1, int(size * 0.012))
    d.text((tx + shadow_off, ty + shadow_off), text, font=font, fill=CHARCOAL)
    d.text((tx, ty), text, font=font, fill=CREAM)

    img.save(out, "PNG", optimize=True)
    print(f"wrote {out} ({size}x{size})")

if __name__ == "__main__":
    make_icon(192, ROOT / "icon-192.png")
    make_icon(512, ROOT / "icon-512.png")
