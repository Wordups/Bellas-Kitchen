"""Generate Bella's Kitchen PWA + App Store icons into icons/.

Sizes: 180 (apple-touch), 192, 512, 1024 (App Store).
Tomato-red background, cream "BK" monogram with charcoal drop-shadow,
rounded charcoal border. Safe-zone padding so maskable circle crops survive.
"""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

TOMATO   = (230, 57, 70, 255)
CREAM    = (253, 246, 227, 255)
CHARCOAL = (61, 40, 23, 255)

ROOT = Path(__file__).parent
ICONS = ROOT / "icons"
ICONS.mkdir(exist_ok=True)

def find_font():
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

    d.rectangle([0, 0, size, size], fill=TOMATO)

    border_inset = int(size * 0.10)
    border_w     = max(2, int(size * 0.025))
    d.rounded_rectangle(
        [border_inset, border_inset, size - border_inset, size - border_inset],
        radius=int(size * 0.12),
        outline=CHARCOAL,
        width=border_w,
    )

    text = "BK"
    font_path = find_font()
    font_size = int(size * (0.46 if font_path and "Bungee" in font_path else 0.52))
    font = ImageFont.truetype(font_path, font_size) if font_path else ImageFont.load_default()

    bbox = d.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    tx = (size - tw) / 2 - bbox[0]
    ty = (size - th) / 2 - bbox[1]

    shadow_off = max(1, int(size * 0.012))
    d.text((tx + shadow_off, ty + shadow_off), text, font=font, fill=CHARCOAL)
    d.text((tx, ty), text, font=font, fill=CREAM)

    img.save(out, "PNG", optimize=True)
    print(f"wrote {out} ({size}x{size})")

if __name__ == "__main__":
    make_icon(180,  ICONS / "apple-touch-icon.png")
    make_icon(192,  ICONS / "icon-192.png")
    make_icon(512,  ICONS / "icon-512.png")
    make_icon(1024, ICONS / "icon-1024.png")
