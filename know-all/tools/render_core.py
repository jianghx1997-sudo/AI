from __future__ import annotations

import math
import re
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageDraw, ImageFont


WIDTH = 1080
HEIGHT = 1440
BG = "#F8F0E6"
PANEL = "#FFFDFC"
COFFEE = "#7B3F2A"
ACCENT = "#C98F5A"
TEXT = "#222222"
LINE = "#E7D6C8"
SLOGAN = (
    "\u628a\u65e5\u5e38\u8bdd\u9898\u8bb2\u660e\u767d\uff0c"
    "\u8ba9\u95f2\u804a\u66f4\u6709\u6599"
)
SAMPLE_CHAR = "\u6d4b"


def safe_font(size: int, bold: bool = False):
    candidates = [
        Path(r"C:\Windows\Fonts\msyhbd.ttc" if bold else r"C:\Windows\Fonts\msyh.ttc"),
        Path(r"C:\Windows\Fonts\simhei.ttf" if bold else r"C:\Windows\Fonts\simsun.ttc"),
    ]
    for path in candidates:
        if path.exists():
            return ImageFont.truetype(str(path), size=size)
    return ImageFont.load_default()


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


def draw_wrapped(
    draw: ImageDraw.ImageDraw,
    text: str,
    xy: tuple[int, int],
    font,
    fill: str,
    max_width: int,
    line_spacing: int,
) -> int:
    x, y = xy
    lines = wrap_text(text, font, max_width, draw)
    bbox = draw.textbbox((0, 0), SAMPLE_CHAR, font=font)
    line_height = bbox[3] - bbox[1]
    for idx, line in enumerate(lines):
        draw.text((x, y + idx * (line_height + line_spacing)), line, font=font, fill=fill)
    return y + len(lines) * (line_height + line_spacing) - line_spacing


def draw_round_rect(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    radius: int,
    fill: str,
    outline: str | None = None,
    width: int = 1,
):
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
    canvas = Image.new(
        "RGB",
        (cols * thumb_w + (cols + 1) * gap, rows * thumb_h + (rows + 1) * gap),
        "#1F2528",
    )
    for idx, image in enumerate(images):
        image = image.resize((thumb_w, thumb_h))
        row, col = divmod(idx, cols)
        x = gap + col * (thumb_w + gap)
        y = gap + row * (thumb_h + gap)
        canvas.paste(image, (x, y))
    canvas.save(out_path)
