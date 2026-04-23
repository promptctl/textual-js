#!/usr/bin/env python3
"""
Real-terminal runner for Python Textual fixtures.

Invoked inside an xterm that is running inside Xvfb inside Docker.
Imports the fixture module at `visual-tests/fixtures/<name>.py`, instantiates
its `app` class, and calls `.run()` — Textual's normal terminal entrypoint.

The app runs until the orchestrator kills the process from outside after the
screenshot is taken; no cooperative exit.
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

FIXTURES_DIR = Path(__file__).parent / "fixtures"


def _disable_cursor_blink() -> None:
    # Blinking cursors produce an infinite stream of non-identical frames,
    # which defeats screenshot-stability detection. The visual-test harness
    # treats blink as a test-environment adjustment (like disabling CSS
    # animations in Playwright) and forces it off for every fixture.
    from textual.widgets import Input, TextArea

    Input.cursor_blink = False
    TextArea.cursor_blink = False


def load_fixture(name: str):
    spec = importlib.util.spec_from_file_location(name, FIXTURES_DIR / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main(name: str) -> None:
    _disable_cursor_blink()
    module = load_fixture(name)
    # [LAW:one-source-of-truth] Fixtures declare `app = SomeApp` as the single
    # entrypoint; real-terminal rendering instantiates and runs that class.
    module.app().run()


if __name__ == "__main__":
    main(sys.argv[1])
