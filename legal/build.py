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

ROOT = Path("/app/backend/legal")
ROOT.mkdir(parents=True, exist_ok=True)
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
  <p class="sub">The agreements that govern your use of QuickGig, plus how to delete your account.</p>
  <div class="links">
    <a class="tile" href="./privacy.html">Privacy Policy <span class="arrow">→</span></a>
    <a class="tile" href="./eula.html">End User License Agreement <span class="arrow">→</span></a>
    <a class="tile" href="./delete-account.html">Delete My Account <span class="arrow">→</span></a>
  </div>
  <footer>© QuickGig · Operated by Shannon Garrison · Hiawassee, GA · USA</footer>
</main>
</body>
</html>
"""


def delete_account_html() -> str:
    return """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="index, follow">
<title>Delete My Account — QuickGig</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    background: #FAFAFA;
    color: #111827;
    line-height: 1.55;
    -webkit-text-size-adjust: 100%;
  }
  header {
    background: linear-gradient(135deg, #FF5A5F 0%, #FF8C42 100%);
    color: #fff;
    padding: 32px 24px 28px;
  }
  header .wrap { max-width: 760px; margin: 0 auto; }
  header .brand {
    display: inline-block;
    font-weight: 800;
    letter-spacing: 0.6px;
    font-size: 12px;
    background: rgba(255,255,255,0.18);
    padding: 4px 10px;
    border-radius: 999px;
    margin-bottom: 12px;
  }
  header h1 { margin: 0 0 4px; font-size: 28px; letter-spacing: -0.4px; }
  header p.sub { margin: 0; opacity: 0.92; font-size: 14px; }
  main { max-width: 760px; margin: 0 auto; padding: 28px 24px 64px; }
  .card {
    background: #fff;
    border: 1px solid #E5E7EB;
    border-radius: 14px;
    padding: 24px;
    box-shadow: 0 2px 6px rgba(0,0,0,0.03);
    margin-bottom: 16px;
  }
  .step {
    display: flex;
    gap: 14px;
    align-items: flex-start;
    padding: 12px 0;
  }
  .num {
    flex-shrink: 0;
    width: 28px; height: 28px;
    border-radius: 14px;
    background: #FF5A5F;
    color: #fff;
    font-weight: 800;
    display: flex; align-items: center; justify-content: center;
    font-size: 14px;
  }
  h2 { font-size: 19px; margin: 0 0 8px; letter-spacing: -0.3px; }
  h3 { font-size: 16px; margin: 0 0 4px; letter-spacing: -0.2px; }
  p { margin: 0 0 8px; }
  ul { margin: 6px 0 0 0; padding-left: 22px; }
  li { margin-bottom: 4px; }
  a.btn {
    display: inline-block;
    background: #B91C1C;
    color: #fff !important;
    text-decoration: none;
    font-weight: 700;
    padding: 12px 18px;
    border-radius: 10px;
    margin-top: 8px;
  }
  a.btn:hover { background: #991b1b; }
  .tag {
    display: inline-block;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.6px;
    padding: 3px 8px;
    border-radius: 999px;
    margin-bottom: 6px;
  }
  .tag.fast { background: #ECFDF5; color: #065F46; }
  .tag.alt { background: #FEF3C7; color: #92400E; }
  .notice {
    background: #FEF2F2;
    border: 1px solid #FECACA;
    color: #7F1D1D;
    padding: 14px 16px;
    border-radius: 12px;
    font-size: 14px;
  }
  nav.crumbs { font-size: 13px; margin-bottom: 14px; }
  nav.crumbs a { color: #FF5A5F; text-decoration: none; font-weight: 600; }
  nav.crumbs a:hover { text-decoration: underline; }
  footer { text-align: center; color: #6B7280; font-size: 12px; padding: 24px; }
  @media (prefers-color-scheme: dark) {
    body { background: #0F172A; color: #E5E7EB; }
    .card { background: #1F2937; border-color: #334155; box-shadow: none; }
    .notice { background: #3F1D1D; border-color: #7F1D1D; color: #FECACA; }
    footer { color: #94A3B8; }
  }
</style>
</head>
<body>
<header>
  <div class="wrap">
    <div class="brand">QUICKGIG · ACCOUNT DELETION</div>
    <h1>Delete My QuickGig Account</h1>
    <p class="sub">Two ways to request account deletion. We honour every valid request.</p>
  </div>
</header>
<main>
  <nav class="crumbs"><a href="./index.html">← All legal documents</a></nav>

  <div class="card">
    <span class="tag fast">FASTEST</span>
    <h2>Option 1: Delete from inside the QuickGig app</h2>
    <p>If you can still open the app and log in, this is the quickest way to submit a deletion request:</p>
    <div class="step"><div class="num">1</div><div><strong>Open QuickGig</strong> on your phone and sign in with your account.</div></div>
    <div class="step"><div class="num">2</div><div>Tap the <strong>Profile</strong> tab at the bottom of the screen.</div></div>
    <div class="step"><div class="num">3</div><div>Scroll down and tap <strong>Request Account Deletion</strong>.</div></div>
    <div class="step"><div class="num">4</div><div>(Optional) Tell us why you're leaving, then tap <strong>Submit request</strong>.</div></div>
    <div class="step"><div class="num">5</div><div>An admin will review and process your request, usually within 30 days. You can cancel the request from the same screen at any time before it's processed.</div></div>
  </div>

  <div class="card">
    <span class="tag alt">CAN'T ACCESS THE APP?</span>
    <h2>Option 2: Email us</h2>
    <p>If you can't open the app or have lost access to your account, email us from the email address registered on your account:</p>
    <p style="margin-top:14px;"><a class="btn" href="mailto:support@quickgig.app?subject=Account%20Deletion%20Request&amp;body=Please%20delete%20my%20QuickGig%20account.%0A%0AAccount%20email%3A%20%0AReason%20(optional)%3A%20">Email support@quickgig.app</a></p>
    <p style="margin-top:14px;font-size:13px;color:#6B7280;">We will verify your identity and confirm the request before processing. We respond within 30 days.</p>
  </div>

  <div class="card">
    <h2>What happens when we process your request</h2>
    <p>When an admin approves a deletion request, the following data tied to your account is permanently and irreversibly anonymized or removed:</p>
    <h3 style="margin-top:14px;">Removed / wiped</h3>
    <ul>
      <li>Your name (replaced with "Deleted User")</li>
      <li>Your email address (replaced with a non-functional placeholder)</li>
      <li>Your phone number, profile photo, bio, and address</li>
      <li>Your password (login is permanently disabled)</li>
      <li>Any push-notification tokens linked to your account</li>
      <li>Your Pro / Background-Check / Boost flags</li>
    </ul>
    <h3 style="margin-top:14px;">Cancelled</h3>
    <ul>
      <li>Any jobs you posted that are still open or in-progress are automatically cancelled</li>
    </ul>
    <h3 style="margin-top:14px;">Kept (for the OTHER party's history only)</h3>
    <ul>
      <li>Past completed-job records, ratings and reviews you gave or received, and chat messages from completed jobs — these stay in the system showing "Deleted User" so the user(s) you worked with retain an accurate history</li>
      <li>Payment records as required by tax/financial law (typically 7 years)</li>
    </ul>
  </div>

  <div class="card notice">
    <strong>Heads up:</strong> account deletion is irreversible. Once your account is anonymized, you cannot log back in with the same email — you'd need to register a brand-new account from scratch. If you only want to take a break, you can simply uninstall the app instead.
  </div>

  <p style="margin-top:18px;font-size:13px;color:#6B7280;">Full details of what we collect and how long we keep it are in our <a href="./privacy.html" style="color:#FF5A5F;font-weight:600;">Privacy Policy</a> (sections 7 and 8).</p>
</main>
<footer>© QuickGig · Operated by Shannon Garrison · 112 Titus Valley Rd., Hiawassee, GA 30545 · USA</footer>
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
    (ROOT / "delete-account.html").write_text(delete_account_html(), encoding="utf-8")
    print("Wrote:")
    for f in ("index.html", "privacy.html", "eula.html", "delete-account.html"):
        p = ROOT / f
        print(f"  {p}  ({p.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
