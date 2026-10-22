#!/usr/bin/env python3
"""Build FAQ HTML and FAQPage JSON-LD for each page from faqs.json.

Usage: python3 -I build.py [faqs.json] [out_dir]
Output: <out_dir>/<slug>/faq.html and faq-schema.html (general -> out_dir/general).
"""
import html
import json
import sys
from pathlib import Path

src = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).with_name("faqs.json"))
out = Path(sys.argv[2] if len(sys.argv) > 2 else Path(__file__).with_name("dist"))
data = json.loads(src.read_text(encoding="utf-8"))


def build(slug, page):
    faqs = page["faqs"]
    schema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "@id": page["url"] + "#faq",
        "url": page["url"],
        "mainEntity": [
            {
                "@type": "Question",
                "name": f["q"],
                "acceptedAnswer": {"@type": "Answer", "text": f["a"]},
            }
            for f in faqs
        ],
    }
    rows = [f'<section class="wkh-faq" id="faq">', f"  <h2>{html.escape(page['title'])}</h2>"]
    for f in faqs:
        rows.append(
            f"  <details>\n    <summary>{html.escape(f['q'])}</summary>\n"
            f"    <p>{html.escape(f['a'])}</p>\n  </details>"
        )
    rows.append("</section>")
    d = out / slug
    d.mkdir(parents=True, exist_ok=True)
    (d / "faq.html").write_text("\n".join(rows) + "\n", encoding="utf-8")
    ld = json.dumps(schema, indent=2, ensure_ascii=False)
    (d / "faq-schema.html").write_text(
        f'<script type="application/ld+json">\n{ld}\n</script>\n', encoding="utf-8"
    )
    return len(faqs)


total = build("general", data["general"])
for slug, page in data["projects"].items():
    total += build(slug, page)
print(f"built {1 + len(data['projects'])} pages, {total} questions -> {out}")
