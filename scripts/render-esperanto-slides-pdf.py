#!/usr/bin/env python3
"""
Build presentation PDF: one slide per page, DAATAN palette, from docs/esperanto-lecture-slides.md.
Requires: pandoc, Google Chrome/Chromium (headless).
"""
from __future__ import annotations

import re
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SLIDES_MD = ROOT / "docs" / "esperanto-lecture-slides.md"
OUT_PDF = ROOT / "docs" / "esperanto-lecture-slides.pdf"

CHROME_CANDIDATES = (
    "google-chrome",
    "google-chrome-stable",
    "chromium",
    "chromium-browser",
)


def find_chrome() -> str:
    for name in CHROME_CANDIDATES:
        try:
            subprocess.run(
                ["which", name],
                check=True,
                capture_output=True,
                text=True,
            )
            return name
        except subprocess.CalledProcessError:
            continue
    print("ERROR: No Chrome/Chromium found in PATH.", file=sys.stderr)
    sys.exit(1)


def md_to_html_fragment(md: str) -> str:
    proc = subprocess.run(
        ["pandoc", "-f", "markdown", "-t", "html", "--wrap=none"],
        input=md,
        capture_output=True,
        text=True,
        check=True,
    )
    return proc.stdout.strip()


def split_slides(raw: str) -> list[str]:
    return [p.strip() for p in raw.split("\n---\n") if p.strip()]


def build_html(slides: list[str]) -> str:
    bodies: list[str] = []
    for i, slide_md in enumerate(slides, start=1):
        inner = md_to_html_fragment(slide_md)
        # Hide markdown control headings such as "Glito 1 — Titolo" in final PDF.
        inner = re.sub(
            r'^<h2[^>]*>\s*Glito\s+\d+\s+—.*?</h2>\s*',
            "",
            inner,
            flags=re.IGNORECASE | re.MULTILINE | re.DOTALL,
        )
        bodies.append(
            f'<section class="slide" aria-label="Slido {i}">\n'
            f'<div class="slide-inner">\n{inner}\n</div>\n'
            f'<div class="slide-num">{i} / {len(slides)}</div>\n'
            "</section>"
        )

    return f"""<!DOCTYPE html>
<html lang="eo">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>DAATAN — slido prezento</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"/>
  <style>
    :root {{
      --navy-900: #0B1F33;
      --navy-800: #0E263D;
      --navy-700: #132C45;
      --cobalt: #2F6BFF;
      --cobalt-light: #5B8CFF;
      --mist: #E6E9EF;
      --text-secondary: #A0AEC0;
      --white: #FFFFFF;
    }}
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    @page {{
      size: 13.333in 7.5in;
      margin: 0;
    }}
    html, body {{
      font-family: 'Inter', system-ui, sans-serif;
      background: var(--navy-900);
      color: var(--white);
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }}
    .slide {{
      width: 13.333in;
      height: 7.5in;
      page-break-after: always;
      break-after: page;
      position: relative;
      display: flex;
      align-items: stretch;
      justify-content: center;
      padding: 0.55in 0.65in 0.7in 0.85in;
      background: linear-gradient(145deg, var(--navy-900) 0%, var(--navy-800) 45%, var(--navy-700) 100%);
      border-left: 6px solid var(--cobalt);
    }}
    .slide:last-child {{
      page-break-after: auto;
      break-after: auto;
    }}
    .slide-inner {{
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      min-height: 0;
    }}
    .slide-inner h1 {{
      font-size: 2rem;
      font-weight: 700;
      color: var(--white);
      margin-bottom: 0.35em;
      line-height: 1.15;
    }}
    .slide-inner h2 {{
      font-size: 1.35rem;
      font-weight: 600;
      color: var(--cobalt-light);
      margin-bottom: 0.65em;
      letter-spacing: 0.02em;
    }}
    .slide-inner h1 + p,
    .slide-inner h2 + p {{
      margin-top: 0;
    }}
    .slide-inner p {{
      font-size: 1.05rem;
      color: var(--mist);
      line-height: 1.45;
      margin: 0.4em 0;
      max-width: 95%;
    }}
    .slide-inner ul {{
      margin: 0.35em 0 0 1.1em;
      padding: 0;
    }}
    .slide-inner li {{
      font-size: 1.02rem;
      color: var(--mist);
      line-height: 1.42;
      margin: 0.38em 0;
    }}
    .slide-inner strong {{
      color: var(--white);
      font-weight: 600;
    }}
    .slide-inner a {{
      color: var(--cobalt-light);
      word-break: break-all;
    }}
    .slide-inner ol {{
      margin: 0.35em 0 0 1.2em;
    }}
    .slide-num {{
      position: absolute;
      right: 0.55in;
      bottom: 0.38in;
      font-size: 0.72rem;
      color: var(--text-secondary);
      font-weight: 500;
    }}
    @media print {{
      .slide {{
        margin: 0;
        border: none;
        border-left: 6px solid var(--cobalt);
      }}
    }}
  </style>
</head>
<body>
{chr(10).join(bodies)}
</body>
</html>
"""


def main() -> None:
    if not SLIDES_MD.is_file():
        print(f"ERROR: Missing {SLIDES_MD}", file=sys.stderr)
        sys.exit(1)

    raw = SLIDES_MD.read_text(encoding="utf-8")
    slides = split_slides(raw)
    if not slides:
        print("ERROR: No slides after split/filter.", file=sys.stderr)
        sys.exit(1)

    html = build_html(slides)
    chrome = find_chrome()

    with tempfile.NamedTemporaryFile(
        mode="w",
        suffix=".html",
        delete=False,
        encoding="utf-8",
    ) as f:
        f.write(html)
        tmp_html = Path(f.name)

    try:
        subprocess.run(
            [
                chrome,
                "--headless=new",
                "--disable-gpu",
                "--no-pdf-header-footer",
                f"--print-to-pdf={OUT_PDF}",
                f"file://{tmp_html}",
            ],
            check=True,
            capture_output=True,
            text=True,
        )
    finally:
        tmp_html.unlink(missing_ok=True)

    print(f"Wrote {OUT_PDF} ({len(slides)} slides)")


if __name__ == "__main__":
    main()
