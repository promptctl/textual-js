"""Fixture: CommandPalette opened via the default ctrl+backslash binding."""

from textual.app import App, ComposeResult
from textual.command import Hit, Hits, Provider
from textual.widgets import Static


class DemoCommands(Provider):
    async def search(self, query: str) -> Hits:
        for label in ("Open File", "Save File", "Quit Application"):
            score = self.matcher(query).match(label)
            if score > 0:
                yield Hit(score, label, lambda: None, help=f"Run: {label}")


class CommandPaletteOpenApp(App):
    COMMANDS = App.COMMANDS | {DemoCommands}

    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        yield Static("Background")

    def on_mount(self) -> None:
        self.action_command_palette()


app = CommandPaletteOpenApp

interactions = [
    {"type": "wait", "ms": 200},
]
