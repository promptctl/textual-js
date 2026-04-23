"""Fixture: DirectoryTree rooted in a tmp dir with a small, stable set of files."""

import os
import tempfile

from textual.app import App, ComposeResult
from textual.widgets import DirectoryTree


# Create the temp directory at import time so its path is stable within this
# process and the tree can be constructed with it during compose.
_TMPDIR = tempfile.mkdtemp(prefix="textual_dirtree_")
for _name in ("alpha.txt", "beta.txt", "gamma.md"):
    with open(os.path.join(_TMPDIR, _name), "w") as _f:
        _f.write("x")
os.makedirs(os.path.join(_TMPDIR, "subdir"), exist_ok=True)


class DirectoryTreeBasicApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        yield DirectoryTree(path=_TMPDIR)


app = DirectoryTreeBasicApp

interactions = []
