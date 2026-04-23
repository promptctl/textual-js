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
    # [LAW:single-enforcer] Disabling cursor blink is the visual-test
    # harness's responsibility, not each widget's. We walk the full Widget
    # subclass tree (after eagerly importing textual.widgets so all stock
    # widgets are registered) and rewrite the `_default` of any
    # `cursor_blink` Reactive descriptor we find. New blink-owning widgets
    # shipped upstream are handled automatically — no enumeration to drift.
    #
    # Why rewrite the descriptor default rather than replace the attribute:
    # `cursor_blink` is a Textual Reactive. Setting `Class.cursor_blink = False`
    # would clobber the descriptor with a literal, but the Reactive's own
    # storage on each instance still defaults to True via `_default`. Only
    # by mutating `_default` do new instances genuinely come up non-blinking.
    #
    # Why disable at all: blinking cursors produce an infinite stream of
    # non-identical frames, defeating screenshot-stability detection. This
    # is the test-environment analog of Playwright's `prefers-reduced-motion`.
    # textual.widgets uses TYPE_CHECKING-guarded imports + a lazy
    # __getattr__, so plain `import textual.widgets` registers nothing.
    # Force every name in __all__ to load so the Widget subclass tree is
    # complete before we walk it.
    import textual.widgets

    for name in textual.widgets.__all__:
        getattr(textual.widgets, name)

    from textual.widget import Widget

    pending = [Widget]
    seen: set[type] = set()
    while pending:
        cls = pending.pop()
        if cls in seen:
            continue
        seen.add(cls)
        descriptor = cls.__dict__.get("cursor_blink")
        if descriptor is not None and hasattr(descriptor, "_default"):
            descriptor._default = False
        pending.extend(cls.__subclasses__())


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
