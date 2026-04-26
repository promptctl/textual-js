#!/usr/bin/env python3
"""
Capture terminal frames from Python Textual fixtures.

Runs each fixture app headlessly at a fixed terminal size, then saves:
  - An ANSI frame (for window screenshot capture)
  - A styled cell grid (diagnostic only)
  - A plain-text grid (diagnostic only)

Must be run via uv from the visual-tests directory:
    uv run python capture_python.py [fixture_name]
"""

from __future__ import annotations

import asyncio
import argparse
import importlib.util
import json
import sys
from pathlib import Path
from typing import Any

import textual  # noqa: F401
from rich.cells import cell_len
from rich.style import Style

FIXTURES_DIR = Path(__file__).parent / "fixtures"
SNAPSHOTS_DIR = Path(__file__).parent / "snapshots" / "python"
FIXTURE_TODOS_PATH = Path(__file__).parent / "fixture-todos.json"

TERMINAL_WIDTH = 80
TERMINAL_HEIGHT = 24
AMBIENT_BACKGROUNDS = {"#121212"}
AMBIENT_FOREGROUNDS = {"#e0e0e0"}


def discover_todo_names() -> set[str]:
    # [LAW:one-source-of-truth] Python capture reads the shared fixture todo
    # file instead of maintaining a second skip list.
    raw_todos = json.loads(FIXTURE_TODOS_PATH.read_text())

    if not isinstance(raw_todos, list):
        raise ValueError("fixture-todos.json must contain an array")

    todo_names: set[str] = set()
    for index, entry in enumerate(raw_todos):
        if (
            not isinstance(entry, dict)
            or not isinstance(entry.get("name"), str)
            or not isinstance(entry.get("stage"), str)
            or not isinstance(entry.get("component"), str)
            or not isinstance(entry.get("reason"), str)
        ):
            raise ValueError(
                f"fixture-todos.json entry {index} must include name, stage, component, and reason strings"
            )
        todo_names.add(entry["name"])

    return todo_names


def discover_fixtures(include_todos: bool = False) -> list[Path]:
    python_names = {path.stem for path in FIXTURES_DIR.glob("*.py")}
    js_names = {path.stem for path in FIXTURES_DIR.glob("*.tsx")}
    todo_names = discover_todo_names()
    # [LAW:single-enforcer] Todo membership is the only Python capture boundary
    # that admits future baselines without making them active gate fixtures.
    active_names = (python_names & js_names) - todo_names
    baseline_names = active_names | (python_names & todo_names if include_todos else set())
    return [FIXTURES_DIR / f"{name}.py" for name in sorted(baseline_names)]


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
    cell = {
      "text": text,
      "continuation": continuation,
      **style,
    }
    return normalize_ambient_cell(cell)


def normalize_ambient_cell(cell: dict[str, Any]) -> dict[str, Any]:
    normalized = cell.copy()

    # [LAW:single-enforcer] Python snapshot capture owns ambient-screen style
    # normalization so compare-step consumers read one canonical content grid
    # instead of re-deriving blank-screen equivalence in multiple places.
    if normalized["background"] in AMBIENT_BACKGROUNDS:
        normalized["background"] = None

    is_blank = normalized["text"] == " " and normalized["continuation"] is False

    if is_blank and normalized["foreground"] in AMBIENT_FOREGROUNDS:
        normalized["foreground"] = None

    if is_blank and normalized["foreground"] is None and normalized["background"] is None:
        normalized["bold"] = False
        normalized["dim"] = False
        normalized["italic"] = False
        normalized["underline"] = False
        normalized["strikethrough"] = False
        normalized["inverse"] = False

    return normalized


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


def strips_to_ansi(strips: list[Any]) -> str:
    rows: list[str] = []

    for strip in strips:
        segments: list[str] = []

        for segment in strip._segments:
            style = normalize_style_for_terminal(getattr(segment, "style", None))
            text = segment.text
            segments.append(text if style is None else style.render(text))

        rows.append("".join(segments))

    return "\n".join(rows)


def normalize_style_for_terminal(style: Any) -> Style | None:
    if style is None:
        return None

    normalized_background = normalize_color(getattr(style, "bgcolor", None))

    # [LAW:one-source-of-truth] The capture window's default terminal colors are
    # the single ambient-screen source; Python frame export clears matching
    # screen background fills instead of inventing a second backdrop.
    if normalized_background in AMBIENT_BACKGROUNDS:
        return Style(
            color=getattr(style, "color", None),
            bgcolor=None,
            bold=bool(getattr(style, "bold", False)),
            dim=bool(getattr(style, "dim", False)),
            italic=bool(getattr(style, "italic", False)),
            underline=bool(getattr(style, "underline", False)),
            strike=bool(getattr(style, "strike", False)),
            reverse=bool(getattr(style, "reverse", False)),
        )

    return style


async def capture_fixture(fixture_path: Path) -> None:
    name = fixture_path.stem
    print(f"  Capturing: {name}")

    module = load_fixture(fixture_path)
    app_class = module.app
    app = app_class()

    ansi_path = SNAPSHOTS_DIR / f"{name}.ansi"
    json_path = SNAPSHOTS_DIR / f"{name}.json"
    txt_path = SNAPSHOTS_DIR / f"{name}.txt"

    async with app.run_test(size=(TERMINAL_WIDTH, TERMINAL_HEIGHT), tooltips=True, headless=True) as pilot:
        await pilot.pause()

        if hasattr(module, "capture"):
            await module.capture(pilot)

        strips = app.screen._compositor.render_strips()
        ansi_frame = strips_to_ansi(strips)
        styled_grid = strips_to_styled_grid(strips)
        text_grid = styled_grid_to_text(styled_grid)

        ansi_path.write_text(ansi_frame)
        json_path.write_text(json.dumps(styled_grid, indent=2) + "\n")
        txt_path.write_text(text_grid + ("\n" if text_grid else ""))

    print(f"    -> {ansi_path.relative_to(Path(__file__).parent)}")
    print(f"    -> {json_path.relative_to(Path(__file__).parent)}")
    print(f"    -> {txt_path.relative_to(Path(__file__).parent)}")


async def main(fixture_filter: str | None = None, include_todos: bool = False) -> None:
    SNAPSHOTS_DIR.mkdir(parents=True, exist_ok=True)

    fixtures = discover_fixtures(include_todos=include_todos)
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
    parser = argparse.ArgumentParser(description="Capture Python Textual visual fixtures.")
    parser.add_argument("fixture", nargs="?")
    parser.add_argument(
        "--include-todos",
        action="store_true",
        help="Include Python fixtures listed in fixture-todos.json.",
    )
    args = parser.parse_args()
    asyncio.run(main(args.fixture, include_todos=args.include_todos))
