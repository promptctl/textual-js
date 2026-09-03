#!/usr/bin/env python3
"""
Capture the cell-level record of Python Textual fixtures.

Runs each named fixture app headlessly at a fixed terminal size, then saves,
beside the PNG that Gate 4 measures:
  - <name>.ansi  the exact bytes Textual emitted, truecolor SGR and all
  - <name>.txt   the plain text of the frame

Together with the PNG these are one baseline: one frame, three representations,
captured under one environment (visual-tests/capture-env) and committed together.
Nothing here decides *which* fixtures have baselines — the caller passes the
names, and discover-fixtures.ts is the only place that set is derived.

Invoked by render_pngs.ts inside the fixture container. To reproduce that step by
hand, point uv at visual-tests/pyproject.toml the same way that caller does:
    uv run --project visual-tests python visual-tests/capture_python.py <fixture> ...
"""

from __future__ import annotations

import asyncio
import argparse
import importlib.util
import os
from pathlib import Path
from typing import Any

CAPTURE_ENV_PATH = Path(__file__).parent / "capture-env"


def load_capture_env() -> tuple[dict[str, str], list[str]]:
    """Parse the shared capture environment into (set, unset). See visual-tests/capture-env."""
    entries: dict[str, str] = {}
    removals: list[str] = []
    for number, line in enumerate(CAPTURE_ENV_PATH.read_text().splitlines(), start=1):
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if stripped.startswith("-"):
            removals.append(stripped[1:].strip())
            continue
        # [LAW:no-silent-failure] A malformed line means the capture environment
        # is not what anyone thinks it is; every baseline downstream would be
        # wrong in a way no diff shows. Refuse rather than skip the line.
        if "=" not in stripped:
            raise ValueError(
                f"{CAPTURE_ENV_PATH}:{number}: expected KEY=VALUE or -KEY, got {stripped!r}"
            )
        key, value = stripped.split("=", 1)
        entries[key.strip()] = value.strip()
    return entries, removals


# Applied unconditionally, overriding the ambient shell: a developer who happens
# to export TEXTUAL_ANIMATIONS would otherwise capture a baseline nobody else can
# reproduce. Must run before importing textual, which reads its env at import time.
_capture_env, _capture_env_removals = load_capture_env()
os.environ.update(_capture_env)
for _name in _capture_env_removals:
    os.environ.pop(_name, None)

import textual  # noqa: E402,F401
from rich.cells import cell_len
from rich.style import Style

FIXTURES_DIR = Path(__file__).parent / "fixtures"
SNAPSHOTS_DIR = Path(__file__).parent / "snapshots" / "python"

TERMINAL_WIDTH = 80
TERMINAL_HEIGHT = 24
AMBIENT_BACKGROUNDS = {"#121212"}
AMBIENT_FOREGROUNDS = {"#e0e0e0"}


def resolve_fixture(name: str) -> Path:
    path = FIXTURES_DIR / f"{name}.py"
    # [LAW:no-silent-failure] A name with no fixture means the caller's fixture
    # list and this directory disagree. Skipping it would leave a stale cell record
    # sitting beside a fresh PNG — exactly the divergence this script exists to
    # avoid — and the run would still report success.
    if not path.is_file():
        raise FileNotFoundError(f"no Python fixture at {path}")
    return path


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
        txt_path.write_text(text_grid + ("\n" if text_grid else ""))

    print(f"    -> {ansi_path.relative_to(Path(__file__).parent)}")
    print(f"    -> {txt_path.relative_to(Path(__file__).parent)}")


async def main(names: list[str]) -> None:
    SNAPSHOTS_DIR.mkdir(parents=True, exist_ok=True)

    fixtures = [resolve_fixture(name) for name in names]

    print(f"Capturing {len(fixtures)} Python Textual fixture(s)...\n")

    for fixture_path in fixtures:
        await capture_fixture(fixture_path)

    print(f"\nDone. Snapshots in: {SNAPSHOTS_DIR.relative_to(Path(__file__).parent)}/")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description=(
            "Capture the cell-level record of Python Textual fixtures. Fixture names are "
            "supplied by the caller; discover-fixtures.ts owns which fixtures have baselines, "
            "so this script never re-derives that set."
        ),
    )
    parser.add_argument("fixtures", nargs="+", metavar="FIXTURE")
    args = parser.parse_args()
    asyncio.run(main(args.fixtures))
