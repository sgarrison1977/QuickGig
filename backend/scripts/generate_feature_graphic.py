"""Generate the Google Play Feature Graphic (1024x500 banner) for QuickGig.

Run: cd /app/backend && python3 scripts/generate_feature_graphic.py
Output: /app/frontend/assets/images/playstore-feature-1024x500.png
"""
import asyncio
import base64
import os
from io import BytesIO
from pathlib import Path

from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage
from PIL import Image

load_dotenv("/app/backend/.env")

OUT = Path("/app/frontend/assets/images/playstore-feature-1024x500.png")

PROMPT = """Design a professional Google Play Store feature graphic banner for a mobile app called "QuickGig".

STRICT COMPOSITION (very important):
- Canvas is a wide horizontal banner, aspect ratio roughly 2:1 (about twice as wide as it is tall).
- LEFT THIRD of the banner: a large, bold, uppercase letter "Q" in a coral-red gradient (#FF6B6B to a slightly deeper red). The Q has thick, softly-rounded strokes and a playful angled tail at bottom-right. It sits centered vertically on the left side.
- CENTER / RIGHT: The wordmark "QuickGig" in a bold, modern, geometric sans-serif typeface (like Poppins Bold, Plus Jakarta Sans, or Cabinet Grotesk), in the same coral-red color, aligned left, large and confident.
- Directly BELOW the "QuickGig" wordmark: a smaller tagline in warm charcoal grey (#333) or muted grey: "Post & find local gigs nearby". About 1/3 the size of the wordmark.
- FAR RIGHT: soft, small decorative icons floating gently — a house outline, a small map pin, a broom, a lawn-mower silhouette, a dollar sign — all in coral-red at low opacity so they don't compete with the text. Arranged in a subtle cluster.
- BACKGROUND: a soft warm-cream (#FDFBF7) with a very subtle coral radial glow behind the Q.
- Overall vibe: friendly, premium, modern, marketplace, DoorDash / TaskRabbit / Airbnb quality.
- NO photos, NO people, NO gradients on the background beyond the soft glow, NO screenshots of a phone.
- The text must be spelled EXACTLY: "QuickGig" (capital Q, capital G) and tagline "Post & find local gigs nearby".
- No border, no frame around the banner.
"""


async def main():
    api_key = os.getenv("EMERGENT_LLM_KEY")
    chat = LlmChat(
        api_key=api_key,
        session_id="quickgig-feature-graphic",
        system_message="You generate high-quality marketing banners for mobile apps.",
    )
    chat.with_model("gemini", "gemini-3.1-flash-image-preview").with_params(
        modalities=["image", "text"]
    )

    msg = UserMessage(text=PROMPT)
    text, images = await chat.send_message_multimodal_response(msg)
    print("Model text:", (text or "")[:100])
    if not images:
        raise RuntimeError("No image returned. text=" + (text or ""))

    img_bytes = base64.b64decode(images[0]["data"])
    src = Image.open(BytesIO(img_bytes)).convert("RGBA")
    print("Generated size:", src.size, src.mode)

    # Force to exactly 1024x500 using cover-crop (fill entire banner, crop excess)
    target_w, target_h = 1024, 500
    src_ratio = src.width / src.height
    tgt_ratio = target_w / target_h

    if src_ratio > tgt_ratio:
        # source too wide -> match height, crop width
        new_h = target_h
        new_w = int(src.width * (target_h / src.height))
        resized = src.resize((new_w, new_h), Image.LANCZOS)
        left = (new_w - target_w) // 2
        cropped = resized.crop((left, 0, left + target_w, target_h))
    else:
        # source too tall -> match width, crop height (center)
        new_w = target_w
        new_h = int(src.height * (target_w / src.width))
        resized = src.resize((new_w, new_h), Image.LANCZOS)
        top = (new_h - target_h) // 2
        cropped = resized.crop((0, top, target_w, top + target_h))

    cropped = cropped.convert("RGB")  # Play Store accepts RGB PNG
    OUT.parent.mkdir(parents=True, exist_ok=True)
    cropped.save(OUT, "PNG", optimize=True)
    print(f"Saved {OUT} {cropped.size}")


if __name__ == "__main__":
    asyncio.run(main())
