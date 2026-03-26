from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

from docx import Document
import tools.render_core as renderer

TITLE_HEADING = "\u6807\u9898"
COVER_HEADING = "\u5c01\u9762"
COVER_TITLE_PREFIX = "\u4e3b\u6807\u9898\uff1a"
COVER_SUBTITLE_PREFIX = "\u526f\u6807\u9898\uff1a"
COVER_POINTS_HEADING = "\u5c01\u9762\u5217\u70b9\uff1a"
COVER_POINTS_HEADING_ALT = "\u5c01\u9762\u5217\u70b9"
CARD_PREFIX = "\u77e5\u8bc6\u5361 "
CARD_TITLE_PREFIX = "\u6807\u9898\uff1a"
CARD_BODY_HEADING = "\u6b63\u6587\u5206\u6bb5\uff1a"
CARD_BODY_HEADING_ALT = "\u6b63\u6587\u5206\u6bb5"
CARD_BODY_HEADING_SHORT = "\u6b63\u6587\uff1a"
CARD_BODY_HEADING_SHORT_ALT = "\u6b63\u6587"
HASHTAG_HEADING = "#\u8bdd\u9898"
CONFIRM_HEADING = "\u786e\u8ba4\u8bf4\u660e"

def normalize_text(value: str) -> str:
    return value.replace("\u3000", " ").strip()


def parse_mark(line: str) -> tuple[str, str]:
    match = re.search(r"raw=(.+?)\s*/\s*render=(.+)", line)
    if not match:
        return "", ""
    return match.group(1).strip(), match.group(2).strip()


def split_cover_point(line: str) -> dict:
    text = normalize_text(line)
    text = re.sub(r"^[•\-]\s*", "", text)
    parts = text.split(" ", 1)
    if len(parts) == 2:
        mark_raw, body = parts
        body = body.strip()
        mark_render = body[:1]
        return {"text": body, "mark_raw": mark_raw.strip(), "mark_render": mark_render}
    return {"text": text, "mark_raw": "", "mark_render": text[:1]}


def strip_leading_number(line: str) -> str:
    return re.sub(r"^\d+\.\s*", "", line).strip()


def parse_review_docx(docx_path: Path) -> dict:
    doc = Document(str(docx_path))
    lines = [normalize_text(p.text) for p in doc.paragraphs if normalize_text(p.text)]

    title = ""
    cover_title = ""
    cover_subtitle = ""
    cover_points: list[dict] = []
    cards: list[dict] = []
    hashtags: list[str] = []
    topic = docx_path.parent.name.split("_", 1)[-1]

    i = 0
    while i < len(lines):
        line = lines[i]
        if line == TITLE_HEADING and i + 1 < len(lines):
            title = lines[i + 1]
            i += 2
            continue
        if line == COVER_HEADING:
            i += 1
            while i < len(lines):
                current = lines[i]
                if current.startswith(COVER_TITLE_PREFIX):
                    cover_title = current.removeprefix(COVER_TITLE_PREFIX).strip()
                elif current.startswith(COVER_SUBTITLE_PREFIX):
                    cover_subtitle = current.removeprefix(COVER_SUBTITLE_PREFIX).strip()
                elif current in {COVER_POINTS_HEADING, COVER_POINTS_HEADING_ALT}:
                    i += 1
                    while i < len(lines) and not lines[i].startswith(CARD_PREFIX):
                        cover_points.append(split_cover_point(lines[i]))
                        i += 1
                    continue
                elif current.startswith(CARD_PREFIX):
                    break
                i += 1
            continue
        if line.startswith(CARD_PREFIX):
            card_id_match = re.search(r"\d+", line)
            card_id = f"{int(card_id_match.group(0)):02d}" if card_id_match else f"{len(cards)+1:02d}"
            title_line = lines[i + 1] if i + 1 < len(lines) else ""
            mark_line = lines[i + 2] if i + 2 < len(lines) else ""
            raw, render = parse_mark(mark_line)
            title_value = title_line.removeprefix(CARD_TITLE_PREFIX).strip() if title_line.startswith(CARD_TITLE_PREFIX) else title_line
            paragraphs: list[str] = []
            i += 3
            if i < len(lines) and lines[i] in {
                CARD_BODY_HEADING,
                CARD_BODY_HEADING_ALT,
                CARD_BODY_HEADING_SHORT,
                CARD_BODY_HEADING_SHORT_ALT,
            }:
                i += 1
            while i < len(lines) and not lines[i].startswith(CARD_PREFIX) and lines[i] != HASHTAG_HEADING and lines[i] != CONFIRM_HEADING:
                paragraphs.append(strip_leading_number(lines[i]))
                i += 1
            cards.append({
                "id": card_id,
                "title": title_value,
                "mark_raw": raw,
                "mark_render": render,
                "paragraphs": paragraphs,
            })
            continue
        if line == HASHTAG_HEADING:
            i += 1
            while i < len(lines) and lines[i] != CONFIRM_HEADING:
                hashtags.append(lines[i].strip())
                i += 1
            continue
        i += 1

    return {
        "topic": topic,
        "title": title,
        "cover": {
            "title": cover_title,
            "subtitle": cover_subtitle,
            "points": cover_points,
        },
        "cards": cards,
        "hashtags": hashtags,
        "render_options": {
            "top_tags": False,
            "bottom_tips": False,
            "closing_page": False,
            "theme_cover_required": True,
        },
    }

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("review_docx", type=Path)
    args = parser.parse_args()

    review_docx = args.review_docx
    pack = parse_review_docx(review_docx)
    out_dir = review_docx.parent
    topic = pack["topic"]

    approved_path = out_dir / "02_approved-note-pack.json"
    approved_path.write_text(json.dumps(pack, ensure_ascii=False, indent=2), encoding="utf-8")

    cover_path = out_dir / f"{topic}-cover.png"
    renderer.render_cover(pack, cover_path)

    card_paths: list[Path] = []
    for card in pack["cards"]:
        card_path = out_dir / f"{topic}-card-{card['id']}.png"
        renderer.render_card(pack, card, card_path)
        card_paths.append(card_path)

    preview_path = out_dir / f"{topic}-preview-grid.png"
    renderer.render_preview([cover_path, *card_paths], preview_path)

    print(approved_path)
    print(cover_path)
    for path in card_paths:
        print(path)
    print(preview_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
