"""Compose Google Play Store phone screenshots (1080x1920, 9:16 PNG) from raw
device captures.

Run: cd /app/backend && python3 scripts/compose_playstore_screenshots.py
Outputs: /app/frontend/assets/images/screenshots/final/playstore-01..05.png
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

RAW = Path("/app/frontend/assets/images/screenshots/raw")
OUT = Path("/app/frontend/assets/images/screenshots/final")
OUT.mkdir(parents=True, exist_ok=True)

W, H = 1080, 1920  # 9:16
CORAL = (255, 107, 107)
CORAL_DEEP = (233, 78, 78)
CREAM = (253, 251, 247)
CHARCOAL = (46, 42, 46)

FONT_BOLD_PATH = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
FONT_REG_PATH = "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"


def gradient_bg(w, h, top, bottom):
    """Vertical gradient background."""
    base = Image.new("RGB", (w, h), top)
    top_r, top_g, top_b = top
    bot_r, bot_g, bot_b = bottom
    px = base.load()
    for y in range(h):
        t = y / (h - 1)
        r = int(top_r * (1 - t) + bot_r * t)
        g = int(top_g * (1 - t) + bot_g * t)
        b = int(top_b * (1 - t) + bot_b * t)
        for x in range(w):
            px[x, y] = (r, g, b)
    return base


def wrap_text(draw, text, font, max_w):
    words = text.split(" ")
    lines, cur = [], ""
    for w in words:
        test = (cur + " " + w).strip()
        if draw.textlength(test, font=font) <= max_w:
            cur = test
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def make_screenshot(raw_path: Path, out_path: Path, headline: str, subline: str):
    canvas = Image.new("RGB", (W, H), CREAM)

    # --- Top hero band with gradient (occupies top 620px) ---
    band_h = 620
    band = gradient_bg(W, band_h, CORAL, CORAL_DEEP)
    # rounded bottom corners on the band
    mask = Image.new("L", (W, band_h), 255)
    md = ImageDraw.Draw(mask)
    # Cut off bottom-corner arcs so band has a soft bottom edge (not needed for full rect, keep simple)
    canvas.paste(band, (0, 0), mask)

    # Headline text
    draw = ImageDraw.Draw(canvas)
    title_font = ImageFont.truetype(FONT_BOLD_PATH, 82)
    sub_font = ImageFont.truetype(FONT_REG_PATH, 38)

    title_lines = wrap_text(draw, headline, title_font, W - 140)
    y = 130
    for line in title_lines:
        tw = draw.textlength(line, font=title_font)
        draw.text(((W - tw) // 2, y), line, font=title_font, fill=(255, 255, 255))
        y += 100

    if subline:
        y += 15
        sub_lines = wrap_text(draw, subline, sub_font, W - 200)
        for line in sub_lines:
            tw = draw.textlength(line, font=sub_font)
            draw.text(
                ((W - tw) // 2, y), line, font=sub_font, fill=(255, 240, 235)
            )
            y += 48

    # --- Phone frame in the middle-lower area ---
    phone = Image.open(raw_path).convert("RGB")

    # Scale phone so height ~= 1180, keeping aspect
    target_h = 1180
    scale = target_h / phone.height
    new_w = int(phone.width * scale)
    phone_resized = phone.resize((new_w, target_h), Image.LANCZOS)

    # Round the phone corners (radius ~44)
    radius = 48
    mask = Image.new("L", phone_resized.size, 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle(
        [(0, 0), phone_resized.size], radius=radius, fill=255
    )

    # Drop shadow
    shadow = Image.new("RGBA", (new_w + 60, target_h + 60), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle(
        [(30, 30), (new_w + 30, target_h + 30)],
        radius=radius,
        fill=(0, 0, 0, 90),
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=18))

    phone_x = (W - new_w) // 2
    phone_y = band_h - 120  # phone overlaps the band by 120px

    canvas.paste(shadow, (phone_x - 30, phone_y - 15), shadow)
    canvas.paste(phone_resized, (phone_x, phone_y), mask)

    # --- Bottom wordmark ---
    brand_font = ImageFont.truetype(FONT_BOLD_PATH, 52)
    brand_text = "QuickGig"
    bw = draw.textlength(brand_text, font=brand_font)
    draw.text(
        ((W - bw) // 2, H - 100), brand_text, font=brand_font, fill=CORAL_DEEP
    )

    canvas.save(out_path, "PNG", optimize=True)
    print(f"Saved {out_path}")


shots = [
    ("01-welcome.jpeg", "playstore-01-welcome.png",
     "Neighbors helping neighbors.",
     "Post small jobs. Earn fast cash. All in your neighborhood."),
    ("02-browse.jpeg", "playstore-02-browse.png",
     "Find work nearby.",
     "Filter local gigs by distance, category or price."),
    ("03-post.jpeg", "playstore-03-post.png",
     "Post a gig in 60 seconds.",
     "Set your budget. Pick a category. Get help today."),
    ("05-profile.jpeg", "playstore-04-profile.png",
     "Build trust every gig.",
     "Two-way star ratings. ID Verified badges. Real reputation."),
    ("06-upgrade.jpeg", "playstore-05-upgrade.png",
     "Go Pro. Win more gigs.",
     "Priority placement in search. 3× more accepted jobs."),
]

for src, dst, headline, subline in shots:
    src_p = RAW / src
    dst_p = OUT / dst
    if not src_p.exists():
        print(f"skip missing {src_p}")
        continue
    make_screenshot(src_p, dst_p, headline, subline)

print("\nAll done. Outputs in:", OUT)
