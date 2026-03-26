from __future__ import annotations

import json
from pathlib import Path

from write_review_xlsx import write_review_xlsx


ROOT = Path(__file__).resolve().parents[1]
OUTPUTS_DIR = ROOT / "outputs"
PACK_NAME = "02_approved-note-pack.json"


def main() -> int:
    migrated = 0
    for child in OUTPUTS_DIR.iterdir():
        if not child.is_dir():
            continue
        if child.name.startswith("_"):
            continue
        pack_path = child / PACK_NAME
        if not pack_path.exists():
            continue
        if "_" not in child.name:
            continue
        date_text, topic = child.name.split("_", 1)
        payload = json.loads(pack_path.read_text(encoding="utf-8"))
        source = {
            "date": date_text,
            "topic": topic,
            "title": payload.get("title", ""),
            "cover": payload.get("cover", {}),
            "cards": payload.get("cards", []),
            "hashtags": payload.get("hashtags", []),
        }
        out_path = write_review_xlsx(source)
        print(out_path)
        migrated += 1
    print(f"migrated={migrated}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
