from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill

THIS_DIR = Path(__file__).resolve().parent
if str(THIS_DIR) not in sys.path:
    sys.path.insert(0, str(THIS_DIR))

from update_topic_library_links import refresh_topic_library_links


ROOT = Path(__file__).resolve().parents[1]
OUTPUTS_DIR = ROOT / "outputs"
CANONICAL_REVIEW_XLSX = "01_审核稿.xlsx"
SHEET_NAME = "Review"


SECTION_FILL = PatternFill("solid", fgColor="F2E5DA")
TITLE_FILL = PatternFill("solid", fgColor="8C4B2D")
TITLE_FONT = Font(name="Microsoft YaHei", size=12, bold=True, color="FFFFFF")
HEADER_FONT = Font(name="Microsoft YaHei", size=11, bold=True, color="222222")
NORMAL_FONT = Font(name="Microsoft YaHei", size=11, color="222222")
WRAP_TOP = Alignment(vertical="top", wrap_text=True)
WRAP_CENTER = Alignment(vertical="center", wrap_text=True)


def normalize_cover_points(points: list[Any]) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    for point in points:
        if isinstance(point, dict):
            out.append(
                {
                    "text": str(point.get("text", "")).strip(),
                    "mark_raw": str(point.get("mark_raw", "")).strip(),
                    "mark_render": str(point.get("mark_render", "")).strip(),
                }
            )
        elif isinstance(point, str):
            text = point.strip()
            out.append({"text": text, "mark_raw": "", "mark_render": text[:1]})
    return [item for item in out if item["text"]]


def normalize_cards(cards: list[Any]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for idx, card in enumerate(cards, start=1):
        if not isinstance(card, dict):
            continue
        paragraphs = [str(item).strip() for item in card.get("paragraphs", []) if str(item).strip()]
        out.append(
            {
                "id": str(card.get("id", f"{idx:02d}")).strip() or f"{idx:02d}",
                "title": str(card.get("title", "")).strip(),
                "mark_raw": str(card.get("mark_raw", "")).strip(),
                "mark_render": str(card.get("mark_render", "")).strip(),
                "paragraphs": paragraphs[:4],
            }
        )
    return out


def set_col_widths(ws) -> None:
    widths = {
        "A": 12,
        "B": 30,
        "C": 16,
        "D": 16,
        "E": 54,
        "F": 54,
        "G": 54,
        "H": 54,
    }
    for col, width in widths.items():
        ws.column_dimensions[col].width = width


def set_base_style(ws) -> None:
    set_col_widths(ws)
    for row in range(1, 80):
        ws.row_dimensions[row].height = 24
    for row in range(23, 29):
        ws.row_dimensions[row].height = 92


def section_label(ws, cell: str, text: str, fill=SECTION_FILL, font=HEADER_FONT) -> None:
    ws[cell] = text
    ws[cell].fill = fill
    ws[cell].font = font
    ws[cell].alignment = WRAP_CENTER


def write_review_xlsx(source: dict[str, Any]) -> Path:
    date_text = str(source.get("date", "")).strip()
    topic = str(source.get("topic", "")).strip()
    title = str(source.get("title", "")).strip()
    cover = source.get("cover", {}) or {}
    cover_title = str(cover.get("title", "")).strip()
    cover_subtitle = str(cover.get("subtitle", "")).strip()
    cover_points = normalize_cover_points(cover.get("points", []) or [])
    cards = normalize_cards(source.get("cards", []) or [])
    hashtags = [str(tag).strip() for tag in source.get("hashtags", []) if str(tag).strip()]

    if not date_text or not topic:
        raise ValueError("source must contain non-empty date and topic")

    topic_dir = OUTPUTS_DIR / f"{date_text}_{topic}"
    topic_dir.mkdir(parents=True, exist_ok=True)
    out_path = topic_dir / CANONICAL_REVIEW_XLSX

    wb = Workbook()
    ws = wb.active
    ws.title = SHEET_NAME
    set_base_style(ws)

    section_label(ws, "A1", "专题信息", fill=TITLE_FILL, font=TITLE_FONT)
    ws["A2"] = "专题"
    ws["B2"] = topic
    ws["A3"] = "状态"
    ws["B3"] = "待人工确认"
    ws["A4"] = "说明"
    ws["B4"] = "本地审核表格是审核阶段唯一 source of truth。只有在用户明确确认后，才允许进入出图。"
    for cell in ("A2", "A3", "A4"):
        ws[cell].font = HEADER_FONT
        ws[cell].alignment = WRAP_CENTER
    for cell in ("B2", "B3", "B4"):
        ws[cell].font = NORMAL_FONT
        ws[cell].alignment = WRAP_TOP
    ws.row_dimensions[4].height = 42

    section_label(ws, "A6", "标题", fill=TITLE_FILL, font=TITLE_FONT)
    ws["B6"] = title
    ws["B6"].font = NORMAL_FONT
    ws["B6"].alignment = WRAP_TOP

    section_label(ws, "A8", "封面", fill=TITLE_FILL, font=TITLE_FONT)
    ws["A9"] = "主标题"
    ws["B9"] = cover_title
    ws["A10"] = "副标题"
    ws["B10"] = cover_subtitle
    for cell in ("A9", "A10"):
        ws[cell].font = HEADER_FONT
        ws[cell].alignment = WRAP_CENTER
    for cell in ("B9", "B10"):
        ws[cell].font = NORMAL_FONT
        ws[cell].alignment = WRAP_TOP

    section_label(ws, "A12", "封面列点", fill=SECTION_FILL)
    point_headers = [("A13", "序号"), ("B13", "mark_raw"), ("C13", "mark_render"), ("D13", "文本")]
    for cell, text in point_headers:
        ws[cell] = text
        ws[cell].font = HEADER_FONT
        ws[cell].fill = SECTION_FILL
        ws[cell].alignment = WRAP_CENTER
    for idx, point in enumerate(cover_points[:6], start=1):
        row = 13 + idx
        ws[f"A{row}"] = f"{idx:02d}"
        ws[f"B{row}"] = point["mark_raw"]
        ws[f"C{row}"] = point["mark_render"]
        ws[f"D{row}"] = point["text"]
        for col in ("A", "B", "C", "D"):
            ws[f"{col}{row}"].font = NORMAL_FONT
            ws[f"{col}{row}"].alignment = WRAP_TOP

    section_label(ws, "A20", "知识卡", fill=TITLE_FILL, font=TITLE_FONT)
    headers = ["卡片ID", "标题", "mark_raw", "mark_render", "正文1", "正文2", "正文3", "正文4"]
    for idx, text in enumerate(headers, start=1):
        cell = ws.cell(row=22, column=idx)
        cell.value = text
        cell.font = HEADER_FONT
        cell.fill = SECTION_FILL
        cell.alignment = WRAP_CENTER
    for idx, card in enumerate(cards[:6], start=1):
        row = 22 + idx
        ws.cell(row=row, column=1, value=card["id"])
        ws.cell(row=row, column=2, value=card["title"])
        ws.cell(row=row, column=3, value=card["mark_raw"])
        ws.cell(row=row, column=4, value=card["mark_render"])
        for paragraph_index, paragraph in enumerate(card["paragraphs"][:4], start=5):
            ws.cell(row=row, column=paragraph_index, value=paragraph)
        for col in range(1, 9):
            ws.cell(row=row, column=col).font = NORMAL_FONT
            ws.cell(row=row, column=col).alignment = WRAP_TOP

    section_label(ws, "A30", "#话题", fill=TITLE_FILL, font=TITLE_FONT)
    for idx, tag in enumerate(hashtags[:8], start=31):
        ws[f"A{idx}"] = tag
        ws[f"A{idx}"].font = NORMAL_FONT
        ws[f"A{idx}"].alignment = WRAP_TOP

    section_label(ws, "A40", "确认说明", fill=TITLE_FILL, font=TITLE_FONT)
    ws["B40"] = "请直接修改这份本地审核表格。只有在明确说“文稿无误”或“可以出图”后，才允许进入图片阶段。"
    ws["B40"].font = NORMAL_FONT
    ws["B40"].alignment = WRAP_TOP
    ws.row_dimensions[40].height = 48

    wb.save(out_path)
    refresh_topic_library_links()
    return out_path


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("source_json", type=Path)
    args = parser.parse_args()

    source = json.loads(args.source_json.read_text(encoding="utf-8-sig"))
    out_path = write_review_xlsx(source)
    print(out_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
