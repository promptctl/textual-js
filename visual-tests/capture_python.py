#!/usr/bin/env python3
"""
Capture snapshots from Python Textual fixtures.

Runs each fixture app headlessly at a fixed terminal size, then saves:
  - An SVG screenshot (for visual comparison)
  - A styled cell grid (for automated style-aware diff)
  - A plain-text grid (diagnostic only)

Must be run via uv from the visual-tests directory:
    uv run python capture_python.py [fixture_name]
"""

from __future__ import annotations

import asyncio
import importlib.util
import json
import sys
from pathlib import Path
from typing import Any

import textual  # noqa: F401
from rich.cells import cell_len

FIXTURES_DIR = Path(__file__).parent / "fixtures"
SNAPSHOTS_DIR = Path(__file__).parent / "snapshots" / "python"

TERMINAL_WIDTH = 80
TERMINAL_HEIGHT = 24


def discover_fixtures() -> list[Path]:
    manifest = json.loads((Path(__file__).parent / "fixtures.json").read_text())
    return [FIXTURES_DIR / f"{name}.py" for name in sorted(manifest)]


def load_fixture(path: Path):
    spec = importlib.util.spec_from_file_location(path.stem, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def normalize_color(color: Any) -> str | None:
    if color is None:
      return None

    if getattr(color, "is_default", False):
      return None

    triplet = getattr(color, "triplet", None)
    if triplet is not None:
      return triplet.hex.lower()

    number = getattr(color, "number", None)
    if number is not None:
      return f"standard:{number}" if number < 16 else f"eight-bit:{number}"

    name = getattr(color, "name", None)
    return None if name in (None, "default") else str(name).lower()


def style_to_state(style: Any) -> dict[str, Any]:
    return {
      "foreground": normalize_color(getattr(style, "color", None)) if style is not None else None,
      "background": normalize_color(getattr(style, "bgcolor", None)) if style is not None else None,
      "bold": bool(getattr(style, "bold", False)) if style is not None else False,
      "dim": bool(getattr(style, "dim", False)) if style is not None else False,
      "italic": bool(getattr(style, "italic", False)) if style is not None else False,
      "underline": bool(getattr(style, "underline", False)) if style is not None else False,
      "strikethrough": bool(getattr(style, "strike", False)) if style is not None else False,
      "inverse": bool(getattr(style, "reverse", False)) if style is not None else False,
    }


def create_cell(text: str, style: dict[str, Any], continuation: bool = False) -> dict[str, Any]:
    return {
      "text": text,
      "continuation": continuation,
      **style,
    }


def is_default_blank_cell(cell: dict[str, Any] | None) -> bool:
    return cell == {
      "text": " ",
      "foreground": None,
      "background": None,
      "bold": False,
      "dim": False,
      "italic": False,
      "underline": False,
      "strikethrough": False,
      "inverse": False,
      "continuation": False,
    }


def trim_row(row: list[dict[str, Any]]) -> list[dict[str, Any]]:
    trimmed = row[:]
    while is_default_blank_cell(trimmed[-1] if trimmed else None):
        trimmed.pop()
    return trimmed


def trim_rows(rows: list[list[dict[str, Any]]]) -> list[list[dict[str, Any]]]:
    trimmed = [trim_row(row) for row in rows]
    while trimmed and not trimmed[-1]:
        trimmed.pop()
    return trimmed


def strips_to_styled_grid(strips: list[Any]) -> dict[str, list[list[dict[str, Any]]]]:
    rows: list[list[dict[str, Any]]] = []

    for strip in strips:
        row: list[dict[str, Any]] = []

        for segment in strip._segments:
            style = style_to_state(segment.style)

            for glyph in segment.text:
                width = cell_len(glyph)

                if width == 0:
                    if row:
                        row[-1]["text"] += glyph
                    continue

                row.append(create_cell(glyph, style))
                for _ in range(1, width):
                    row.append(create_cell("", style, continuation=True))

        rows.append(row)

    return {"rows": trim_rows(rows)}


def styled_grid_to_text(styled_grid: dict[str, list[list[dict[str, Any]]]]) -> str:
    return "\n".join(
        "".join(cell["text"] for cell in row if not cell["continuation"])
        for row in styled_grid["rows"]
    )


async def capture_fixture(fixture_path: Path) -> None:
    name = fixture_path.stem
    print(f"  Capturing: {name}")

    module = load_fixture(fixture_path)
    app_class = module.app
    app = app_class()

    svg_path = SNAPSHOTS_DIR / f"{name}.svg"
    json_path = SNAPSHOTS_DIR / f"{name}.json"
    txt_path = SNAPSHOTS_DIR / f"{name}.txt"

    async with app.run_test(size=(TERMINAL_WIDTH, TERMINAL_HEIGHT), tooltips=True, headless=False) as pilot:
        await pilot.pause()

        if hasattr(module, "capture"):
            await module.capture(pilot)

        svg_path.write_text(app.export_screenshot())

        strips = app.screen._compositor.render_strips()
        styled_grid = strips_to_styled_grid(strips)
        text_grid = styled_grid_to_text(styled_grid)

        json_path.write_text(json.dumps(styled_grid, indent=2) + "\n")
        txt_path.write_text(text_grid + ("\n" if text_grid else ""))

    print(f"    -> {svg_path.relative_to(Path(__file__).parent)}")
    print(f"    -> {json_path.relative_to(Path(__file__).parent)}")
    print(f"    -> {txt_path.relative_to(Path(__file__).parent)}")


async def main(fixture_filter: str | None = None) -> None:
    SNAPSHOTS_DIR.mkdir(parents=True, exist_ok=True)

    fixtures = discover_fixtures()
    if fixture_filter:
        fixtures = [f for f in fixtures if f.stem == fixture_filter]
        if not fixtures:
            print(f"No fixture found matching: {fixture_filter}")
            sys.exit(1)

    print(f"Capturing {len(fixtures)} Python Textual fixture(s)...\n")

    for fixture_path in fixtures:
        await capture_fixture(fixture_path)

    print(f"\nDone. Snapshots in: {SNAPSHOTS_DIR.relative_to(Path(__file__).parent)}/")


if __name__ == "__main__":
    fixture_name = sys.argv[1] if len(sys.argv) > 1 else None
    asyncio.run(main(fixture_name))
