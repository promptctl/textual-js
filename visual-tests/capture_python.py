#!/usr/bin/env python3
"""
Capture screenshots from Python Textual fixtures.

Runs each fixture app headlessly at a fixed terminal size, then saves:
  - An SVG screenshot (for visual comparison)
  - A plain-text grid (for automated text diff)

Usage:
    python capture_python.py [fixture_name]

    Without arguments, captures all fixtures.
    With a fixture name, captures only that fixture.

Output goes to visual-tests/snapshots/python/<fixture_name>.svg
                                              <fixture_name>.txt
"""

import asyncio
import importlib.util

try:
    import textual  # noqa: F401
except ImportError:
    print("ERROR: textual is not installed. Run: pip install textual")
    raise SystemExit(1)

import sys
from pathlib import Path

FIXTURES_DIR = Path(__file__).parent / "fixtures"
SNAPSHOTS_DIR = Path(__file__).parent / "snapshots" / "python"

TERMINAL_WIDTH = 80
TERMINAL_HEIGHT = 24


def discover_fixtures() -> list[Path]:
    """Find all Python fixture files."""
    return sorted(FIXTURES_DIR.glob("*.py"))


def load_fixture(path: Path):
    """Import a fixture module and return the app class."""
    spec = importlib.util.spec_from_file_location(path.stem, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.app


async def capture_fixture(fixture_path: Path) -> None:
    """Run a fixture app headlessly and save screenshots."""
    name = fixture_path.stem
    print(f"  Capturing: {name}")

    app_class = load_fixture(fixture_path)
    app = app_class()

    svg_path = SNAPSHOTS_DIR / f"{name}.svg"
    txt_path = SNAPSHOTS_DIR / f"{name}.txt"

    async with app.run_test(size=(TERMINAL_WIDTH, TERMINAL_HEIGHT)) as pilot:
        await pilot.pause()

        # Save SVG screenshot
        svg_content = app.export_screenshot()
        svg_path.write_text(svg_content)

        # Save plain text grid — strip ANSI and capture the visible text
        # Use the app's console to render a text-only version
        lines = []
        for y in range(TERMINAL_HEIGHT):
            row_segments = []
            try:
                strip = app.screen._compositor.render_line(y)
                row_segments = [seg.text for seg in strip._segments]
            except (IndexError, AttributeError):
                pass
            lines.append("".join(row_segments).rstrip())

        # Remove trailing blank lines
        while lines and not lines[-1]:
            lines.pop()

        txt_path.write_text("\n".join(lines) + "\n")

    print(f"    -> {svg_path.relative_to(Path(__file__).parent)}")
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
        try:
            await capture_fixture(fixture_path)
        except Exception as e:
            print(f"  ERROR capturing {fixture_path.stem}: {e}")

    print(f"\nDone. Snapshots in: {SNAPSHOTS_DIR.relative_to(Path(__file__).parent)}/")


if __name__ == "__main__":
    fixture_name = sys.argv[1] if len(sys.argv) > 1 else None
    asyncio.run(main(fixture_name))
