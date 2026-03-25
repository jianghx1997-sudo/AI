from __future__ import annotations

import argparse
import json
import math
import re
from pathlib import Path
from typing import Iterable

from docx import Document
from PIL import Image, ImageDraw, ImageFont

WIDTH = 1080
HEIGHT = 1440
BG = "#F8F0E6"
PANEL = "#FFFDFC"
COFFEE = "#7B3F2A"
ACCENT = "#C98F5A"
TEXT = "#222222"
MUTED = "#7D756E"
LINE = "#E7D6C8"
SLOGAN = "\u628a\u65e5\u5e38\u8bdd\u9898\u8bb2\u660e\u767d\uff0c\u8ba9\u95f2\u804a\u66f4\u6709\u6599"

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
HASHTAG_HEADING = "#\u8bdd\u9898"
CONFIRM_HEADING = "\u786e\u8ba4\u8bf4\u660e"


def safe_font(size: int, bold: bool = False):
    candidates = [
        Path(r"C:\Windows\Fonts\msyhbd.ttc" if bold else r"C:\Windows\Fonts\msyh.ttc"),
        Path(r"C:\Windows\Fonts\simhei.ttf" if bold else r"C:\Windows\Fonts\simsun.ttc"),
    ]
    for path in candidates:
        if path.exists():
            return ImageFont.truetype(str(path), size=size)
    return ImageFont.load_default()


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
            if i < len(lines) and lines[i] in {CARD_BODY_HEADING, CARD_BODY_HEADING_ALT}:
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


def wrap_text(text: str, font, max_width: int, draw: ImageDraw.ImageDraw) -> list[str]:
    lines: list[str] = []
    current = ""
    for ch in text:
        trial = current + ch
        width = draw.textbbox((0, 0), trial, font=font)[2]
        if width <= max_width or not current:
            current = trial
        else:
            lines.append(current)
            current = ch
    if current:
        lines.append(current)
    return lines


def draw_wrapped(draw: ImageDraw.ImageDraw, text: str, xy: tuple[int, int], font, fill: str, max_width: int, line_spacing: int) -> int:
    x, y = xy
    lines = wrap_text(text, font, max_width, draw)
    bbox = draw.textbbox((0, 0), "\u6d4b", font=font)
    line_height = bbox[3] - bbox[1]
    for idx, line in enumerate(lines):
        draw.text((x, y + idx * (line_height + line_spacing)), line, font=font, fill=fill)
    return y + len(lines) * (line_height + line_spacing) - line_spacing


def draw_round_rect(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], radius: int, fill: str, outline: str | None = None, width: int = 1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def draw_slogan(draw: ImageDraw.ImageDraw, prominent: bool = False) -> None:
    if prominent:
        font = safe_font(36, bold=True)
        box = (62, 38, 708, 114)
        draw_round_rect(draw, box, 24, COFFEE)
        draw.text((88, 57), SLOGAN, font=font, fill="#FFF9F2")
    else:
        font = safe_font(23, bold=True)
        box = (56, 22, 522, 72)
        draw_round_rect(draw, box, 17, "#975635")
        draw.text((76, 33), SLOGAN, font=font, fill="#FFF8F1")


def wrap_by_width(text: str, font, max_width: int, draw: ImageDraw.ImageDraw) -> list[str]:
    lines: list[str] = []
    current = ""
    for ch in text:
        trial = current + ch
        width = draw.textbbox((0, 0), trial, font=font)[2]
        if width <= max_width or not current:
            current = trial
        else:
            lines.append(current)
            current = ch
    if current:
        lines.append(current)
    return lines


def render_cover(pack: dict, out_path: Path) -> None:
    img = Image.new("RGB", (WIDTH, HEIGHT), BG)
    draw = ImageDraw.Draw(img)
    title_font = safe_font(74, bold=True)
    subtitle_font = safe_font(42, bold=False)
    point_font = safe_font(34, bold=True)
    badge_font = safe_font(28, bold=True)
    mark_font = safe_font(24, bold=True)

    draw_slogan(draw, prominent=True)
    draw.ellipse((800, 70, 1015, 285), fill="#A95B54")
    draw.ellipse((70, 1140, 240, 1310), fill="#E9D7CC")

    bean_color = "#CDA27D"
    for cx, cy, rx, ry in [(845, 520, 42, 28), (915, 575, 42, 28), (860, 630, 42, 28)]:
        draw.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=bean_color)
        draw.line((cx, cy - ry + 4, cx, cy + ry - 4), fill="#A67C56", width=3)

    cup_x, cup_y = 760, 930
    draw.rounded_rectangle((cup_x, cup_y, cup_x + 180, cup_y + 190), radius=24, fill="#E6C7B1")
    draw.rounded_rectangle((cup_x + 22, cup_y + 30, cup_x + 158, cup_y + 150), radius=18, fill="#FFF4EA")
    draw.rectangle((cup_x + 40, cup_y + 150, cup_x + 140, cup_y + 190), fill="#B07C60")
    draw.ellipse((730, 1110, 970, 1165), fill="#D9B59A")
    for offset in [0, 28, 56]:
        draw.arc((cup_x + 48 + offset, cup_y - 72, cup_x + 84 + offset, cup_y - 8), 180, 360, fill="#D9B59A", width=4)

    title = pack["cover"]["title"]
    subtitle = pack["cover"]["subtitle"]
    if "?" in title:
        first, second = title.split("?", 1)
        title_lines = [first + "?", second]
    else:
        title_lines = wrap_by_width(title, title_font, 620, draw)[:2]
    y = 164
    for line in title_lines:
        draw.text((80, y), line, font=title_font, fill=TEXT)
        y += 92
    draw.text((82, y + 10), subtitle, font=subtitle_font, fill="#7B6E64")

    panel_top = 520
    draw_round_rect(draw, (70, panel_top, 890, 1030), 34, PANEL, outline="#E3CFBF", width=2)
    row_y = panel_top + 70
    points = pack["cover"]["points"]
    for idx, point in enumerate(points, start=1):
        badge = f"{idx:02d}"
        draw.text((110, row_y - 4), badge, font=badge_font, fill=ACCENT)
        mark = point.get("mark_render", "").strip()[:1]
        if mark:
            draw_round_rect(draw, (170, row_y - 14, 222, row_y + 34), 18, "#F2E5DA")
            mark_box = draw.textbbox((0, 0), mark, font=mark_font)
            mark_w = mark_box[2] - mark_box[0]
            draw.text((196 - mark_w / 2, row_y - 2), mark, font=mark_font, fill=COFFEE)
        draw.text((248, row_y - 6), point["text"], font=point_font, fill=TEXT)
        if idx != len(points):
            draw.line((110, row_y + 62, 830, row_y + 62), fill=LINE, width=2)
        row_y += 92

    img.save(out_path)


def render_card(pack: dict, card: dict, out_path: Path) -> None:
    img = Image.new("RGB", (WIDTH, HEIGHT), BG)
    draw = ImageDraw.Draw(img)
    header_font = safe_font(44, bold=True)
    num_font = safe_font(30, bold=True)
    mark_font = safe_font(22, bold=True)
    body_font = safe_font(34, bold=False)

    draw_slogan(draw, prominent=False)
    draw.ellipse((770, 138, 980, 348), fill="#EEE0D4")
    draw.ellipse((80, 1120, 230, 1270), fill="#F3E7DD")

    header_box = (60, 126, 900, 236)
    draw_round_rect(draw, header_box, 30, COFFEE)
    draw_round_rect(draw, (78, 138, 172, 232), 47, "#FFF9F2")
    draw.text((101, 165), card["id"], font=num_font, fill=COFFEE)
    title_text = re.sub(r"\s+[^\u4e00-\u9fffA-Za-z0-9]+$", "", card["title"]).strip()
    render_mark = card.get("mark_render", "").strip()
    title_x = 210
    if render_mark:
        mark_box = (210, 160, 258, 206)
        draw_round_rect(draw, mark_box, 16, "#F2E5DA")
        bbox = draw.textbbox((0, 0), render_mark[:1], font=mark_font)
        mark_w = bbox[2] - bbox[0]
        mark_h = bbox[3] - bbox[1]
        draw.text((234 - mark_w / 2, 183 - mark_h / 2), render_mark[:1], font=mark_font, fill=COFFEE)
        title_x = 278
    draw.text((title_x, 149), title_text, font=header_font, fill="white")

    body_box = (50, 286, 970, 1260)
    draw_round_rect(draw, body_box, 36, PANEL, outline="#E3CFBF", width=2)

    x = 110
    y = 378
    max_width = 820
    line_spacing = 18
    paragraph_gap = 34
    for idx, para in enumerate(card["paragraphs"]):
        y = draw_wrapped(draw, para, (x, y), body_font, TEXT, max_width, line_spacing)
        if idx != len(card["paragraphs"]) - 1:
            y += 22
            draw.line((105, y, 900, y), fill=LINE, width=2)
            y += paragraph_gap

    img.save(out_path)


def render_preview(image_paths: Iterable[Path], out_path: Path) -> None:
    images = [Image.open(path).convert("RGB") for path in image_paths]
    thumb_w = 260
    thumb_h = int(thumb_w * HEIGHT / WIDTH)
    cols = 2
    rows = math.ceil(len(images) / cols)
    gap = 24
    canvas = Image.new("RGB", (cols * thumb_w + (cols + 1) * gap, rows * thumb_h + (rows + 1) * gap), "#1F2528")
    for idx, image in enumerate(images):
        image = image.resize((thumb_w, thumb_h))
        row, col = divmod(idx, cols)
        x = gap + col * (thumb_w + gap)
        y = gap + row * (thumb_h + gap)
        canvas.paste(image, (x, y))
    canvas.save(out_path)


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
    render_cover(pack, cover_path)

    card_paths: list[Path] = []
    for card in pack["cards"]:
        card_path = out_dir / f"{topic}-card-{card['id']}.png"
        render_card(pack, card, card_path)
        card_paths.append(card_path)

    preview_path = out_dir / f"{topic}-preview-grid.png"
    render_preview([cover_path, *card_paths], preview_path)

    print(approved_path)
    print(cover_path)
    for path in card_paths:
        print(path)
    print(preview_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
