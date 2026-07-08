"""One-off script: generate the QuickGig app icon using Gemini Nano Banana.

Run:  cd /app/backend && python3 scripts/generate_icon.py
Output: /app/frontend/assets/images/icon.png (also copied to
        adaptive-icon.png and favicon.png).
"""
import asyncio
import base64
import os
import shutil
from pathlib import Path

from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage

load_dotenv("/app/backend/.env")

ASSETS_DIR = Path("/app/frontend/assets/images")
ICON_PATH = ASSETS_DIR / "icon.png"
ADAPTIVE_PATH = ASSETS_DIR / "adaptive-icon.png"
FAVICON_PATH = ASSETS_DIR / "favicon.png"

PROMPT = """Create a modern, premium mobile app icon for a brand called QuickGig.

- A single bold uppercase letter "Q" as the central mark.
- Coral to red gradient on the Q, with the primary color being #FF6B6B (vibrant coral-red), fading into a slightly deeper red/orange highlight and a soft warm-cream (#FDFBF7) background.
- The Q should feel confident, friendly and geometric — thick strokes, softly rounded corners, a slightly playful angled tail on the bottom-right of the Q.
- Subtle depth: a very soft inner shadow and a gentle radial glow behind the Q. Do NOT add heavy shadows or 3D bevels.
- No text besides the letter Q. No taglines, no wordmarks, no small subtitle.
- Composition: perfectly centered, with generous safe-zone padding around the Q (the Q should occupy roughly 60–65% of the canvas so it survives iOS/Android icon masking).
- Square 1:1 canvas, corners left square (Android/iOS will apply the rounded mask automatically at launch).
- Style: flat modern with a hint of gradient depth — think Airbnb / Instacart / DoorDash app-icon quality. High contrast so it reads clearly at 48×48 px on a home screen.
- No photorealism, no people, no illustrations, no map pins, no icons — ONLY the stylized letter Q on the warm-cream background.
"""


async def main():
    api_key = os.getenv("EMERGENT_LLM_KEY")
    if not api_key:
        raise RuntimeError("EMERGENT_LLM_KEY missing from /app/backend/.env")

    chat = LlmChat(
        api_key=api_key,
        session_id="quickgig-icon-gen",
        system_message="You generate premium mobile app icons.",
    )
    chat.with_model("gemini", "gemini-3.1-flash-image-preview").with_params(
        modalities=["image", "text"]
    )

    msg = UserMessage(text=PROMPT)
    text, images = await chat.send_message_multimodal_response(msg)
    print("Model text:", (text or "")[:120])
    if not images:
        raise RuntimeError("Gemini returned no images. Response text: " + (text or ""))

    img = images[0]
    print("Got image mime:", img.get("mime_type"))
    image_bytes = base64.b64decode(img["data"])
    ASSETS_DIR.mkdir(parents=True, exist_ok=True)
    with open(ICON_PATH, "wb") as f:
        f.write(image_bytes)
    print(f"Wrote {ICON_PATH} ({len(image_bytes)} bytes)")

    # Copy the same file to adaptive-icon and favicon so all three stay in sync.
    shutil.copyfile(ICON_PATH, ADAPTIVE_PATH)
    shutil.copyfile(ICON_PATH, FAVICON_PATH)
    print(f"Mirrored to {ADAPTIVE_PATH} and {FAVICON_PATH}")


if __name__ == "__main__":
    asyncio.run(main())
