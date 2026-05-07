#!/usr/bin/env python3
"""Generate hostable HTML versions of QuickGig's EULA and Privacy Policy.

Reads the canonical text directly from
    /app/frontend/src/eulaText.ts
    /app/frontend/src/privacyText.ts
so the hosted pages always match what's in the app.

Usage:
    python3 /app/legal/build.py
Outputs:
    /app/legal/index.html
    /app/legal/privacy.html
    /app/legal/eula.html
Then upload the entire /app/legal folder to your host (GitHub Pages,
Netlify drop, Cloudflare Pages, etc.).
"""
import re
from pathlib import Path
from html import escape

ROOT = Path(__file__).resolve().parent
SRC = Path("/app/frontend/src")


def extract_block(ts_path: Path, const_name: str) -> str:
    """Pull the body of `export const NAME = \\`...\\`;` out of a .ts file."""
    text = ts_path.read_text(encoding="utf-8")
    pattern = rf"export const {const_name}\s*=\s*`(.*?)`;"
    m = re.search(pattern, text, re.DOTALL)
    if not m:
        raise RuntimeError(f"Could not find {const_name} in {ts_path}")
    body = m.group(1)
    # Strip ${VAR} interpolations — replace with the variable's value.
    for var_match in re.finditer(r"\$\{(\w+)\}", body):
        var = var_match.group(1)
        v_pat = rf'export const {var}\s*=\s*"([^"]*)";'
        v = re.search(v_pat, text)
        if v:
            body = body.replace(var_match.group(0), v.group(1))
    return body


def text_to_html(plain: str, title: str) -> str:
    """Wrap a plain-text legal doc in clean, store-reviewer-friendly HTML."""
    safe = escape(plain)
    # Bold standalone numbered headings (e.g., "1. THE SERVICE")
    safe = re.sub(
        r"^(\d{1,2}\. [A-Z][A-Z &\-/&,'’]+)$",
        r"<strong>\1</strong>",
        safe,
        flags=re.MULTILINE,
    )
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="index, follow">
<title>{escape(title)} — QuickGig</title>
<style>
  :root {{ color-scheme: light; }}
  * {{ box-sizing: border-box; }}
  body {{
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    background: #FAFAFA;
    color: #111827;
    line-height: 1.55;
    -webkit-text-size-adjust: 100%;
  }}
  header {{
    background: linear-gradient(135deg, #FF5A5F 0%, #FF8C42 100%);
    color: #fff;
    padding: 32px 24px 28px;
  }}
  header .wrap {{ max-width: 760px; margin: 0 auto; }}
  header .brand {{
    display: inline-block;
    font-weight: 800;
    letter-spacing: 0.6px;
    font-size: 12px;
    background: rgba(255,255,255,0.18);
    padding: 4px 10px;
    border-radius: 999px;
    margin-bottom: 12px;
  }}
  header h1 {{ margin: 0 0 4px; font-size: 28px; letter-spacing: -0.4px; }}
  header p.sub {{ margin: 0; opacity: 0.92; font-size: 14px; }}
  main {{ max-width: 760px; margin: 0 auto; padding: 28px 24px 64px; }}
  pre.doc {{
    white-space: pre-wrap;
    word-wrap: break-word;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 15px;
    background: #fff;
    border: 1px solid #E5E7EB;
    border-radius: 14px;
    padding: 24px;
    box-shadow: 0 2px 6px rgba(0,0,0,0.03);
  }}
  pre.doc strong {{ color: #111827; font-size: 16px; }}
  nav.crumbs {{ font-size: 13px; margin-bottom: 14px; }}
  nav.crumbs a {{ color: #FF5A5F; text-decoration: none; font-weight: 600; }}
  nav.crumbs a:hover {{ text-decoration: underline; }}
  footer {{
    text-align: center;
    color: #6B7280;
    font-size: 12px;
    padding: 24px;
  }}
  @media (prefers-color-scheme: dark) {{
    body {{ background: #0F172A; color: #E5E7EB; }}
    pre.doc {{ background: #1F2937; border-color: #334155; box-shadow: none; }}
    pre.doc strong {{ color: #F9FAFB; }}
    footer {{ color: #94A3B8; }}
  }}
</style>
</head>
<body>
<header>
  <div class="wrap">
    <div class="brand">QUICKGIG · LEGAL</div>
    <h1>{escape(title)}</h1>
    <p class="sub">QuickGig — Post small jobs. Earn fast cash. All in your neighborhood.</p>
  </div>
</header>
<main>
  <nav class="crumbs">
    <a href="./index.html">← All legal documents</a>
  </nav>
  <pre class="doc">{safe}</pre>
</main>
<footer>
  © QuickGig · Operated by Shannon Garrison · Hiawassee, GA · USA
</footer>
</body>
</html>
"""


def index_html() -> str:
    return """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>QuickGig — Legal Documents</title>
<style>
  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: linear-gradient(135deg, #FF5A5F 0%, #FF8C42 100%);
    color: #fff;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }
  .card {
    background: #fff;
    color: #111827;
    border-radius: 22px;
    padding: 36px 32px;
    max-width: 480px;
    width: 100%;
    box-shadow: 0 20px 50px rgba(0,0,0,0.18);
  }
  .tag {
    display: inline-block;
    font-weight: 800;
    letter-spacing: 0.6px;
    font-size: 11px;
    background: #FFF1F1;
    color: #B91C1C;
    padding: 4px 10px;
    border-radius: 999px;
    margin-bottom: 14px;
  }
  h1 { margin: 0 0 6px; font-size: 30px; letter-spacing: -0.5px; }
  p.sub { margin: 0 0 22px; color: #6B7280; font-size: 14px; line-height: 1.45; }
  .links { display: grid; gap: 12px; }
  a.tile {
    display: flex;
    align-items: center;
    justify-content: space-between;
    text-decoration: none;
    color: #111827;
    border: 1.5px solid #E5E7EB;
    border-radius: 14px;
    padding: 16px 18px;
    font-weight: 700;
    transition: border-color 0.15s, transform 0.15s;
  }
  a.tile:hover {
    border-color: #FF5A5F;
    transform: translateY(-1px);
  }
  a.tile span.arrow { color: #FF5A5F; font-weight: 900; }
  footer { margin-top: 22px; font-size: 12px; color: #6B7280; text-align: center; }
</style>
</head>
<body>
<main class="card">
  <div class="tag">QUICKGIG · LEGAL</div>
  <h1>Legal Documents</h1>
  <p class="sub">The agreements that govern your use of QuickGig.</p>
  <div class="links">
    <a class="tile" href="./privacy.html">Privacy Policy <span class="arrow">→</span></a>
    <a class="tile" href="./eula.html">End User License Agreement <span class="arrow">→</span></a>
  </div>
  <footer>© QuickGig · Operated by Shannon Garrison · Hiawassee, GA · USA</footer>
</main>
</body>
</html>
"""


def main() -> None:
    privacy_text = extract_block(SRC / "privacyText.ts", "PRIVACY_TEXT")
    eula_text = extract_block(SRC / "eulaText.ts", "EULA_TEXT")

    (ROOT / "privacy.html").write_text(
        text_to_html(privacy_text, "Privacy Policy"), encoding="utf-8"
    )
    (ROOT / "eula.html").write_text(
        text_to_html(eula_text, "End User License Agreement"), encoding="utf-8"
    )
    (ROOT / "index.html").write_text(index_html(), encoding="utf-8")
    print("Wrote:")
    for f in ("index.html", "privacy.html", "eula.html"):
        p = ROOT / f
        print(f"  {p}  ({p.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
