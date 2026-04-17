#!/usr/bin/env python3
"""
Capture screenshots from Python Textual fixtures.

Runs each fixture app headlessly at a fixed terminal size, then saves:
  - An SVG screenshot (for visual comparison)
  - A plain-text grid (for automated text diff)

Must be run via uv from the visual-tests directory:
    uv run python capture_python.py [fixture_name]

uv resolves textual from pyproject.toml automatically.
"""

import asyncio
import importlib.util
import sys
from pathlib import Path

# Bare import — crashes immediately if textual is not available.
# This is intentional. The harness must never silently skip the Python side.
import textual  # noqa: F401

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

        # Save plain text grid — extract visible text from the compositor
        strips = app.screen._compositor.render_strips()
        lines = [
            "".join(seg.text for seg in strip._segments).rstrip()
            for strip in strips
        ]

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
        await capture_fixture(fixture_path)

    print(f"\nDone. Snapshots in: {SNAPSHOTS_DIR.relative_to(Path(__file__).parent)}/")


if __name__ == "__main__":
    fixture_name = sys.argv[1] if len(sys.argv) > 1 else None
    asyncio.run(main(fixture_name))
